# Especificación Técnica Detallada — ecom-analytics

> Documento complementario a PLAN-ARQUITECTURA-v2.md.
> Aquí se define el "cómo" de cada subsistema complejo.

---

## FASE 1: SYNC ENGINE — Extracción de datos, OAuth, sincronización incremental

### 1.1 Tiendanube — OAuth y API

**Flujo de conexión (una sola vez por tienda):**

1. El usuario hace click en "Conectar TiendaNube" en Settings
2. Se redirige a `https://www.tiendanube.com/apps/{APP_ID}/authorize?state={csrf_token}`
3. El usuario autoriza → TN redirige a nuestro callback con `?code=XXXXX` (expira en 5 min)
4. Backend hace `POST https://www.tiendanube.com/apps/authorize/token` con:
   ```json
   {
     "client_id": "APP_ID",
     "client_secret": "APP_SECRET",
     "grant_type": "authorization_code",
     "code": "XXXXX"
   }
   ```
5. Recibimos `{ access_token, token_type: "bearer", scope, user_id }` → guardamos en `Store.tnAccessToken` y `Store.tnStoreId`

**Dato clave**: el token de TN **NO expira**. Solo se invalida si se genera uno nuevo o si el usuario desinstala la app. No hay refresh token. Esto simplifica mucho el flujo.

**Scopes necesarios**: `read_orders`, `read_products`, `read_customers`

**Endpoints que usamos:**

| Recurso | Endpoint | Filtro incremental | Campos clave |
|---------|----------|-------------------|--------------|
| Órdenes | `GET /v1/{store_id}/orders` | `updated_at_min` (ISO 8601) | `total`, `subtotal`, `discount`, `shipping_cost_customer`, `shipping_cost_owner`, `gateway`, `gateway_name`, `payment_status`, `payment_details.method`, `payment_details.installments`, `paid_at`, `customer`, `products`, `status` |
| Productos | `GET /v1/{store_id}/products` | `updated_at_min` (ISO 8601) | `name`, `variants[].price`, `variants[].stock`, `variants[].sku`, `brand`, `categories`, `tags` |
| Clientes | `GET /v1/{store_id}/customers` | `updated_at_min` (ISO 8601) | `name`, `email`, `total_ordered`, `last_order_id`, `created_at` |

**Paginación**: page-based (no cursor). Default 30 items, max configurable. Se itera con `page=1,2,3...` hasta que la respuesta tenga menos items que `per_page`. Límite absoluto de la API: 10,000 items por query. Si se excede, hay que achicar el rango de fechas.

**Rate limits**: TN no documenta límites explícitos, pero en la práctica se recomienda no exceder ~2 req/seg. Implementamos delay de 500ms entre pages como safety.

**Sync incremental — cómo funciona:**

```js
// syncTiendanubeOrders.js
async function syncOrders(store) {
  const lastSync = store.integrationStatus.tiendanube.lastSync || new Date(0);
  let page = 1;
  let hasMore = true;
  const perPage = 200; // máximo práctico

  while (hasMore) {
    const orders = await tnAPI.get(`/${store.tnStoreId}/orders`, {
      params: {
        updated_at_min: lastSync.toISOString(),
        per_page: perPage,
        page: page,
        status: 'any',
        fields: 'id,number,total,subtotal,discount,shipping_cost_customer,shipping_cost_owner,gateway,gateway_name,payment_status,payment_details,paid_at,customer,products,status,created_at,updated_at,cancelled_at'
      },
      headers: {
        'Authentication': `bearer ${store.tnAccessToken}`,
        'User-Agent': 'ecom-analytics (lucasvar@gmail.com)'
      }
    });

    for (const order of orders.data) {
      await Order.findOneAndUpdate(
        { storeId: store._id, tnOrderId: order.id },
        { ...mapTnOrderToSchema(order) },
        { upsert: true, new: true }
      );
    }

    hasMore = orders.data.length === perPage;
    page++;
    await sleep(500); // rate limit safety
  }

  // Actualizar timestamp de último sync
  store.integrationStatus.tiendanube.lastSync = new Date();
  await store.save();

  // Log
  await SyncLog.create({
    storeId: store._id,
    type: 'tiendanube_orders',
    status: 'success',
    recordsFetched: totalRecords,
    duration: Date.now() - startTime
  });
}
```

**Mapeo de orden TN → nuestro modelo Order:**

```js
function mapTnOrderToSchema(tnOrder) {
  return {
    tnOrderNumber: tnOrder.number,
    customerName: tnOrder.customer?.name,
    customerEmail: tnOrder.customer?.email,
    totalOrden: parseFloat(tnOrder.total),
    subtotal: parseFloat(tnOrder.subtotal),
    descuento: parseFloat(tnOrder.discount || 0),
    costoEnvio: parseFloat(tnOrder.shipping_cost_owner || 0),
    gateway: tnOrder.gateway_name,
    medioPago: tnOrder.payment_details?.method,
    cantidadCuotas: tnOrder.payment_details?.installments || 1,
    paymentStatus: tnOrder.payment_status,
    paidAt: tnOrder.paid_at ? new Date(tnOrder.paid_at) : null,
    status: tnOrder.status,
    canal: 'tiendanube',
    createdAt: new Date(tnOrder.created_at),
    updatedAt: new Date(tnOrder.updated_at),
    // Estos se CALCULAN después del mapeo, no vienen de TN:
    // comisionPago, impuestosIBB, comisionCuotas, feePlataforma, costoProductos, totalNeto
  };
}
```

**Campos que NO vienen de la API y se calculan localmente:**
- `comisionPago` → se calcula con `Store.comisionPagoConfig` según gateway + cuotas
- `impuestosIBB` → `totalOrden × Store.tasaIBB / 100`
- `comisionCuotas` → según tabla en `Store.comisionPagoConfig`
- `feePlataforma` → `totalOrden × Store.feePlataformaPct / 100`
- `costoProductos` → suma de `Product.costoUnitario × quantity` por cada line item
- `totalNeto` → `totalOrden - comisionPago - impuestosIBB - comisionCuotas - feePlataforma - costoEnvio - costoProductos`
- `liquidable` → `totalOrden - comisionPago - comisionCuotas - feePlataforma`
- `esClienteNuevo` → se determina buscando si el customer tiene órdenes previas

**Post-sync hooks** (corren después de cada sync):
1. `calculateOrderFinancials(order, store)` — calcula todos los campos derivados
2. `updateCustomerStatus(order)` — marca `esClienteNuevo`, actualiza `Customer.totalOrders`
3. `updateDailyMetric(order)` — agrega/actualiza la fila del día en DailyMetric

---

### 1.2 Meta Ads — OAuth y Marketing API

**Flujo de conexión:**

1. El usuario hace click en "Conectar Meta Ads" en Settings
2. Se redirige a `https://www.facebook.com/v25.0/dialog/oauth?client_id={APP_ID}&redirect_uri={CALLBACK}&scope=ads_read,ads_management&state={csrf}`
3. El usuario autoriza → Meta redirige con `?code=XXXXX`
4. Backend intercambia por short-lived token:
   ```
   GET https://graph.facebook.com/v25.0/oauth/access_token?
     client_id={APP_ID}&
     client_secret={APP_SECRET}&
     redirect_uri={CALLBACK}&
     code={CODE}
   ```
5. Intercambiar por long-lived token (60 días):
   ```
   GET https://graph.facebook.com/v25.0/oauth/access_token?
     grant_type=fb_exchange_token&
     client_id={APP_ID}&
     client_secret={APP_SECRET}&
     fb_exchange_token={SHORT_TOKEN}
   ```
6. Guardar en `Store.metaAccessToken` + `Store.metaTokenExpiresAt`

**Dato clave**: el long-lived token **EXPIRA en 60 días**. Hay que implementar un refresh automático. El refresh se hace con el mismo endpoint de exchange ANTES de que expire. Implementamos un cron que 7 días antes de vencer intenta renovar. Si falla, se crea una Alert avisando que el usuario tiene que reconectar.

**Scopes necesarios**: `ads_read` (read-only de campañas y insights)

**Endpoints que usamos:**

| Recurso | Endpoint | Uso |
|---------|----------|-----|
| Campañas | `GET /act_{ad_account_id}/campaigns?fields=name,status,objective,daily_budget,lifetime_budget` | Sync de estructura |
| Ad Sets | `GET /act_{ad_account_id}/adsets?fields=name,status,campaign_id,targeting,daily_budget,optimization_goal` | Sync de estructura |
| Ads | `GET /act_{ad_account_id}/ads?fields=name,status,adset_id,creative{thumbnail_url,body,title}` | Sync de estructura + thumbnails |
| Insights (daily) | `GET /{object_id}/insights?fields={metrics}&time_range={range}&time_increment=1` | Métricas por día |

**Campos de Insights que pedimos:**

```js
const INSIGHT_FIELDS = [
  'spend',
  'impressions',
  'reach',
  'clicks',
  'unique_clicks',
  'cpm',
  'cpc',
  'ctr',
  'actions',           // array de {action_type, value}
  'action_values',     // array de {action_type, value} — revenue por tipo
  'cost_per_action_type',
  'video_avg_time_watched_actions',
  'video_p25_watched_actions',
  'video_p50_watched_actions',
  'video_p75_watched_actions',
  'video_p100_watched_actions',
];
```

**Extraer purchases del array `actions`:**

```js
function extractPurchases(actions) {
  if (!actions) return { purchases: 0, atc: 0, checkouts: 0 };
  return {
    purchases: findAction(actions, 'purchase') || findAction(actions, 'offsite_conversion.fb_pixel_purchase') || 0,
    atc: findAction(actions, 'offsite_conversion.fb_pixel_add_to_cart') || 0,
    checkouts: findAction(actions, 'offsite_conversion.fb_pixel_initiate_checkout') || 0,
  };
}

function findAction(actions, type) {
  const found = actions.find(a => a.action_type === type);
  return found ? parseInt(found.value) : 0;
}

function extractPurchaseValue(actionValues) {
  if (!actionValues) return 0;
  const found = actionValues.find(a => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase');
  return found ? parseFloat(found.value) : 0;
}
```

**Rate limiting de Meta — sistema de puntos:**

| Tier | Puntos máx | Ventana | Bloqueo si excede |
|------|-----------|---------|-------------------|
| Development | 60 | 300 seg | 300 seg |
| Standard | 9,000 | 300 seg | 60 seg |

- Read = 1 punto, Write = 3 puntos
- **ads_insights** tiene su propio bucket: 600 (dev) o 190,000 (standard) + 400 × ads activos por hora
- Headers de respuesta `X-FB-Ads-Insights-Throttle` y `X-Ad-Account-Usage` indican uso actual

**Estrategia anti-throttle:**

```js
async function fetchInsightsWithBackoff(objectId, params, token, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await metaAPI.get(`/${objectId}/insights`, { params, token });

    // Verificar throttle headers
    const throttle = JSON.parse(res.headers['x-fb-ads-insights-throttle'] || '{}');
    if (throttle.acc_id_util_pct > 75) {
      const waitTime = Math.min(60000 * (attempt + 1), 180000); // 1min, 2min, 3min
      await sleep(waitTime);
    }

    if (res.status === 429) {
      const waitTime = 60000 * (attempt + 1);
      await sleep(waitTime);
      continue;
    }

    return res.data;
  }
  throw new Error(`Meta API rate limited after ${retries} retries`);
}
```

**Sync incremental de Meta — lógica:**

Meta no tiene `updated_at_min` para insights. El approach es:
1. Siempre pedir los **últimos 3 días** completos (Meta puede tardar hasta 72h en consolidar datos de attribution windows)
2. Hacer UPSERT en `MetaDailyInsight` por `{storeId, metaId, date}` — si ya existe, sobreescribe
3. Para sync inicial (primera vez), pedir últimos 90 días con async report

```js
async function syncMetaInsights(store) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 3); // últimos 3 días siempre

  // Sync por niveles: campaign > adset > ad
  for (const level of ['campaign', 'adset', 'ad']) {
    const objects = await MetaCampaign.find({
      storeId: store._id,
      level: level,
      status: { $in: ['ACTIVE', 'PAUSED'] } // no pedir datos de archivados
    });

    for (const obj of objects) {
      const insights = await fetchInsightsWithBackoff(obj.metaId, {
        fields: INSIGHT_FIELDS.join(','),
        time_range: JSON.stringify({
          since: formatDate(startDate),
          until: formatDate(endDate)
        }),
        time_increment: 1, // desglose diario
      }, store.metaAccessToken);

      for (const dayData of insights) {
        const { purchases, atc, checkouts } = extractPurchases(dayData.actions);
        const purchaseValue = extractPurchaseValue(dayData.action_values);

        await MetaDailyInsight.findOneAndUpdate(
          { storeId: store._id, metaId: obj.metaId, date: new Date(dayData.date_start) },
          {
            spend: parseFloat(dayData.spend) * store.cotizacionDolar, // USD → ARS
            impressions: parseInt(dayData.impressions),
            reach: parseInt(dayData.reach || 0),
            clicks: parseInt(dayData.clicks),
            uniqueClicks: parseInt(dayData.unique_clicks || 0),
            cpm: parseFloat(dayData.cpm || 0),
            cpc: parseFloat(dayData.cpc || 0),
            ctr: parseFloat(dayData.ctr || 0),
            purchases,
            purchaseValue: purchaseValue * store.cotizacionDolar, // USD → ARS
            atc,
            checkouts,
            // Video metrics
            videoAvgWatched: extractVideoMetric(dayData, 'video_avg_time_watched_actions'),
            videoP25: extractVideoMetric(dayData, 'video_p25_watched_actions'),
            videoP50: extractVideoMetric(dayData, 'video_p50_watched_actions'),
            videoP75: extractVideoMetric(dayData, 'video_p75_watched_actions'),
            videoP100: extractVideoMetric(dayData, 'video_p100_watched_actions'),
          },
          { upsert: true }
        );
      }
      await sleep(200); // spacing entre requests
    }
  }
}
```

**Refresh automático del token Meta:**

```js
// Corre como cron job diario
async function refreshMetaTokens() {
  const stores = await Store.find({
    'metaAccessToken': { $exists: true },
    'metaTokenExpiresAt': { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } // expira en <7 días
  });

  for (const store of stores) {
    try {
      const res = await axios.get('https://graph.facebook.com/v25.0/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          fb_exchange_token: store.metaAccessToken,
        }
      });
      store.metaAccessToken = res.data.access_token;
      store.metaTokenExpiresAt = new Date(Date.now() + res.data.expires_in * 1000);
      await store.save();
    } catch (err) {
      // Token ya no se puede renovar → crear alerta
      await Alert.create({
        storeId: store._id,
        tipo: 'integration_error',
        descripcion: `Token de Meta Ads expirado. Reconectar en Settings.`,
        severidad: 'critical',
        estado: 'active'
      });
    }
  }
}
```

---

### 1.3 Carga manual (fallback y complemento)

Siempre disponible como alternativa o complemento a la API:

**CSV de órdenes (import histórico):**
- Endpoint: `POST /api/store/{id}/orders/import`
- Formato esperado: CSV con columnas `order_id, date, total, customer_email, customer_name, payment_method, installments, shipping_cost, status`
- Validación: papaparse parsea → validar columnas requeridas → detectar duplicados por order_id → insertar faltantes
- Uso: cargar histórico pre-conexión API o datos de períodos donde la API no alcanza

**CSV de productos con costos (COGS):**
- Endpoint: `POST /api/store/{id}/products/costs`
- Formato esperado: CSV con columnas `sku, costo_unitario` (mínimo) o `sku, costo_unitario, proveedor, moneda`
- Validación: parsear → matchear SKU con productos existentes → reportar no-encontrados → actualizar `Product.costoUnitario`
- Trigger: después del upload, recalcular `costoProductos` en todas las órdenes que contengan esos SKUs

**CSV de Meta Ads (export desde Ads Manager):**
- Endpoint: `POST /api/store/{id}/meta/import`
- Formato esperado: export estándar de Meta Ads Manager (columnas: Campaign name, Ad set name, Ad name, Impressions, Clicks, Spend, etc.)
- Mapeo: las columnas de Meta se mapean automáticamente a nuestro schema MetaDailyInsight

**Implementación del upload:**

```js
// routes/uploadRoutes.js
const multer = require('multer');
const upload = multer({ dest: 'uploads/', limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

router.post('/store/:storeId/products/costs', upload.single('file'), async (req, res) => {
  const file = req.file;
  const store = req.store; // del middleware storeContext

  const csvText = fs.readFileSync(file.path, 'utf-8');
  const { data, errors } = Papa.parse(csvText, { header: true, skipEmptyLines: true });

  if (errors.length > 0) return res.status(400).json({ errors });

  const results = { updated: 0, notFound: [], invalid: [] };

  for (const row of data) {
    if (!row.sku || !row.costo_unitario) {
      results.invalid.push(row);
      continue;
    }

    const product = await Product.findOne({ storeId: store._id, 'variants.sku': row.sku });
    if (!product) {
      results.notFound.push(row.sku);
      continue;
    }

    // Actualizar costo en la variante que matchea
    const variant = product.variants.find(v => v.sku === row.sku);
    variant.costoUnitario = parseFloat(row.costo_unitario);
    await product.save();
    results.updated++;
  }

  // Trigger recálculo de órdenes afectadas
  await recalculateOrderCosts(store._id, data.map(r => r.sku));

  fs.unlinkSync(file.path); // limpiar archivo temporal
  res.json(results);
});
```

---

### 1.4 Cron Jobs — Orquestación

**Definición en `cronManager.js`:**

```js
const cron = require('node-cron');

module.exports = function setupCrons() {
  // Sync TiendaNube orders — cada 4 horas
  cron.schedule('0 */4 * * *', () => runJob('syncTnOrders', syncAllTnOrders));

  // Sync TiendaNube products — cada 12 horas
  cron.schedule('0 */12 * * *', () => runJob('syncTnProducts', syncAllTnProducts));

  // Sync Meta campaign structure — cada 12 horas
  cron.schedule('30 */12 * * *', () => runJob('syncMetaStructure', syncAllMetaStructure));

  // Sync Meta insights — cada 6 horas
  cron.schedule('0 1,7,13,19 * * *', () => runJob('syncMetaInsights', syncAllMetaInsights));

  // Recálculo de DailyMetric — después de cada sync (triggered, no cron)
  // Se llama como post-hook de syncTnOrders y syncMetaInsights

  // Refresh tokens Meta — 1x por día a las 2am
  cron.schedule('0 2 * * *', () => runJob('refreshMetaTokens', refreshMetaTokens));

  // Diagnósticos y alertas — cada 6 horas
  cron.schedule('30 0,6,12,18 * * *', () => runJob('diagnostics', runDiagnostics));

  // Cleanup — 1x por día a las 3am
  cron.schedule('0 3 * * *', () => runJob('cleanup', runCleanup));
};

async function runJob(name, fn) {
  const startTime = Date.now();
  try {
    const stores = await Store.find({});
    for (const store of stores) {
      await fn(store);
    }
    await SyncLog.create({ type: name, status: 'success', duration: Date.now() - startTime });
  } catch (error) {
    await SyncLog.create({ type: name, status: 'error', error: error.message, duration: Date.now() - startTime });
    console.error(`[CRON] ${name} failed:`, error);
  }
}
```

**Configuración de frecuencia por tienda:**

En el modelo Store, se agrega:

```js
syncConfig: {
  tnOrdersInterval: { type: String, default: '0 */4 * * *' },    // cada 4h
  metaInsightsInterval: { type: String, default: '0 1,7,13,19 * * *' }, // cada 6h
  autoSync: { type: Boolean, default: true },  // on/off global
}
```

La UI en Settings muestra un selector: "Cada 2h / 4h / 6h / 12h / Manual only" que se traduce a la expresión cron correspondiente.

**Botón "Sincronizar ahora":**

```js
router.post('/store/:storeId/sync/now', async (req, res) => {
  const { type } = req.body; // 'tiendanube' | 'meta' | 'all'
  // Encolar sync inmediato (no bloquea la respuesta)
  setImmediate(async () => {
    if (type === 'tiendanube' || type === 'all') await syncTnOrders(req.store);
    if (type === 'meta' || type === 'all') await syncMetaInsights(req.store);
    await recalculateDailyMetrics(req.store);
  });
  res.json({ status: 'sync_started' });
});
```

---

### 1.5 Error handling y resiliencia

**Retry con backoff exponencial:**

```js
async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      if (error.response?.status === 429) {
        // Rate limited — esperar más
        const delay = baseDelay * Math.pow(3, attempt); // 1s, 3s, 9s
        await sleep(delay);
      } else if (error.response?.status >= 500) {
        // Server error — retry con backoff normal
        const delay = baseDelay * Math.pow(2, attempt); // 1s, 2s, 4s
        await sleep(delay);
      } else {
        throw error; // 4xx (excepto 429) no se retries
      }
    }
  }
}
```

**Sync parcial (no pierde progreso):**

Si el sync se interrumpe a mitad (crash, timeout), la próxima ejecución retoma desde `lastSync`. Las órdenes ya guardadas se sobreescriben vía UPSERT (idempotente). No hay riesgo de duplicados ni de datos perdidos.

**Alertas de integración:**

| Situación | Alerta | Severidad |
|-----------|--------|-----------|
| Token Meta expira en <7 días | "Reconectar Meta Ads" | warning |
| Token Meta expirado / inválido | "Meta Ads desconectado" | critical |
| TN retorna 401 (token inválido) | "Reconectar TiendaNube" | critical |
| Sync falla 3 veces seguidas | "Sync {tipo} fallando" | warning |
| API retorna 0 órdenes por 48h+ | "Sin órdenes nuevas hace 48h" | warning |

---

### 1.6 Nuevas plataformas — Patrón de extensión

Agregar una plataforma nueva (ej: MercadoLibre, Google Ads) sigue este checklist:

1. **Crear `{platform}API.js`** en `/backend/src/services/` con métodos `connect()`, `refreshToken()`, `fetchOrders()`, `fetchInsights()`
2. **Agregar campos al modelo Store**: `mlAccessToken`, `mlRefreshToken`, `mlTokenExpiresAt`, `mlUserId`
3. **Agregar a `integrationStatus`**: `mercadolibre: { connected, lastSync }`
4. **Crear controller + route** para OAuth callback
5. **Agregar cron job** en `cronManager.js`
6. **Mapear datos al modelo existente**: `Order.canal = 'mercadolibre'`, `MetaDailyInsight` equivalente si aplica
7. **Agregar card de integración** en Settings del frontend
8. **Agregar CSV import** como fallback manual

El modelo de datos está preparado: `Order.canal` distingue la fuente, `DailyMetric` agrega todo junto, y el frontend filtra por canal cuando es necesario (ej: tabla de Marketing Mix en Dashboard).

---

## FASE 2: MOTOR DE CÁLCULOS — Fórmulas, DailyMetric, breakeven, NC/RC, Cashflow

### 2.1 Arquitectura del motor

El cálculo NO ocurre en el frontend. Toda la lógica vive en el backend en un servicio `metricCalculator.js` que se invoca en dos momentos:

1. **Post-sync** — después de que `syncTnOrders` o `syncMetaInsights` terminan, se recalculan las métricas del día afectado
2. **On-demand** — cuando el frontend pide métricas para un rango de fechas, el backend hace aggregation sobre `DailyMetric` (ya pre-calculado)

Esto significa que el frontend NUNCA hace cuentas. Pide datos ya procesados. Y la colección `DailyMetric` actúa como una **tabla de hechos pre-agregada** (similar a un data warehouse en miniatura).

---

### 2.2 Cálculos a nivel de orden individual

Cuando una orden se sincroniza o actualiza, se ejecuta `calculateOrderFinancials()`. Este es el cálculo más importante de toda la app porque todo lo demás se deriva de acá.

```js
// services/metricCalculator.js

async function calculateOrderFinancials(order, store) {
  // 1. Comisión de pago — buscar en config de la tienda
  const comisionConfig = store.comisionPagoConfig.find(c =>
    c.medioPago === mapGatewayToMedioPago(order.gateway) &&
    c.cuotas === order.cantidadCuotas
  );
  // Fallback: si no hay config exacta, buscar la de cuotas=1 del mismo medio
  const fallback = store.comisionPagoConfig.find(c =>
    c.medioPago === mapGatewayToMedioPago(order.gateway) && c.cuotas === 1
  );
  const config = comisionConfig || fallback;

  order.comisionPago = config
    ? order.totalOrden * (config.comisionBase / 100)
    : 0;

  // 2. Comisión de cuotas — adicional si hay cuotas > 1
  order.comisionCuotas = (config && order.cantidadCuotas > 1)
    ? order.totalOrden * (config.comisionCuotas / 100)
    : 0;

  // 3. Impuestos IBB
  order.impuestosIBB = order.totalOrden * (store.tasaIBB / 100);

  // 4. Fee plataforma (TiendaNube)
  order.feePlataforma = order.totalOrden * (store.feePlataformaPct / 100);

  // 5. Costo de productos — requiere lookup de cada line item
  order.costoProductos = 0;
  for (const item of order.lineItems) {
    const product = await Product.findOne({
      storeId: store._id,
      'variants.sku': item.sku
    }).lean();
    if (product) {
      const variant = product.variants.find(v => v.sku === item.sku);
      order.costoProductos += (variant?.costoUnitario || 0) * item.quantity;
    }
    // Si no hay producto o no tiene costo cargado, queda en 0
    // El InsightBar de Costos va a detectar esto y avisar "X productos sin costo asignado"
  }

  // 6. Costo de envío — ya viene de TN (shipping_cost_owner)
  // order.costoEnvio ya está seteado desde el mapeo

  // 7. TOTAL NETO — la fórmula central
  order.totalNeto = order.totalOrden
    - order.comisionPago
    - order.impuestosIBB
    - order.comisionCuotas
    - order.feePlataforma
    - order.costoEnvio
    - order.costoProductos;

  // 8. Liquidable — lo que efectivamente se acredita (antes de COGS y envío)
  order.liquidable = order.totalOrden
    - order.comisionPago
    - order.comisionCuotas
    - order.feePlataforma;

  await order.save();
}
```

**Tabla de mapeo gateway → medio de pago:**

```js
function mapGatewayToMedioPago(gateway) {
  const map = {
    'Mercado Pago': 'mercadopago',
    'mercadopago': 'mercadopago',
    'Todo Pago': 'todopago',
    'Mobbex': 'mobbex',
    'PayWay': 'payway',
    // Tarjetas directas (si el gateway reporta marca)
    'visa': 'visa',
    'mastercard': 'mastercard',
    'amex': 'amex',
    'Transferencia bancaria': 'transferencia',
  };
  return map[gateway] || 'otro';
}
```

---

### 2.3 Detección NC/RC (Nuevo Cliente vs Recurrente)

Se ejecuta como post-hook de cada orden sincronizada. La lógica es:

```js
async function classifyCustomer(order, store) {
  // Buscar si el cliente tiene órdenes PREVIAS a esta
  const previousOrders = await Order.countDocuments({
    storeId: store._id,
    customerEmail: order.customerEmail,
    createdAt: { $lt: order.createdAt },
    status: { $ne: 'cancelled' }
  });

  order.esClienteNuevo = previousOrders === 0;
  await order.save();

  // Actualizar o crear el Customer doc
  await Customer.findOneAndUpdate(
    { storeId: store._id, email: order.customerEmail },
    {
      $set: {
        name: order.customerName,
        lastOrderDate: order.createdAt,
      },
      $inc: { totalOrders: 1, totalSpent: order.totalOrden },
      $setOnInsert: {
        firstPurchase: order.createdAt,
        cohortMonth: formatMonth(order.createdAt), // '2026-03'
      }
    },
    { upsert: true, new: true }
  );
}
```

**Caso edge importante**: si se hace un sync histórico (import CSV de 12 meses), las órdenes se procesan en orden cronológico para que `esClienteNuevo` sea correcto. Si se procesaran desordenadas, la primera orden cronológica podría marcarse como "recurrente" si una orden posterior ya fue procesada.

```js
// En syncTnOrders, siempre ordenar por fecha antes de procesar
const orders = ordersFromApi.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
```

---

### 2.4 DailyMetric — Tabla de hechos pre-agregada

Esta colección es el corazón del rendimiento. Una fila por tienda por día con TODAS las métricas ya calculadas.

**Schema completo:**

```js
const DailyMetricSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  date: { type: Date, required: true },

  // === VENTAS (de Orders) ===
  ordenes: Number,              // total de órdenes (incluye $0)
  ordenesPositivas: Number,     // órdenes con total > $0
  revenue: Number,              // sum(totalOrden) — órdenes positivas
  netRevenue: Number,           // sum(totalNeto)
  aov: Number,                  // revenue / ordenesPositivas
  aovNeto: Number,              // netRevenue / ordenesPositivas
  devoluciones: Number,         // count(status === 'cancelled' o 'refunded')

  // === COSTOS (de Orders) ===
  costoProductos: Number,       // sum(costoProductos)
  costoEnvio: Number,           // sum(costoEnvio)
  comisionPago: Number,         // sum(comisionPago)
  comisionCuotas: Number,       // sum(comisionCuotas)
  impuestosIBB: Number,         // sum(impuestosIBB)
  feePlataforma: Number,        // sum(feePlataforma)

  // === PROFIT ===
  profit: Number,               // netRevenue (ya neto de todo)
  profitMargin: Number,         // (netRevenue / revenue) × 100

  // === NC/RC (de Orders.esClienteNuevo) ===
  ncOrdenes: Number,            // count(esClienteNuevo === true)
  ncRevenue: Number,            // sum(totalOrden donde esClienteNuevo)
  ncNetRevenue: Number,         // sum(totalNeto donde esClienteNuevo)
  rcOrdenes: Number,            // ordenesPositivas - ncOrdenes
  rcRevenue: Number,            // revenue - ncRevenue
  ncPct: Number,                // (ncOrdenes / ordenesPositivas) × 100

  // === META ADS (de MetaDailyInsight, agregado por día) ===
  adSpend: Number,              // sum(MetaDailyInsight.spend) — ya en ARS
  impressions: Number,
  reach: Number,
  clicks: Number,
  metaPurchases: Number,        // purchases atribuidas por Meta
  metaPurchaseValue: Number,    // revenue atribuido por Meta (en ARS)

  // === DERIVADOS (calculados al momento de generar este doc) ===
  roas: Number,                 // revenue / adSpend
  trueRoas: Number,             // netRevenue / adSpend
  cpa: Number,                  // adSpend / ordenesPositivas
  trueCpa: Number,              // adSpend / (ordenesPositivas que generaron profit >0)
  ncCpa: Number,                // adSpend / ncOrdenes
  ncRoas: Number,               // ncRevenue / adSpend
  ncTrueRoas: Number,           // ncNetRevenue / adSpend
  cpc: Number,                  // adSpend / clicks
  ctr: Number,                  // (clicks / impressions) × 100
  cpm: Number,                  // (adSpend / impressions) × 1000
  conversionRate: Number,       // (ordenesPositivas / clicks) × 100

  // === CASHFLOW (de CashflowEntry) ===
  liquidable: Number,           // sum(liquidable) del día
  pagosRecibidos: Number,       // sum(liquidable) donde fechaPago = hoy y estado = 'recibido'
  pagosPendientes: Number,      // sum(liquidable) donde estado = 'pendiente'

}, {
  timestamps: true,
  // Índice compuesto único — una sola fila por tienda por día
});

DailyMetricSchema.index({ storeId: 1, date: 1 }, { unique: true });
// Índice para queries por rango de fechas
DailyMetricSchema.index({ storeId: 1, date: -1 });
```

**Función de recálculo:**

```js
async function recalculateDailyMetric(storeId, date) {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  // 1. Agregar órdenes del día
  const orderAgg = await Order.aggregate([
    {
      $match: {
        storeId: mongoose.Types.ObjectId(storeId),
        createdAt: { $gte: dayStart, $lte: dayEnd },
        status: { $nin: ['cancelled'] }
      }
    },
    {
      $group: {
        _id: null,
        ordenes: { $sum: 1 },
        ordenesPositivas: { $sum: { $cond: [{ $gt: ['$totalOrden', 0] }, 1, 0] } },
        revenue: { $sum: { $cond: [{ $gt: ['$totalOrden', 0] }, '$totalOrden', 0] } },
        netRevenue: { $sum: '$totalNeto' },
        costoProductos: { $sum: '$costoProductos' },
        costoEnvio: { $sum: '$costoEnvio' },
        comisionPago: { $sum: '$comisionPago' },
        comisionCuotas: { $sum: '$comisionCuotas' },
        impuestosIBB: { $sum: '$impuestosIBB' },
        feePlataforma: { $sum: '$feePlataforma' },
        liquidable: { $sum: '$liquidable' },
        // NC/RC
        ncOrdenes: { $sum: { $cond: ['$esClienteNuevo', 1, 0] } },
        ncRevenue: { $sum: { $cond: ['$esClienteNuevo', '$totalOrden', 0] } },
        ncNetRevenue: { $sum: { $cond: ['$esClienteNuevo', '$totalNeto', 0] } },
      }
    }
  ]);

  const o = orderAgg[0] || getEmptyOrderAgg();

  // 2. Agregar devoluciones
  const devoluciones = await Order.countDocuments({
    storeId: mongoose.Types.ObjectId(storeId),
    createdAt: { $gte: dayStart, $lte: dayEnd },
    status: { $in: ['cancelled', 'refunded'] }
  });

  // 3. Agregar Meta insights del día
  const metaAgg = await MetaDailyInsight.aggregate([
    {
      $match: {
        storeId: mongoose.Types.ObjectId(storeId),
        date: { $gte: dayStart, $lte: dayEnd }
      }
    },
    {
      // Solo nivel campaña para evitar doble conteo (campaign > adset > ad)
      $lookup: {
        from: 'metacampaigns',
        localField: 'metaId',
        foreignField: 'metaId',
        as: 'campaign'
      }
    },
    { $unwind: '$campaign' },
    { $match: { 'campaign.level': 'campaign' } },
    {
      $group: {
        _id: null,
        adSpend: { $sum: '$spend' },
        impressions: { $sum: '$impressions' },
        reach: { $sum: '$reach' },
        clicks: { $sum: '$clicks' },
        metaPurchases: { $sum: '$purchases' },
        metaPurchaseValue: { $sum: '$purchaseValue' },
      }
    }
  ]);

  const m = metaAgg[0] || getEmptyMetaAgg();

  // 4. Agregar cashflow del día
  const cashflowAgg = await CashflowEntry.aggregate([
    {
      $match: {
        storeId: mongoose.Types.ObjectId(storeId),
        fechaPago: { $gte: dayStart, $lte: dayEnd }
      }
    },
    {
      $group: {
        _id: '$estado',
        total: { $sum: '$liquidable' }
      }
    }
  ]);
  const pagosRecibidos = cashflowAgg.find(c => c._id === 'recibido')?.total || 0;
  const pagosPendientes = cashflowAgg.find(c => c._id === 'pendiente')?.total || 0;

  // 5. Calcular métricas derivadas (con safe division)
  const safeDiv = (a, b) => (b && b > 0) ? a / b : 0;

  const derived = {
    aov: safeDiv(o.revenue, o.ordenesPositivas),
    aovNeto: safeDiv(o.netRevenue, o.ordenesPositivas),
    profitMargin: safeDiv(o.netRevenue, o.revenue) * 100,
    roas: safeDiv(o.revenue, m.adSpend),
    trueRoas: safeDiv(o.netRevenue, m.adSpend),
    cpa: safeDiv(m.adSpend, o.ordenesPositivas),
    ncCpa: safeDiv(m.adSpend, o.ncOrdenes),
    ncRoas: safeDiv(o.ncRevenue, m.adSpend),
    ncTrueRoas: safeDiv(o.ncNetRevenue, m.adSpend),
    ncPct: safeDiv(o.ncOrdenes, o.ordenesPositivas) * 100,
    cpc: safeDiv(m.adSpend, m.clicks),
    ctr: safeDiv(m.clicks, m.impressions) * 100,
    cpm: safeDiv(m.adSpend, m.impressions) * 1000,
    conversionRate: safeDiv(o.ordenesPositivas, m.clicks) * 100,
  };

  // 6. Upsert
  await DailyMetric.findOneAndUpdate(
    { storeId, date: dayStart },
    {
      ...o,
      ...m,
      ...derived,
      devoluciones,
      profit: o.netRevenue, // profit = netRevenue (ya neto de todo)
      pagosRecibidos,
      pagosPendientes,
    },
    { upsert: true }
  );
}
```

**Problema del doble conteo de Meta:**

Meta reporta insights a nivel campaña, adset y ad. Si sumamos los tres niveles, triplicamos los números. La solución es SIEMPRE agregar solo a nivel `campaign` para los totales del día. Los niveles adset y ad se usan solo para drill-down en la vista Meta Pixel (donde el usuario expande una campaña para ver sus adsets y sus ads).

```
// CORRECTO:  sum(insights donde level=campaign)  → totales del día
// INCORRECTO: sum(todos los insights)             → números x3
```

---

### 2.5 API de métricas para el frontend

El frontend NO recalcula. Pide rangos pre-agregados:

**Endpoint principal:**

```
GET /api/store/:storeId/metrics?from=2026-03-01&to=2026-03-25&compare=previous
```

**Lógica del controller:**

```js
async function getMetrics(req, res) {
  const { storeId } = req.params;
  const { from, to, compare } = req.query;

  // Período principal
  const metrics = await aggregateRange(storeId, new Date(from), new Date(to));

  let comparison = null;
  if (compare === 'previous') {
    // Calcular período anterior de misma duración
    const days = differenceInDays(new Date(to), new Date(from));
    const prevFrom = subDays(new Date(from), days + 1);
    const prevTo = subDays(new Date(from), 1);
    comparison = await aggregateRange(storeId, prevFrom, prevTo);
  }

  res.json({
    current: metrics,
    previous: comparison,
    // Deltas precalculados para el frontend
    deltas: comparison ? calculateDeltas(metrics, comparison) : null
  });
}

async function aggregateRange(storeId, from, to) {
  const result = await DailyMetric.aggregate([
    {
      $match: {
        storeId: mongoose.Types.ObjectId(storeId),
        date: { $gte: from, $lte: to }
      }
    },
    {
      $group: {
        _id: null,
        // Sumables
        ordenes: { $sum: '$ordenes' },
        ordenesPositivas: { $sum: '$ordenesPositivas' },
        revenue: { $sum: '$revenue' },
        netRevenue: { $sum: '$netRevenue' },
        adSpend: { $sum: '$adSpend' },
        costoProductos: { $sum: '$costoProductos' },
        costoEnvio: { $sum: '$costoEnvio' },
        comisionPago: { $sum: '$comisionPago' },
        comisionCuotas: { $sum: '$comisionCuotas' },
        impuestosIBB: { $sum: '$impuestosIBB' },
        feePlataforma: { $sum: '$feePlataforma' },
        impressions: { $sum: '$impressions' },
        reach: { $sum: '$reach' },
        clicks: { $sum: '$clicks' },
        metaPurchases: { $sum: '$metaPurchases' },
        devoluciones: { $sum: '$devoluciones' },
        ncOrdenes: { $sum: '$ncOrdenes' },
        ncRevenue: { $sum: '$ncRevenue' },
        ncNetRevenue: { $sum: '$ncNetRevenue' },
        liquidable: { $sum: '$liquidable' },
        pagosRecibidos: { $sum: '$pagosRecibidos' },
        pagosPendientes: { $sum: '$pagosPendientes' },

        // Para series temporales (el frontend los usa en charts)
        dailyBreakdown: {
          $push: {
            date: '$date',
            revenue: '$revenue',
            netRevenue: '$netRevenue',
            adSpend: '$adSpend',
            profit: '$profit',
            ordenes: '$ordenesPositivas',
          }
        }
      }
    }
  ]);

  if (!result.length) return getEmptyMetrics();

  const r = result[0];
  const safeDiv = (a, b) => (b && b > 0) ? a / b : 0;

  // Recalcular ratios sobre el rango completo (no promediar ratios diarios)
  return {
    ...r,
    profit: r.netRevenue,
    profitMargin: safeDiv(r.netRevenue, r.revenue) * 100,
    aov: safeDiv(r.revenue, r.ordenesPositivas),
    aovNeto: safeDiv(r.netRevenue, r.ordenesPositivas),
    roas: safeDiv(r.revenue, r.adSpend),
    trueRoas: safeDiv(r.netRevenue, r.adSpend),
    cpa: safeDiv(r.adSpend, r.ordenesPositivas),
    ncCpa: safeDiv(r.adSpend, r.ncOrdenes),
    ncRoas: safeDiv(r.ncRevenue, r.adSpend),
    ncTrueRoas: safeDiv(r.ncNetRevenue, r.adSpend),
    ncPct: safeDiv(r.ncOrdenes, r.ordenesPositivas) * 100,
    rcOrdenes: r.ordenesPositivas - r.ncOrdenes,
    rcRevenue: r.revenue - r.ncRevenue,
    rcPct: 100 - safeDiv(r.ncOrdenes, r.ordenesPositivas) * 100,
    cpc: safeDiv(r.adSpend, r.clicks),
    ctr: safeDiv(r.clicks, r.impressions) * 100,
    cpm: safeDiv(r.adSpend, r.impressions) * 1000,
    conversionRate: safeDiv(r.ordenesPositivas, r.clicks) * 100,
  };
}
```

**Por qué NO se promedian los ratios diarios:**

Si Lunes tuvo ROAS 8x y Martes ROAS 2x, el ROAS del rango NO es `(8+2)/2 = 5x`. El correcto es `sum(revenue_lun + revenue_mar) / sum(spend_lun + spend_mar)`. Por eso se suman los valores brutos y se recalculan los ratios sobre el total del rango.

**Deltas para comparación:**

```js
function calculateDeltas(current, previous) {
  const delta = (curr, prev) => {
    if (!prev || prev === 0) return null;
    return ((curr - prev) / Math.abs(prev)) * 100; // porcentaje de cambio
  };

  return {
    revenue: delta(current.revenue, previous.revenue),
    netRevenue: delta(current.netRevenue, previous.netRevenue),
    ordenes: delta(current.ordenesPositivas, previous.ordenesPositivas),
    adSpend: delta(current.adSpend, previous.adSpend),
    roas: delta(current.roas, previous.roas),
    trueRoas: delta(current.trueRoas, previous.trueRoas),
    profit: delta(current.profit, previous.profit),
    profitMargin: current.profitMargin - previous.profitMargin, // diferencia absoluta en pp
    ncPct: current.ncPct - previous.ncPct, // diferencia absoluta en pp
    aov: delta(current.aov, previous.aov),
    cpa: delta(current.cpa, previous.cpa),
    // CPA invertido: subir es malo, bajar es bueno
    // El frontend se encarga de colorear verde/rojo según la métrica
  };
}
```

---

### 2.6 Breakeven automático

Se recalcula cada vez que se cambia una configuración en Settings (cotización, tasas, comisiones) o después de un CSV de costos:

```js
async function calculateBreakeven(store) {
  // Traer últimos 30 días de métricas para promedios
  const last30 = await DailyMetric.aggregate([
    {
      $match: {
        storeId: store._id,
        date: { $gte: subDays(new Date(), 30) }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$revenue' },
        totalNetRevenue: { $sum: '$netRevenue' },
        totalOrdenes: { $sum: '$ordenesPositivas' },
        totalCostoProductos: { $sum: '$costoProductos' },
        totalCostoEnvio: { $sum: '$costoEnvio' },
        totalComisionPago: { $sum: '$comisionPago' },
        totalComisionCuotas: { $sum: '$comisionCuotas' },
        totalIBB: { $sum: '$impuestosIBB' },
        totalFeePlataforma: { $sum: '$feePlataforma' },
      }
    }
  ]);

  if (!last30.length || last30[0].totalRevenue === 0) return;
  const d = last30[0];

  // Porcentaje total de deducciones sobre revenue
  const totalDeducciones = d.totalComisionPago + d.totalComisionCuotas +
    d.totalIBB + d.totalFeePlataforma + d.totalCostoEnvio + d.totalCostoProductos;
  const deduccionPct = totalDeducciones / d.totalRevenue; // ej: 0.38 (38%)

  // ROAS Breakeven: el ROAS donde netRevenue = adSpend (profit = 0)
  // netRevenue = revenue × (1 - deduccionPct)
  // breakeven cuando: revenue × (1 - deduccionPct) = adSpend
  // → revenue / adSpend = 1 / (1 - deduccionPct)
  const roasBreakeven = 1 / (1 - deduccionPct);

  // CPA Breakeven: el CPA donde el costo de adquisición iguala el margen por orden
  // margen promedio por orden = netRevenue / ordenes
  const margenPromedioPorOrden = d.totalNetRevenue / d.totalOrdenes;
  const cpaBreakeven = margenPromedioPorOrden;

  // AOV Mínimo: debajo de este ticket promedio no hay margen positivo
  // costoFijoPromedioPorOrden = (comisiones + IBB + fee + envio + COGS) / ordenes
  const costoFijoPromedioPorOrden = totalDeducciones / d.totalOrdenes;
  // AOV mínimo: el total que cubre exactamente las deducciones
  // Como las deducciones son proporcionales: AOV × deduccionPct = AOV → no funciona
  // Mejor: costos fijos por orden / (1 - comisiones_variables%)
  // Separar fijos (envío, COGS) de variables (% sobre venta)
  const costosFijosOrden = (d.totalCostoEnvio + d.totalCostoProductos) / d.totalOrdenes;
  const comisionesVariablesPct = (d.totalComisionPago + d.totalComisionCuotas +
    d.totalIBB + d.totalFeePlataforma) / d.totalRevenue;
  const aovMinimo = costosFijosOrden / (1 - comisionesVariablesPct);

  // Guardar en store
  store.objetivos.breakeven = {
    roasBreakeven: Math.round(roasBreakeven * 100) / 100,
    cpaBreakeven: Math.round(cpaBreakeven),
    aovMinimo: Math.round(aovMinimo),
  };
  await store.save();
}
```

**Cuándo se dispara el recálculo de breakeven:**
- `POST /api/store/:id/settings` (cambio de tasas/comisiones)
- `POST /api/store/:id/products/costs` (upload de CSV costos)
- `POST /api/store/:id/settings/cotizacion` (cambio cotización dólar)
- Después del cron de recálculo diario (3am)

---

### 2.7 Cashflow — Generación de CashflowEntry

Cuando se sincroniza una orden con `paymentStatus === 'paid'`, se generan las entries de cashflow:

```js
async function generateCashflowEntries(order, store) {
  // Eliminar entries previas de esta orden (por si cambió la info)
  await CashflowEntry.deleteMany({ orderId: order._id });

  const cuotas = order.cantidadCuotas || 1;
  const liquidableTotal = order.liquidable;
  const liquidablePorCuota = liquidableTotal / cuotas;
  const comisionPorCuota = order.comisionPago / cuotas;

  // Configuración de días de acreditación por gateway
  const diasAcreditacion = getGatewayDays(order.gateway);

  for (let i = 0; i < cuotas; i++) {
    const fechaPago = new Date(order.paidAt || order.createdAt);
    fechaPago.setDate(fechaPago.getDate() + diasAcreditacion + (i * 30));
    // Cuota 1: paidAt + días gateway
    // Cuota 2: paidAt + días gateway + 30
    // Cuota N: paidAt + días gateway + (N-1) × 30

    const hoy = new Date();
    const estado = fechaPago <= hoy ? 'recibido' : 'pendiente';

    await CashflowEntry.create({
      orderId: order._id,
      storeId: order.storeId,
      fechaCreacion: order.createdAt,
      fechaPago,
      estado,
      totalOrden: order.totalOrden / cuotas,
      liquidable: liquidablePorCuota,
      comision: comisionPorCuota,
      gateway: order.gateway,
      cuotas,
      numeroCuota: i + 1,
    });
  }
}

function getGatewayDays(gateway) {
  // Días promedio hasta acreditación según gateway
  const config = {
    'Mercado Pago': 14,     // MP retiene ~14 días
    'mercadopago': 14,
    'Todo Pago': 7,
    'Mobbex': 3,
    'PayWay': 5,
    'Transferencia bancaria': 0, // inmediata
    'default': 7,
  };
  return config[gateway] || config['default'];
}
```

**Cron de actualización de estados:**

```js
// Corre diariamente — marca como 'recibido' las cuotas cuya fechaPago ya pasó
async function updateCashflowStates() {
  const hoy = startOfDay(new Date());
  await CashflowEntry.updateMany(
    { estado: 'pendiente', fechaPago: { $lte: hoy } },
    { $set: { estado: 'recibido' } }
  );
}
```

---

### 2.8 Cashflow — API de forecasting

El cashflow tiene una vista FORWARD (próximas semanas) además de la histórica:

```js
async function getCashflowForecast(storeId, weeks = 4) {
  const hoy = startOfDay(new Date());
  const hasta = addWeeks(hoy, weeks);

  // Agrupar por semana
  const forecast = await CashflowEntry.aggregate([
    {
      $match: {
        storeId: mongoose.Types.ObjectId(storeId),
        fechaPago: { $gte: hoy, $lte: hasta }
      }
    },
    {
      $group: {
        _id: {
          semana: { $isoWeek: '$fechaPago' },
          year: { $isoWeekYear: '$fechaPago' },
          estado: '$estado'
        },
        total: { $sum: '$liquidable' },
        count: { $sum: 1 },
        entries: {
          $push: {
            orderId: '$orderId',
            fechaPago: '$fechaPago',
            liquidable: '$liquidable',
            gateway: '$gateway',
            cuotas: '$cuotas',
            numeroCuota: '$numeroCuota',
          }
        }
      }
    },
    { $sort: { '_id.year': 1, '_id.semana': 1 } }
  ]);

  return forecast;
}
```

---

### 2.9 Health Indicators — Comparación vs objetivos

El HealthIndicator es un cálculo que corre cuando se envían métricas al frontend:

```js
function evaluateHealth(metrics, objetivos) {
  if (!objetivos || !objetivos.kpis) return null;

  const kpis = objetivos.kpis;
  const thresholds = objetivos.alertThresholds || { warningPct: 15, criticalPct: 30 };
  const results = {};

  // Métricas donde MAYOR = MEJOR
  const higherIsBetter = [
    { key: 'roas', target: kpis.roasTarget },
    { key: 'trueRoas', target: kpis.trueRoasTarget },
    { key: 'profitMargin', target: kpis.profitMarginMin },
    { key: 'ncPct', target: kpis.ncPctTarget },
    { key: 'aov', target: kpis.aovTarget },
    { key: 'conversionRate', target: kpis.conversionRateTarget },
  ];

  // Métricas donde MENOR = MEJOR
  const lowerIsBetter = [
    { key: 'cpa', target: kpis.cpaMaximo },
    { key: 'trueCpa', target: kpis.trueCpaMaximo },
    { key: 'devoluciones', target: kpis.tasaDevolucionMax }, // como %
  ];

  for (const { key, target } of higherIsBetter) {
    if (!target || !metrics[key]) continue;
    const pctDiff = ((metrics[key] - target) / target) * 100;
    results[key] = {
      value: metrics[key],
      target,
      diff: pctDiff,
      status: pctDiff >= 0 ? 'ok'
        : Math.abs(pctDiff) <= thresholds.warningPct ? 'ok'
        : Math.abs(pctDiff) <= thresholds.criticalPct ? 'warn'
        : 'critical',
    };
  }

  for (const { key, target } of lowerIsBetter) {
    if (!target || !metrics[key]) continue;
    const pctDiff = ((metrics[key] - target) / target) * 100;
    results[key] = {
      value: metrics[key],
      target,
      diff: pctDiff,
      // Invertido: estar POR ENCIMA del target es malo
      status: pctDiff <= 0 ? 'ok'
        : pctDiff <= thresholds.warningPct ? 'ok'
        : pctDiff <= thresholds.criticalPct ? 'warn'
        : 'critical',
    };
  }

  // Breakeven check
  if (objetivos.breakeven?.roasBreakeven && metrics.trueRoas) {
    results.breakeven = {
      roasBreakeven: objetivos.breakeven.roasBreakeven,
      currentTrueRoas: metrics.trueRoas,
      margin: ((metrics.trueRoas - objetivos.breakeven.roasBreakeven) / objetivos.breakeven.roasBreakeven) * 100,
      status: metrics.trueRoas > objetivos.breakeven.roasBreakeven ? 'ok' : 'critical',
    };
  }

  // Status global de la tienda (para Home card)
  const statuses = Object.values(results).map(r => r.status);
  const globalStatus = statuses.includes('critical') ? 'critical'
    : statuses.includes('warn') ? 'warn'
    : 'ok';

  const okCount = statuses.filter(s => s === 'ok').length;

  return {
    kpis: results,
    global: globalStatus,
    summary: `${okCount}/${statuses.length} KPIs en objetivo`,
  };
}
```

**Se integra en el endpoint de métricas:**

```js
// En getMetrics controller
const metrics = await aggregateRange(storeId, from, to);
const store = await Store.findById(storeId);
const health = evaluateHealth(metrics, store.objetivos);

res.json({
  current: metrics,
  previous: comparison,
  deltas: comparison ? calculateDeltas(metrics, comparison) : null,
  health,  // ← el frontend usa esto para semáforos e InsightBars
});
```

---

### 2.10 InsightBar — Generación de texto contextual

Las InsightBars no usan IA. Son templates con reglas:

```js
function generateInsightText(sectionId, metrics, health) {
  const insights = [];

  switch (sectionId) {
    case 'dashboard':
      // Destacar KPIs fuera de objetivo
      for (const [key, data] of Object.entries(health.kpis)) {
        if (data.status === 'critical') {
          insights.push(`${metricLabel(key)} ${formatValue(key, data.value)} está ${Math.abs(data.diff).toFixed(0)}% ${data.diff > 0 ? 'por encima' : 'por debajo'} del ${data.diff > 0 ? 'máximo' : 'objetivo'} (${formatValue(key, data.target)}).`);
        }
      }
      // Destacar lo positivo
      if (health.kpis.breakeven?.status === 'ok') {
        insights.push(`Operando ${health.kpis.breakeven.margin.toFixed(0)}% por encima del breakeven.`);
      }
      break;

    case 'cashflow':
      if (metrics.liquidable > metrics.costoOperativo) {
        const margen = ((metrics.liquidable - metrics.costoOperativo) / metrics.costoOperativo * 100).toFixed(0);
        insights.push(`Liquidable cubre costos operativos. Margen de seguridad: +${margen}%.`);
      } else {
        insights.push(`⚠️ Liquidable NO cubre costos operativos del período.`);
      }
      break;

    case 'productos':
      // Contar productos bajo margen objetivo
      if (metrics.productosBajoMargen > 0) {
        insights.push(`${metrics.productosBajoMargen} productos con margen bajo el objetivo (${health.kpis.profitMargin?.target || 15}%).`);
      }
      break;

    case 'clientes':
      // NC% vs target
      if (health.kpis.ncPct) {
        const ncData = health.kpis.ncPct;
        insights.push(`NC% ${metrics.ncPct.toFixed(0)}% ${ncData.status === 'ok' ? 'supera' : 'está bajo'} objetivo (${ncData.target}%).`);
      }
      // LTV vs CPA ratio
      if (metrics.ltvPromedio && metrics.cpa) {
        const ratio = (metrics.ltvPromedio / metrics.cpa).toFixed(1);
        insights.push(`LTV/CPA ratio ${ratio}x ${parseFloat(ratio) > 3 ? '(saludable >3x)' : '(bajo — revisar retención)'}.`);
      }
      break;

    // ... otros sectionIds
  }

  return insights.join(' ');
}
```

---

### 2.11 Tabla de fórmulas completa — Referencia

| Métrica | Fórmula | Nivel |
|---------|---------|-------|
| **Revenue** | `sum(Order.totalOrden)` donde `totalOrden > 0` | Rango |
| **Net Revenue** | `sum(Order.totalNeto)` | Rango |
| **Profit** | `= Net Revenue` (ya neto de todos los costos) | Rango |
| **Profit Margin %** | `(Net Revenue / Revenue) × 100` | Rango |
| **AOV** | `Revenue / Órdenes >$0` | Rango |
| **AOV Neto** | `Net Revenue / Órdenes >$0` | Rango |
| **ROAS** | `Revenue / Ad Spend` | Rango |
| **True ROAS** | `Net Revenue / Ad Spend` | Rango |
| **CPA** | `Ad Spend / Órdenes >$0` | Rango |
| **True CPA** | `Ad Spend / Órdenes con totalNeto > 0` | Rango |
| **NC %** | `(NC Órdenes / Órdenes >$0) × 100` | Rango |
| **NC CPA** | `Ad Spend / NC Órdenes` | Rango |
| **NC ROAS** | `NC Revenue / Ad Spend` | Rango |
| **NC True ROAS** | `NC Net Revenue / Ad Spend` | Rango |
| **RC %** | `100 - NC%` | Rango |
| **CPC** | `Ad Spend / Clicks` | Rango |
| **CTR** | `(Clicks / Impressions) × 100` | Rango |
| **CPM** | `(Ad Spend / Impressions) × 1000` | Rango |
| **Conversion Rate** | `(Órdenes / Clicks) × 100` | Rango |
| **ROAS Breakeven** | `1 / (1 - deducciónPct)` | Config |
| **CPA Breakeven** | `margenPromedioPorOrden` (últimos 30d) | Config |
| **AOV Mínimo** | `costosFijosOrden / (1 - comisionesVariablesPct)` | Config |
| **Total Neto (orden)** | `Total - ComPago - IBB - ComCuotas - FeeTN - Envío - COGS` | Orden |
| **Liquidable (orden)** | `Total - ComPago - ComCuotas - FeeTN` | Orden |
| **Comisión Pago** | `Total × comisionBase%` (de config por gateway) | Orden |
| **IBB** | `Total × tasaIBB%` | Orden |
| **Fee Plataforma** | `Total × feePlataformaPct%` | Orden |

---

## FASE 3: SISTEMA DE FECHAS — Contexto global, overrides, comparación, presets

### 3.1 Problema a resolver

El calendario no es un simple date picker. Es un **sistema de contexto** que controla qué datos se muestran en TODA la app. Cualquier KPI, tabla, chart o insight depende del rango de fechas seleccionado. Y tiene varias capas de complejidad:

- Un rango global que aplica a todas las secciones
- Algunas secciones necesitan override local (ej: Cashflow mira hacia el futuro)
- Comparación con período anterior (para mostrar deltas ↑↓)
- Presets rápidos ("Últimos 7 días", "Este mes")
- El rango tiene que propagarse al backend en cada request API
- Cuando el usuario cambia el rango, TODOS los componentes deben re-fetchear datos

### 3.2 Arquitectura — Redux slice + React Context

El estado de fechas vive en Redux (persiste entre navegación) y se expone vía un custom hook `useDateRange()`:

```js
// store/dateSlice.js
import { createSlice } from '@reduxjs/toolkit';
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';

const today = new Date();

const presets = {
  'today': () => ({
    from: startOfDay(today),
    to: endOfDay(today),
    label: 'Hoy'
  }),
  'yesterday': () => ({
    from: startOfDay(subDays(today, 1)),
    to: endOfDay(subDays(today, 1)),
    label: 'Ayer'
  }),
  'last_7d': () => ({
    from: startOfDay(subDays(today, 6)),
    to: endOfDay(today),
    label: 'Últimos 7 días'
  }),
  'last_14d': () => ({
    from: startOfDay(subDays(today, 13)),
    to: endOfDay(today),
    label: 'Últimos 14 días'
  }),
  'last_28d': () => ({
    from: startOfDay(subDays(today, 27)),
    to: endOfDay(today),
    label: 'Últimos 28 días'
  }),
  'last_30d': () => ({
    from: startOfDay(subDays(today, 29)),
    to: endOfDay(today),
    label: 'Últimos 30 días'
  }),
  'this_month': () => ({
    from: startOfMonth(today),
    to: endOfDay(today),
    label: 'Este mes'
  }),
  'last_month': () => ({
    from: startOfMonth(subMonths(today, 1)),
    to: endOfMonth(subMonths(today, 1)),
    label: 'Mes pasado'
  }),
  'last_90d': () => ({
    from: startOfDay(subDays(today, 89)),
    to: endOfDay(today),
    label: 'Últimos 90 días'
  }),
};

const initialState = {
  // Rango global activo
  from: presets['last_7d']().from.toISOString(),
  to: presets['last_7d']().to.toISOString(),
  preset: 'last_7d',
  label: 'Últimos 7 días',

  // Comparación
  compareEnabled: false,
  compareFrom: null,
  compareTo: null,
  compareMode: 'previous_period', // 'previous_period' | 'previous_year' | 'custom'

  // Overrides por sección (key = sectionId)
  overrides: {},
  // ej: { cashflow: { from: '...', to: '...', preset: 'next_4w' } }
};

const dateSlice = createSlice({
  name: 'date',
  initialState,
  reducers: {
    // Cambiar rango global con preset
    setPreset(state, action) {
      const presetKey = action.payload;
      const range = presets[presetKey]();
      state.from = range.from.toISOString();
      state.to = range.to.toISOString();
      state.preset = presetKey;
      state.label = range.label;
      // Recalcular comparación si estaba activa
      if (state.compareEnabled) {
        recalcComparison(state);
      }
    },

    // Cambiar rango global custom
    setCustomRange(state, action) {
      const { from, to } = action.payload;
      state.from = startOfDay(new Date(from)).toISOString();
      state.to = endOfDay(new Date(to)).toISOString();
      state.preset = 'custom';
      state.label = `${formatShort(from)} - ${formatShort(to)}`;
      if (state.compareEnabled) {
        recalcComparison(state);
      }
    },

    // Toggle comparación
    toggleCompare(state, action) {
      state.compareEnabled = action.payload;
      if (state.compareEnabled) {
        recalcComparison(state);
      } else {
        state.compareFrom = null;
        state.compareTo = null;
      }
    },

    // Cambiar modo de comparación
    setCompareMode(state, action) {
      state.compareMode = action.payload;
      recalcComparison(state);
    },

    // Override para una sección específica
    setSectionOverride(state, action) {
      const { sectionId, from, to, preset, label } = action.payload;
      state.overrides[sectionId] = { from, to, preset, label };
    },

    // Limpiar override de sección (vuelve al global)
    clearSectionOverride(state, action) {
      delete state.overrides[action.payload];
    },
  }
});

// Lógica de comparación
function recalcComparison(state) {
  const from = new Date(state.from);
  const to = new Date(state.to);
  const days = Math.ceil((to - from) / (1000 * 60 * 60 * 24));

  switch (state.compareMode) {
    case 'previous_period':
      // Mismo número de días, inmediatamente antes
      state.compareTo = subDays(from, 1).toISOString();
      state.compareFrom = subDays(from, days + 1).toISOString();
      break;

    case 'previous_year':
      // Mismo rango, año anterior
      const prevYearFrom = new Date(from);
      prevYearFrom.setFullYear(prevYearFrom.getFullYear() - 1);
      const prevYearTo = new Date(to);
      prevYearTo.setFullYear(prevYearTo.getFullYear() - 1);
      state.compareFrom = prevYearFrom.toISOString();
      state.compareTo = prevYearTo.toISOString();
      break;

    case 'custom':
      // No se recalcula — el usuario lo setea manualmente
      break;
  }
}

export const {
  setPreset, setCustomRange, toggleCompare,
  setCompareMode, setSectionOverride, clearSectionOverride
} = dateSlice.actions;
export { presets };
export default dateSlice.reducer;
```

---

### 3.3 Hook `useDateRange` — Interfaz para componentes

Cada componente que necesita fechas usa este hook. Resuelve automáticamente si hay override de sección o si usa el global:

```js
// hooks/useDateRange.js
import { useSelector } from 'react-redux';

export function useDateRange(sectionId = null) {
  const dateState = useSelector(state => state.date);

  // Si hay override para esta sección, usar ese
  const override = sectionId ? dateState.overrides[sectionId] : null;

  const from = override?.from || dateState.from;
  const to = override?.to || dateState.to;
  const isOverridden = !!override;

  return {
    from,
    to,
    label: override?.label || dateState.label,
    preset: override?.preset || dateState.preset,
    isOverridden,

    // Comparación (solo aplica al rango global, no a overrides)
    compareEnabled: !isOverridden && dateState.compareEnabled,
    compareFrom: dateState.compareFrom,
    compareTo: dateState.compareTo,
    compareMode: dateState.compareMode,

    // Query params listos para pasar al API
    toQueryParams() {
      const params = {
        from: from.split('T')[0], // YYYY-MM-DD
        to: to.split('T')[0],
      };
      if (!isOverridden && dateState.compareEnabled) {
        params.compare = dateState.compareMode;
        if (dateState.compareMode === 'custom') {
          params.compareFrom = dateState.compareFrom.split('T')[0];
          params.compareTo = dateState.compareTo.split('T')[0];
        }
      }
      return params;
    }
  };
}
```

**Uso en un componente:**

```jsx
function DashboardPage() {
  const { from, to, compareEnabled, toQueryParams } = useDateRange('dashboard');
  const storeId = useStoreContext();

  const { data, isLoading } = useQuery(
    ['metrics', storeId, from, to],
    () => api.getMetrics(storeId, toQueryParams()),
    { keepPreviousData: true } // no flashear loading al cambiar fechas
  );

  // data.current = métricas del período
  // data.previous = métricas del período anterior (si compare habilitado)
  // data.deltas = % de cambio
  // data.health = semáforos vs objetivos
}
```

---

### 3.4 Overrides por sección — Cashflow como caso especial

Cashflow necesita mirar hacia el FUTURO (próximas semanas), no hacia el pasado como el resto. Por eso tiene su propio override con presets especiales:

```js
// Presets especiales para Cashflow (forward-looking)
const cashflowPresets = {
  'next_2w': () => ({
    from: startOfDay(new Date()),
    to: endOfDay(addWeeks(new Date(), 2)),
    label: 'Próximas 2 semanas'
  }),
  'next_4w': () => ({
    from: startOfDay(new Date()),
    to: endOfDay(addWeeks(new Date(), 4)),
    label: 'Próximas 4 semanas'
  }),
  'next_6w': () => ({
    from: startOfDay(new Date()),
    to: endOfDay(addWeeks(new Date(), 6)),
    label: 'Próximas 6 semanas'
  }),
  'next_8w': () => ({
    from: startOfDay(new Date()),
    to: endOfDay(addWeeks(new Date(), 8)),
    label: 'Próximas 8 semanas'
  }),
};
```

En la UI, cuando el usuario entra a Cashflow, el componente muestra un selector propio:

```jsx
function CashflowPage() {
  const dispatch = useDispatch();
  const { from, to, isOverridden } = useDateRange('cashflow');

  // Al montar, setear override forward si no hay uno ya
  useEffect(() => {
    if (!isOverridden) {
      const range = cashflowPresets['next_4w']();
      dispatch(setSectionOverride({
        sectionId: 'cashflow',
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        preset: 'next_4w',
        label: range.label
      }));
    }
  }, []);

  return (
    <div>
      {/* Indicador de que se está usando override */}
      {isOverridden && (
        <div className="override-badge">
          Rango: {label}
          <button onClick={() => dispatch(clearSectionOverride('cashflow'))}>
            Usar rango global
          </button>
        </div>
      )}
      {/* Selector de presets forward */}
      <CashflowDateSelector />
      {/* ... resto del contenido */}
    </div>
  );
}
```

**Otras secciones que podrían usar override:**
- **Reportes**: al generar un reporte, se fija un rango específico
- **Competencia**: la última revisión de precios puede tener fecha propia
- Todas las demás usan el rango global

---

### 3.5 Componente `DateRangePicker` — UI estilo Meta Ads Manager

El componente visual del calendario es el más usado en toda la app. Aparece en el header y tiene estas características:

```jsx
// components/common/DateRangePicker.jsx

function DateRangePicker({ sectionId = null }) {
  const dispatch = useDispatch();
  const dateRange = useDateRange(sectionId);
  const [isOpen, setIsOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(null);
  const [tempTo, setTempTo] = useState(null);

  return (
    <div className="date-range-picker">
      {/* Botón trigger — muestra rango actual */}
      <button className="drp-trigger" onClick={() => setIsOpen(!isOpen)}>
        <CalendarIcon />
        <span>{dateRange.label}</span>
        {dateRange.isOverridden && <OverrideBadge />}
        <ChevronDown />
      </button>

      {isOpen && (
        <div className="drp-dropdown">
          {/* Columna izquierda: presets */}
          <div className="drp-presets">
            <PresetButton preset="today" />
            <PresetButton preset="yesterday" />
            <PresetButton preset="last_7d" />
            <PresetButton preset="last_14d" />
            <PresetButton preset="last_28d" />
            <PresetButton preset="this_month" />
            <PresetButton preset="last_month" />
            <PresetButton preset="last_90d" />
          </div>

          {/* Columna derecha: calendar visual (2 meses) */}
          <div className="drp-calendar">
            <DualMonthCalendar
              from={tempFrom || dateRange.from}
              to={tempTo || dateRange.to}
              onSelect={(from, to) => { setTempFrom(from); setTempTo(to); }}
            />
          </div>

          {/* Footer: comparación + aplicar */}
          <div className="drp-footer">
            <div className="drp-compare">
              <label>
                <input
                  type="checkbox"
                  checked={dateRange.compareEnabled}
                  onChange={(e) => dispatch(toggleCompare(e.target.checked))}
                />
                Comparar con
              </label>
              <select
                value={dateRange.compareMode}
                onChange={(e) => dispatch(setCompareMode(e.target.value))}
                disabled={!dateRange.compareEnabled}
              >
                <option value="previous_period">Período anterior</option>
                <option value="previous_year">Mismo período año anterior</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>

            <div className="drp-actions">
              <button onClick={() => setIsOpen(false)}>Cancelar</button>
              <button className="btn-primary" onClick={() => {
                if (tempFrom && tempTo) {
                  dispatch(setCustomRange({ from: tempFrom, to: tempTo }));
                }
                setIsOpen(false);
              }}>
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Comportamiento UX clave (copiado de Meta Ads Manager):**
- Click en un preset → aplica inmediatamente, cierra el dropdown
- Click en una fecha del calendar → empieza selección de rango (from), segundo click → finaliza (to)
- El rango se previsualiza en el calendar antes de aplicar (highlight azul)
- "Comparar con" muestra el rango anterior en gris debajo del principal
- El botón "Aplicar" solo aparece para selección custom; los presets se aplican con un click

---

### 3.6 Propagación al backend — Query params

Toda request API incluye el rango de fechas como query params. NO se guarda el rango en el backend; es 100% frontend-driven:

```
GET /api/store/:storeId/metrics?from=2026-03-01&to=2026-03-25&compare=previous_period
GET /api/store/:storeId/orders?from=2026-03-01&to=2026-03-25&page=1&limit=50
GET /api/store/:storeId/cashflow/forecast?from=2026-03-26&to=2026-04-23
GET /api/store/:storeId/meta/campaigns?from=2026-03-01&to=2026-03-25
GET /api/store/:storeId/products/top?from=2026-03-01&to=2026-03-25&limit=20
```

**Middleware de parseo de fechas:**

```js
// middleware/dateRange.js
function parseDateRange(req, res, next) {
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: 'from and to query params required' });
  }

  // Parsear y validar
  const fromDate = startOfDay(new Date(from));
  const toDate = endOfDay(new Date(to));

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  if (fromDate > toDate) {
    return res.status(400).json({ error: 'from must be before to' });
  }

  // Límite: máximo 365 días de rango
  const days = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24));
  if (days > 365) {
    return res.status(400).json({ error: 'Range cannot exceed 365 days' });
  }

  req.dateRange = { from: fromDate, to: toDate, days };

  // Parsear comparación si viene
  const { compare, compareFrom, compareTo } = req.query;
  if (compare) {
    if (compare === 'previous_period') {
      req.compareRange = {
        from: subDays(fromDate, days + 1),
        to: subDays(fromDate, 1)
      };
    } else if (compare === 'previous_year') {
      const prevFrom = new Date(fromDate);
      prevFrom.setFullYear(prevFrom.getFullYear() - 1);
      const prevTo = new Date(toDate);
      prevTo.setFullYear(prevTo.getFullYear() - 1);
      req.compareRange = { from: prevFrom, to: prevTo };
    } else if (compare === 'custom' && compareFrom && compareTo) {
      req.compareRange = {
        from: startOfDay(new Date(compareFrom)),
        to: endOfDay(new Date(compareTo))
      };
    }
  }

  next();
}
```

---

### 3.7 Invalidación de cache al cambiar fechas

Cuando el usuario cambia el rango, todos los componentes deben re-fetchear. Usamos React Query con cache keys que incluyen el rango:

```js
// El cache key incluye storeId + from + to → cambiar fechas = nueva query
const { data } = useQuery(
  ['metrics', storeId, from, to],
  () => api.getMetrics(storeId, toQueryParams()),
  {
    keepPreviousData: true,   // muestra datos viejos mientras carga los nuevos
    staleTime: 5 * 60 * 1000, // 5 min antes de refetch automático
    cacheTime: 30 * 60 * 1000, // 30 min en cache (si vuelve al rango anterior, es instant)
  }
);
```

**Beneficio de este approach:** si el usuario navega entre "Últimos 7 días" y "Este mes" ida y vuelta, la segunda vez es instantánea porque React Query tiene la respuesta cacheada. Solo se re-fetchea si pasaron más de 5 minutos (staleTime).

---

### 3.8 Timezone

Todo se almacena y calcula en **America/Argentina/Buenos_Aires** (UTC-3). No usamos UTC en la UI. Las razones:

- Los clientes son argentinos, las ventas son en ARS
- TiendaNube reporta fechas en timezone del store (que es Argentina)
- Meta reporta en timezone de la cuenta publicitaria (configurada como Argentina)
- Si usáramos UTC, una venta del 25 Mar a las 22:00 ART aparecería el 26 Mar en UTC → confuso

```js
// config/timezone.js
const TIMEZONE = 'America/Argentina/Buenos_Aires';

function startOfDayLocal(date) {
  // Devuelve el inicio del día en Argentina, no UTC
  return zonedTimeToUtc(startOfDay(utcToZonedTime(date, TIMEZONE)), TIMEZONE);
}

function endOfDayLocal(date) {
  return zonedTimeToUtc(endOfDay(utcToZonedTime(date, TIMEZONE)), TIMEZONE);
}

// En las queries de MongoDB, usar estas funciones
// DailyMetric.date ya está en ART, así que matchea directamente
```

Dependencia: `date-fns-tz` para manejo de timezones con `date-fns`.

---

## FASE 4: WIDGET & DASHBOARD SYSTEM — Personalización total

### 4.1 Filosofía: todo es configurable

El sistema de widgets no se limita al Resumen. TODAS las secciones son personalizables. El layout por defecto de cada sección (Dashboard, Cashflow, etc.) es un **template pre-armado** que el usuario puede editar: mover widgets, quitar, agregar nuevos, cambiar tamaños, cambiar métricas. La idea es que dos tiendas distintas puedan tener dashboards totalmente distintos según lo que le importa a cada cliente.

**Niveles de personalización:**

1. **Home cards** → 5 métricas configurables por tienda
2. **Resumen** → 100% libre, el usuario arma su grilla desde cero
3. **Cada sección** → viene con layout default que se puede editar (agregar/quitar/mover widgets)
4. **Templates** → layouts pre-armados que se pueden aplicar a una sección con un click

### 4.2 Tipos de widget disponibles (17 tipos)

```js
const WIDGET_TYPES = {

  // ═══════════ CARDS Y NÚMEROS ═══════════

  kpi: {
    name: 'KPI Card',
    icon: '📊',
    description: 'Métrica individual con valor, delta vs período anterior y semáforo vs objetivo',
    defaultSize: { cols: 1, rows: 1 },
    configFields: ['metric', 'showDelta', 'showHealth', 'showSparkline', 'invertColor'],
    // invertColor: true para métricas donde bajar es bueno (CPA, devoluciones)
  },

  kpiCompact: {
    name: 'KPI Compacto',
    icon: '🔢',
    description: 'Solo valor y label, sin delta ni semáforo. Para grillas densas',
    defaultSize: { cols: 1, rows: 1 },
    configFields: ['metric'],
  },

  kpiComparison: {
    name: 'Comparación A vs B',
    icon: '⚖️',
    description: 'Dos métricas lado a lado con barra de proporción. Ej: NC% vs RC%, ROAS vs True ROAS',
    defaultSize: { cols: 2, rows: 1 },
    configFields: ['metricA', 'metricB', 'showBar'],
  },

  kpiTarget: {
    name: 'KPI con Target',
    icon: '🎯',
    description: 'Métrica con progress bar circular mostrando % de avance hacia el objetivo configurado',
    defaultSize: { cols: 1, rows: 1 },
    configFields: ['metric', 'targetSource'], // targetSource: 'objetivos' | 'custom'
  },

  scorecard: {
    name: 'Scorecard',
    icon: '📋',
    description: 'Resumen de múltiples KPIs en una sola card compacta (hasta 6 métricas)',
    defaultSize: { cols: 2, rows: 1 },
    configFields: ['metrics'], // array de hasta 6 metric keys
  },

  // ═══════════ TABLAS ═══════════

  table: {
    name: 'Tabla de datos',
    icon: '📑',
    description: 'Tabla con columnas configurables, sorting, filtros y paginación',
    defaultSize: { cols: 3, rows: 2 },
    configFields: ['dataSource', 'columns', 'sortBy', 'sortOrder', 'limit', 'filters', 'showTotals', 'conditionalFormatting'],
    // dataSource: 'orders' | 'products' | 'campaigns' | 'customers' | 'cashflow'
  },

  ranking: {
    name: 'Ranking / Leaderboard',
    icon: '🏆',
    description: 'Top N items con barra de proporción. Ej: Top 10 productos, Top campañas',
    defaultSize: { cols: 2, rows: 2 },
    configFields: ['dataSource', 'rankBy', 'limit', 'showBar', 'showIndex'],
  },

  // ═══════════ CHARTS ═══════════

  lineChart: {
    name: 'Gráfico de línea',
    icon: '📈',
    description: 'Serie temporal de una o más métricas. Soporta eje Y dual',
    defaultSize: { cols: 2, rows: 2 },
    configFields: ['series', 'xAxis', 'granularity', 'showArea', 'dualAxis', 'showBreakevenLine', 'showTargetLine', 'showComparison'],
    // granularity: 'day' | 'week' | 'month'
    // showComparison: overlay del período anterior en línea punteada
  },

  areaChart: {
    name: 'Gráfico de área',
    icon: '🏔️',
    description: 'Como línea pero con área rellena. Ideal para volumen (revenue, spend)',
    defaultSize: { cols: 2, rows: 2 },
    configFields: ['series', 'xAxis', 'granularity', 'stacked'],
  },

  barChart: {
    name: 'Gráfico de barras',
    icon: '📊',
    description: 'Barras verticales u horizontales. Soporta agrupado y stacked',
    defaultSize: { cols: 2, rows: 2 },
    configFields: ['series', 'groupBy', 'orientation', 'stacked', 'showValues'],
    // orientation: 'vertical' | 'horizontal'
  },

  donut: {
    name: 'Donut / Pie',
    icon: '🍩',
    description: 'Distribución porcentual. Ej: Revenue por canal, pagos por gateway',
    defaultSize: { cols: 1, rows: 2 },
    configFields: ['metric', 'groupBy', 'showLegend', 'showValues', 'innerLabel'],
    // innerLabel: texto en el centro del donut (ej: total)
  },

  funnel: {
    name: 'Funnel',
    icon: '🔻',
    description: 'Embudo de conversión. Ej: Impressions → Clicks → ATC → Checkouts → Purchases',
    defaultSize: { cols: 2, rows: 2 },
    configFields: ['steps', 'showDropoff', 'showPercentages'],
    // steps: array de metric keys en orden del funnel
  },

  gauge: {
    name: 'Velocímetro / Gauge',
    icon: '⏱️',
    description: 'Indicador semicircular con zonas rojo/amarillo/verde. Ideal para ROAS vs breakeven',
    defaultSize: { cols: 1, rows: 1 },
    configFields: ['metric', 'min', 'max', 'zones'],
    // zones: [{ from: 0, to: 2.1, color: 'red' }, { from: 2.1, to: 3.5, color: 'yellow' }, { from: 3.5, to: 10, color: 'green' }]
  },

  waterfall: {
    name: 'Waterfall / Cascada',
    icon: '🌊',
    description: 'Desglose paso a paso. Perfecto para P&L: Revenue → -Comisiones → -IBB → ... → Net',
    defaultSize: { cols: 3, rows: 2 },
    configFields: ['steps', 'showConnectors'],
    // steps: [{ label: 'Revenue', metric: 'revenue', type: 'start' }, { label: 'Comisiones', metric: 'comisionPago', type: 'subtract' }, ...]
  },

  heatmap: {
    name: 'Heatmap',
    icon: '🗓️',
    description: 'Mapa de calor. Ej: Revenue por día de semana × hora, o cohort retention',
    defaultSize: { cols: 3, rows: 2 },
    configFields: ['metric', 'xAxis', 'yAxis', 'colorScale'],
    // xAxis: 'dayOfWeek' | 'week' | 'month'
    // yAxis: 'hour' | 'cohortMonth'
  },

  // ═══════════ CONTENIDO ═══════════

  textNote: {
    name: 'Nota / Texto libre',
    icon: '📝',
    description: 'Bloque de texto editable con markdown. Para anotaciones, recordatorios, contexto',
    defaultSize: { cols: 2, rows: 1 },
    configFields: ['content'], // markdown string
  },

  separator: {
    name: 'Separador / Título',
    icon: '➖',
    description: 'Línea divisoria con título opcional para organizar secciones del dashboard',
    defaultSize: { cols: 4, rows: 1 },
    configFields: ['title', 'subtitle'],
  },
};
```

### 4.3 Catálogo de métricas (55 métricas en 8 categorías)

```js
const METRIC_CATALOG = {

  // ═══════════ VENTAS (12) ═══════════
  ordenes:            { label: 'Órdenes totales', format: 'number', category: 'ventas', invertColor: false },
  ordenesPositivas:   { label: 'Órdenes >$0', format: 'number', category: 'ventas', invertColor: false },
  revenue:            { label: 'Revenue', format: 'currency', category: 'ventas', invertColor: false },
  netRevenue:         { label: 'Net Revenue', format: 'currency', category: 'ventas', invertColor: false },
  aov:                { label: 'AOV', format: 'currency', category: 'ventas', invertColor: false },
  aovNeto:            { label: 'AOV Neto', format: 'currency', category: 'ventas', invertColor: false },
  devoluciones:       { label: 'Devoluciones', format: 'number', category: 'ventas', invertColor: true },
  tasaDevolucion:     { label: 'Tasa Devolución %', format: 'percent', category: 'ventas', invertColor: true },
  descuentoPromedio:  { label: 'Descuento promedio', format: 'currency', category: 'ventas', invertColor: true },
  descuentoPct:       { label: 'Descuento % s/revenue', format: 'percent', category: 'ventas', invertColor: true },
  revenuePerDay:      { label: 'Revenue por día', format: 'currency', category: 'ventas', invertColor: false },
  ordenesPerDay:      { label: 'Órdenes por día', format: 'decimal', category: 'ventas', invertColor: false },

  // ═══════════ PROFIT Y COSTOS (14) ═══════════
  profit:             { label: 'Profit', format: 'currency', category: 'profit', invertColor: false },
  profitMargin:       { label: 'Profit Margin %', format: 'percent', category: 'profit', invertColor: false },
  profitPerOrder:     { label: 'Profit por orden', format: 'currency', category: 'profit', invertColor: false },
  costoProductos:     { label: 'Costo Productos (COGS)', format: 'currency', category: 'profit', invertColor: true },
  cogsPct:            { label: 'COGS % s/revenue', format: 'percent', category: 'profit', invertColor: true },
  costoEnvio:         { label: 'Costo Envío total', format: 'currency', category: 'profit', invertColor: true },
  envioPromedio:      { label: 'Envío promedio por orden', format: 'currency', category: 'profit', invertColor: true },
  comisionPago:       { label: 'Comisiones de Pago', format: 'currency', category: 'profit', invertColor: true },
  comisionPagoPct:    { label: 'Comisiones Pago %', format: 'percent', category: 'profit', invertColor: true },
  comisionCuotas:     { label: 'Comisiones de Cuotas', format: 'currency', category: 'profit', invertColor: true },
  impuestosIBB:       { label: 'Impuestos IBB', format: 'currency', category: 'profit', invertColor: true },
  feePlataforma:      { label: 'Fee Plataforma', format: 'currency', category: 'profit', invertColor: true },
  costoTotalPct:      { label: 'Costo total % s/revenue', format: 'percent', category: 'profit', invertColor: true },
  margenContribucion: { label: 'Margen Contribución', format: 'currency', category: 'profit', invertColor: false },

  // ═══════════ MARKETING / ADS (14) ═══════════
  adSpend:            { label: 'Ad Spend', format: 'currency', category: 'marketing', invertColor: true },
  adSpendPerDay:      { label: 'Spend por día', format: 'currency', category: 'marketing', invertColor: true },
  roas:               { label: 'ROAS', format: 'multiplier', category: 'marketing', invertColor: false },
  trueRoas:           { label: 'True ROAS', format: 'multiplier', category: 'marketing', invertColor: false },
  cpa:                { label: 'CPA', format: 'currency', category: 'marketing', invertColor: true },
  trueCpa:            { label: 'True CPA', format: 'currency', category: 'marketing', invertColor: true },
  cpc:                { label: 'CPC', format: 'currency', category: 'marketing', invertColor: true },
  cpm:                { label: 'CPM', format: 'currency', category: 'marketing', invertColor: true },
  ctr:                { label: 'CTR %', format: 'percent', category: 'marketing', invertColor: false },
  conversionRate:     { label: 'Conversion Rate %', format: 'percent', category: 'marketing', invertColor: false },
  impressions:        { label: 'Impressions', format: 'number', category: 'marketing', invertColor: false },
  reach:              { label: 'Reach', format: 'number', category: 'marketing', invertColor: false },
  clicks:             { label: 'Clicks', format: 'number', category: 'marketing', invertColor: false },
  frequency:          { label: 'Frequency', format: 'decimal', category: 'marketing', invertColor: true },

  // ═══════════ NC/RC — CLIENTES (11) ═══════════
  ncPct:              { label: 'NC %', format: 'percent', category: 'clientes', invertColor: false },
  ncOrdenes:          { label: 'NC Órdenes', format: 'number', category: 'clientes', invertColor: false },
  ncRevenue:          { label: 'NC Revenue', format: 'currency', category: 'clientes', invertColor: false },
  ncNetRevenue:       { label: 'NC Net Revenue', format: 'currency', category: 'clientes', invertColor: false },
  ncCpa:              { label: 'NC CPA', format: 'currency', category: 'clientes', invertColor: true },
  ncRoas:             { label: 'NC ROAS', format: 'multiplier', category: 'clientes', invertColor: false },
  ncTrueRoas:         { label: 'NC True ROAS', format: 'multiplier', category: 'clientes', invertColor: false },
  rcPct:              { label: 'RC %', format: 'percent', category: 'clientes', invertColor: false },
  rcOrdenes:          { label: 'RC Órdenes', format: 'number', category: 'clientes', invertColor: false },
  rcRevenue:          { label: 'RC Revenue', format: 'currency', category: 'clientes', invertColor: false },
  ltvCpaRatio:        { label: 'LTV/CPA Ratio', format: 'multiplier', category: 'clientes', invertColor: false },

  // ═══════════ CASHFLOW (4) ═══════════
  liquidable:         { label: 'Liquidable', format: 'currency', category: 'cashflow', invertColor: false },
  pagosRecibidos:     { label: 'Pagos Recibidos', format: 'currency', category: 'cashflow', invertColor: false },
  pagosPendientes:    { label: 'Pagos Pendientes', format: 'currency', category: 'cashflow', invertColor: false },
  comisionesPct:      { label: 'Comisiones % s/ventas', format: 'percent', category: 'cashflow', invertColor: true },
};

// Categorías para el selector en el editor
const METRIC_CATEGORIES = [
  { id: 'ventas', label: 'Ventas', icon: '🛒', color: '#3b82f6' },
  { id: 'profit', label: 'Profit y Costos', icon: '💰', color: '#22c55e' },
  { id: 'marketing', label: 'Marketing / Ads', icon: '📣', color: '#a855f7' },
  { id: 'clientes', label: 'Clientes NC/RC', icon: '👥', color: '#f97316' },
  { id: 'cashflow', label: 'Cashflow', icon: '🏦', color: '#06b6d4' },
];
```

### 4.4 Modelo de datos — Widget (schema expandido)

```js
const WidgetSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  pageId: { type: String, required: true },
  // pageId: 'resumen' | 'dashboard' | 'cashflow' | 'metapixel' | 'costos' | 'productos' | 'clientes' | 'creativos'
  type: {
    type: String,
    enum: ['kpi', 'kpiCompact', 'kpiComparison', 'kpiTarget', 'scorecard',
           'table', 'ranking', 'lineChart', 'areaChart', 'barChart', 'donut',
           'funnel', 'gauge', 'waterfall', 'heatmap', 'textNote', 'separator'],
    required: true
  },

  // ═══════ DISPLAY ═══════
  title: String,                   // override del título auto-generado
  subtitle: String,                // descripción opcional debajo del título
  size: {
    cols: { type: Number, default: 1, min: 1, max: 4 },  // 1-4 columnas en la grilla
    rows: { type: Number, default: 1, min: 1, max: 3 },  // 1-3 filas
  },
  position: {
    order: { type: Number, default: 0 },    // posición secuencial
    // Para futuro drag & drop: row, col
  },

  // ═══════ STYLE ═══════
  style: {
    colorScheme: { type: String, default: 'default' },
    // 'default' | 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'cyan' | 'gradient'
    bgTransparent: { type: Boolean, default: false },   // fondo transparente
    borderless: { type: Boolean, default: false },       // sin borde
    compact: { type: Boolean, default: false },          // padding reducido
  },

  // ═══════ CONFIG (varía por tipo) ═══════
  config: {

    // — KPI / kpiCompact / kpiTarget —
    metric: String,                          // key de METRIC_CATALOG
    showDelta: { type: Boolean, default: true },       // mostrar ↑12% vs anterior
    showHealth: { type: Boolean, default: true },      // mostrar semáforo
    showSparkline: { type: Boolean, default: false },  // mini chart dentro de la card
    invertColor: { type: Boolean, default: false },    // rojo=sube, verde=baja (para CPA)
    targetSource: { type: String, default: 'objetivos' }, // 'objetivos' (auto) | 'custom'
    customTarget: Number,                    // target manual si targetSource=custom

    // — kpiComparison —
    metricA: String,
    metricB: String,
    showBar: { type: Boolean, default: true },

    // — scorecard —
    metrics: [String],                       // array de hasta 6 metric keys

    // — Table —
    dataSource: String,                      // 'orders' | 'products' | 'campaigns' | 'customers' | 'cashflow'
    columns: [{
      field: String,                         // nombre del campo
      label: String,                         // override del label
      format: String,                        // 'currency' | 'number' | 'percent' | 'date' | 'text'
      width: Number,                         // ancho en px (null = auto)
      sortable: { type: Boolean, default: true },
      visible: { type: Boolean, default: true },
    }],
    sortBy: { field: String, order: String },
    limit: { type: Number, default: 10 },
    showTotals: { type: Boolean, default: false },
    conditionalFormatting: [{
      field: String,
      operator: String,   // 'gt' | 'lt' | 'eq' | 'between'
      value: Number,
      value2: Number,     // para 'between'
      color: String,      // 'green' | 'yellow' | 'red'
    }],
    filters: [{
      field: String,
      operator: String,
      value: mongoose.Schema.Types.Mixed,
    }],

    // — Ranking —
    rankBy: String,                          // metric key para ordenar
    showIndex: { type: Boolean, default: true },

    // — Charts (line, area, bar) —
    series: [String],                        // metric keys a graficar
    xAxis: { type: String, default: 'date' },
    granularity: { type: String, default: 'day' }, // 'day' | 'week' | 'month'
    stacked: { type: Boolean, default: false },
    showArea: { type: Boolean, default: false },
    dualAxis: { type: Boolean, default: false },   // segundo eje Y
    dualAxisSeries: [String],                      // qué series van al eje Y derecho
    showBreakevenLine: { type: Boolean, default: false },
    showTargetLine: { type: Boolean, default: false },
    showComparison: { type: Boolean, default: false }, // overlay período anterior
    showValues: { type: Boolean, default: false },     // valores sobre las barras/puntos
    showLegend: { type: Boolean, default: true },
    orientation: { type: String, default: 'vertical' },
    chartColors: [String],                   // override de colores de series

    // — Donut —
    groupBy: String,                         // 'gateway' | 'canal' | 'ncrc' | 'status'
    innerLabel: String,                      // texto en el centro

    // — Funnel —
    steps: [{
      label: String,
      metric: String,                        // key para obtener el valor
    }],
    showDropoff: { type: Boolean, default: true },
    showPercentages: { type: Boolean, default: true },

    // — Gauge —
    min: { type: Number, default: 0 },
    max: { type: Number, default: 10 },
    zones: [{
      from: Number,
      to: Number,
      color: String,
    }],

    // — Waterfall —
    waterfallSteps: [{
      label: String,
      metric: String,
      type: String,                          // 'start' | 'add' | 'subtract' | 'total'
    }],
    showConnectors: { type: Boolean, default: true },

    // — Heatmap —
    yAxis: String,                           // 'hour' | 'dayOfWeek' | 'cohortMonth'
    colorScale: { type: String, default: 'green' }, // 'green' | 'blue' | 'red' | 'purple'

    // — TextNote —
    content: String,                         // markdown

    // — Separator —
    // usa title y subtitle del nivel principal
  },

  isDefault: { type: Boolean, default: false }, // true = viene del template, usuario puede borrar
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

WidgetSchema.index({ storeId: 1, pageId: 1, 'position.order': 1 });
```

### 4.5 Columnas disponibles por dataSource (para widgets tipo Table)

```js
const TABLE_COLUMNS = {
  orders: [
    { field: 'tnOrderNumber', label: 'ID Orden', format: 'text' },
    { field: 'createdAt', label: 'Fecha', format: 'date' },
    { field: 'customerName', label: 'Cliente', format: 'text' },
    { field: 'customerEmail', label: 'Email', format: 'text' },
    { field: 'totalOrden', label: 'Total', format: 'currency' },
    { field: 'comisionPago', label: 'Com. Pago', format: 'currency' },
    { field: 'impuestosIBB', label: 'IBB', format: 'currency' },
    { field: 'comisionCuotas', label: 'Com. Cuotas', format: 'currency' },
    { field: 'feePlataforma', label: 'Fee TN', format: 'currency' },
    { field: 'costoEnvio', label: 'Envío', format: 'currency' },
    { field: 'costoProductos', label: 'COGS', format: 'currency' },
    { field: 'totalNeto', label: 'Neto', format: 'currency' },
    { field: 'liquidable', label: 'Liquidable', format: 'currency' },
    { field: 'gateway', label: 'Gateway', format: 'text' },
    { field: 'cantidadCuotas', label: 'Cuotas', format: 'number' },
    { field: 'esClienteNuevo', label: 'NC/RC', format: 'boolean' },
    { field: 'status', label: 'Estado', format: 'text' },
    { field: 'canal', label: 'Canal', format: 'text' },
  ],
  products: [
    { field: 'name', label: 'Producto', format: 'text' },
    { field: 'sku', label: 'SKU', format: 'text' },
    { field: 'price', label: 'Precio', format: 'currency' },
    { field: 'costoUnitario', label: 'Costo', format: 'currency' },
    { field: 'margin', label: 'Margen $', format: 'currency' },
    { field: 'marginPct', label: 'Margen %', format: 'percent' },
    { field: 'unitsSold', label: 'Unidades', format: 'number' },
    { field: 'revenue', label: 'Revenue', format: 'currency' },
    { field: 'profitContribution', label: '% del Profit', format: 'percent' },
    { field: 'stock', label: 'Stock', format: 'number' },
    { field: 'daysOfStock', label: 'Días stock', format: 'number' },
    { field: 'velocity', label: 'Velocidad venta/día', format: 'decimal' },
  ],
  campaigns: [
    { field: 'name', label: 'Campaña', format: 'text' },
    { field: 'status', label: 'Estado', format: 'text' },
    { field: 'spend', label: 'Spend', format: 'currency' },
    { field: 'impressions', label: 'Impresiones', format: 'number' },
    { field: 'reach', label: 'Reach', format: 'number' },
    { field: 'clicks', label: 'Clicks', format: 'number' },
    { field: 'ctr', label: 'CTR', format: 'percent' },
    { field: 'cpc', label: 'CPC', format: 'currency' },
    { field: 'cpm', label: 'CPM', format: 'currency' },
    { field: 'purchases', label: 'Compras', format: 'number' },
    { field: 'purchaseValue', label: 'Revenue Attr.', format: 'currency' },
    { field: 'roas', label: 'ROAS', format: 'multiplier' },
    { field: 'trueRoas', label: 'True ROAS', format: 'multiplier' },
    { field: 'cpa', label: 'CPA', format: 'currency' },
    { field: 'frequency', label: 'Frequency', format: 'decimal' },
  ],
  customers: [
    { field: 'name', label: 'Nombre', format: 'text' },
    { field: 'email', label: 'Email', format: 'text' },
    { field: 'totalOrders', label: 'Órdenes', format: 'number' },
    { field: 'totalSpent', label: 'Total gastado', format: 'currency' },
    { field: 'aov', label: 'AOV', format: 'currency' },
    { field: 'firstPurchase', label: 'Primera compra', format: 'date' },
    { field: 'lastOrderDate', label: 'Última compra', format: 'date' },
    { field: 'daysSinceLastOrder', label: 'Días desde última', format: 'number' },
    { field: 'ltv', label: 'LTV', format: 'currency' },
    { field: 'rfmSegment', label: 'Segmento RFM', format: 'text' },
    { field: 'cohortMonth', label: 'Cohorte', format: 'text' },
  ],
  cashflow: [
    { field: 'orderId', label: 'Orden', format: 'text' },
    { field: 'fechaCreacion', label: 'Fecha Orden', format: 'date' },
    { field: 'fechaPago', label: 'Fecha Pago', format: 'date' },
    { field: 'estado', label: 'Estado', format: 'text' },
    { field: 'totalOrden', label: 'Total', format: 'currency' },
    { field: 'liquidable', label: 'Liquidable', format: 'currency' },
    { field: 'comision', label: 'Comisión', format: 'currency' },
    { field: 'gateway', label: 'Gateway', format: 'text' },
    { field: 'cuotas', label: 'Cuotas', format: 'number' },
    { field: 'numeroCuota', label: 'Cuota N°', format: 'number' },
  ],
};
```

### 4.6 Renderizado dinámico — WidgetContainer (17 tipos)

El WidgetContainer es el componente central que resuelve qué componente renderizar según el tipo de widget, aplica estilos configurados, maneja conditional formatting y provee el menú de acciones:

```jsx
// components/widgets/WidgetContainer.jsx
import { lazy, Suspense, useMemo } from 'react';

// Lazy load de cada tipo de widget
const WIDGET_COMPONENTS = {
  kpi:           lazy(() => import('./types/KPIWidget')),
  kpiCompact:    lazy(() => import('./types/KPICompactWidget')),
  kpiComparison: lazy(() => import('./types/KPIComparisonWidget')),
  kpiTarget:     lazy(() => import('./types/KPITargetWidget')),
  scorecard:     lazy(() => import('./types/ScorecardWidget')),
  table:         lazy(() => import('./types/TableWidget')),
  ranking:       lazy(() => import('./types/RankingWidget')),
  lineChart:     lazy(() => import('./types/LineChartWidget')),
  areaChart:     lazy(() => import('./types/AreaChartWidget')),
  barChart:      lazy(() => import('./types/BarChartWidget')),
  donut:         lazy(() => import('./types/DonutWidget')),
  funnel:        lazy(() => import('./types/FunnelWidget')),
  gauge:         lazy(() => import('./types/GaugeWidget')),
  waterfall:     lazy(() => import('./types/WaterfallWidget')),
  heatmap:       lazy(() => import('./types/HeatmapWidget')),
  textNote:      lazy(() => import('./types/TextNoteWidget')),
  separator:     lazy(() => import('./types/SeparatorWidget')),
};

function WidgetContainer({ widget, metrics, health, timeseries, tableData, onEdit, onDelete, onDuplicate, isEditMode }) {
  const Component = WIDGET_COMPONENTS[widget.type];
  if (!Component) return null;

  // Resolver tamaño del widget en la grilla
  const size = widget.size || WIDGET_TYPES[widget.type].defaultSize;
  const gridStyle = {
    gridColumn: `span ${size.cols}`,
    gridRow: `span ${size.rows}`,
  };

  // Aplicar conditional formatting al container
  const conditionalStyle = useMemo(() => {
    return resolveConditionalStyle(widget, metrics);
  }, [widget.config?.conditionalFormatting, metrics]);

  // Widgets decorativos no necesitan header
  const isDecorative = ['textNote', 'separator'].includes(widget.type);

  return (
    <div
      className={`widget widget-${widget.type} ${isEditMode ? 'widget-editable' : ''}`}
      style={{ ...gridStyle, ...conditionalStyle }}
      data-widget-id={widget._id}
    >
      {/* Header con título, health badge, y menú */}
      {!isDecorative && (
        <div className="widget-header">
          <div className="widget-header-left">
            <span className="widget-title">
              {widget.title || METRIC_CATALOG[widget.config?.metric]?.label || WIDGET_TYPES[widget.type].name}
            </span>
            {widget.config?.showHealth && health?.kpis?.[widget.config?.metric] && (
              <HealthBadge status={health.kpis[widget.config.metric].status} />
            )}
          </div>
          <div className="widget-header-right">
            {isEditMode && (
              <WidgetMenu
                onEdit={() => onEdit(widget)}
                onDuplicate={() => onDuplicate(widget)}
                onDelete={() => onDelete(widget._id)}
                onResize={(newSize) => onEdit({ ...widget, size: newSize })}
                widgetType={widget.type}
              />
            )}
          </div>
        </div>
      )}

      {/* Contenido del widget */}
      <Suspense fallback={<div className="widget-skeleton" />}>
        <Component
          config={widget.config}
          style={widget.style}
          metrics={metrics}
          health={health}
          timeseries={timeseries}
          tableData={tableData}
        />
      </Suspense>
    </div>
  );
}
```

**Menú contextual del widget (WidgetMenu):**

```jsx
function WidgetMenu({ onEdit, onDuplicate, onDelete, onResize, widgetType }) {
  const [open, setOpen] = useState(false);
  const sizeOptions = WIDGET_TYPES[widgetType]?.allowedSizes || [];

  return (
    <div className="widget-menu-wrapper">
      <button className="widget-menu-btn" onClick={() => setOpen(!open)}>⋯</button>
      {open && (
        <div className="widget-dropdown">
          <button onClick={onEdit}>✏️ Editar</button>
          <button onClick={onDuplicate}>📋 Duplicar</button>
          {sizeOptions.length > 0 && (
            <div className="size-submenu">
              <span>Tamaño:</span>
              {sizeOptions.map(s => (
                <button key={`${s.cols}x${s.rows}`} onClick={() => onResize(s)}>
                  {s.cols}×{s.rows}
                </button>
              ))}
            </div>
          )}
          <hr />
          <button className="danger" onClick={onDelete}>🗑 Eliminar</button>
        </div>
      )}
    </div>
  );
}
```

**Conditional formatting resolver:**

```js
// utils/conditionalFormatting.js
function resolveConditionalStyle(widget, metrics) {
  const rules = widget.config?.conditionalFormatting;
  if (!rules?.length) return {};

  const value = metrics?.current?.[widget.config?.metric];
  if (value == null) return {};

  // Evaluar reglas en orden de prioridad (primera que matchea gana)
  for (const rule of rules) {
    let match = false;
    switch (rule.operator) {
      case '>':  match = value > rule.value; break;
      case '>=': match = value >= rule.value; break;
      case '<':  match = value < rule.value; break;
      case '<=': match = value <= rule.value; break;
      case '==': match = value === rule.value; break;
      case 'between': match = value >= rule.value && value <= rule.value2; break;
    }
    if (match) {
      return {
        borderLeft: `4px solid ${rule.color}`,
        backgroundColor: `${rule.color}10`, // 10 = 6% opacity hex
      };
    }
  }
  return {};
}
```

**Componentes de widget — implementación de cada tipo:**

```jsx
// widgets/types/KPIWidget.jsx — Tarjeta KPI grande con valor, delta, health, sparkline opcional
function KPIWidget({ config, style, metrics, health }) {
  const { metric, showDelta = true, showHealth = true, showSparkline = false } = config;
  const entry = METRIC_CATALOG[metric];
  const value = metrics?.current?.[metric];
  const delta = metrics?.deltas?.[metric];
  const healthData = health?.kpis?.[metric];
  const sparkData = showSparkline ? metrics?.timeseries?.map(d => d[metric]) : null;

  return (
    <div className="kpi-widget" style={{ color: style?.textColor }}>
      <div className="kpi-value">{formatValue(entry.format, value)}</div>
      {showDelta && delta != null && (
        <DeltaBadge delta={delta} invertColor={entry.invertColor} />
      )}
      {showHealth && healthData && (
        <HealthIndicator status={healthData.status} diff={healthData.diff} />
      )}
      {sparkData && <MiniSparkline data={sparkData} color={style?.primaryColor || '#6366f1'} />}
    </div>
  );
}

// widgets/types/KPICompactWidget.jsx — Mini KPI para filas densas (solo label + valor)
function KPICompactWidget({ config, metrics }) {
  const { metric } = config;
  const entry = METRIC_CATALOG[metric];
  const value = metrics?.current?.[metric];
  return (
    <div className="kpi-compact">
      <span className="kpi-compact-label">{entry.label}</span>
      <span className="kpi-compact-value">{formatValue(entry.format, value)}</span>
    </div>
  );
}

// widgets/types/KPIComparisonWidget.jsx — Dos métricas lado a lado con delta
function KPIComparisonWidget({ config, metrics }) {
  const { metricA, metricB } = config;
  const entryA = METRIC_CATALOG[metricA];
  const entryB = METRIC_CATALOG[metricB];
  return (
    <div className="kpi-comparison">
      <div className="kpi-comparison-side">
        <span className="label">{entryA.label}</span>
        <span className="value">{formatValue(entryA.format, metrics?.current?.[metricA])}</span>
      </div>
      <div className="kpi-comparison-vs">vs</div>
      <div className="kpi-comparison-side">
        <span className="label">{entryB.label}</span>
        <span className="value">{formatValue(entryB.format, metrics?.current?.[metricB])}</span>
      </div>
    </div>
  );
}

// widgets/types/KPITargetWidget.jsx — KPI con barra de progreso hacia objetivo
function KPITargetWidget({ config, metrics, health }) {
  const { metric, targetValue, targetLabel } = config;
  const entry = METRIC_CATALOG[metric];
  const value = metrics?.current?.[metric] || 0;
  const target = targetValue || health?.kpis?.[metric]?.target || 100;
  const progress = Math.min((value / target) * 100, 150); // cap at 150%

  return (
    <div className="kpi-target">
      <div className="kpi-target-header">
        <span>{formatValue(entry.format, value)}</span>
        <span className="kpi-target-of">/ {formatValue(entry.format, target)}</span>
      </div>
      <div className="progress-bar">
        <div
          className={`progress-fill ${progress >= 100 ? 'achieved' : progress >= 75 ? 'close' : 'behind'}`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      {targetLabel && <span className="kpi-target-label">{targetLabel}</span>}
    </div>
  );
}

// widgets/types/ScorecardWidget.jsx — Múltiples KPIs apilados en una sola card
function ScorecardWidget({ config, metrics, health }) {
  const { metricsList } = config; // array de metric keys
  return (
    <div className="scorecard">
      {metricsList?.map(metric => {
        const entry = METRIC_CATALOG[metric];
        const value = metrics?.current?.[metric];
        const delta = metrics?.deltas?.[metric];
        return (
          <div key={metric} className="scorecard-row">
            <span className="scorecard-label">{entry.label}</span>
            <span className="scorecard-value">{formatValue(entry.format, value)}</span>
            {delta != null && <DeltaBadge delta={delta} invertColor={entry.invertColor} size="sm" />}
          </div>
        );
      })}
    </div>
  );
}

// widgets/types/TableWidget.jsx — Tabla con sort, paginación, export
function TableWidget({ config, tableData }) {
  const { dataSource, columns: selectedCols, sortBy, sortDir, pageSize = 20 } = config;
  const allColumns = TABLE_COLUMNS[dataSource] || [];
  const visibleColumns = selectedCols?.length
    ? allColumns.filter(c => selectedCols.includes(c.field))
    : allColumns;

  const [sort, setSort] = useState({ field: sortBy || visibleColumns[0]?.field, dir: sortDir || 'desc' });
  const [page, setPage] = useState(0);

  const data = tableData?.[dataSource] || [];
  const sorted = [...data].sort((a, b) => {
    const mul = sort.dir === 'asc' ? 1 : -1;
    return (a[sort.field] > b[sort.field] ? 1 : -1) * mul;
  });
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="table-widget">
      <table>
        <thead>
          <tr>
            {visibleColumns.map(col => (
              <th key={col.field} onClick={() => setSort({
                field: col.field,
                dir: sort.field === col.field && sort.dir === 'desc' ? 'asc' : 'desc'
              })}>
                {col.label} {sort.field === col.field ? (sort.dir === 'asc' ? '↑' : '↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paged.map((row, i) => (
            <tr key={i}>
              {visibleColumns.map(col => (
                <td key={col.field}>{formatValue(col.format, row[col.field])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <TablePagination page={page} setPage={setPage} total={sorted.length} pageSize={pageSize} />
      <ExportCSVButton data={sorted} columns={visibleColumns} />
    </div>
  );
}

// widgets/types/RankingWidget.jsx — Lista ordenada con barras horizontales
function RankingWidget({ config, tableData }) {
  const { dataSource, rankBy, labelField, limit = 10, showBars = true } = config;
  const data = tableData?.[dataSource] || [];
  const sorted = [...data].sort((a, b) => b[rankBy] - a[rankBy]).slice(0, limit);
  const maxVal = sorted[0]?.[rankBy] || 1;

  return (
    <div className="ranking-widget">
      {sorted.map((item, i) => (
        <div key={i} className="ranking-row">
          <span className="ranking-pos">#{i + 1}</span>
          <span className="ranking-label">{item[labelField]}</span>
          <span className="ranking-value">{formatValue(METRIC_CATALOG[rankBy]?.format || 'number', item[rankBy])}</span>
          {showBars && (
            <div className="ranking-bar">
              <div className="ranking-bar-fill" style={{ width: `${(item[rankBy] / maxVal) * 100}%` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// widgets/types/LineChartWidget.jsx — Gráfico de líneas con múltiples series, eje dual, líneas de referencia
function LineChartWidget({ config, style, timeseries }) {
  const { series, xAxis = 'date', showBreakevenLine, breakevenValue, showTargetLine, targetValue,
          dualAxis, rightAxisMetric, showDots = true, curveType = 'monotone' } = config;
  const colors = style?.chartColors || DEFAULT_COLORS;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsLineChart data={timeseries}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey={xAxis} tickFormatter={formatDateAxis} />
        <YAxis yAxisId="left" />
        {dualAxis && <YAxis yAxisId="right" orientation="right" />}
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        {series?.map((metric, i) => (
          <Line
            key={metric}
            yAxisId={dualAxis && metric === rightAxisMetric ? 'right' : 'left'}
            type={curveType}
            dataKey={metric}
            name={METRIC_CATALOG[metric]?.label}
            stroke={colors[i % colors.length]}
            dot={showDots}
            strokeWidth={2}
          />
        ))}
        {showBreakevenLine && (
          <ReferenceLine y={breakevenValue} yAxisId="left" stroke="#ef4444" strokeDasharray="5 5" label="Breakeven" />
        )}
        {showTargetLine && (
          <ReferenceLine y={targetValue} yAxisId="left" stroke="#22c55e" strokeDasharray="5 5" label="Objetivo" />
        )}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}

// widgets/types/AreaChartWidget.jsx — Igual que Line pero con fill, ideal para revenue/spend over time
// Misma estructura que LineChartWidget pero usa <Area> en vez de <Line>
// con fillOpacity configurable y opción stacked

// widgets/types/BarChartWidget.jsx — Barras verticales, agrupadas o stacked
function BarChartWidget({ config, style, timeseries }) {
  const { series, xAxis = 'date', stacked = false, horizontal = false, showValues = false } = config;
  const colors = style?.chartColors || DEFAULT_COLORS;
  const ChartComponent = horizontal ? RechartsBarChart : RechartsBarChart; // layout prop handles orientation

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ChartComponent data={timeseries} layout={horizontal ? 'vertical' : 'horizontal'}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        {horizontal ? <XAxis type="number" /> : <XAxis dataKey={xAxis} tickFormatter={formatDateAxis} />}
        {horizontal ? <YAxis type="category" dataKey={xAxis} /> : <YAxis />}
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        {series?.map((metric, i) => (
          <Bar
            key={metric}
            dataKey={metric}
            name={METRIC_CATALOG[metric]?.label}
            fill={colors[i % colors.length]}
            stackId={stacked ? 'stack' : undefined}
            label={showValues ? { position: 'top', formatter: (v) => abbreviateNumber(v) } : false}
          />
        ))}
      </ChartComponent>
    </ResponsiveContainer>
  );
}

// widgets/types/DonutWidget.jsx — Gráfico de torta/dona para distribución
function DonutWidget({ config, style, metrics }) {
  const { dataSource, valueField, labelField, innerRadius = 60, showLegend = true, showPercentage = true } = config;
  const colors = style?.chartColors || DEFAULT_COLORS;
  // El data se prepara según dataSource: puede ser distribución NC/RC, medios de pago, etc.
  const data = prepareDonutData(config, metrics);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%" cy="50%"
          innerRadius={innerRadius} outerRadius="80%"
          dataKey="value"
          nameKey="name"
          label={showPercentage ? renderPercentLabel : false}
        >
          {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
        </Pie>
        {showLegend && <Legend />}
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

// widgets/types/FunnelWidget.jsx — Embudo de conversión (sessions → cart → checkout → purchase)
function FunnelWidget({ config, style, metrics }) {
  const { stages } = config;
  // stages: [{ metric: 'sessions', label: 'Visitas' }, { metric: 'addToCart', label: 'Carrito' }, ...]
  const data = stages?.map((stage, i) => ({
    name: stage.label,
    value: metrics?.current?.[stage.metric] || 0,
    fill: (style?.chartColors || DEFAULT_COLORS)[i],
  })) || [];

  const maxVal = data[0]?.value || 1;

  return (
    <div className="funnel-widget">
      {data.map((stage, i) => {
        const width = Math.max((stage.value / maxVal) * 100, 15); // mínimo 15% para visibilidad
        const convRate = i > 0 ? ((stage.value / data[i - 1].value) * 100).toFixed(1) : null;
        return (
          <div key={i} className="funnel-stage">
            <div className="funnel-bar" style={{ width: `${width}%`, backgroundColor: stage.fill }}>
              <span>{stage.name}: {stage.value.toLocaleString('es-AR')}</span>
            </div>
            {convRate && <span className="funnel-conv">↓ {convRate}%</span>}
          </div>
        );
      })}
    </div>
  );
}

// widgets/types/GaugeWidget.jsx — Medidor circular (ideal para métricas con target)
function GaugeWidget({ config, metrics, health }) {
  const { metric, min = 0, max, zones } = config;
  // zones: [{ from: 0, to: 1.5, color: '#ef4444' }, { from: 1.5, to: 3, color: '#eab308' }, { from: 3, to: 5, color: '#22c55e' }]
  const entry = METRIC_CATALOG[metric];
  const value = metrics?.current?.[metric] || 0;
  const maxVal = max || (value * 1.5); // auto-scale si no se define max
  const angle = (value / maxVal) * 180; // semicírculo

  return (
    <div className="gauge-widget">
      <svg viewBox="0 0 200 120">
        {/* Zonas de color en el arco */}
        {zones?.map((zone, i) => (
          <Arc key={i} from={(zone.from / maxVal) * 180} to={(zone.to / maxVal) * 180} color={zone.color} />
        ))}
        {/* Aguja */}
        <line
          x1="100" y1="100"
          x2={100 + 80 * Math.cos(Math.PI - (angle * Math.PI / 180))}
          y2={100 - 80 * Math.sin(Math.PI - (angle * Math.PI / 180))}
          stroke="#1f2937" strokeWidth="2"
        />
      </svg>
      <div className="gauge-value">{formatValue(entry.format, value)}</div>
      <div className="gauge-label">{entry.label}</div>
    </div>
  );
}

// widgets/types/WaterfallWidget.jsx — Cascada para desglose de revenue a profit
function WaterfallWidget({ config, style, metrics }) {
  const { steps } = config;
  // steps: [{ metric: 'revenue', label: 'Revenue', type: 'total' },
  //         { metric: 'comisionesPago', label: 'Comisiones Pago', type: 'subtract' },
  //         { metric: 'ibb', label: 'IBB', type: 'subtract' },
  //         { metric: 'adSpend', label: 'Ad Spend', type: 'subtract' },
  //         { metric: 'profit', label: 'Profit', type: 'total' }]
  let running = 0;
  const data = steps?.map(step => {
    const val = metrics?.current?.[step.metric] || 0;
    if (step.type === 'total') {
      const item = { name: step.label, value: val, start: 0, isTotal: true };
      running = val;
      return item;
    }
    const start = running;
    running -= val;
    return { name: step.label, value: -val, start, isTotal: false };
  }) || [];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsBarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip content={<WaterfallTooltip />} />
        <Bar dataKey="start" stackId="waterfall" fill="transparent" />
        <Bar dataKey="value" stackId="waterfall">
          {data.map((d, i) => (
            <Cell key={i} fill={d.isTotal ? '#6366f1' : d.value < 0 ? '#ef4444' : '#22c55e'} />
          ))}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}

// widgets/types/HeatmapWidget.jsx — Mapa de calor por día de semana × hora (para campañas/ventas)
function HeatmapWidget({ config, style, timeseries }) {
  const { metric, colorScale } = config;
  // timeseries debe incluir dayOfWeek y hour
  const colors = colorScale || { low: '#f0fdf4', mid: '#86efac', high: '#16a34a' };
  const grid = buildHeatmapGrid(timeseries, metric); // 7 filas (lun-dom) × 24 cols (0-23h)
  const maxVal = Math.max(...grid.flat());

  return (
    <div className="heatmap-widget">
      <div className="heatmap-grid">
        {DAYS.map((day, di) => (
          <div key={day} className="heatmap-row">
            <span className="heatmap-day">{day}</span>
            {grid[di].map((val, hi) => (
              <div
                key={hi}
                className="heatmap-cell"
                style={{ backgroundColor: interpolateColor(val / maxVal, colors) }}
                title={`${day} ${hi}:00 — ${formatValue(METRIC_CATALOG[metric]?.format, val)}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="heatmap-hours">
        {Array.from({ length: 24 }, (_, i) => <span key={i}>{i}</span>)}
      </div>
    </div>
  );
}

// widgets/types/TextNoteWidget.jsx — Nota de texto libre (para anotaciones, recordatorios)
function TextNoteWidget({ config, style }) {
  return (
    <div className="text-note" style={{
      backgroundColor: style?.backgroundColor || '#fefce8',
      color: style?.textColor || '#713f12',
      fontSize: style?.fontSize || '14px'
    }}>
      {config.text || 'Nota vacía — editá este widget para agregar texto'}
    </div>
  );
}

// widgets/types/SeparatorWidget.jsx — Separador visual con título opcional
function SeparatorWidget({ config, style }) {
  return (
    <div className="separator-widget" style={{ borderColor: style?.primaryColor || '#e5e7eb' }}>
      {config.text && <span className="separator-label">{config.text}</span>}
    </div>
  );
}
```

**Utilidades compartidas:**

```jsx
// components/widgets/shared.jsx

function DeltaBadge({ delta, invertColor, size = 'md' }) {
  // invertColor: para métricas donde subir es malo (CPA, costos)
  const isPositive = invertColor ? delta < 0 : delta > 0;
  return (
    <span className={`delta-badge delta-${size} ${isPositive ? 'delta-positive' : 'delta-negative'}`}>
      {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

function HealthIndicator({ status, diff }) {
  const icons = { ok: '🟢', warn: '🟡', critical: '🔴' };
  return (
    <span className={`health-indicator health-${status}`}>
      {icons[status]} {diff > 0 ? '+' : ''}{diff?.toFixed(0)}% vs target
    </span>
  );
}

function HealthBadge({ status }) {
  const icons = { ok: '🟢', warn: '🟡', critical: '🔴' };
  return <span className="health-badge">{icons[status]}</span>;
}

function MiniSparkline({ data, color, width = 80, height = 24 }) {
  if (!data?.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`
  ).join(' ');
  return (
    <svg width={width} height={height} className="mini-sparkline">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function formatValue(format, value) {
  if (value == null) return '—';
  switch (format) {
    case 'currency': return `$${abbreviateNumber(value)}`;
    case 'number': return value.toLocaleString('es-AR');
    case 'percent': return `${value.toFixed(1)}%`;
    case 'multiplier': return `${value.toFixed(2)}x`;
    case 'days': return `${value.toFixed(0)}d`;
    default: return String(value);
  }
}

function abbreviateNumber(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString('es-AR');
}

const DEFAULT_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
```

### 4.7 Widget Editor — Wizard multi-step

El editor se rediseña como un wizard de 3 pasos para manejar los 17 tipos y todas las opciones de personalización:

```jsx
// components/widgets/WidgetEditor.jsx
function WidgetEditor({ pageId, storeId, existingWidget, onSave, onClose }) {
  const [step, setStep] = useState(1);
  const [type, setType] = useState(existingWidget?.type || null);
  const [config, setConfig] = useState(existingWidget?.config || {});
  const [style, setStyle] = useState(existingWidget?.style || {});
  const [size, setSize] = useState(existingWidget?.size || null);
  const [title, setTitle] = useState(existingWidget?.title || '');

  const canAdvance = step === 1 ? !!type : step === 2 ? validateConfig(type, config) : true;

  return (
    <div className="widget-editor-modal">
      {/* Progress bar */}
      <div className="wizard-steps">
        <div className={`wizard-step ${step >= 1 ? 'active' : ''}`}>1. Tipo</div>
        <div className={`wizard-step ${step >= 2 ? 'active' : ''}`}>2. Datos</div>
        <div className={`wizard-step ${step >= 3 ? 'active' : ''}`}>3. Estilo</div>
      </div>

      {/* STEP 1: Elegir tipo de widget */}
      {step === 1 && (
        <div className="wizard-content">
          <h3>¿Qué tipo de widget querés agregar?</h3>
          <div className="widget-type-grid">
            {Object.entries(WIDGET_TYPES).map(([key, wt]) => (
              <button
                key={key}
                className={`widget-type-card ${type === key ? 'selected' : ''}`}
                onClick={() => {
                  setType(key);
                  setConfig({}); // reset config al cambiar tipo
                  setSize(wt.defaultSize);
                }}
              >
                <span className="widget-type-icon">{wt.icon}</span>
                <span className="widget-type-name">{wt.name}</span>
                <span className="widget-type-desc">{wt.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2: Configurar datos según tipo */}
      {step === 2 && (
        <div className="wizard-content">
          <h3>Configurar {WIDGET_TYPES[type].name}</h3>

          {/* Título personalizado */}
          <div className="form-group">
            <label>Título (opcional)</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Auto-generado si está vacío" />
          </div>

          {/* Config específica por tipo */}
          <WidgetConfigPanel type={type} config={config} setConfig={setConfig} />
        </div>
      )}

      {/* STEP 3: Personalizar estilo */}
      {step === 3 && (
        <div className="wizard-content">
          <h3>Personalizar apariencia</h3>

          {/* Tamaño */}
          <div className="form-group">
            <label>Tamaño en la grilla</label>
            <div className="size-selector">
              {(WIDGET_TYPES[type].allowedSizes || [WIDGET_TYPES[type].defaultSize]).map(s => (
                <button
                  key={`${s.cols}x${s.rows}`}
                  className={size?.cols === s.cols && size?.rows === s.rows ? 'selected' : ''}
                  onClick={() => setSize(s)}
                >
                  {s.cols}×{s.rows}
                </button>
              ))}
            </div>
          </div>

          {/* Colores */}
          <StylePanel type={type} style={style} setStyle={setStyle} />

          {/* Conditional formatting (solo para KPI/gauge/scorecard) */}
          {['kpi', 'kpiTarget', 'gauge', 'scorecard'].includes(type) && (
            <ConditionalFormattingEditor
              rules={config.conditionalFormatting || []}
              onChange={rules => setConfig({ ...config, conditionalFormatting: rules })}
              metric={config.metric}
            />
          )}

          {/* Preview */}
          <div className="widget-preview">
            <h4>Vista previa</h4>
            <WidgetPreview type={type} config={config} style={style} size={size} title={title} />
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="wizard-footer">
        <button onClick={onClose} className="btn-cancel">Cancelar</button>
        <div className="wizard-nav">
          {step > 1 && <button onClick={() => setStep(step - 1)} className="btn-back">← Atrás</button>}
          {step < 3 ? (
            <button onClick={() => setStep(step + 1)} disabled={!canAdvance} className="btn-next">
              Siguiente →
            </button>
          ) : (
            <button onClick={() => {
              onSave({ type, config, style, size, title, pageId, storeId });
              onClose();
            }} className="btn-save">
              {existingWidget ? 'Guardar cambios' : 'Agregar widget'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Paneles de configuración por tipo (Step 2):**

```jsx
// components/widgets/WidgetConfigPanel.jsx
function WidgetConfigPanel({ type, config, setConfig }) {
  const update = (key, val) => setConfig({ ...config, [key]: val });

  switch (type) {
    // ——— KPI types ———
    case 'kpi':
      return (
        <>
          <MetricSelector value={config.metric} onChange={v => update('metric', v)} />
          <Checkbox label="Mostrar delta vs período anterior" checked={config.showDelta !== false} onChange={v => update('showDelta', v)} />
          <Checkbox label="Mostrar indicador de salud" checked={config.showHealth !== false} onChange={v => update('showHealth', v)} />
          <Checkbox label="Mostrar sparkline" checked={config.showSparkline} onChange={v => update('showSparkline', v)} />
        </>
      );

    case 'kpiCompact':
      return <MetricSelector value={config.metric} onChange={v => update('metric', v)} />;

    case 'kpiComparison':
      return (
        <>
          <MetricSelector label="Métrica A" value={config.metricA} onChange={v => update('metricA', v)} />
          <MetricSelector label="Métrica B" value={config.metricB} onChange={v => update('metricB', v)} />
        </>
      );

    case 'kpiTarget':
      return (
        <>
          <MetricSelector value={config.metric} onChange={v => update('metric', v)} />
          <NumberInput label="Valor objetivo (dejar vacío = usar objetivo de store)" value={config.targetValue} onChange={v => update('targetValue', v)} />
          <TextInput label="Label del objetivo" value={config.targetLabel} onChange={v => update('targetLabel', v)} />
        </>
      );

    case 'scorecard':
      return (
        <MultiMetricSelector
          label="Métricas a mostrar (hasta 8)"
          value={config.metricsList || []}
          onChange={v => update('metricsList', v)}
          max={8}
        />
      );

    // ——— Table types ———
    case 'table':
      return (
        <>
          <SelectInput label="Fuente de datos" value={config.dataSource} onChange={v => update('dataSource', v)}
            options={[
              { value: 'orders', label: 'Órdenes' },
              { value: 'products', label: 'Productos' },
              { value: 'campaigns', label: 'Campañas' },
              { value: 'customers', label: 'Clientes' },
              { value: 'cashflow', label: 'Cashflow' },
            ]}
          />
          {config.dataSource && (
            <ColumnSelector
              available={TABLE_COLUMNS[config.dataSource]}
              selected={config.columns || TABLE_COLUMNS[config.dataSource].map(c => c.field)}
              onChange={v => update('columns', v)}
            />
          )}
          <NumberInput label="Filas por página" value={config.pageSize || 20} onChange={v => update('pageSize', v)} />
        </>
      );

    case 'ranking':
      return (
        <>
          <SelectInput label="Fuente de datos" value={config.dataSource} onChange={v => update('dataSource', v)}
            options={[
              { value: 'products', label: 'Productos' },
              { value: 'campaigns', label: 'Campañas' },
              { value: 'customers', label: 'Clientes' },
            ]}
          />
          {config.dataSource && (
            <>
              <SelectInput label="Ordenar por" value={config.rankBy}
                onChange={v => update('rankBy', v)}
                options={TABLE_COLUMNS[config.dataSource]
                  ?.filter(c => ['currency', 'number', 'percent', 'multiplier'].includes(c.format))
                  .map(c => ({ value: c.field, label: c.label }))}
              />
              <SelectInput label="Mostrar como label" value={config.labelField}
                onChange={v => update('labelField', v)}
                options={TABLE_COLUMNS[config.dataSource]?.filter(c => c.format === 'text').map(c => ({ value: c.field, label: c.label }))}
              />
            </>
          )}
          <NumberInput label="Top N" value={config.limit || 10} onChange={v => update('limit', v)} />
          <Checkbox label="Mostrar barras" checked={config.showBars !== false} onChange={v => update('showBars', v)} />
        </>
      );

    // ——— Chart types ———
    case 'lineChart':
    case 'areaChart':
      return (
        <>
          <MultiMetricSelector label="Series" value={config.series || []} onChange={v => update('series', v)} max={6} />
          <SelectInput label="Eje X" value={config.xAxis || 'date'} onChange={v => update('xAxis', v)}
            options={[{ value: 'date', label: 'Por día' }, { value: 'week', label: 'Por semana' }, { value: 'month', label: 'Por mes' }]}
          />
          <Checkbox label="Eje dual (Y derecho)" checked={config.dualAxis} onChange={v => update('dualAxis', v)} />
          {config.dualAxis && (
            <SelectInput label="Métrica en eje derecho" value={config.rightAxisMetric}
              onChange={v => update('rightAxisMetric', v)}
              options={config.series?.map(m => ({ value: m, label: METRIC_CATALOG[m]?.label }))}
            />
          )}
          <Checkbox label="Línea de breakeven" checked={config.showBreakevenLine} onChange={v => update('showBreakevenLine', v)} />
          {config.showBreakevenLine && (
            <NumberInput label="Valor breakeven" value={config.breakevenValue} onChange={v => update('breakevenValue', v)} />
          )}
          <Checkbox label="Línea de objetivo" checked={config.showTargetLine} onChange={v => update('showTargetLine', v)} />
          {config.showTargetLine && (
            <NumberInput label="Valor objetivo" value={config.targetValue} onChange={v => update('targetValue', v)} />
          )}
          {type === 'lineChart' && (
            <Checkbox label="Mostrar puntos" checked={config.showDots !== false} onChange={v => update('showDots', v)} />
          )}
          {type === 'areaChart' && (
            <Checkbox label="Apilar áreas (stacked)" checked={config.stacked} onChange={v => update('stacked', v)} />
          )}
        </>
      );

    case 'barChart':
      return (
        <>
          <MultiMetricSelector label="Series" value={config.series || []} onChange={v => update('series', v)} max={6} />
          <SelectInput label="Eje X" value={config.xAxis || 'date'} onChange={v => update('xAxis', v)}
            options={[{ value: 'date', label: 'Por día' }, { value: 'week', label: 'Por semana' }, { value: 'month', label: 'Por mes' }]}
          />
          <Checkbox label="Barras apiladas" checked={config.stacked} onChange={v => update('stacked', v)} />
          <Checkbox label="Horizontal" checked={config.horizontal} onChange={v => update('horizontal', v)} />
          <Checkbox label="Mostrar valores sobre barras" checked={config.showValues} onChange={v => update('showValues', v)} />
        </>
      );

    case 'donut':
      return (
        <>
          <SelectInput label="Dato a graficar" value={config.dataField} onChange={v => update('dataField', v)}
            options={[
              { value: 'ncRcSplit', label: 'NC vs RC (órdenes)' },
              { value: 'ncRcRevenue', label: 'NC vs RC (revenue)' },
              { value: 'medioPago', label: 'Distribución medio de pago' },
              { value: 'campaignSplit', label: 'Revenue por campaña' },
              { value: 'productCategory', label: 'Revenue por categoría' },
            ]}
          />
          <RangeInput label="Radio interior" value={config.innerRadius || 60} min={0} max={100} onChange={v => update('innerRadius', v)} />
          <Checkbox label="Mostrar leyenda" checked={config.showLegend !== false} onChange={v => update('showLegend', v)} />
          <Checkbox label="Mostrar porcentajes" checked={config.showPercentage !== false} onChange={v => update('showPercentage', v)} />
        </>
      );

    case 'funnel':
      return (
        <FunnelStagesEditor
          stages={config.stages || DEFAULT_FUNNEL_STAGES}
          onChange={v => update('stages', v)}
        />
      );

    case 'gauge':
      return (
        <>
          <MetricSelector value={config.metric} onChange={v => update('metric', v)} />
          <NumberInput label="Valor mínimo" value={config.min || 0} onChange={v => update('min', v)} />
          <NumberInput label="Valor máximo" value={config.max} onChange={v => update('max', v)} placeholder="Auto" />
          <GaugeZonesEditor zones={config.zones || []} onChange={v => update('zones', v)} />
        </>
      );

    case 'waterfall':
      return (
        <WaterfallStepsEditor
          steps={config.steps || DEFAULT_WATERFALL_STEPS}
          onChange={v => update('steps', v)}
        />
      );

    case 'heatmap':
      return (
        <>
          <MetricSelector value={config.metric} onChange={v => update('metric', v)} />
          <ColorScaleEditor scale={config.colorScale} onChange={v => update('colorScale', v)} />
        </>
      );

    case 'textNote':
      return <TextArea label="Contenido" value={config.text || ''} onChange={v => update('text', v)} rows={4} />;

    case 'separator':
      return <TextInput label="Título de sección (opcional)" value={config.text || ''} onChange={v => update('text', v)} />;

    default:
      return <p>Tipo no reconocido</p>;
  }
}

// Valores por defecto para tipos complejos
const DEFAULT_FUNNEL_STAGES = [
  { metric: 'sessions', label: 'Visitas' },
  { metric: 'addToCart', label: 'Agregar al carrito' },
  { metric: 'checkoutInitiated', label: 'Checkout iniciado' },
  { metric: 'ordenesPositivas', label: 'Compra completada' },
];

const DEFAULT_WATERFALL_STEPS = [
  { metric: 'revenue', label: 'Revenue Bruto', type: 'total' },
  { metric: 'comisionesPago', label: 'Comisiones Pago', type: 'subtract' },
  { metric: 'ibb', label: 'IBB', type: 'subtract' },
  { metric: 'comisionesCuotas', label: 'Comisiones Cuotas', type: 'subtract' },
  { metric: 'feePlataforma', label: 'Fee Plataforma', type: 'subtract' },
  { metric: 'costoEnvio', label: 'Costo Envío', type: 'subtract' },
  { metric: 'cogs', label: 'COGS', type: 'subtract' },
  { metric: 'adSpend', label: 'Ad Spend', type: 'subtract' },
  { metric: 'profit', label: 'Profit Neto', type: 'total' },
];
```

**Subcomponentes de selección reutilizables:**

```jsx
// MetricSelector — dropdown agrupado por categoría
function MetricSelector({ value, onChange, label = 'Métrica' }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <select value={value || ''} onChange={e => onChange(e.target.value)}>
        <option value="">Seleccionar...</option>
        {METRIC_CATEGORIES.map(cat => (
          <optgroup key={cat.key} label={cat.label}>
            {cat.metrics.map(m => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

// MultiMetricSelector — chips con add/remove, máximo configurable
function MultiMetricSelector({ value, onChange, max = 6, label = 'Métricas' }) {
  const [showPicker, setShowPicker] = useState(false);
  const add = (metric) => {
    if (value.length < max && !value.includes(metric)) {
      onChange([...value, metric]);
    }
  };
  const remove = (metric) => onChange(value.filter(m => m !== metric));

  return (
    <div className="form-group">
      <label>{label} ({value.length}/{max})</label>
      <div className="metric-chips">
        {value.map(m => (
          <span key={m} className="metric-chip">
            {METRIC_CATALOG[m]?.label} <button onClick={() => remove(m)}>×</button>
          </span>
        ))}
        {value.length < max && (
          <button className="metric-chip-add" onClick={() => setShowPicker(true)}>+ Agregar</button>
        )}
      </div>
      {showPicker && (
        <MetricPickerDropdown
          exclude={value}
          onSelect={(m) => { add(m); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

// ColumnSelector — checkboxes para columnas de tabla, con drag para reordenar
function ColumnSelector({ available, selected, onChange }) {
  const toggle = (field) => {
    if (selected.includes(field)) {
      onChange(selected.filter(f => f !== field));
    } else {
      onChange([...selected, field]);
    }
  };

  return (
    <div className="form-group">
      <label>Columnas visibles (arrastrá para reordenar)</label>
      <div className="column-selector">
        {available.map(col => (
          <label key={col.field} className="column-checkbox">
            <input type="checkbox" checked={selected.includes(col.field)} onChange={() => toggle(col.field)} />
            {col.label}
          </label>
        ))}
      </div>
    </div>
  );
}

// ConditionalFormattingEditor — reglas de formato condicional
function ConditionalFormattingEditor({ rules, onChange, metric }) {
  const addRule = () => onChange([...rules, { operator: '>', value: 0, color: '#ef4444' }]);
  const updateRule = (i, key, val) => {
    const updated = [...rules];
    updated[i] = { ...updated[i], [key]: val };
    onChange(updated);
  };
  const removeRule = (i) => onChange(rules.filter((_, idx) => idx !== i));

  return (
    <div className="form-group">
      <label>Formato condicional</label>
      {rules.map((rule, i) => (
        <div key={i} className="cond-format-rule">
          <span>Si {METRIC_CATALOG[metric]?.label || 'valor'}</span>
          <select value={rule.operator} onChange={e => updateRule(i, 'operator', e.target.value)}>
            <option value=">">mayor que</option>
            <option value=">=">mayor o igual</option>
            <option value="<">menor que</option>
            <option value="<=">menor o igual</option>
            <option value="between">entre</option>
          </select>
          <input type="number" value={rule.value} onChange={e => updateRule(i, 'value', Number(e.target.value))} />
          {rule.operator === 'between' && (
            <>
              <span>y</span>
              <input type="number" value={rule.value2} onChange={e => updateRule(i, 'value2', Number(e.target.value))} />
            </>
          )}
          <input type="color" value={rule.color} onChange={e => updateRule(i, 'color', e.target.value)} />
          <button onClick={() => removeRule(i)}>×</button>
        </div>
      ))}
      <button className="btn-sm" onClick={addRule}>+ Agregar regla</button>
    </div>
  );
}
```

**Validación de config por tipo:**

```js
function validateConfig(type, config) {
  switch (type) {
    case 'kpi':
    case 'kpiCompact':
    case 'kpiTarget':
    case 'gauge':
    case 'heatmap':
      return !!config.metric;
    case 'kpiComparison':
      return !!config.metricA && !!config.metricB;
    case 'scorecard':
      return config.metricsList?.length >= 2;
    case 'table':
      return !!config.dataSource;
    case 'ranking':
      return !!config.dataSource && !!config.rankBy && !!config.labelField;
    case 'lineChart':
    case 'areaChart':
    case 'barChart':
      return config.series?.length >= 1;
    case 'donut':
      return !!config.dataField;
    case 'funnel':
      return config.stages?.length >= 2;
    case 'waterfall':
      return config.steps?.length >= 2;
    case 'textNote':
    case 'separator':
      return true; // siempre válido
    default:
      return false;
  }
}
```

### 4.8 Panel de estilos (Step 3 del wizard)

```jsx
// components/widgets/StylePanel.jsx
function StylePanel({ type, style, setStyle }) {
  const update = (key, val) => setStyle({ ...style, [key]: val });
  const isChart = ['lineChart', 'areaChart', 'barChart', 'donut', 'funnel', 'waterfall', 'heatmap'].includes(type);

  return (
    <div className="style-panel">
      {/* Colores principales */}
      <div className="form-group">
        <label>Color principal</label>
        <ColorPicker value={style.primaryColor || '#6366f1'} onChange={v => update('primaryColor', v)} />
      </div>

      <div className="form-group">
        <label>Color de fondo</label>
        <ColorPicker value={style.backgroundColor || '#ffffff'} onChange={v => update('backgroundColor', v)} />
      </div>

      <div className="form-group">
        <label>Color de texto</label>
        <ColorPicker value={style.textColor || '#1f2937'} onChange={v => update('textColor', v)} />
      </div>

      {/* Paleta de colores para charts */}
      {isChart && (
        <div className="form-group">
          <label>Paleta de colores</label>
          <PaletteSelector
            value={style.chartColors || DEFAULT_COLORS}
            onChange={v => update('chartColors', v)}
            presets={[
              { name: 'Default', colors: ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'] },
              { name: 'Cool', colors: ['#3b82f6', '#06b6d4', '#14b8a6', '#6366f1', '#8b5cf6', '#a78bfa'] },
              { name: 'Warm', colors: ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e'] },
              { name: 'Pastel', colors: ['#c4b5fd', '#a5f3fc', '#86efac', '#fde68a', '#fca5a5', '#f0abfc'] },
              { name: 'Mono', colors: ['#1f2937', '#374151', '#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb'] },
            ]}
          />
        </div>
      )}

      {/* Font size para KPIs */}
      {['kpi', 'kpiTarget', 'kpiComparison'].includes(type) && (
        <div className="form-group">
          <label>Tamaño del valor</label>
          <SelectInput value={style.fontSize || '2rem'} onChange={v => update('fontSize', v)}
            options={[
              { value: '1.5rem', label: 'Pequeño' },
              { value: '2rem', label: 'Normal' },
              { value: '2.5rem', label: 'Grande' },
              { value: '3rem', label: 'Extra grande' },
            ]}
          />
        </div>
      )}

      {/* Bordes */}
      <div className="form-group">
        <label>Borde</label>
        <SelectInput value={style.borderStyle || 'subtle'} onChange={v => update('borderStyle', v)}
          options={[
            { value: 'none', label: 'Sin borde' },
            { value: 'subtle', label: 'Sutil' },
            { value: 'solid', label: 'Sólido' },
            { value: 'accent', label: 'Acento (color principal)' },
          ]}
        />
      </div>

      {/* Sombra */}
      <Checkbox label="Sombra" checked={style.shadow !== false} onChange={v => update('shadow', v)} />

      {/* Bordes redondeados */}
      <SelectInput label="Bordes redondeados" value={style.borderRadius || '8px'} onChange={v => update('borderRadius', v)}
        options={[
          { value: '0', label: 'Sin redondeo' },
          { value: '4px', label: 'Leve' },
          { value: '8px', label: 'Normal' },
          { value: '12px', label: 'Redondeado' },
          { value: '16px', label: 'Muy redondeado' },
        ]}
      />
    </div>
  );
}
```

### 4.9 Grid Layout System — CSS Grid con drag-and-drop

El sistema de layout usa CSS Grid con 12 columnas. Cada widget ocupa `cols` columnas y `rows` filas. El usuario puede reordenar widgets arrastrándolos:

```jsx
// components/widgets/WidgetGrid.jsx
function WidgetGrid({ widgets, metrics, health, timeseries, tableData, isEditMode, onReorder, onEdit, onDelete, onDuplicate }) {
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  const handleDragStart = (e, index) => {
    if (!isEditMode) return;
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    setOverIndex(index);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (dragIndex == null || dragIndex === dropIndex) return;
    const reordered = [...widgets];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    onReorder(reordered.map(w => w._id));
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div className="widget-grid" style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(12, 1fr)',
      gap: '16px',
      padding: '16px',
    }}>
      {widgets.map((widget, i) => (
        <div
          key={widget._id}
          draggable={isEditMode}
          onDragStart={(e) => handleDragStart(e, i)}
          onDragOver={(e) => handleDragOver(e, i)}
          onDrop={(e) => handleDrop(e, i)}
          className={`widget-grid-item ${overIndex === i ? 'drag-over' : ''} ${dragIndex === i ? 'dragging' : ''}`}
        >
          <WidgetContainer
            widget={widget}
            metrics={metrics}
            health={health}
            timeseries={timeseries}
            tableData={tableData}
            isEditMode={isEditMode}
            onEdit={onEdit}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
          />
        </div>
      ))}
    </div>
  );
}
```

**CSS del grid system:**

```css
/* styles/widget-grid.css */

.widget-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 16px;
  padding: 16px;
  min-height: 200px;
}

/* Cada widget usa su size.cols / size.rows */
.widget {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  padding: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: box-shadow 0.2s, transform 0.2s;
}

.widget:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }

/* Edit mode */
.widget-editable { cursor: grab; border: 2px dashed transparent; }
.widget-editable:hover { border-color: #6366f1; }
.dragging { opacity: 0.5; transform: scale(0.95); }
.drag-over { border-color: #6366f1; background: #f5f3ff; }

/* Widget header */
.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  min-height: 24px;
}

.widget-title {
  font-weight: 600;
  font-size: 0.85rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

/* Responsive: en mobile, todos los widgets ocupan 12 cols */
@media (max-width: 768px) {
  .widget-grid { grid-template-columns: 1fr; }
  .widget { grid-column: span 1 !important; }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .widget-grid { grid-template-columns: repeat(6, 1fr); }
}

/* Tamaños de widgets — se aplican via inline style gridColumn/gridRow en WidgetContainer */

/* Widget skeleton para lazy loading */
.widget-skeleton {
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  height: 100%;
  min-height: 80px;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Add widget button */
.add-widget-btn {
  grid-column: span 3;
  min-height: 120px;
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.add-widget-btn:hover {
  border-color: #6366f1;
  color: #6366f1;
  background: #f5f3ff;
}
```

### 4.10 Dashboard Templates — Layouts pre-armados por sección

Cada sección tiene un template por defecto que se aplica automáticamente cuando el usuario entra por primera vez. El usuario puede resetear al template o empezar de cero:

```js
// config/dashboardTemplates.js

const DASHBOARD_TEMPLATES = {
  resumen: {
    name: 'Dashboard General',
    description: 'Vista general con KPIs principales, evolución y desglose',
    widgets: [
      { type: 'kpi', config: { metric: 'revenue', showDelta: true, showHealth: true, showSparkline: true }, size: { cols: 3, rows: 1 } },
      { type: 'kpi', config: { metric: 'netRevenue', showDelta: true, showHealth: true }, size: { cols: 3, rows: 1 } },
      { type: 'kpi', config: { metric: 'profit', showDelta: true, showHealth: true }, size: { cols: 3, rows: 1 } },
      { type: 'kpi', config: { metric: 'profitMargin', showDelta: true, showHealth: true }, size: { cols: 3, rows: 1 } },
      { type: 'kpiTarget', config: { metric: 'trueRoas' }, size: { cols: 4, rows: 1 } },
      { type: 'kpiTarget', config: { metric: 'cpa' }, size: { cols: 4, rows: 1 } },
      { type: 'kpiTarget', config: { metric: 'ncPct' }, size: { cols: 4, rows: 1 } },
      { type: 'lineChart', config: { series: ['revenue', 'netRevenue', 'adSpend'], xAxis: 'date', showBreakevenLine: false }, size: { cols: 8, rows: 2 } },
      { type: 'donut', config: { dataField: 'ncRcRevenue', showLegend: true }, size: { cols: 4, rows: 2 } },
      { type: 'waterfall', config: { steps: DEFAULT_WATERFALL_STEPS }, size: { cols: 12, rows: 2 } },
    ]
  },

  metaAds: {
    name: 'Meta Ads Dashboard',
    description: 'Rendimiento de campañas con ROAS, CPA y tendencias',
    widgets: [
      { type: 'kpi', config: { metric: 'adSpend', showDelta: true }, size: { cols: 3, rows: 1 } },
      { type: 'kpi', config: { metric: 'roas', showDelta: true, showHealth: true }, size: { cols: 3, rows: 1 } },
      { type: 'kpi', config: { metric: 'trueRoas', showDelta: true, showHealth: true }, size: { cols: 3, rows: 1 } },
      { type: 'kpi', config: { metric: 'cpa', showDelta: true, showHealth: true }, size: { cols: 3, rows: 1 } },
      { type: 'lineChart', config: { series: ['roas', 'trueRoas'], xAxis: 'date', showBreakevenLine: true, breakevenValue: null /* auto from store */ }, size: { cols: 6, rows: 2 } },
      { type: 'barChart', config: { series: ['adSpend', 'metaRevenue'], xAxis: 'date' }, size: { cols: 6, rows: 2 } },
      { type: 'ranking', config: { dataSource: 'campaigns', rankBy: 'roas', labelField: 'name', limit: 10 }, size: { cols: 6, rows: 2 } },
      { type: 'table', config: { dataSource: 'campaigns', pageSize: 15 }, size: { cols: 6, rows: 2 } },
    ]
  },

  cashflow: {
    name: 'Cashflow Dashboard',
    description: 'Proyección de liquidaciones, cuotas pendientes, por gateway',
    widgets: [
      { type: 'kpi', config: { metric: 'liquidable2w' }, size: { cols: 3, rows: 1 } },
      { type: 'kpi', config: { metric: 'liquidable4w' }, size: { cols: 3, rows: 1 } },
      { type: 'kpi', config: { metric: 'pendienteLiquidar' }, size: { cols: 3, rows: 1 } },
      { type: 'kpi', config: { metric: 'liquidado' }, size: { cols: 3, rows: 1 } },
      { type: 'areaChart', config: { series: ['liquidable2w'], xAxis: 'date', stacked: false }, size: { cols: 8, rows: 2 } },
      { type: 'donut', config: { dataField: 'medioPago' }, size: { cols: 4, rows: 2 } },
      { type: 'table', config: { dataSource: 'cashflow', pageSize: 20 }, size: { cols: 12, rows: 3 } },
    ]
  },

  productos: {
    name: 'Productos Dashboard',
    description: 'Ranking de productos, márgenes, análisis de rentabilidad',
    widgets: [
      { type: 'kpi', config: { metric: 'aov', showDelta: true }, size: { cols: 4, rows: 1 } },
      { type: 'kpi', config: { metric: 'profitMargin', showDelta: true }, size: { cols: 4, rows: 1 } },
      { type: 'kpi', config: { metric: 'cogs', showDelta: true }, size: { cols: 4, rows: 1 } },
      { type: 'ranking', config: { dataSource: 'products', rankBy: 'revenue', labelField: 'name', limit: 10 }, size: { cols: 6, rows: 2 } },
      { type: 'ranking', config: { dataSource: 'products', rankBy: 'marginPct', labelField: 'name', limit: 10 }, size: { cols: 6, rows: 2 } },
      { type: 'table', config: { dataSource: 'products', pageSize: 20 }, size: { cols: 12, rows: 3 } },
    ]
  },

  clientes: {
    name: 'Clientes Dashboard',
    description: 'Segmentación NC/RC, cohorts, retención',
    widgets: [
      { type: 'kpi', config: { metric: 'ncPct', showDelta: true, showHealth: true }, size: { cols: 3, rows: 1 } },
      { type: 'kpi', config: { metric: 'ncCpa', showDelta: true }, size: { cols: 3, rows: 1 } },
      { type: 'kpi', config: { metric: 'rcRevenuePct', showDelta: true }, size: { cols: 3, rows: 1 } },
      { type: 'kpi', config: { metric: 'avgOrdersPerCustomer', showDelta: true }, size: { cols: 3, rows: 1 } },
      { type: 'donut', config: { dataField: 'ncRcSplit' }, size: { cols: 4, rows: 2 } },
      { type: 'lineChart', config: { series: ['ncPct'], xAxis: 'date', showTargetLine: true }, size: { cols: 8, rows: 2 } },
      { type: 'table', config: { dataSource: 'customers', pageSize: 20 }, size: { cols: 12, rows: 3 } },
    ]
  },

  costos: {
    name: 'Costos Dashboard',
    description: 'Desglose de deducciones, márgenes, breakeven',
    widgets: [
      { type: 'kpi', config: { metric: 'comisionesPago', showDelta: true }, size: { cols: 3, rows: 1 } },
      { type: 'kpi', config: { metric: 'ibb', showDelta: true }, size: { cols: 3, rows: 1 } },
      { type: 'kpi', config: { metric: 'cogs', showDelta: true }, size: { cols: 3, rows: 1 } },
      { type: 'kpi', config: { metric: 'profitMargin', showHealth: true }, size: { cols: 3, rows: 1 } },
      { type: 'waterfall', config: { steps: DEFAULT_WATERFALL_STEPS }, size: { cols: 12, rows: 2 } },
      { type: 'lineChart', config: { series: ['profitMargin', 'roasBreakeven'], xAxis: 'date', showBreakevenLine: true }, size: { cols: 12, rows: 2 } },
    ]
  },

  creativos: {
    name: 'Creativos Dashboard',
    description: 'Análisis de piezas creativas de Meta Ads',
    widgets: [
      { type: 'kpi', config: { metric: 'ctr', showDelta: true }, size: { cols: 3, rows: 1 } },
      { type: 'kpi', config: { metric: 'cpc', showDelta: true }, size: { cols: 3, rows: 1 } },
      { type: 'kpi', config: { metric: 'cpm', showDelta: true }, size: { cols: 3, rows: 1 } },
      { type: 'kpi', config: { metric: 'hookRate', showDelta: true }, size: { cols: 3, rows: 1 } },
      { type: 'ranking', config: { dataSource: 'campaigns', rankBy: 'roas', labelField: 'name', limit: 10 }, size: { cols: 6, rows: 2 } },
      { type: 'table', config: { dataSource: 'campaigns', pageSize: 15 }, size: { cols: 6, rows: 2 } },
      { type: 'heatmap', config: { metric: 'spend' }, size: { cols: 12, rows: 2 } },
    ]
  },
};

// API para aplicar template
async function applyTemplate(storeId, pageId, templateKey) {
  // Borrar widgets existentes de la página
  await Widget.deleteMany({ storeId, pageId });

  // Crear widgets del template
  const template = DASHBOARD_TEMPLATES[templateKey];
  if (!template) throw new Error(`Template ${templateKey} not found`);

  const widgets = template.widgets.map((w, i) => ({
    storeId,
    pageId,
    type: w.type,
    config: w.config,
    size: w.size,
    style: w.style || {},
    position: i,
  }));

  await Widget.insertMany(widgets);
  return widgets;
}

// Al entrar a una sección por primera vez, si no tiene widgets, aplicar template
async function ensureDefaultWidgets(storeId, pageId) {
  const count = await Widget.countDocuments({ storeId, pageId });
  if (count === 0 && DASHBOARD_TEMPLATES[pageId]) {
    await applyTemplate(storeId, pageId, pageId);
  }
}
```

**UI para selección de template:**

```jsx
function TemplateSelector({ storeId, pageId, onApply }) {
  const templates = Object.entries(DASHBOARD_TEMPLATES);

  return (
    <div className="template-selector">
      <h3>Elegí un template o empezá de cero</h3>
      <div className="template-grid">
        {templates.map(([key, tpl]) => (
          <button key={key} className="template-card" onClick={() => onApply(key)}>
            <span className="template-name">{tpl.name}</span>
            <span className="template-desc">{tpl.description}</span>
            <span className="template-count">{tpl.widgets.length} widgets</span>
          </button>
        ))}
        <button className="template-card template-empty" onClick={() => onApply(null)}>
          <span className="template-name">Dashboard vacío</span>
          <span className="template-desc">Empezar desde cero y agregar widgets manualmente</span>
        </button>
      </div>
    </div>
  );
}
```

### 4.11 Persistencia y API

```js
// routes/widgetRoutes.js

// Obtener widgets de una página
router.get('/store/:storeId/widgets/:pageId', async (req, res) => {
  // Asegurar que existan widgets por defecto
  await ensureDefaultWidgets(req.params.storeId, req.params.pageId);
  const widgets = await Widget.find({
    storeId: req.params.storeId,
    pageId: req.params.pageId
  }).sort('position');
  res.json(widgets);
});

// Crear widget
router.post('/store/:storeId/widgets', async (req, res) => {
  const { pageId, type, config, style, size, title } = req.body;
  if (!validateConfig(type, config)) {
    return res.status(400).json({ error: 'Configuración inválida para el tipo de widget' });
  }
  const maxPos = await Widget.findOne({ storeId: req.params.storeId, pageId })
    .sort('-position').lean();
  const widget = await Widget.create({
    storeId: req.params.storeId,
    pageId, type, config, style, size, title,
    position: (maxPos?.position || 0) + 1
  });
  res.json(widget);
});

// Actualizar widget (config, style, size, title — todo editable)
router.put('/store/:storeId/widgets/:widgetId', async (req, res) => {
  const { type, config, style, size, title } = req.body;
  if (type && config && !validateConfig(type, config)) {
    return res.status(400).json({ error: 'Configuración inválida para el tipo de widget' });
  }
  const widget = await Widget.findByIdAndUpdate(
    req.params.widgetId,
    { $set: { type, config, style, size, title } },
    { new: true }
  );
  res.json(widget);
});

// Duplicar widget
router.post('/store/:storeId/widgets/:widgetId/duplicate', async (req, res) => {
  const original = await Widget.findById(req.params.widgetId).lean();
  if (!original) return res.status(404).json({ error: 'Widget no encontrado' });
  const maxPos = await Widget.findOne({ storeId: req.params.storeId, pageId: original.pageId })
    .sort('-position').lean();
  const duplicate = await Widget.create({
    ...original,
    _id: undefined,
    title: `${original.title || WIDGET_TYPES[original.type]?.name} (copia)`,
    position: (maxPos?.position || 0) + 1,
  });
  res.json(duplicate);
});

// Reordenar widgets (recibe array de IDs en nuevo orden)
router.put('/store/:storeId/widgets-reorder/:pageId', async (req, res) => {
  const { orderedIds } = req.body;
  const bulk = orderedIds.map((id, i) => ({
    updateOne: { filter: { _id: id }, update: { $set: { position: i } } }
  }));
  await Widget.bulkWrite(bulk);
  res.json({ success: true });
});

// Aplicar template (reemplaza todos los widgets de la página)
router.post('/store/:storeId/widgets-template/:pageId', async (req, res) => {
  const { templateKey } = req.body;
  const widgets = await applyTemplate(req.params.storeId, req.params.pageId, templateKey);
  res.json(widgets);
});

// Eliminar widget
router.delete('/store/:storeId/widgets/:widgetId', async (req, res) => {
  await Widget.findByIdAndDelete(req.params.widgetId);
  res.json({ success: true });
});

// Eliminar todos los widgets de una página (reset)
router.delete('/store/:storeId/widgets-page/:pageId', async (req, res) => {
  await Widget.deleteMany({ storeId: req.params.storeId, pageId: req.params.pageId });
  res.json({ success: true });
});
```

### 4.12 Home metrics — Caso especial simplificado

Las métricas del Home card (vista agencia) NO usan el widget system completo. Son un array de metric keys guardado en `Store.metricasHome`, con un límite de 5 métricas seleccionables desde las 55 disponibles:

```jsx
function HomeMetricsSelector({ store, onSave }) {
  const [selected, setSelected] = useState(
    store.metricasHome || ['ordenesPositivas', 'revenue', 'trueRoas', 'profit', 'ncPct']
  );

  const toggle = (metric) => {
    if (selected.includes(metric)) {
      setSelected(selected.filter(m => m !== metric));
    } else if (selected.length < 5) {
      setSelected([...selected, metric]);
    }
  };

  return (
    <div className="home-metrics-selector">
      <p>Elegí hasta 5 métricas para la card de Home ({selected.length}/5)</p>

      {/* Métricas seleccionadas con orden arrastra */}
      <div className="selected-metrics">
        {selected.map(metric => (
          <div key={metric} className="selected-metric-chip" draggable>
            {METRIC_CATALOG[metric]?.label}
            <button onClick={() => toggle(metric)}>×</button>
          </div>
        ))}
      </div>

      {/* Catálogo agrupado por categoría */}
      {METRIC_CATEGORIES.map(cat => (
        <div key={cat.key} className="metric-category">
          <h4>{cat.label}</h4>
          <div className="metrics-grid">
            {cat.metrics.map(m => (
              <button
                key={m.key}
                className={`metric-btn ${selected.includes(m.key) ? 'selected' : ''}`}
                onClick={() => toggle(m.key)}
                disabled={!selected.includes(m.key) && selected.length >= 5}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <button className="btn-primary" onClick={() => onSave(selected)}>Guardar</button>
    </div>
  );
}
```

### 4.13 Data fetching strategy

Principio clave: **N widgets, mínimos requests**. El sistema agrupa las necesidades de data de todos los widgets de una página y hace la menor cantidad de llamadas posibles:

```jsx
// hooks/usePageData.js — Hook central de data para una página de widgets
function usePageData(storeId, pageId) {
  const { toQueryParams } = useDateRange(pageId);
  const params = toQueryParams();

  // 1. Fetch de la configuración de widgets
  const { data: widgets } = useQuery(
    ['widgets', storeId, pageId],
    () => api.getWidgets(storeId, pageId),
    { staleTime: 60_000 }
  );

  // 2. Analizar qué data necesitan los widgets configurados
  const dataNeeds = useMemo(() => analyzeDataNeeds(widgets), [widgets]);

  // 3. Fetch condicional según lo que los widgets necesitan
  const { data: metrics } = useQuery(
    ['metrics', storeId, params],
    () => api.getMetrics(storeId, params),
    { enabled: dataNeeds.needsMetrics, keepPreviousData: true, staleTime: 30_000 }
  );

  const { data: timeseries } = useQuery(
    ['timeseries', storeId, params],
    () => api.getTimeseries(storeId, params),
    { enabled: dataNeeds.needsTimeseries, keepPreviousData: true, staleTime: 30_000 }
  );

  const { data: tableData } = useQuery(
    ['tableData', storeId, params, dataNeeds.dataSources],
    () => api.getTableData(storeId, params, dataNeeds.dataSources),
    { enabled: dataNeeds.dataSources.length > 0, keepPreviousData: true, staleTime: 30_000 }
  );

  const { data: health } = useQuery(
    ['health', storeId],
    () => api.getHealth(storeId),
    { enabled: dataNeeds.needsHealth, staleTime: 120_000 }
  );

  return { widgets, metrics, timeseries, tableData, health, isLoading: !widgets };
}

// Analizar qué endpoints necesitan los widgets de esta página
function analyzeDataNeeds(widgets) {
  if (!widgets?.length) return { needsMetrics: false, needsTimeseries: false, needsHealth: false, dataSources: [] };

  const needs = {
    needsMetrics: false,
    needsTimeseries: false,
    needsHealth: false,
    dataSources: new Set(),
  };

  for (const w of widgets) {
    const t = w.type;

    // KPI types siempre necesitan metrics
    if (['kpi', 'kpiCompact', 'kpiComparison', 'kpiTarget', 'scorecard', 'gauge'].includes(t)) {
      needs.needsMetrics = true;
    }

    // Chart types necesitan timeseries
    if (['lineChart', 'areaChart', 'barChart', 'heatmap'].includes(t)) {
      needs.needsTimeseries = true;
    }

    // Donut, funnel, waterfall necesitan metrics (agregados)
    if (['donut', 'funnel', 'waterfall'].includes(t)) {
      needs.needsMetrics = true;
    }

    // Table y ranking necesitan data específica
    if (['table', 'ranking'].includes(t) && w.config?.dataSource) {
      needs.dataSources.add(w.config.dataSource);
    }

    // Si algún widget muestra health
    if (w.config?.showHealth) {
      needs.needsHealth = true;
    }
  }

  return { ...needs, dataSources: [...needs.dataSources] };
}
```

**Página de dashboard completa (ejemplo):**

```jsx
// pages/DashboardPage.jsx
function DashboardPage({ pageId }) {
  const { storeId } = useStoreContext();
  const { widgets, metrics, timeseries, tableData, health, isLoading } = usePageData(storeId, pageId);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);
  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false);

  const { mutate: saveWidget } = useMutation(
    (data) => data._id ? api.updateWidget(storeId, data._id, data) : api.createWidget(storeId, data),
    { onSuccess: () => queryClient.invalidateQueries(['widgets', storeId, pageId]) }
  );

  const { mutate: deleteWidget } = useMutation(
    (widgetId) => api.deleteWidget(storeId, widgetId),
    { onSuccess: () => queryClient.invalidateQueries(['widgets', storeId, pageId]) }
  );

  const { mutate: duplicateWidget } = useMutation(
    (widgetId) => api.duplicateWidget(storeId, widgetId),
    { onSuccess: () => queryClient.invalidateQueries(['widgets', storeId, pageId]) }
  );

  const { mutate: reorderWidgets } = useMutation(
    (orderedIds) => api.reorderWidgets(storeId, pageId, orderedIds)
  );

  const { mutate: applyTemplateApi } = useMutation(
    (templateKey) => api.applyTemplate(storeId, pageId, templateKey),
    { onSuccess: () => {
      queryClient.invalidateQueries(['widgets', storeId, pageId]);
      setTemplateSelectorOpen(false);
    }}
  );

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="dashboard-page">
      {/* Toolbar */}
      <div className="dashboard-toolbar">
        <DateRangePicker sectionId={pageId} />
        <div className="toolbar-actions">
          <button onClick={() => setTemplateSelectorOpen(true)}>📐 Templates</button>
          <button onClick={() => setIsEditMode(!isEditMode)} className={isEditMode ? 'active' : ''}>
            {isEditMode ? '✓ Listo' : '✏️ Editar'}
          </button>
        </div>
      </div>

      {/* Grid de widgets */}
      <WidgetGrid
        widgets={widgets}
        metrics={metrics}
        health={health}
        timeseries={timeseries}
        tableData={tableData}
        isEditMode={isEditMode}
        onReorder={reorderWidgets}
        onEdit={(w) => { setEditingWidget(w); setEditorOpen(true); }}
        onDelete={deleteWidget}
        onDuplicate={(w) => duplicateWidget(w._id)}
      />

      {/* Botón agregar widget (visible en edit mode) */}
      {isEditMode && (
        <button className="add-widget-btn" onClick={() => { setEditingWidget(null); setEditorOpen(true); }}>
          + Agregar widget
        </button>
      )}

      {/* Widget Editor Modal */}
      {editorOpen && (
        <WidgetEditor
          pageId={pageId}
          storeId={storeId}
          existingWidget={editingWidget}
          onSave={saveWidget}
          onClose={() => { setEditorOpen(false); setEditingWidget(null); }}
        />
      )}

      {/* Template Selector Modal */}
      {templateSelectorOpen && (
        <TemplateSelector
          storeId={storeId}
          pageId={pageId}
          onApply={applyTemplateApi}
        />
      )}
    </div>
  );
}
```

**Endpoints de backend para data fetching:**

```js
// routes/dataRoutes.js

// Métricas agregadas (para KPIs, donuts, waterfall, etc.)
router.get('/store/:storeId/metrics', parseDateRange, async (req, res) => {
  const { from, to, compareFrom, compareTo } = req.dateRange;
  const current = await aggregateRange(req.params.storeId, from, to);
  let comparison = null, deltas = null;
  if (compareFrom && compareTo) {
    comparison = await aggregateRange(req.params.storeId, compareFrom, compareTo);
    deltas = calculateDeltas(current, comparison);
  }
  const health = await evaluateHealth(req.params.storeId, current);
  res.json({ current, comparison, deltas, health });
});

// Timeseries (para line/area/bar charts, heatmap)
router.get('/store/:storeId/timeseries', parseDateRange, async (req, res) => {
  const { from, to } = req.dateRange;
  const data = await DailyMetric.find({
    storeId: req.params.storeId,
    date: { $gte: from, $lte: to }
  }).sort('date').lean();
  res.json(data);
});

// Table data (para tables, rankings — solo fetch de dataSources necesarios)
router.get('/store/:storeId/tabledata', parseDateRange, async (req, res) => {
  const { from, to } = req.dateRange;
  const sources = req.query.sources?.split(',') || [];
  const result = {};

  if (sources.includes('orders')) {
    result.orders = await Order.find({
      storeId: req.params.storeId,
      createdAt: { $gte: from, $lte: to },
      financialStatus: 'paid'
    }).sort('-createdAt').lean();
  }

  if (sources.includes('products')) {
    result.products = await getProductAggregation(req.params.storeId, from, to);
  }

  if (sources.includes('campaigns')) {
    result.campaigns = await getCampaignMetrics(req.params.storeId, from, to, 'campaign');
  }

  if (sources.includes('customers')) {
    result.customers = await getCustomerList(req.params.storeId, from, to);
  }

  if (sources.includes('cashflow')) {
    result.cashflow = await CashflowEntry.find({
      storeId: req.params.storeId,
      fechaEstimada: { $gte: from, $lte: to }
    }).sort('fechaEstimada').lean();
  }

  res.json(result);
});

// Health (evaluación de KPIs vs objetivos)
router.get('/store/:storeId/health', async (req, res) => {
  const today = new Date();
  const from = startOfMonth(today);
  const metrics = await aggregateRange(req.params.storeId, from, today);
  const health = await evaluateHealth(req.params.storeId, metrics);
  res.json(health);
});
```

---

## FASE 4B: CAPA DE ANÁLISIS Y COMENTARIOS — Del dato al insight accionable

### 4B.1 Problema y filosofía

El informe de Giorlent (febrero 2026) demuestra que el valor real no está en mostrar "ROAS 6.89x" sino en decir "La caída es de volumen, no de pricing — el ticket se mantuvo estable (+1.7%) mientras las órdenes cayeron -24%". La app necesita generar este tipo de interpretaciones automáticamente en cada sección.

**Filosofía: 3 capas de comentarios, cada una independiente.**

| Capa | Fuente | Latencia | Costo | Ejemplo |
|------|--------|----------|-------|---------|
| **L1: Reglas automáticas** | Motor de reglas JS | Instantáneo | $0 | "Cart→Checkout 14.9% — CUELLO DE BOTELLA — ~2.267 carritos perdidos/mes ($376M potencial)" |
| **L2: AI generativa** | Claude API (tool_use) | 3-8 seg | Tokens | "El problema es de volumen, no de pricing. La concentración de ~70% del presupuesto en ángulos de ROAS <1.5x es el mayor desperdicio identificado" |
| **L3: Notas manuales** | El usuario/agencia escribe | Manual | $0 | "Pausar Gonzalo como protagonista principal, reasignar a Fran y catálogos" |

Las 3 capas coexisten. L1 siempre está presente, L2 se genera on-demand o por cron, L3 es editable por el equipo. En la UI se muestran juntas como un feed de insights debajo de cada sección de widgets.

### 4B.2 Tipos de commentary (taxonomía)

Del análisis del informe Giorlent extraemos 12 tipos de comentarios que el sistema debe poder generar:

```js
// config/commentaryTypes.js

const COMMENTARY_TYPES = {
  // === TIPO 1: Interpretaciones contextuales ===
  contextual_interpretation: {
    name: 'Interpretación contextual',
    icon: '💡',
    color: '#529CCA',
    // Cruza múltiples métricas para dar una lectura coherente
    // Ej: "El problema es de volumen, no de pricing — ticket estable +1.7% pero órdenes -24%"
    layer: 'L1+L2', // L1 genera la versión simple, L2 la enriquece
  },

  // === TIPO 2: Cuellos de botella cuantificados ===
  bottleneck: {
    name: 'Cuello de botella',
    icon: '⚠️',
    color: '#CB7B3E',
    // Identifica el punto débil del funnel con impacto estimado en $
    // Ej: "Cart→Checkout 14.9% — 2.267 carritos perdidos = ~$376M potencial"
    layer: 'L1',
  },

  // === TIPO 3: Verdict badges por item ===
  verdict: {
    name: 'Veredicto',
    icon: '🏷️',
    color: 'varies', // verde=Escalar, rojo=Pausar, azul=Testear, gris=Mantener
    // Cada campaña/producto/creativo recibe un badge automático
    // Ej: "ESCALAR — Fotocromático ROAS 11.55x con solo 1 ad"
    layer: 'L1',
  },

  // === TIPO 4: Anomalía / alerta con contexto ===
  anomaly: {
    name: 'Anomalía',
    icon: '🔴',
    color: '#C75A5A',
    // Detecta valores fuera de lo esperado y explica por qué importa
    // Ej: "Revenue cayó -22.9% vs período anterior. Estacionalidad post-verano probable pero requiere atención"
    layer: 'L1',
  },

  // === TIPO 5: Oportunidad cuantificada ===
  opportunity: {
    name: 'Oportunidad',
    icon: '🚀',
    color: '#4DAB9A',
    // Identifica potencial no explotado con estimación de impacto
    // Ej: "Fotocromático (11.55x ROAS) tiene 1 solo ad — crear 3-5 variantes podría duplicar compras"
    layer: 'L1+L2',
  },

  // === TIPO 6: Comparación/benchmark ===
  comparison: {
    name: 'Comparación',
    icon: '📊',
    color: '#529CCA',
    // Compara contra período anterior, objetivo, o benchmark
    // Ej: "Ticket mobile $107K es 42% menor que desktop $187K — oportunidad en UX mobile"
    layer: 'L1',
  },

  // === TIPO 7: Correlación cruzada ===
  cross_correlation: {
    name: 'Correlación cruzada',
    icon: '🔗',
    color: '#8b5cf6',
    // Conecta datos de diferentes secciones
    // Ej: "El top product (Cristales HD 19% del revenue) es complementario natural al clip-on — oportunidad cross-sell"
    layer: 'L2', // requiere AI por complejidad
  },

  // === TIPO 8: Concentración / riesgo ===
  concentration_risk: {
    name: 'Riesgo de concentración',
    icon: '⚡',
    color: '#CB7B3E',
    // Detecta dependencia excesiva en un canal/producto/campaña
    // Ej: "Top 10 productos = 50.3% del revenue. 'Secuencia Clip on hombre' genera 27% de compras ECOM"
    layer: 'L1',
  },

  // === TIPO 9: Diagnóstico narrativo ===
  diagnostic: {
    name: 'Diagnóstico estratégico',
    icon: '📋',
    color: '#1a1a2e',
    // Párrafo de síntesis que conecta todo (como sección 14 del informe)
    // Solo se genera por AI o manual
    layer: 'L2+L3',
  },

  // === TIPO 10: Acción recomendada ===
  action_item: {
    name: 'Acción recomendada',
    icon: '✅',
    color: '#4DAB9A',
    // Recomendación concreta y accionable
    // Ej: "IMPLEMENTAR — Trust badges en página de carrito (envío, garantía, pago seguro)"
    layer: 'L2+L3',
  },

  // === TIPO 11: Win highlight ===
  win: {
    name: 'Win',
    icon: '🏆',
    color: '#4DAB9A',
    // Lo que está funcionando bien — refuerzo positivo
    // Ej: "ROAS real 6.89x con margen post-ads de 85.5% — cada $1 genera $6.89"
    layer: 'L1',
  },

  // === TIPO 12: Nota manual del equipo ===
  manual_note: {
    name: 'Nota del equipo',
    icon: '📝',
    color: '#7a8a9e',
    // Escrita por el usuario, puede ser para sí mismo o para compartir en informe
    layer: 'L3',
  },
};
```

### 4B.3 Modelo de datos — Commentary

```js
// models/Commentary.js
const CommentarySchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
  sectionId: { type: String, required: true, index: true },
    // 'resumen', 'metaAds', 'cashflow', 'productos', 'clientes', 'costos', 'creativos', 'funnel', '_global'

  // Tipo y capa
  type: { type: String, enum: Object.keys(COMMENTARY_TYPES), required: true },
  layer: { type: String, enum: ['L1', 'L2', 'L3'], required: true },

  // Contenido
  title: { type: String, required: true },          // "Cart→Checkout: CUELLO DE BOTELLA"
  body: { type: String, required: true },            // "14.9% CVR — 2.267 carritos perdidos/mes (~$376M potencial)"
  severity: { type: String, enum: ['positive', 'neutral', 'warning', 'critical'], default: 'neutral' },

  // Contexto de datos (qué métricas/items generaron este comentario)
  context: {
    metrics: [{ key: String, value: Number, format: String }],  // métricas involucradas
    items: [{ type: String, id: String, name: String }],        // campaña/producto/cliente específico
    period: { from: Date, to: Date },
    comparisonPeriod: { from: Date, to: Date },
  },

  // Verdict badge (para tipo 'verdict')
  verdict: {
    action: { type: String, enum: ['escalar', 'mantener', 'revisar', 'pausar', 'testear', 'implementar', 'monitorear'] },
    confidence: { type: Number, min: 0, max: 1 },  // qué tan seguro es el veredicto
  },

  // Impacto estimado (para tipos bottleneck, opportunity)
  impact: {
    estimatedValue: Number,       // en $ (ej: $376M de carritos perdidos)
    estimatedPctImprovement: Number, // ej: +15% si se implementa
    description: String,          // "Revenue potencial recuperable"
  },

  // Metadata
  generatedBy: { type: String, enum: ['rules', 'ai', 'manual'], required: true },
  generatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },  // L1 y L2 expiran cuando cambian los datos, L3 no expira
  pinned: { type: Boolean, default: false },    // fijar arriba del feed
  archived: { type: Boolean, default: false },  // ocultar sin borrar
  editedBy: { type: String },                   // si L2 fue editado manualmente

  // Para informes exportables (como el de Giorlent)
  includeInReport: { type: Boolean, default: true },
  reportSection: { type: String }, // en qué sección del informe aparece
}, { timestamps: true });

CommentarySchema.index({ storeId: 1, sectionId: 1, layer: 1, generatedAt: -1 });
CommentarySchema.index({ storeId: 1, expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL auto-cleanup
```

### 4B.4 Motor de reglas L1 — Generación automática instantánea

El motor L1 se ejecuta cada vez que se recalculan las métricas (post-sync o al abrir una sección). Produce comentarios instantáneos sin costo:

```js
// services/commentaryEngine.js

const L1_RULES = [

  // ——— RESUMEN / DASHBOARD ———

  {
    id: 'revenue_drop',
    section: 'resumen',
    type: 'anomaly',
    check: (current, comparison) => {
      const delta = comparison ? ((current.revenue - comparison.revenue) / comparison.revenue) * 100 : null;
      if (delta != null && delta < -15) return { delta, current: current.revenue, previous: comparison.revenue };
      return null;
    },
    generate: (data) => ({
      title: `Revenue cayó ${data.delta.toFixed(1)}% vs período anterior`,
      body: `De $${abbr(data.previous)} a $${abbr(data.current)}. ${
        Math.abs(data.delta) > 20
          ? 'Caída significativa — revisar si es estacionalidad o problema de adquisición.'
          : 'Caída moderada — monitorear tendencia en los próximos días.'
      }`,
      severity: Math.abs(data.delta) > 25 ? 'critical' : 'warning',
      context: { metrics: [
        { key: 'revenue', value: data.current, format: 'currency' },
        { key: 'revenueDelta', value: data.delta, format: 'percent' },
      ]},
    }),
  },

  {
    id: 'volume_vs_pricing',
    section: 'resumen',
    type: 'contextual_interpretation',
    check: (current, comparison) => {
      if (!comparison) return null;
      const revDelta = ((current.revenue - comparison.revenue) / comparison.revenue) * 100;
      const ordDelta = ((current.ordenesPositivas - comparison.ordenesPositivas) / comparison.ordenesPositivas) * 100;
      const aovDelta = ((current.aov - comparison.aov) / comparison.aov) * 100;
      // Revenue baja pero ticket estable → problema de volumen
      if (revDelta < -10 && Math.abs(aovDelta) < 5) {
        return { revDelta, ordDelta, aovDelta, problem: 'volume' };
      }
      // Revenue baja y ticket baja → problema de pricing/descuentos
      if (revDelta < -10 && aovDelta < -5) {
        return { revDelta, ordDelta, aovDelta, problem: 'pricing' };
      }
      return null;
    },
    generate: (data) => ({
      title: data.problem === 'volume'
        ? 'El problema es de volumen, no de pricing'
        : 'Caída en ticket promedio — posible exceso de descuentos',
      body: data.problem === 'volume'
        ? `El ticket se mantuvo estable (${data.aovDelta > 0 ? '+' : ''}${data.aovDelta.toFixed(1)}%) mientras las órdenes cayeron ${data.ordDelta.toFixed(1)}%. Foco en adquisición de tráfico.`
        : `El ticket cayó ${data.aovDelta.toFixed(1)}% junto con el revenue (${data.revDelta.toFixed(1)}%). Revisar política de descuentos y mix de productos.`,
      severity: 'warning',
    }),
  },

  {
    id: 'margin_win',
    section: 'resumen',
    type: 'win',
    check: (current) => {
      const marginPct = current.profitMargin;
      if (marginPct > 70) return { marginPct, profit: current.profit };
      return null;
    },
    generate: (data) => ({
      title: `Margen post-ads de ${data.marginPct.toFixed(1)}%`,
      body: `Profit neto: $${abbr(data.profit)}. Cada $1 invertido en ads genera alto retorno después de deducciones.`,
      severity: 'positive',
    }),
  },

  // ——— FUNNEL / CONVERSIÓN ———

  {
    id: 'funnel_bottleneck',
    section: 'metaAds',
    type: 'bottleneck',
    check: (current) => {
      // Detectar el paso con mayor drop-off en el funnel
      const steps = [
        { name: 'Impresiones→Clics', from: current.impressions, to: current.uniqueClicks, rate: current.ctr },
        { name: 'Clics→Landing', from: current.uniqueClicks, to: current.landingViews, rate: current.landingViews / current.uniqueClicks * 100 },
        { name: 'Landing→ATC', from: current.landingViews, to: current.addToCart, rate: current.addToCart / current.landingViews * 100 },
        { name: 'ATC→Checkout', from: current.addToCart, to: current.checkoutInitiated, rate: current.checkoutInitiated / current.addToCart * 100 },
        { name: 'Checkout→Compra', from: current.checkoutInitiated, to: current.purchases, rate: current.purchases / current.checkoutInitiated * 100 },
      ].filter(s => s.from > 0 && s.to > 0);

      // El bottleneck es el paso con menor tasa de conversión relativa
      let worst = null;
      for (const step of steps) {
        // Benchmarks típicos por paso
        const benchmarks = {
          'ATC→Checkout': 30,      // 30% es esperado
          'Landing→ATC': 15,       // 15% es esperado
          'Checkout→Compra': 50,   // 50% es esperado
        };
        const benchmark = benchmarks[step.name];
        if (benchmark && step.rate < benchmark * 0.6) { // más de 40% debajo del benchmark
          const lost = step.from - step.to;
          const revenuePerUnit = current.revenue / current.purchases || current.aov;
          if (!worst || step.rate / benchmark < worst.ratio) {
            worst = {
              step: step.name,
              rate: step.rate,
              benchmark,
              lost,
              potentialRevenue: lost * revenuePerUnit,
              ratio: step.rate / benchmark,
            };
          }
        }
      }
      return worst;
    },
    generate: (data) => ({
      title: `${data.step}: ${data.rate.toFixed(1)}% — CUELLO DE BOTELLA`,
      body: `${data.lost.toLocaleString('es-AR')} usuarios perdidos en este paso (benchmark: ${data.benchmark}%). Revenue potencial perdido estimado: ~$${abbr(data.potentialRevenue)}/mes.`,
      severity: 'critical',
      impact: {
        estimatedValue: data.potentialRevenue,
        description: 'Revenue potencial si se alcanza el benchmark del paso',
      },
    }),
  },

  // ——— CAMPAÑAS / CREATIVOS ———

  {
    id: 'campaign_verdicts',
    section: 'metaAds',
    type: 'verdict',
    check: (current, comparison, extra) => {
      // extra.campaigns es el array de campañas con métricas
      if (!extra?.campaigns?.length) return null;
      return extra.campaigns.map(c => {
        const roas = c.roas || 0;
        const spend = c.spend || 0;
        const purchases = c.purchases || 0;
        const roasBreakeven = extra.breakeven?.roasBreakeven || 2;

        let action, confidence;
        if (roas >= roasBreakeven * 2 && purchases >= 5) {
          action = 'escalar'; confidence = 0.9;
        } else if (roas >= roasBreakeven * 1.5 && purchases >= 3) {
          action = 'escalar'; confidence = 0.7;
        } else if (roas >= roasBreakeven && roas < roasBreakeven * 1.5) {
          action = 'mantener'; confidence = 0.7;
        } else if (roas > 0 && roas < roasBreakeven * 0.7 && spend > current.adSpend * 0.05) {
          action = 'pausar'; confidence = 0.8;
        } else if (purchases < 3 && roas > roasBreakeven) {
          action = 'testear'; confidence = 0.5; // ROAS alto pero bajo volumen
        } else {
          action = 'revisar'; confidence = 0.5;
        }

        return { ...c, action, confidence };
      }).filter(c => c.action !== 'mantener'); // solo mostrar los que requieren acción
    },
    generate: (campaigns) => campaigns.map(c => ({
      title: `${c.action.toUpperCase()} — ${c.name}`,
      body: `ROAS ${c.roas?.toFixed(2)}x | ${c.purchases} compras | $${abbr(c.spend)} gasto${
        c.action === 'pausar' ? ' — ROAS por debajo del breakeven, consumiendo presupuesto con retorno mínimo' :
        c.action === 'escalar' ? ' — Alto retorno confirmado, aumentar presupuesto' :
        c.action === 'testear' ? ' — ROAS prometedor pero bajo volumen, necesita más data' :
        ''
      }`,
      severity: c.action === 'pausar' ? 'critical' : c.action === 'escalar' ? 'positive' : 'neutral',
      verdict: { action: c.action, confidence: c.confidence },
      context: { items: [{ type: 'campaign', id: c.campaignId, name: c.name }] },
    })),
  },

  // ——— PRODUCTOS ———

  {
    id: 'product_concentration',
    section: 'productos',
    type: 'concentration_risk',
    check: (current, comparison, extra) => {
      if (!extra?.products?.length) return null;
      const totalRevenue = extra.products.reduce((sum, p) => sum + p.revenue, 0);
      const top10Revenue = extra.products.slice(0, 10).reduce((sum, p) => sum + p.revenue, 0);
      const top10Pct = (top10Revenue / totalRevenue) * 100;
      const topProduct = extra.products[0];
      const topPct = (topProduct.revenue / totalRevenue) * 100;

      if (top10Pct > 40 || topPct > 15) {
        return { top10Pct, topProduct: topProduct.name, topPct, totalProducts: extra.products.length };
      }
      return null;
    },
    generate: (data) => ({
      title: `Top 10 productos = ${data.top10Pct.toFixed(1)}% del revenue`,
      body: `"${data.topProduct}" lidera con ${data.topPct.toFixed(1)}%. ${data.totalProducts} productos vendidos en total. ${
        data.top10Pct > 60 ? 'Alta concentración — riesgo si un producto top cae.' :
        'Concentración moderada pero monitorear diversificación.'
      }`,
      severity: data.top10Pct > 60 ? 'warning' : 'neutral',
    }),
  },

  // ——— CLIENTES ———

  {
    id: 'retention_alert',
    section: 'clientes',
    type: 'anomaly',
    check: (current) => {
      const rcPct = current.rcPct || 0;
      if (rcPct < 5) return { rcPct, rcCount: current.rcCount, totalCustomers: current.totalCustomers };
      return null;
    },
    generate: (data) => ({
      title: `Recurrencia ${data.rcPct.toFixed(1)}% — muy baja`,
      body: `Solo ${data.rcCount} de ${data.totalCustomers} clientes compraron más de una vez. Sin estrategia de retención ni email marketing aparente.`,
      severity: 'warning',
      context: { metrics: [{ key: 'rcPct', value: data.rcPct, format: 'percent' }] },
    }),
  },

  {
    id: 'cross_sell_opportunity',
    section: 'clientes',
    type: 'opportunity',
    check: (current, comparison, extra) => {
      if (!extra?.products?.length || (current.rcPct || 0) >= 10) return null;
      // Si hay productos complementarios y baja recurrencia → oportunidad
      const topProducts = extra.products.slice(0, 5);
      return { rcPct: current.rcPct, topProducts: topProducts.map(p => p.name), totalCustomers: current.totalCustomers };
    },
    generate: (data) => ({
      title: `Oportunidad de cross-sell con ${data.totalCustomers} clientes`,
      body: `Con recurrencia del ${data.rcPct?.toFixed(1)}%, una campaña de retención/cross-sell con los top products podría recuperar ventas sin gasto adicional en adquisición.`,
      severity: 'positive',
      impact: {
        estimatedPctImprovement: 10,
        description: 'Aumento estimado en órdenes si se implementa email marketing básico',
      },
    }),
  },

  // ——— MOBILE vs DESKTOP ———

  {
    id: 'mobile_gap',
    section: 'resumen',
    type: 'comparison',
    check: (current, comparison, extra) => {
      if (!extra?.channels) return null;
      const desktop = extra.channels.find(c => c.name === 'desktop' || c.name === 'store');
      const mobile = extra.channels.find(c => c.name === 'mobile');
      if (!desktop || !mobile) return null;
      const gap = ((desktop.aov - mobile.aov) / desktop.aov) * 100;
      if (gap > 20) return { desktopAov: desktop.aov, mobileAov: mobile.aov, gap, mobileRevPct: (mobile.revenue / (desktop.revenue + mobile.revenue)) * 100 };
      return null;
    },
    generate: (data) => ({
      title: `Ticket mobile ${data.gap.toFixed(0)}% menor que desktop`,
      body: `Mobile: $${abbr(data.mobileAov)} vs Desktop: $${abbr(data.desktopAov)}. Mobile genera ${data.mobileRevPct.toFixed(1)}% del revenue pero probablemente recibe >60% del tráfico de Meta Ads. Oportunidad de mejora en UX mobile.`,
      severity: 'warning',
    }),
  },

  // ——— COSTOS ———

  {
    id: 'budget_waste',
    section: 'metaAds',
    type: 'bottleneck',
    check: (current, comparison, extra) => {
      if (!extra?.campaigns?.length) return null;
      const roasBreakeven = extra.breakeven?.roasBreakeven || 2;
      const underperformers = extra.campaigns.filter(c => (c.roas || 0) < roasBreakeven * 0.75);
      const wastedSpend = underperformers.reduce((sum, c) => sum + (c.spend || 0), 0);
      const wastedPct = (wastedSpend / current.adSpend) * 100;
      if (wastedPct > 20) {
        return { wastedSpend, wastedPct, count: underperformers.length, campaigns: underperformers.map(c => c.name) };
      }
      return null;
    },
    generate: (data) => ({
      title: `~${data.wastedPct.toFixed(0)}% del presupuesto en campañas bajo breakeven`,
      body: `${data.count} campañas con ROAS < breakeven consumen $${abbr(data.wastedSpend)}. Reasignar a campañas de alto ROAS podría mejorar el retorno general significativamente.`,
      severity: 'critical',
      impact: {
        estimatedValue: data.wastedSpend,
        description: 'Presupuesto recuperable si se pausan campañas underperforming',
      },
    }),
  },
];
```

### 4B.5 Ejecución del motor L1

```js
// services/commentaryEngine.js

async function generateL1Commentary(storeId, sectionId, dateRange) {
  const store = await Store.findById(storeId).lean();
  const { from, to } = dateRange;

  // Obtener datos necesarios
  const current = await aggregateRange(storeId, from, to);
  const comparison = dateRange.compareFrom
    ? await aggregateRange(storeId, dateRange.compareFrom, dateRange.compareTo)
    : null;

  // Datos extra según la sección
  const extra = {};
  if (['metaAds', 'creativos'].includes(sectionId)) {
    extra.campaigns = await getCampaignMetrics(storeId, from, to, 'campaign');
    extra.breakeven = store.objetivos?.breakeven;
  }
  if (['productos', 'resumen'].includes(sectionId)) {
    extra.products = await getProductAggregation(storeId, from, to);
  }
  if (sectionId === 'resumen') {
    extra.channels = await getChannelBreakdown(storeId, from, to);
  }
  if (sectionId === 'clientes') {
    extra.products = await getProductAggregation(storeId, from, to);
  }

  // Ejecutar reglas de la sección
  const applicableRules = L1_RULES.filter(r =>
    r.section === sectionId || r.section === '_global'
  );

  const commentaries = [];

  for (const rule of applicableRules) {
    try {
      const checkResult = rule.check(current, comparison, extra);
      if (!checkResult) continue;

      // Algunos rules generan múltiples commentaries (ej: verdicts por campaña)
      const generated = rule.generate(checkResult);
      const items = Array.isArray(generated) ? generated : [generated];

      for (const item of items) {
        commentaries.push({
          storeId,
          sectionId,
          type: rule.type,
          layer: 'L1',
          generatedBy: 'rules',
          ...item,
          context: {
            ...item.context,
            period: { from, to },
            comparisonPeriod: comparison ? { from: dateRange.compareFrom, to: dateRange.compareTo } : undefined,
          },
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // expira en 24h (se regenera)
        });
      }
    } catch (err) {
      console.error(`L1 rule ${rule.id} failed:`, err.message);
    }
  }

  // Upsert: reemplazar L1 existentes de esta sección
  await Commentary.deleteMany({ storeId, sectionId, layer: 'L1' });
  if (commentaries.length > 0) {
    await Commentary.insertMany(commentaries);
  }

  return commentaries;
}
```

### 4B.6 Generación AI (L2) — Análisis profundo con Claude

L2 genera los comentarios más valiosos: diagnósticos narrativos, correlaciones cruzadas, y acciones recomendadas. Se ejecuta on-demand (botón "Generar análisis") o por cron diario:

```js
// services/commentaryAI.js

async function generateL2Commentary(storeId, sectionId, dateRange) {
  const store = await Store.findById(storeId).lean();
  const current = await aggregateRange(storeId, dateRange.from, dateRange.to);
  const comparison = dateRange.compareFrom
    ? await aggregateRange(storeId, dateRange.compareFrom, dateRange.compareTo)
    : null;
  const health = await evaluateHealth(storeId, current);

  // Obtener L1 existentes para que AI no repita
  const existingL1 = await Commentary.find({ storeId, sectionId, layer: 'L1' }).lean();

  const systemPrompt = `Sos un analista senior de ecommerce para una agencia argentina.
Tu trabajo es generar insights accionables sobre los datos de la tienda "${store.nombre}".

REGLAS:
- Escribí en español argentino informal pero profesional
- Cada insight debe ser ACCIONABLE — no solo describir, sino recomendar qué hacer
- Cuantificá el impacto siempre que puedas (en $ o %)
- No repitas lo que ya dicen estos insights existentes: ${existingL1.map(c => c.title).join('; ')}
- Priorizá insights que crucen datos de diferentes áreas (ej: conectar retención con productos, o creativos con funnel)
- Máximo 5 insights, cada uno con título corto y cuerpo de 1-3 oraciones

Respondé con un JSON array de objetos con esta estructura:
[{
  "type": "diagnostic|cross_correlation|opportunity|action_item",
  "title": "Título corto y directo",
  "body": "Análisis en 1-3 oraciones con datos concretos",
  "severity": "positive|neutral|warning|critical",
  "impact": { "estimatedValue": number|null, "estimatedPctImprovement": number|null, "description": "string" } // opcional
}]`;

  const userPrompt = buildL2Prompt(sectionId, current, comparison, health, store.objetivos);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content[0].text;
  const insights = JSON.parse(text);

  // Guardar como L2
  const commentaries = insights.map((insight, i) => ({
    storeId,
    sectionId,
    type: insight.type,
    layer: 'L2',
    generatedBy: 'ai',
    title: insight.title,
    body: insight.body,
    severity: insight.severity,
    impact: insight.impact || undefined,
    context: { period: { from: dateRange.from, to: dateRange.to } },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // L2 expira en 7 días
  }));

  await Commentary.deleteMany({ storeId, sectionId, layer: 'L2' });
  await Commentary.insertMany(commentaries);

  return commentaries;
}

function buildL2Prompt(sectionId, current, comparison, health, objetivos) {
  let prompt = `Sección: ${sectionId}\n\nMétricas actuales:\n`;
  // (similar a buildAnalysisPrompt de Fase 7, pero enfocado en generar el JSON de insights)
  prompt += `Revenue: $${current.revenue?.toLocaleString()}\n`;
  prompt += `Net Revenue: $${current.netRevenue?.toLocaleString()}\n`;
  prompt += `Profit: $${current.profit?.toLocaleString()} (${current.profitMargin?.toFixed(1)}%)\n`;
  prompt += `ROAS: ${current.roas?.toFixed(2)}x | True ROAS: ${current.trueRoas?.toFixed(2)}x\n`;
  prompt += `CPA: $${current.cpa?.toLocaleString()} | NC CPA: $${current.ncCpa?.toLocaleString()}\n`;
  prompt += `NC%: ${current.ncPct?.toFixed(1)}% | AOV: $${current.aov?.toLocaleString()}\n`;
  prompt += `Órdenes: ${current.ordenesPositivas}\n`;

  if (comparison) {
    prompt += `\nVs período anterior:\n`;
    const deltas = calculateDeltas(current, comparison);
    prompt += `Revenue: ${deltas.revenue > 0 ? '+' : ''}${deltas.revenue.toFixed(1)}%\n`;
    prompt += `Órdenes: ${deltas.ordenesPositivas > 0 ? '+' : ''}${deltas.ordenesPositivas.toFixed(1)}%\n`;
    prompt += `AOV: ${deltas.aov > 0 ? '+' : ''}${deltas.aov.toFixed(1)}%\n`;
  }

  if (objetivos?.kpis) {
    prompt += `\nObjetivos: ROAS target ${objetivos.kpis.roasTarget}x, CPA máx $${objetivos.kpis.cpaMaximo}, Breakeven ROAS ${objetivos.breakeven?.roasBreakeven}x\n`;
  }

  prompt += `\nGenerá insights profundos que crucen estos datos. Buscá patrones, causas raíz, y oportunidades concretas.`;
  return prompt;
}
```

### 4B.7 Notas manuales (L3) — El equipo escribe

L3 es el más simple: un CRUD donde el usuario puede agregar notas, planes de acción, o comentarios que quiere que aparezcan en la sección y en los informes exportables:

```js
// routes/commentaryRoutes.js

// Crear nota manual
router.post('/store/:storeId/commentary', async (req, res) => {
  const { sectionId, title, body, type, severity, verdict, pinned, includeInReport } = req.body;
  const commentary = await Commentary.create({
    storeId: req.params.storeId,
    sectionId,
    type: type || 'manual_note',
    layer: 'L3',
    generatedBy: 'manual',
    title,
    body,
    severity: severity || 'neutral',
    verdict,
    pinned: pinned || false,
    includeInReport: includeInReport !== false,
    // L3 no expira
  });
  res.json(commentary);
});

// Editar cualquier commentary (L2 puede ser editado → se marca como editedBy)
router.put('/store/:storeId/commentary/:id', async (req, res) => {
  const update = { ...req.body };
  if (req.body.body || req.body.title) {
    update.editedBy = 'manual'; // marcar que fue editado por humano
  }
  const commentary = await Commentary.findByIdAndUpdate(req.params.id, update, { new: true });
  res.json(commentary);
});

// Obtener commentaries de una sección (todas las capas, ordenados por prioridad)
router.get('/store/:storeId/commentary/:sectionId', async (req, res) => {
  const commentaries = await Commentary.find({
    storeId: req.params.storeId,
    sectionId: req.params.sectionId,
    archived: { $ne: true },
  }).sort({ pinned: -1, severity: 1, generatedAt: -1 }).lean();

  // Orden de severity: critical > warning > neutral > positive
  const severityOrder = { critical: 0, warning: 1, neutral: 2, positive: 3 };
  commentaries.sort((a, b) => {
    if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
    return (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
  });

  res.json(commentaries);
});

// Archivar commentary
router.put('/store/:storeId/commentary/:id/archive', async (req, res) => {
  await Commentary.findByIdAndUpdate(req.params.id, { archived: true });
  res.json({ success: true });
});

// Toggle pin
router.put('/store/:storeId/commentary/:id/pin', async (req, res) => {
  const c = await Commentary.findById(req.params.id);
  c.pinned = !c.pinned;
  await c.save();
  res.json(c);
});

// Trigger L2 generation on demand
router.post('/store/:storeId/commentary/:sectionId/generate-ai', async (req, res) => {
  const dateRange = parseDateRangeFromQuery(req.query);
  const commentaries = await generateL2Commentary(req.params.storeId, req.params.sectionId, dateRange);
  res.json(commentaries);
});
```

### 4B.8 Componente UI — InsightFeed

El InsightFeed es el componente que renderiza los commentaries debajo de los widgets de cada sección:

```jsx
// components/commentary/InsightFeed.jsx

function InsightFeed({ storeId, sectionId }) {
  const { data: commentaries, isLoading } = useQuery(
    ['commentary', storeId, sectionId],
    () => api.getCommentary(storeId, sectionId)
  );

  const generateAI = useMutation(
    () => api.generateAICommentary(storeId, sectionId),
    { onSuccess: () => queryClient.invalidateQueries(['commentary', storeId, sectionId]) }
  );

  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'L1', 'L2', 'L3', 'critical', 'positive'

  const filtered = commentaries?.filter(c => {
    if (filter === 'all') return true;
    if (filter === 'critical') return c.severity === 'critical' || c.severity === 'warning';
    if (filter === 'positive') return c.severity === 'positive';
    return c.layer === filter;
  });

  if (isLoading) return <InsightFeedSkeleton />;

  return (
    <div className="insight-feed">
      {/* Header con filtros y acciones */}
      <div className="insight-feed-header">
        <h3>Análisis e insights</h3>
        <div className="insight-feed-actions">
          <FilterTabs value={filter} onChange={setFilter}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'critical', label: '⚠️ Alertas' },
              { value: 'positive', label: '🏆 Wins' },
              { value: 'L1', label: 'Auto' },
              { value: 'L2', label: 'AI' },
              { value: 'L3', label: 'Notas' },
            ]}
          />
          <button onClick={() => generateAI.mutate()} disabled={generateAI.isLoading} className="btn-sm btn-ai">
            {generateAI.isLoading ? '⏳ Generando...' : '🤖 Generar análisis AI'}
          </button>
          <button onClick={() => setShowNoteEditor(true)} className="btn-sm">
            ✏️ Agregar nota
          </button>
        </div>
      </div>

      {/* Feed de insights */}
      <div className="insight-cards">
        {filtered?.length === 0 && (
          <div className="insight-empty">No hay insights para esta sección. Probá generar un análisis con AI.</div>
        )}

        {filtered?.map(commentary => (
          <InsightCard key={commentary._id} commentary={commentary} storeId={storeId} />
        ))}
      </div>

      {/* Editor de nota manual */}
      {showNoteEditor && (
        <NoteEditor
          storeId={storeId}
          sectionId={sectionId}
          onSave={() => {
            setShowNoteEditor(false);
            queryClient.invalidateQueries(['commentary', storeId, sectionId]);
          }}
          onClose={() => setShowNoteEditor(false)}
        />
      )}
    </div>
  );
}

// Card individual de insight
function InsightCard({ commentary, storeId }) {
  const typeInfo = COMMENTARY_TYPES[commentary.type];
  const [expanded, setExpanded] = useState(false);

  const severityStyles = {
    critical: { bg: '#fce8e8', border: '#C75A5A', text: '#b44040' },
    warning: { bg: '#fff3e0', border: '#CB7B3E', text: '#b06a2a' },
    positive: { bg: '#e6f5f0', border: '#4DAB9A', text: '#2d8a6e' },
    neutral: { bg: '#f0f7ff', border: '#529CCA', text: '#2a5f9e' },
  };

  const style = severityStyles[commentary.severity] || severityStyles.neutral;

  return (
    <div className="insight-card" style={{
      background: style.bg,
      borderLeft: `4px solid ${style.border}`,
    }}>
      <div className="insight-card-header">
        <span className="insight-icon">{typeInfo?.icon || '💡'}</span>
        <span className="insight-title" style={{ color: style.text }}>{commentary.title}</span>
        <div className="insight-badges">
          {commentary.verdict?.action && (
            <VerdictBadge action={commentary.verdict.action} />
          )}
          {commentary.layer === 'L2' && <span className="badge badge-ai">AI</span>}
          {commentary.layer === 'L3' && <span className="badge badge-manual">Manual</span>}
          {commentary.pinned && <span className="badge badge-pinned">📌</span>}
        </div>
      </div>

      <div className="insight-card-body">{commentary.body}</div>

      {/* Impacto estimado si existe */}
      {commentary.impact?.estimatedValue && (
        <div className="insight-impact">
          💰 Impacto estimado: ${abbreviateNumber(commentary.impact.estimatedValue)}
          {commentary.impact.description && ` — ${commentary.impact.description}`}
        </div>
      )}

      {/* Métricas de contexto si existen */}
      {commentary.context?.metrics?.length > 0 && expanded && (
        <div className="insight-context">
          {commentary.context.metrics.map((m, i) => (
            <span key={i} className="context-chip">
              {METRIC_CATALOG[m.key]?.label || m.key}: {formatValue(m.format, m.value)}
            </span>
          ))}
        </div>
      )}

      {/* Acciones */}
      <div className="insight-card-actions">
        {(commentary.context?.metrics?.length > 0) && (
          <button className="btn-link" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Menos detalle' : 'Más detalle'}
          </button>
        )}
        <InsightMenu commentaryId={commentary._id} storeId={storeId} pinned={commentary.pinned} />
      </div>
    </div>
  );
}

// Badge de veredicto
function VerdictBadge({ action }) {
  const styles = {
    escalar: { bg: '#e6f5f0', color: '#2d8a6e', label: 'ESCALAR' },
    mantener: { bg: '#eef0f3', color: '#5a6a7e', label: 'MANTENER' },
    revisar: { bg: '#fef0e0', color: '#b06a2a', label: 'REVISAR' },
    pausar: { bg: '#fce8e8', color: '#b44040', label: 'PAUSAR' },
    testear: { bg: '#e8f0fa', color: '#3a7cc6', label: 'TESTEAR' },
    implementar: { bg: '#e6f5f0', color: '#2d8a6e', label: 'IMPLEMENTAR' },
    monitorear: { bg: '#f5e8f5', color: '#8a4a8a', label: 'MONITOREAR' },
  };
  const s = styles[action] || styles.revisar;
  return <span className="verdict-badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
}
```

### 4B.9 Layout de 3 paneles — dónde aparecen los insights

La app usa un layout de **3 paneles persistentes**. El panel derecho de análisis es siempre visible, cambia contextualmente según la sección activa del sidebar, y no requiere scroll adicional en el dashboard para verlo:

```
┌──────────┬──────────────────────────────────┬────────────────────┐
│ SIDEBAR  │       DASHBOARD CENTER           │  ANALYSIS PANEL    │
│  220px   │         flex: 1                  │     340px          │
│          │                                  │                    │
│ [Store▾] │  Header: Store — Sección         │  ANÁLISIS          │
│          │  [DateRange] [vs Anterior] [Edit]│  [Todos][Alertas]  │
│ GENERAL  │                                  │  [Wins][Acciones]  │
│ ▪ Resumen│  ⚠️ Top insight bar (critical)   │  [Notas]           │
│ ▪ Dashbd │                                  │                    │
│          │  ┌──────┐┌──────┐┌──────┐┌─────┐│  ─── Alertas ───   │
│ MARKETING│  │$49.0M││ 295  ││$166K ││85.5%││  🔴 Revenue -22.9% │
│ ▪ Meta   │  │↓-22% ││↓-24% ││↑+1.7%││ 🟢  ││  💡 Volumen, no    │
│ ▪ Creativ│  └──────┘└──────┘└──────┘└─────┘│     pricing        │
│ ▪ Pixel  │                                  │  ⚠️ Cart→Checkout  │
│          │  ┌──────────────────────────────┐│     14.9% BOTELLA  │
│ VENTAS   │  │ 📈 Revenue vs Ad Spend      ││     💰 ~$376M      │
│ ▪ Product│  │ (line chart + breakeven)     ││                    │
│ ▪ Cliente│  └──────────────────────────────┘│  ─── Wins ───      │
│          │                                  │  🏆 Margen 85.5%   │
│ FINANZAS │  ┌──────────────────────────────┐│  🏆 Sin competencia│
│ ▪ Costos │  │ Cascada Revenue → Profit     ││                    │
│ ▪ Cashfl │  └──────────────────────────────┘│  ─── Diagnóstico ──│
│          │                                  │  📋 AI: Giorlent   │
│ IA       │  ┌────────────┐┌────────────┐   │  cerró febrero...  │
│ ▪ AI Chat│  │ NC/RC donut││ Canales    │   │                    │
│ ▪ Reporte│  └────────────┘└────────────┘   │  ─── Acciones ──── │
│          │                                  │  🚀 ESCALAR fotos  │
│ CONFIG   │                                  │  ⛔ PAUSAR X en 1  │
│ ▪ Setting│                                  │                    │
│          │                                  │  ─── Notas ─────── │
│          │                                  │  📝 Lucas 08/03    │
│          │                                  │  Reunión Giorlent  │
│          │                                  │                    │
│          │                                  │  [🤖 AI] [✏️ Nota] │
└──────────┴──────────────────────────────────┴────────────────────┘
```

**Puntos clave del layout:**

1. **Sidebar izquierda (220px)** — Navegación entre secciones + selector de tienda. Ya definida en Fase 8.
2. **Dashboard central (flex: 1)** — Widgets configurables de la sección activa. Solo datos y gráficos. Tiene una "top insight bar" arriba que muestra el insight más crítico como resumen inline.
3. **Panel de análisis derecho (340px)** — Scroll independiente con todos los insights agrupados: Alertas, Wins, Diagnóstico AI, Acciones, Notas manuales. **Cambia automáticamente cuando el usuario navega entre secciones.**

**El panel derecho NO duplica data del centro.** El centro muestra números y gráficos; el panel derecho muestra interpretaciones, contexto y recomendaciones sobre esos números.

**Integración en el layout principal:**

```jsx
// layouts/StoreLayout.jsx — Layout de 3 paneles
function StoreLayout() {
  const { storeId } = useParams();
  const [currentSection, setCurrentSection] = useState('resumen');
  const [panelOpen, setPanelOpen] = useState(true);

  return (
    <div className="store-layout" style={{ display: 'flex', height: '100vh' }}>
      {/* Panel 1: Sidebar de navegación */}
      <StoreSidebar
        storeId={storeId}
        activeSection={currentSection}
        onNavigate={setCurrentSection}
      />

      {/* Panel 2: Dashboard central */}
      <div className="main-center" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <StoreHeader storeId={storeId} sectionId={currentSection} />
        <div className="content" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {/* Top insight bar — solo el más crítico */}
          <TopInsightBar storeId={storeId} sectionId={currentSection} />
          {/* Dashboard de widgets */}
          <DashboardPage pageId={currentSection} />
        </div>
      </div>

      {/* Panel 3: Análisis contextual */}
      {panelOpen && (
        <AnalysisPanel
          storeId={storeId}
          sectionId={currentSection}  // ← cambia al navegar
          onClose={() => setPanelOpen(false)}
        />
      )}
    </div>
  );
}

// TopInsightBar — barra inline arriba del dashboard con el insight más importante
function TopInsightBar({ storeId, sectionId }) {
  const { data: commentaries } = useQuery(
    ['commentary', storeId, sectionId],
    () => api.getCommentary(storeId, sectionId)
  );

  const top = commentaries?.find(c =>
    (c.severity === 'critical' || c.severity === 'warning') && c.pinned
  ) || commentaries?.find(c => c.severity === 'critical');

  if (!top) return null;

  return (
    <div className={`top-insight-bar severity-${top.severity}`}>
      <span className="insight-icon">{COMMENTARY_TYPES[top.type]?.icon}</span>
      <div>
        <strong>{top.title}</strong>
        <span className="top-insight-body">{top.body}</span>
      </div>
    </div>
  );
}

// AnalysisPanel — panel derecho persistente
function AnalysisPanel({ storeId, sectionId, onClose }) {
  const { data: commentaries } = useQuery(
    ['commentary', storeId, sectionId],
    () => api.getCommentary(storeId, sectionId)
  );

  const [filter, setFilter] = useState('all');

  const generateAI = useMutation(
    () => api.generateAICommentary(storeId, sectionId),
    { onSuccess: () => queryClient.invalidateQueries(['commentary', storeId, sectionId]) }
  );

  const [showNoteEditor, setShowNoteEditor] = useState(false);

  // Agrupar por tipo para mostrar en secciones
  const grouped = useMemo(() => {
    if (!commentaries) return {};
    return {
      alertas: commentaries.filter(c => c.severity === 'critical' || c.severity === 'warning'),
      wins: commentaries.filter(c => c.severity === 'positive' || c.type === 'win'),
      diagnostic: commentaries.filter(c => c.type === 'diagnostic' || c.type === 'cross_correlation'),
      actions: commentaries.filter(c => c.type === 'action_item' || c.verdict?.action),
      notes: commentaries.filter(c => c.layer === 'L3'),
    };
  }, [commentaries]);

  return (
    <div className="analysis-panel">
      <div className="panel-header">
        <h3>Análisis</h3>
        <button onClick={onClose}>✕</button>
      </div>

      <div className="panel-tabs">
        {['all', 'alertas', 'wins', 'actions', 'notes'].map(f => (
          <button key={f} className={`panel-tab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}>
            {f === 'all' ? 'Todos' : f === 'alertas' ? '⚠️ Alertas' :
             f === 'wins' ? 'Wins' : f === 'actions' ? 'Acciones' : 'Notas'}
          </button>
        ))}
      </div>

      <div className="panel-content">
        {(filter === 'all' || filter === 'alertas') && grouped.alertas?.length > 0 && (
          <>
            <div className="panel-separator">Alertas y problemas</div>
            {grouped.alertas.map(c => <InsightCard key={c._id} commentary={c} />)}
          </>
        )}

        {(filter === 'all' || filter === 'wins') && grouped.wins?.length > 0 && (
          <>
            <div className="panel-separator">Wins</div>
            {grouped.wins.map(c => <InsightCard key={c._id} commentary={c} />)}
          </>
        )}

        {(filter === 'all') && grouped.diagnostic?.length > 0 && (
          <>
            <div className="panel-separator">Diagnóstico AI</div>
            {grouped.diagnostic.map(c => <InsightCard key={c._id} commentary={c} />)}
          </>
        )}

        {(filter === 'all' || filter === 'actions') && grouped.actions?.length > 0 && (
          <>
            <div className="panel-separator">Acciones recomendadas</div>
            {grouped.actions.map(c => <InsightCard key={c._id} commentary={c} />)}
          </>
        )}

        {(filter === 'all' || filter === 'notes') && grouped.notes?.length > 0 && (
          <>
            <div className="panel-separator">Notas del equipo</div>
            {grouped.notes.map(c => <ManualNote key={c._id} note={c} />)}
          </>
        )}
      </div>

      <div className="panel-footer">
        <button className="btn-ai" onClick={() => generateAI.mutate()}>
          {generateAI.isLoading ? '⏳...' : '🤖 Generar AI'}
        </button>
        <button className="btn-note" onClick={() => setShowNoteEditor(true)}>
          ✏️ Nota
        </button>
      </div>

      {showNoteEditor && (
        <NoteEditor storeId={storeId} sectionId={sectionId}
          onSave={() => { setShowNoteEditor(false); queryClient.invalidateQueries(['commentary']); }}
          onClose={() => setShowNoteEditor(false)}
        />
      )}
    </div>
  );
}
```

Las tablas de campañas/productos en el dashboard central también muestran **verdict badges inline** (ESCALAR, PAUSAR, etc.) como columna adicional, conectados con los commentaries de tipo `verdict`.

### 4B.10 Exportación a informe (como el de Giorlent)

Los commentaries marcados con `includeInReport: true` se usan para generar un informe exportable automáticamente:

```js
// services/reportGenerator.js

async function generateMonthlyReport(storeId, month, year) {
  const store = await Store.findById(storeId).lean();
  const from = new Date(year, month - 1, 1);
  const to = endOfMonth(from);
  const prevFrom = subMonths(from, 1);
  const prevTo = endOfMonth(prevFrom);

  // Recolectar todos los datos
  const metrics = await aggregateRange(storeId, from, to);
  const comparison = await aggregateRange(storeId, prevFrom, prevTo);
  const deltas = calculateDeltas(metrics, comparison);
  const campaigns = await getCampaignMetrics(storeId, from, to, 'campaign');
  const products = await getProductAggregation(storeId, from, to);
  const health = await evaluateHealth(storeId, metrics);

  // Recolectar commentaries para el informe
  const allCommentaries = await Commentary.find({
    storeId,
    includeInReport: true,
    archived: { $ne: true },
    generatedAt: { $gte: from, $lte: new Date() },
  }).sort({ severity: 1, generatedAt: -1 }).lean();

  // Agrupar por sección
  const commentariesBySection = {};
  for (const c of allCommentaries) {
    if (!commentariesBySection[c.sectionId]) commentariesBySection[c.sectionId] = [];
    commentariesBySection[c.sectionId].push(c);
  }

  // Separar wins y problemas
  const wins = allCommentaries.filter(c => c.severity === 'positive' || c.type === 'win').slice(0, 5);
  const problems = allCommentaries.filter(c => c.severity === 'critical' || c.severity === 'warning').slice(0, 5);
  const actions = allCommentaries.filter(c => c.type === 'action_item' || c.verdict?.action);

  // Generar HTML del informe (estructura similar al de Giorlent)
  const html = renderReportHTML({
    store,
    period: { from, to, month, year },
    metrics, comparison, deltas,
    campaigns, products, health,
    commentariesBySection,
    wins, problems, actions,
  });

  return html;
}

// Endpoint
router.get('/store/:storeId/report/:year/:month', async (req, res) => {
  const html = await generateMonthlyReport(
    req.params.storeId,
    parseInt(req.params.month),
    parseInt(req.params.year)
  );
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Endpoint para descargar como HTML
router.get('/store/:storeId/report/:year/:month/download', async (req, res) => {
  const html = await generateMonthlyReport(req.params.storeId, parseInt(req.params.month), parseInt(req.params.year));
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', `attachment; filename="${store.nombre}-${req.params.year}-${req.params.month}.html"`);
  res.send(html);
});
```

### 4B.11 Cron de generación automática

```js
// crons/commentaryCron.js

// Regenerar L1 de todas las tiendas cada 6 horas
cron.schedule('0 */6 * * *', async () => {
  const stores = await Store.find({ active: true }).lean();
  const sections = ['resumen', 'metaAds', 'cashflow', 'productos', 'clientes', 'costos', 'creativos'];

  for (const store of stores) {
    const dateRange = getDefaultDateRange(); // últimos 30 días
    for (const section of sections) {
      try {
        await generateL1Commentary(store._id, section, dateRange);
      } catch (err) {
        console.error(`L1 commentary failed for ${store.nombre}/${section}:`, err.message);
      }
    }
  }
});

// Regenerar L2 (AI) diario a las 8am Argentina (solo si hay token budget)
cron.schedule('0 11 * * *', async () => { // 11 UTC = 8am ARG
  const stores = await Store.find({ active: true }).lean();

  for (const store of stores) {
    const usage = await getTokenUsageToday();
    if (usage > DAILY_TOKEN_LIMIT * 0.8) break; // parar si nos acercamos al límite

    try {
      // Solo generar L2 para 'resumen' diariamente (las otras secciones on-demand)
      const dateRange = getDefaultDateRange();
      await generateL2Commentary(store._id, 'resumen', dateRange);
    } catch (err) {
      console.error(`L2 commentary failed for ${store.nombre}:`, err.message);
    }
  }
});
```

---

## FASE 5: ALERTAS Y DIAGNÓSTICOS — Reglas, umbrales, ciclo de vida

### 5.1 Concepto

Las alertas son el puente entre "datos pasivos" y "acciones". El sistema detecta problemas automáticamente comparando métricas contra objetivos y breakeven, y los surfacea en Home (badge en card) y dentro de cada tienda.

NO depende de IA. Es un motor de reglas determinístico. La IA (Layer 3, Fase 7) puede enriquecer una alerta con análisis, pero la detección es reglas puras.

### 5.2 Modelo de datos — Alert

```js
const AlertSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  tipo: {
    type: String,
    enum: [
      'roas_bajo',           // ROAS o True ROAS bajo target o breakeven
      'cpa_alto',            // CPA excede máximo
      'profit_margin_bajo',  // Margen bajo mínimo
      'sin_ordenes',         // 0 órdenes en 48h+
      'devoluciones_altas',  // Tasa de devoluciones > máximo
      'nc_pct_bajo',         // NC% bajo target
      'cashflow_negativo',   // Liquidable < costos operativos
      'meta_token_expiring', // Token Meta expira pronto
      'meta_token_expired',  // Token Meta ya expiró
      'sync_failed',         // Sync falló 3+ veces
      'campana_bajo_breakeven', // Campaña individual bajo breakeven ROAS
      'producto_margen_negativo', // Producto vendiendo a pérdida
    ]
  },
  severidad: { type: String, enum: ['info', 'warning', 'critical'], required: true },
  titulo: String,           // ej: "True ROAS bajo breakeven"
  descripcion: String,      // ej: "True ROAS actual 1.8x, breakeven es 2.1x. Revisá costos o pausá campañas ineficientes."
  metricas: {               // snapshot de métricas al momento de detectar
    actual: Number,
    target: Number,
    breakeven: Number,
    diff: Number,           // % desviación
  },
  estado: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved', 'auto_resolved'],
    default: 'active'
  },
  fechaDetectada: { type: Date, default: Date.now },
  fechaResuelta: Date,
  aiAnalysis: String,       // Layer 3: análisis de Claude (se agrega después)
}, {
  timestamps: true,
});

AlertSchema.index({ storeId: 1, estado: 1 });
AlertSchema.index({ storeId: 1, fechaDetectada: -1 });
// TTL: alertas resueltas se borran después de 90 días
AlertSchema.index({ fechaResuelta: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60, partialFilterExpression: { estado: { $in: ['resolved', 'auto_resolved'] } } });
```

### 5.3 Motor de reglas — `alertEngine.js`

```js
// services/alertEngine.js

const RULES = [
  {
    id: 'roas_bajo',
    check: (metrics, objetivos) => {
      if (!objetivos?.kpis?.trueRoasTarget) return null;
      if (metrics.trueRoas < objetivos.breakeven.roasBreakeven) {
        return {
          tipo: 'roas_bajo',
          severidad: 'critical',
          titulo: 'True ROAS bajo breakeven',
          descripcion: `True ROAS actual ${metrics.trueRoas.toFixed(2)}x, breakeven es ${objetivos.breakeven.roasBreakeven.toFixed(2)}x. La tienda está operando a pérdida.`,
          metricas: { actual: metrics.trueRoas, target: objetivos.kpis.trueRoasTarget, breakeven: objetivos.breakeven.roasBreakeven }
        };
      }
      if (metrics.trueRoas < objetivos.kpis.trueRoasTarget) {
        const diff = ((metrics.trueRoas - objetivos.kpis.trueRoasTarget) / objetivos.kpis.trueRoasTarget) * 100;
        if (Math.abs(diff) > objetivos.alertThresholds.criticalPct) {
          return {
            tipo: 'roas_bajo',
            severidad: 'critical',
            titulo: 'True ROAS muy por debajo del target',
            descripcion: `True ROAS ${metrics.trueRoas.toFixed(2)}x vs target ${objetivos.kpis.trueRoasTarget}x (${diff.toFixed(0)}%).`,
            metricas: { actual: metrics.trueRoas, target: objetivos.kpis.trueRoasTarget, diff }
          };
        }
        if (Math.abs(diff) > objetivos.alertThresholds.warningPct) {
          return {
            tipo: 'roas_bajo',
            severidad: 'warning',
            titulo: 'True ROAS bajo target',
            descripcion: `True ROAS ${metrics.trueRoas.toFixed(2)}x vs target ${objetivos.kpis.trueRoasTarget}x (${diff.toFixed(0)}%).`,
            metricas: { actual: metrics.trueRoas, target: objetivos.kpis.trueRoasTarget, diff }
          };
        }
      }
      return null;
    }
  },

  {
    id: 'cpa_alto',
    check: (metrics, objetivos) => {
      if (!objetivos?.kpis?.cpaMaximo || !metrics.cpa) return null;
      const diff = ((metrics.cpa - objetivos.kpis.cpaMaximo) / objetivos.kpis.cpaMaximo) * 100;
      if (diff > objetivos.alertThresholds.criticalPct) {
        return {
          tipo: 'cpa_alto',
          severidad: 'critical',
          titulo: 'CPA muy por encima del máximo',
          descripcion: `CPA actual $${Math.round(metrics.cpa).toLocaleString()} vs máximo $${Math.round(objetivos.kpis.cpaMaximo).toLocaleString()} (+${diff.toFixed(0)}%).`,
          metricas: { actual: metrics.cpa, target: objetivos.kpis.cpaMaximo, diff }
        };
      }
      if (diff > objetivos.alertThresholds.warningPct) {
        return {
          tipo: 'cpa_alto',
          severidad: 'warning',
          titulo: 'CPA por encima del máximo',
          descripcion: `CPA actual $${Math.round(metrics.cpa).toLocaleString()} vs máximo $${Math.round(objetivos.kpis.cpaMaximo).toLocaleString()} (+${diff.toFixed(0)}%).`,
          metricas: { actual: metrics.cpa, target: objetivos.kpis.cpaMaximo, diff }
        };
      }
      return null;
    }
  },

  {
    id: 'sin_ordenes',
    check: async (metrics, objetivos, store) => {
      const lastOrder = await Order.findOne({ storeId: store._id, status: { $ne: 'cancelled' } }).sort('-createdAt');
      if (!lastOrder) return null;
      const hoursSinceLastOrder = (Date.now() - lastOrder.createdAt) / (1000 * 60 * 60);
      if (hoursSinceLastOrder > 48) {
        return {
          tipo: 'sin_ordenes',
          severidad: 'warning',
          titulo: 'Sin órdenes en 48+ horas',
          descripcion: `Última orden hace ${Math.round(hoursSinceLastOrder)}h. Verificar si hay un problema con la tienda o las campañas.`,
          metricas: { actual: hoursSinceLastOrder }
        };
      }
      return null;
    }
  },

  {
    id: 'cashflow_negativo',
    check: async (metrics, objetivos, store) => {
      // Próximas 2 semanas: liquidable esperado vs costos operativos estimados
      const forecast = await CashflowEntry.aggregate([
        { $match: { storeId: store._id, fechaPago: { $gte: new Date(), $lte: addWeeks(new Date(), 2) }, estado: 'pendiente' } },
        { $group: { _id: null, totalLiquidable: { $sum: '$liquidable' } } }
      ]);
      const liquidable2w = forecast[0]?.totalLiquidable || 0;
      // Estimar costos operativos: promedio diario × 14
      const last30 = await DailyMetric.aggregate([
        { $match: { storeId: store._id, date: { $gte: subDays(new Date(), 30) } } },
        { $group: { _id: null, avgDailyCost: { $avg: { $add: ['$costoProductos', '$costoEnvio', '$adSpend'] } } } }
      ]);
      const costosEstimados = (last30[0]?.avgDailyCost || 0) * 14;

      if (liquidable2w < costosEstimados * 0.8) {
        return {
          tipo: 'cashflow_negativo',
          severidad: 'critical',
          titulo: 'Cashflow proyectado negativo',
          descripcion: `Liquidable próx. 2 semanas: $${Math.round(liquidable2w).toLocaleString()} vs costos estimados: $${Math.round(costosEstimados).toLocaleString()}.`,
          metricas: { actual: liquidable2w, target: costosEstimados }
        };
      }
      return null;
    }
  },

  // ... reglas adicionales para profit_margin_bajo, devoluciones_altas, nc_pct_bajo, etc.
  // Todas siguen el mismo patrón: check(metrics, objetivos) → Alert object o null
];
```

### 5.4 Cron de diagnósticos

```js
// jobs/diagnostics.js
async function runDiagnostics(store) {
  // Obtener métricas de últimos 7 días
  const metrics = await aggregateRange(store._id, subDays(new Date(), 7), new Date());

  const newAlerts = [];

  for (const rule of RULES) {
    const result = await rule.check(metrics, store.objetivos, store);
    if (result) {
      // Verificar si ya existe una alerta activa del mismo tipo
      const existing = await Alert.findOne({
        storeId: store._id,
        tipo: result.tipo,
        estado: { $in: ['active', 'acknowledged'] }
      });

      if (existing) {
        // Actualizar métricas de la alerta existente (no duplicar)
        existing.metricas = result.metricas;
        existing.descripcion = result.descripcion;
        existing.severidad = result.severidad;
        await existing.save();
      } else {
        // Crear nueva alerta
        const alert = await Alert.create({ storeId: store._id, ...result });
        newAlerts.push(alert);
      }
    } else {
      // La regla no disparó → auto-resolver alertas previas de ese tipo
      await Alert.updateMany(
        { storeId: store._id, tipo: rule.id, estado: 'active' },
        { $set: { estado: 'auto_resolved', fechaResuelta: new Date() } }
      );
    }
  }

  return newAlerts;
}
```

### 5.5 Ciclo de vida de una alerta

```
[No existe] → check dispara → ACTIVE
ACTIVE → usuario ve y marca → ACKNOWLEDGED (sigue visible, pero sabe que la vio)
ACTIVE/ACKNOWLEDGED → métrica vuelve a rango → AUTO_RESOLVED
ACTIVE/ACKNOWLEDGED → usuario la cierra manualmente → RESOLVED
RESOLVED/AUTO_RESOLVED → TTL 90 días → [eliminada automáticamente]
```

### 5.6 API de alertas

```js
// Obtener alertas activas de una tienda (para badge en Home + lista en store)
router.get('/store/:storeId/alerts', async (req, res) => {
  const alerts = await Alert.find({
    storeId: req.params.storeId,
    estado: { $in: ['active', 'acknowledged'] }
  }).sort('-fechaDetectada');
  res.json(alerts);
});

// Obtener conteo para Home badges (todas las tiendas)
router.get('/alerts/summary', async (req, res) => {
  const summary = await Alert.aggregate([
    { $match: { estado: 'active' } },
    { $group: { _id: '$storeId', count: { $sum: 1 }, maxSeveridad: { $max: '$severidad' } } }
  ]);
  res.json(summary);
});

// Marcar como acknowledged
router.put('/alerts/:alertId/acknowledge', async (req, res) => {
  const alert = await Alert.findByIdAndUpdate(req.params.alertId, { estado: 'acknowledged' }, { new: true });
  res.json(alert);
});

// Resolver manualmente
router.put('/alerts/:alertId/resolve', async (req, res) => {
  const alert = await Alert.findByIdAndUpdate(req.params.alertId, {
    estado: 'resolved', fechaResuelta: new Date()
  }, { new: true });
  res.json(alert);
});
```

---

## FASE 6: CARGA MANUAL Y COSTOS — CSV, validación, COGS, recálculo en cadena

### 6.1 Flujo completo de carga de costos

Este es el flujo más largo de la app en términos de side effects. Un CSV de costos dispara una cadena:

```
Upload CSV → parsear → validar → actualizar Products → recalcular Orders → recalcular DailyMetric → recalcular Breakeven → re-evaluar Alerts
```

### 6.2 Frontend — CSVUploadZone

```jsx
function CSVUploadZone({ storeId, type, onComplete }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFile = async (file) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Solo se aceptan archivos .csv');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Archivo máximo 10MB');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.uploadCSV(storeId, type, formData);
      setResult(res.data);
      onComplete?.(res.data);
    } catch (err) {
      toast.error('Error al procesar CSV');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className={`csv-dropzone ${dragOver ? 'active' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
    >
      {uploading ? (
        <Spinner text="Procesando..." />
      ) : result ? (
        <UploadResult result={result} />
      ) : (
        <div>
          <p>Arrastrá un archivo CSV acá</p>
          <p className="text-muted">Formato: sku, costo_unitario</p>
          <input type="file" accept=".csv" onChange={(e) => handleFile(e.target.files[0])} />
          <a href="/templates/costos_template.csv" download>Descargar template</a>
        </div>
      )}
    </div>
  );
}
```

### 6.3 Backend — Procesamiento del CSV

```js
// controllers/costController.js
async function uploadProductCosts(req, res) {
  const store = req.store;
  const file = req.file;
  const csvText = fs.readFileSync(file.path, 'utf-8');

  // 1. Parsear con papaparse
  const { data, errors: parseErrors } = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  });

  if (parseErrors.length) {
    fs.unlinkSync(file.path);
    return res.status(400).json({ error: 'CSV inválido', details: parseErrors });
  }

  // 2. Validar columnas requeridas
  const requiredCols = ['sku', 'costo_unitario'];
  const headers = Object.keys(data[0] || {});
  const missing = requiredCols.filter(c => !headers.includes(c));
  if (missing.length) {
    fs.unlinkSync(file.path);
    return res.status(400).json({ error: `Columnas faltantes: ${missing.join(', ')}` });
  }

  // 3. Procesar fila por fila
  const results = { updated: 0, notFound: [], invalid: [], skipped: 0 };
  const updatedSkus = [];

  for (const row of data) {
    const sku = row.sku?.trim();
    const costo = parseFloat(row.costo_unitario);

    if (!sku) { results.skipped++; continue; }
    if (isNaN(costo) || costo < 0) { results.invalid.push({ sku, reason: 'costo inválido' }); continue; }

    const updated = await Product.findOneAndUpdate(
      { storeId: store._id, 'variants.sku': sku },
      { $set: { 'variants.$.costoUnitario': costo } },
      { new: true }
    );

    if (!updated) {
      results.notFound.push(sku);
    } else {
      results.updated++;
      updatedSkus.push(sku);
    }
  }

  // 4. CADENA DE RECÁLCULO (async, no bloquea response)
  setImmediate(async () => {
    try {
      // Recalcular órdenes que contienen estos SKUs
      const affectedOrders = await Order.find({
        storeId: store._id,
        'lineItems.sku': { $in: updatedSkus }
      });

      for (const order of affectedOrders) {
        await calculateOrderFinancials(order, store);
      }

      // Recalcular DailyMetrics de los días afectados
      const affectedDates = [...new Set(affectedOrders.map(o => startOfDay(o.createdAt).toISOString()))];
      for (const dateStr of affectedDates) {
        await recalculateDailyMetric(store._id, new Date(dateStr));
      }

      // Recalcular breakeven
      await calculateBreakeven(store);

      // Re-evaluar alertas
      await runDiagnostics(store);

      console.log(`[COSTS] Recálculo completo para ${store.nombre}: ${affectedOrders.length} órdenes, ${affectedDates.length} días`);
    } catch (err) {
      console.error('[COSTS] Error en cadena de recálculo:', err);
    }
  });

  fs.unlinkSync(file.path);
  res.json({
    ...results,
    message: `${results.updated} productos actualizados. Recalculando métricas en background.`
  });
}
```

### 6.4 Templates de CSV descargables

El sistema ofrece templates pre-armados para que el usuario sepa el formato:

```js
// routes/templateRoutes.js
router.get('/templates/:type', (req, res) => {
  const templates = {
    'costos': 'sku,costo_unitario\nSKU-001,15000\nSKU-002,8500\nSKU-003,22000',
    'ordenes': 'order_id,date,total,customer_email,customer_name,payment_method,installments,shipping_cost,status\n1001,2026-01-15,85000,juan@email.com,Juan Perez,visa,1,5000,paid',
    'meta': 'campaign_name,date,spend,impressions,clicks,purchases,purchase_value\nRetargeting Carrito,2026-03-01,45000,12000,340,12,890000',
  };
  const csv = templates[req.params.type];
  if (!csv) return res.status(404).json({ error: 'Template not found' });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${req.params.type}_template.csv`);
  res.send(csv);
});
```

---

## FASE 7: AI INTEGRATION — Claude API, tool_use, capas 1-3

### 7.1 Arquitectura

La IA corre 100% en el backend. El frontend NUNCA llama a Claude directamente. Esto por seguridad (la API key no se expone) y porque los tools necesitan acceso a la base de datos.

```
Frontend → POST /api/store/:id/ai/analyze → Backend → Claude API (tool_use) → respuesta → Frontend
Frontend → POST /api/store/:id/ai/chat → Backend → Claude API (conversational + tools) → respuesta → Frontend
```

### 7.2 Layer 1 — Análisis y reportes

El usuario hace click en "Generar análisis" en cualquier sección. El backend arma un prompt con las métricas actuales y le pide a Claude que analice:

```js
// services/claudeAPI.js
const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

async function generateAnalysis(store, sectionId, metrics, health) {
  const systemPrompt = `Sos un analista de ecommerce experto trabajando para una agencia argentina.
Analizás métricas de tiendas en Tiendanube con publicidad en Meta Ads.
Respondé siempre en español argentino. Sé directo y accionable.
La moneda es ARS (pesos argentinos). La cotización USD/ARS es ${store.cotizacionDolar}.
La tienda se llama "${store.nombre}" y está en fase "${store.objetivos?.fase || 'no definida'}".`;

  const userPrompt = buildAnalysisPrompt(sectionId, metrics, health, store.objetivos);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });

  // Guardar como Report
  const report = await Report.create({
    storeId: store._id,
    type: sectionId,
    title: `Análisis ${sectionId} — ${new Date().toLocaleDateString('es-AR')}`,
    content: response.content[0].text,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
  });

  return report;
}

function buildAnalysisPrompt(sectionId, metrics, health, objetivos) {
  // Armar prompt con datos concretos según la sección
  let prompt = `Analizá las siguientes métricas del período:\n\n`;

  prompt += `Revenue: $${metrics.revenue?.toLocaleString()}\n`;
  prompt += `Net Revenue: $${metrics.netRevenue?.toLocaleString()}\n`;
  prompt += `Profit Margin: ${metrics.profitMargin?.toFixed(1)}%\n`;
  prompt += `ROAS: ${metrics.roas?.toFixed(2)}x | True ROAS: ${metrics.trueRoas?.toFixed(2)}x\n`;
  prompt += `CPA: $${metrics.cpa?.toLocaleString()} | NC CPA: $${metrics.ncCpa?.toLocaleString()}\n`;
  prompt += `NC%: ${metrics.ncPct?.toFixed(1)}% | AOV: $${metrics.aov?.toLocaleString()}\n`;
  prompt += `Ad Spend: $${metrics.adSpend?.toLocaleString()}\n`;
  prompt += `Órdenes: ${metrics.ordenesPositivas}\n\n`;

  if (objetivos?.kpis) {
    prompt += `Objetivos configurados:\n`;
    prompt += `- ROAS target: ${objetivos.kpis.roasTarget}x | True ROAS target: ${objetivos.kpis.trueRoasTarget}x\n`;
    prompt += `- CPA máximo: $${objetivos.kpis.cpaMaximo}\n`;
    prompt += `- Profit margin mínimo: ${objetivos.kpis.profitMarginMin}%\n`;
    prompt += `- Breakeven ROAS: ${objetivos.breakeven?.roasBreakeven}x\n\n`;
  }

  if (health) {
    const issues = Object.entries(health.kpis)
      .filter(([_, v]) => v.status !== 'ok')
      .map(([k, v]) => `${k}: ${v.status} (${v.diff.toFixed(0)}% vs target)`);
    if (issues.length) {
      prompt += `KPIs fuera de objetivo: ${issues.join(', ')}\n\n`;
    }
  }

  prompt += `Dá un análisis conciso (3-5 puntos) con:\n`;
  prompt += `1. Qué está funcionando bien\n`;
  prompt += `2. Qué necesita atención inmediata\n`;
  prompt += `3. Acciones concretas recomendadas\n`;

  return prompt;
}
```

### 7.3 Layer 2 — Chat con datos (tool_use)

El chat permite al usuario hacer preguntas sobre los datos. Claude tiene acceso a herramientas que consultan la base de datos:

```js
// Definición de tools para Claude
const CLAUDE_TOOLS = [
  {
    name: 'get_metrics',
    description: 'Obtiene métricas agregadas de una tienda para un rango de fechas. Incluye revenue, profit, ROAS, CPA, NC%, y todas las métricas derivadas.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
        to: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
      },
      required: ['from', 'to']
    }
  },
  {
    name: 'get_top_products',
    description: 'Obtiene los productos más vendidos o más rentables de la tienda en un período.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string' },
        to: { type: 'string' },
        sortBy: { type: 'string', enum: ['revenue', 'units', 'margin'], description: 'Ordenar por revenue, unidades vendidas, o margen' },
        limit: { type: 'number', description: 'Cantidad de productos (default 10)' }
      },
      required: ['from', 'to']
    }
  },
  {
    name: 'get_campaign_performance',
    description: 'Obtiene el rendimiento de campañas de Meta Ads con métricas detalladas.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string' },
        to: { type: 'string' },
        level: { type: 'string', enum: ['campaign', 'adset', 'ad'], description: 'Nivel de detalle' }
      },
      required: ['from', 'to']
    }
  },
  {
    name: 'get_customer_segments',
    description: 'Obtiene segmentación de clientes: NC vs RC, cohorts, RFM.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string' },
        to: { type: 'string' },
      },
      required: ['from', 'to']
    }
  },
  {
    name: 'get_cashflow_forecast',
    description: 'Obtiene proyección de cashflow: pagos pendientes, liquidable esperado por semana.',
    input_schema: {
      type: 'object',
      properties: {
        weeks: { type: 'number', description: 'Semanas hacia adelante (default 4)' }
      }
    }
  },
  {
    name: 'compare_periods',
    description: 'Compara métricas entre dos períodos para identificar tendencias.',
    input_schema: {
      type: 'object',
      properties: {
        period1_from: { type: 'string' },
        period1_to: { type: 'string' },
        period2_from: { type: 'string' },
        period2_to: { type: 'string' },
      },
      required: ['period1_from', 'period1_to', 'period2_from', 'period2_to']
    }
  }
];
```

**Ejecución de tools:**

```js
// services/claudeToolExecutor.js
async function executeTool(toolName, input, storeId) {
  switch (toolName) {
    case 'get_metrics':
      return await aggregateRange(storeId, new Date(input.from), new Date(input.to));

    case 'get_top_products':
      return await Order.aggregate([
        { $match: { storeId, createdAt: { $gte: new Date(input.from), $lte: new Date(input.to) } } },
        { $unwind: '$lineItems' },
        { $group: {
          _id: '$lineItems.sku',
          name: { $first: '$lineItems.name' },
          units: { $sum: '$lineItems.quantity' },
          revenue: { $sum: { $multiply: ['$lineItems.price', '$lineItems.quantity'] } },
          cost: { $sum: { $multiply: ['$lineItems.costoUnitario', '$lineItems.quantity'] } },
        }},
        { $addFields: { margin: { $subtract: ['$revenue', '$cost'] }, marginPct: { $multiply: [{ $divide: [{ $subtract: ['$revenue', '$cost'] }, '$revenue'] }, 100] } } },
        { $sort: { [input.sortBy || 'revenue']: -1 } },
        { $limit: input.limit || 10 }
      ]);

    case 'get_campaign_performance':
      // ... aggregate MetaDailyInsight joined with MetaCampaign
      return await getCampaignMetrics(storeId, input.from, input.to, input.level);

    case 'get_customer_segments':
      return await getCustomerSegments(storeId, input.from, input.to);

    case 'get_cashflow_forecast':
      return await getCashflowForecast(storeId, input.weeks || 4);

    case 'compare_periods':
      const p1 = await aggregateRange(storeId, new Date(input.period1_from), new Date(input.period1_to));
      const p2 = await aggregateRange(storeId, new Date(input.period2_from), new Date(input.period2_to));
      return { period1: p1, period2: p2, deltas: calculateDeltas(p1, p2) };
  }
}
```

**Loop de conversación con tools:**

```js
async function chat(store, messages) {
  const systemPrompt = `Sos un analista de ecommerce... (mismo que Layer 1)
Tenés herramientas para consultar datos de la tienda "${store.nombre}".
Usá las herramientas para obtener datos antes de responder.
Hoy es ${new Date().toLocaleDateString('es-AR')}.`;

  let currentMessages = [...messages];
  let response;

  // Loop: Claude puede pedir múltiples tools antes de dar la respuesta final
  while (true) {
    response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      tools: CLAUDE_TOOLS,
      messages: currentMessages,
    });

    // Si Claude quiere usar una tool
    if (response.stop_reason === 'tool_use') {
      const toolUseBlock = response.content.find(b => b.type === 'tool_use');
      const toolResult = await executeTool(toolUseBlock.name, toolUseBlock.input, store._id);

      // Agregar la respuesta de Claude y el resultado del tool al historial
      currentMessages.push({ role: 'assistant', content: response.content });
      currentMessages.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolUseBlock.id,
          content: JSON.stringify(toolResult)
        }]
      });
      continue; // Volver al loop para que Claude procese el resultado
    }

    // Claude terminó (respuesta de texto)
    break;
  }

  return {
    response: response.content.find(b => b.type === 'text')?.text,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
  };
}
```

### 7.4 Layer 3 — Alertas enriquecidas con IA

Cuando el cron de diagnósticos genera una alerta nueva, opcionalmente la envía a Claude para un análisis más profundo:

```js
async function enrichAlertWithAI(alert, store) {
  const metrics = await aggregateRange(store._id, subDays(new Date(), 7), new Date());
  const prevMetrics = await aggregateRange(store._id, subDays(new Date(), 14), subDays(new Date(), 7));

  const prompt = `Se detectó la siguiente alerta en la tienda "${store.nombre}":

Tipo: ${alert.tipo}
Severidad: ${alert.severidad}
Descripción: ${alert.descripcion}

Métricas última semana: ROAS ${metrics.roas?.toFixed(2)}x, True ROAS ${metrics.trueRoas?.toFixed(2)}x, CPA $${metrics.cpa?.toLocaleString()}, NC% ${metrics.ncPct?.toFixed(1)}%
Métricas semana anterior: ROAS ${prevMetrics.roas?.toFixed(2)}x, True ROAS ${prevMetrics.trueRoas?.toFixed(2)}x, CPA $${prevMetrics.cpa?.toLocaleString()}, NC% ${prevMetrics.ncPct?.toFixed(1)}%

Analizá brevemente (2-3 oraciones) la posible causa y una acción concreta recomendada.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }]
  });

  alert.aiAnalysis = response.content[0].text;
  await alert.save();
}
```

### 7.5 Costos de API y throttling

```js
// Control de costos de Claude API
const TOKEN_LIMITS = {
  dailyMax: 100000,        // tokens máximos por día (toda la plataforma)
  perAnalysis: 2000,       // max tokens por análisis
  perChat: 3000,           // max tokens por mensaje de chat
  perAlertEnrich: 500,     // max tokens por enriquecimiento de alerta
};

// Middleware que trackea uso
async function trackTokenUsage(storeId, tokens, type) {
  const today = startOfDay(new Date());
  await TokenUsage.findOneAndUpdate(
    { date: today },
    { $inc: { total: tokens, [type]: tokens } },
    { upsert: true }
  );

  // Check si se excedió el límite diario
  const usage = await TokenUsage.findOne({ date: today });
  if (usage.total > TOKEN_LIMITS.dailyMax) {
    throw new Error('Límite diario de tokens de IA alcanzado');
  }
}
```

---

## FASE 8: FRONTEND ARCHITECTURE — Redux, routing, lazy loading, componentes

### 8.1 Estructura de routing

```jsx
// App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';

// Lazy loading de páginas
const Home = lazy(() => import('./pages/Home'));
const StoreDashboard = lazy(() => import('./pages/StoreDashboard'));
const Login = lazy(() => import('./pages/Login'));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/store/:storeId/*" element={<ProtectedRoute><StoreLayout /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

**StoreLayout — layout con sidebar para todas las secciones de una tienda:**

```jsx
// layouts/StoreLayout.jsx
function StoreLayout() {
  const { storeId } = useParams();

  return (
    <StoreProvider storeId={storeId}>
      <div className="store-layout">
        <Sidebar storeId={storeId} />
        <div className="store-main">
          <Header />
          <div className="store-content">
            <Suspense fallback={<SectionLoader />}>
              <Routes>
                <Route index element={<Navigate to="resumen" />} />
                <Route path="resumen" element={<ResumenPage />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="cashflow" element={<CashflowPage />} />
                <Route path="metapixel" element={<MetaPixelPage />} />
                <Route path="costos" element={<CostosPage />} />
                <Route path="productos" element={<ProductosPage />} />
                <Route path="clientes" element={<ClientesPage />} />
                <Route path="simulador" element={<SimuladorPage />} />
                <Route path="creativos" element={<CreativosPage />} />
                <Route path="contenido" element={<ContenidoPage />} />
                <Route path="competencia" element={<CompetenciaPage />} />
                <Route path="reportes" element={<ReportesPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Routes>
            </Suspense>
          </div>
        </div>
      </div>
    </StoreProvider>
  );
}
```

### 8.2 Redux Store — Slices

```js
// store/index.js
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import dateReducer from './dateSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,     // user, token, isAuthenticated
    date: dateReducer,     // from, to, compare, overrides (ver Fase 3)
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});
```

**¿Por qué NO hay un storeSlice con datos de métricas?**

Porque usamos **React Query** (TanStack Query) para server state. Redux solo guarda client state (auth, fechas, UI). Las métricas, órdenes, productos, etc. viven en el cache de React Query con invalidación automática.

```js
// services/api.js — React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Interceptor para auth
api.interceptors.request.use((config) => {
  const token = store.getState().auth.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// === Hooks de datos ===

export function useStoreMetrics(storeId, dateParams) {
  return useQuery({
    queryKey: ['metrics', storeId, dateParams],
    queryFn: () => api.get(`/store/${storeId}/metrics`, { params: dateParams }).then(r => r.data),
    keepPreviousData: true,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStoreAlerts(storeId) {
  return useQuery({
    queryKey: ['alerts', storeId],
    queryFn: () => api.get(`/store/${storeId}/alerts`).then(r => r.data),
    refetchInterval: 5 * 60 * 1000, // polling cada 5 min
  });
}

export function useWidgets(storeId, pageId) {
  return useQuery({
    queryKey: ['widgets', storeId, pageId],
    queryFn: () => api.get(`/store/${storeId}/widgets/${pageId}`).then(r => r.data),
  });
}

export function useOrders(storeId, dateParams, page = 1) {
  return useQuery({
    queryKey: ['orders', storeId, dateParams, page],
    queryFn: () => api.get(`/store/${storeId}/orders`, { params: { ...dateParams, page, limit: 50 } }).then(r => r.data),
    keepPreviousData: true,
  });
}

export function useCampaigns(storeId, dateParams) {
  return useQuery({
    queryKey: ['campaigns', storeId, dateParams],
    queryFn: () => api.get(`/store/${storeId}/meta/campaigns`, { params: dateParams }).then(r => r.data),
  });
}

// === Mutations ===

export function useUploadCosts(storeId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData) => api.post(`/store/${storeId}/products/costs`, formData),
    onSuccess: () => {
      // Invalidar todo lo que depende de costos
      queryClient.invalidateQueries(['metrics', storeId]);
      queryClient.invalidateQueries(['products', storeId]);
      queryClient.invalidateQueries(['alerts', storeId]);
    }
  });
}

export function useSyncNow(storeId) {
  return useMutation({
    mutationFn: (type) => api.post(`/store/${storeId}/sync/now`, { type }),
  });
}
```

### 8.3 StoreProvider — Contexto de tienda

```jsx
// context/StoreContext.jsx
const StoreContext = createContext(null);

function StoreProvider({ storeId, children }) {
  const { data: store } = useQuery({
    queryKey: ['store', storeId],
    queryFn: () => api.get(`/store/${storeId}`).then(r => r.data),
  });

  return (
    <StoreContext.Provider value={{ storeId, store }}>
      {children}
    </StoreContext.Provider>
  );
}

function useStoreContext() {
  return useContext(StoreContext);
}
```

### 8.4 Patrón de una página tipo

Todas las secciones siguen el mismo patrón:

```jsx
function DashboardPage() {
  const { storeId, store } = useStoreContext();
  const dateRange = useDateRange('dashboard');
  const { data: metrics, isLoading } = useStoreMetrics(storeId, dateRange.toQueryParams());

  if (isLoading) return <SectionLoader />;

  return (
    <div className="page">
      <PageHeader title="Dashboard" subtitle="Métricas consolidadas de tienda" />

      {/* Insight Bar contextual */}
      {metrics?.health && (
        <InsightBar
          sectionId="dashboard"
          metrics={metrics.current}
          health={metrics.health}
        />
      )}

      {/* KPIs con semáforos */}
      <KPIGrid
        metrics={metrics.current}
        deltas={metrics.deltas}
        health={metrics.health}
        layout={[
          'ordenes', 'revenue', 'adSpend', 'netRevenue',
          'profit', 'profitMargin', 'roas', 'trueRoas'
        ]}
      />

      {/* Secciones */}
      <Section title="Tienda">
        <MetricCards metrics={metrics.current} keys={['ordenes', 'revenue', 'netRevenue', 'aov', 'aovNeto']} />
      </Section>

      <Section title="NC/RC">
        <MetricCards metrics={metrics.current} keys={['ncPct', 'ncOrdenes', 'ncRevenue', 'ncCpa', 'rcPct', 'rcRevenue']} />
      </Section>

      <Section title="Canales de Marketing">
        <MarketingMixTable storeId={storeId} dateParams={dateRange.toQueryParams()} />
      </Section>

      <Section title="Últimas Ventas">
        <OrdersTable storeId={storeId} dateParams={dateRange.toQueryParams()} />
      </Section>

      {/* Botón AI */}
      <AIAnalysisButton storeId={storeId} sectionId="dashboard" metrics={metrics} />
    </div>
  );
}
```

### 8.5 Componentes reutilizables clave

| Componente | Uso | Props principales |
|-----------|-----|-------------------|
| `KPIGrid` | Grid de cards con valor + delta + semáforo | metrics, deltas, health, layout[] |
| `MetricCards` | Subset de KPIs en una sección | metrics, keys[] |
| `InsightBar` | Barra de análisis contextual | sectionId, metrics, health |
| `DataTable` | Tabla genérica con sort/pagination | columns[], data[], sortable, pagination |
| `DateRangePicker` | Selector de fechas global | sectionId (optional) |
| `CSVUploadZone` | Drag-and-drop CSV upload | storeId, type, onComplete |
| `AIAnalysisButton` | Trigger análisis Claude | storeId, sectionId, metrics |
| `AIChatPanel` | Panel lateral de chat con Claude | storeId |
| `HealthIndicator` | Semáforo individual | status, diff |
| `OrderDetailModal` | Modal de desglose de orden | order |
| `SectionLoader` | Skeleton loading | — |

### 8.6 Performance

- **Lazy loading**: cada página se importa con `lazy()` → el bundle inicial es mínimo
- **React Query cache**: navegar entre secciones o cambiar fechas ida y vuelta es instantáneo si los datos están en cache
- **keepPreviousData**: al cambiar fechas, muestra datos anteriores mientras carga los nuevos (no flashea)
- **Recharts con memoization**: los charts usan `React.memo` para no re-renderizar si los datos no cambiaron
- **Paginación**: tablas grandes (órdenes, productos) paginan a 50 items, no cargan todo
- **No hay polling agresivo**: alertas se refetchean cada 5 min, métricas tienen staleTime de 5 min
