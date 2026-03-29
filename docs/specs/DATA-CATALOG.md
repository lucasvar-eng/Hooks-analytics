# DATA CATALOG — ecom-analytics

> Mapeo exhaustivo de cada campo, cada fuente de datos, cada modelo MongoDB y cada CSV del proyecto.
> Documento vivo — se actualiza a medida que se agregan integraciones.

---

## ÍNDICE

1. [TiendaNube API v1](#1-tiendanube-api-v1)
2. [Meta Marketing API v25.0](#2-meta-marketing-api-v250)
3. [Campos Calculados (no vienen de APIs)](#3-campos-calculados)
4. [Formatos de CSV Import](#4-formatos-de-csv-import)
5. [Campos de Configuración (Store)](#5-campos-de-configuración-store)
6. [Modelos MongoDB Completos](#6-modelos-mongodb-completos)
7. [Mapeo de CSVs de Referencia Existentes](#7-mapeo-de-csvs-de-referencia-existentes)
8. [Tabla de Fórmulas Master](#8-tabla-de-fórmulas-master)

---

## 1. TIENDANUBE API v1

Base URL: `https://api.tiendanube.com/v1/{store_id}`
Auth: `Authentication: bearer {token}`
Rate limit: ~2 req/seg (implementar delay 500ms entre pages)
Paginación: page-based, max ~200 items/page, hasta 10,000 items por query

### 1.1 Orders — `GET /v1/{store_id}/orders`

Filtro incremental: `updated_at_min` (ISO 8601)

| Campo API | Tipo | ID Único | Modelo MongoDB | Campo MongoDB | Ejemplo | Sprint |
|-----------|------|----------|---------------|---------------|---------|--------|
| `id` | Integer | Sí (por tienda) | Order | `tnOrderId` | `987654321` | 1 |
| `number` | String | — | Order | `tnOrderNumber` | `"1542"` | 1 |
| `total` | String (parsear a Float) | — | Order | `totalOrden` | `"94500.00"` → `94500` | 1 |
| `subtotal` | String (parsear a Float) | — | Order | `subtotal` | `"89000.00"` → `89000` | 1 |
| `discount` | String (parsear a Float) | — | Order | `descuento` | `"5500.00"` → `5500` | 1 |
| `shipping_cost_customer` | String | — | Order | (informativo) | `"3500.00"` | 2 |
| `shipping_cost_owner` | String (parsear a Float) | — | Order | `costoEnvio` | `"2800.00"` → `2800` | 1 |
| `gateway` | String | — | Order | `gateway` | `"mercadopago"` | 1 |
| `gateway_name` | String | — | Order | (display name) | `"Mercado Pago"` | 1 |
| `payment_status` | String | — | Order | `paymentStatus` | `"paid"` / `"pending"` / `"refunded"` | 1 |
| `payment_details.method` | String | — | Order | `medioPago` | `"visa"` / `"mastercard"` / `"debit"` | 2 |
| `payment_details.installments` | Integer | — | Order | `cantidadCuotas` | `6` | 2 |
| `paid_at` | String (ISO 8601) | — | Order | `paidAt` | `"2026-03-15T14:30:00-03:00"` | 1 |
| `customer.id` | Integer | Sí (por tienda) | Order / Customer | `customerId` / `tnCustomerId` | `45678901` | 1 |
| `customer.name` | String | — | Order | `customerName` | `"María García"` | 1 |
| `customer.email` | String | — | Order | `customerEmail` | `"maria@gmail.com"` | 1 |
| `products` | Array | — | Order | `lineItems` | (ver sub-tabla) | 1 |
| `products[].product_id` | Integer | — | Order.lineItems | `tnProductId` | `12345678` | 1 |
| `products[].variant_id` | Integer | — | Order.lineItems | `tnVariantId` | `87654321` | 1 |
| `products[].name` | String | — | Order.lineItems | `nombre` | `"Zapatillas Dione Negro"` | 1 |
| `products[].price` | String | — | Order.lineItems | `precioUnitario` | `"84000.00"` → `84000` | 1 |
| `products[].quantity` | Integer | — | Order.lineItems | `cantidad` | `2` | 1 |
| `products[].sku` | String | — | Order.lineItems | `sku` | `"60\|11\|35"` | 1 |
| `status` | String | — | Order | `estado` | `"open"` / `"closed"` / `"cancelled"` | 1 |
| `created_at` | String (ISO 8601) | — | Order | `fechaCreacion` | `"2026-03-10T09:15:00-03:00"` | 1 |
| `updated_at` | String (ISO 8601) | — | Order | `updatedAt` | `"2026-03-10T09:20:00-03:00"` | 1 |
| `cancelled_at` | String (ISO 8601) / null | — | Order | `cancelledAt` | `null` o `"2026-03-12T..."` | 1 |

**Notas:**
- `total` viene como String, hay que parsear a Float
- `shipping_cost_owner` es lo que paga la tienda, `shipping_cost_customer` es lo que paga el comprador
- `products` es un array — cada item se guarda en `Order.lineItems[]`
- `payment_details` puede no existir en órdenes pendientes
- Status `cancelled` y órdenes con `payment_status = "refunded"` cuentan como devoluciones

---

### 1.2 Products — `GET /v1/{store_id}/products`

Filtro incremental: `updated_at_min` (ISO 8601)

| Campo API | Tipo | ID Único | Modelo MongoDB | Campo MongoDB | Ejemplo | Sprint |
|-----------|------|----------|---------------|---------------|---------|--------|
| `id` | Integer | Sí (por tienda) | Product | `tnProductId` | `260658871` | 1 |
| `name.es` | String | — | Product | `nombre` | `"Zapatillas Dione Negro/Blanco"` | 1 |
| `variants` | Array | — | Product | `variantes` | (ver sub-tabla) | 1 |
| `variants[].id` | Integer | Sí | Product.variantes | `tnVariantId` | `998877665` | 1 |
| `variants[].price` | String | — | Product.variantes | `precio` | `"84000.00"` → `84000` | 1 |
| `variants[].stock` | Integer / null | — | Product.variantes | `stock` | `178` | 1 |
| `variants[].sku` | String | — | Product.variantes | `sku` | `"60\|11\|35"` | 1 |
| `variants[].name` | String | — | Product.variantes | `nombre` | `"Talle 35"` | 1 |
| `brand` | String | — | Product | `marca` | `"GERF"` | 6 |
| `categories` | Array de Objects | — | Product | `categoria` | `[{id: 1, name: "Zapatillas"}]` | 6 |
| `tags` | String | — | Product | `tags` | `"calzado,unisex"` | 6 |
| `images` | Array | — | Product | `imagenUrl` (primera) | `[{src: "https://..."}]` | 6 |
| `created_at` | String (ISO 8601) | — | Product | `createdAt` | `"2025-01-15T..."` | 1 |
| `updated_at` | String (ISO 8601) | — | Product | `updatedAt` | `"2026-03-20T..."` | 1 |

**Notas:**
- `name` es un objeto con locales (`name.es`, `name.en`) — usamos `name.es`
- `variants[].stock` puede ser `null` si el producto no controla stock
- El campo `precio` del modelo Product toma el precio de la primera variante como referencia
- `imagenUrl` se toma de `images[0].src` — no guardamos todas las imágenes en BD

---

### 1.3 Customers — `GET /v1/{store_id}/customers`

Filtro incremental: `updated_at_min` (ISO 8601)

| Campo API | Tipo | ID Único | Modelo MongoDB | Campo MongoDB | Ejemplo | Sprint |
|-----------|------|----------|---------------|---------------|---------|--------|
| `id` | Integer | Sí (por tienda) | Customer | `tnCustomerId` | `45678901` | 7 |
| `name` | String | — | Customer | `name` | `"María García"` | 7 |
| `email` | String | — | Customer | `email` | `"maria@gmail.com"` | 7 |
| `total_ordered` | Integer | — | Customer | `totalOrders` | `5` | 7 |
| `last_order_id` | Integer | — | Customer | `lastOrderId` | `987654321` | 7 |
| `created_at` | String (ISO 8601) | — | Customer | `firstPurchase` | `"2025-06-10T..."` | 7 |
| `updated_at` | String (ISO 8601) | — | Customer | `updatedAt` | `"2026-03-28T..."` | 7 |

**Notas:**
- `total_ordered` de TN puede diferir de nuestro conteo local (si hay historial pre-conexión)
- `Customer.cohortMonth` se calcula como `YYYY-MM` de `firstPurchase`
- `Customer.totalSpent` se calcula sumando `Order.totalOrden` de todas sus órdenes
- RFM y LTV se calculan localmente, no vienen de la API

---

## 2. META MARKETING API v25.0

Base URL: `https://graph.facebook.com/v25.0`
Auth: Bearer token (long-lived, 60 días, con auto-refresh)
Rate limit: 60 puntos / 300 seg (dev), 9,000 puntos / 300 seg (standard)
Insights bucket: 600 (dev) o 190,000 + 400 × ads activos por hora

### 2.1 Campaigns — `GET /act_{ad_account_id}/campaigns`

| Campo API | Tipo | ID Único | Modelo MongoDB | Campo MongoDB | Ejemplo | Sprint |
|-----------|------|----------|---------------|---------------|---------|--------|
| `id` | String | Sí (global) | MetaCampaign | `metaId` | `"23851234567890123"` | 3 |
| `name` | String | — | MetaCampaign | `nombre` | `"GERF - Conversiones - TOF"` | 3 |
| `status` | Enum | — | MetaCampaign | `status` | `"ACTIVE"` / `"PAUSED"` / `"DELETED"` | 3 |
| `objective` | String | — | MetaCampaign | `objective` | `"OUTCOME_SALES"` | 3 |
| `daily_budget` | String (cents) | — | MetaCampaign | `budget` | `"50000"` → $500 USD | 3 |
| `lifetime_budget` | String (cents) | — | MetaCampaign | `lifetimeBudget` | `"1500000"` → $15,000 USD | 3 |

**level**: `'campaign'` — se setea al guardar

### 2.2 Ad Sets — `GET /act_{ad_account_id}/adsets`

| Campo API | Tipo | ID Único | Modelo MongoDB | Campo MongoDB | Ejemplo | Sprint |
|-----------|------|----------|---------------|---------------|---------|--------|
| `id` | String | Sí (global) | MetaCampaign | `metaId` | `"23851234567890456"` | 3 |
| `name` | String | — | MetaCampaign | `nombre` | `"GERF - Lookalike 2% - 18-55"` | 3 |
| `status` | Enum | — | MetaCampaign | `status` | `"ACTIVE"` | 3 |
| `campaign_id` | String | FK | MetaCampaign | `parentId` (ref) | `"23851234567890123"` | 3 |
| `targeting` | Object | — | MetaCampaign | `targeting` (JSON) | `{age_min: 18, age_max: 55}` | 3 |
| `daily_budget` | String | — | MetaCampaign | `budget` | `"25000"` | 3 |
| `optimization_goal` | String | — | MetaCampaign | `optimizationGoal` | `"OFFSITE_CONVERSIONS"` | 3 |

**level**: `'adset'`

### 2.3 Ads — `GET /act_{ad_account_id}/ads`

| Campo API | Tipo | ID Único | Modelo MongoDB | Campo MongoDB | Ejemplo | Sprint |
|-----------|------|----------|---------------|---------------|---------|--------|
| `id` | String | Sí (global) | MetaCampaign | `metaId` | `"23851234567890789"` | 3 |
| `name` | String | — | MetaCampaign | `nombre` | `"GERF - Dione Negro - Video 15s"` | 3 |
| `status` | Enum | — | MetaCampaign | `status` | `"ACTIVE"` | 3 |
| `adset_id` | String | FK | MetaCampaign | `parentId` (ref) | `"23851234567890456"` | 3 |
| `creative.thumbnail_url` | String | — | MetaCampaign | `thumbnailUrl` | `"https://scontent..."` | 8 |
| `creative.body` | String | — | MetaCampaign | `creativeBody` | `"Las zapatillas que..."` | 8 |
| `creative.title` | String | — | MetaCampaign | `creativeTitle` | `"GERF - Envío gratis"` | 8 |

**level**: `'ad'`

### 2.4 Insights — `GET /{object_id}/insights`

Parámetros: `time_increment=1` (diario), `time_range={since, until}`

#### Métricas Básicas

| Campo API | Tipo | Modelo MongoDB | Campo MongoDB | Ejemplo | Sprint |
|-----------|------|---------------|---------------|---------|--------|
| `spend` | String → Float | MetaDailyInsight | `spend` | `"125.50"` → 125.50 (USD) | 3 |
| `impressions` | String → Int | MetaDailyInsight | `impressions` | `"58275"` → 58275 | 3 |
| `reach` | String → Int | MetaDailyInsight | `reach` | `"52538"` → 52538 | 3 |
| `clicks` | String → Int | MetaDailyInsight | `clicks` | `"1459"` → 1459 | 3 |
| `unique_clicks` | String → Int | MetaDailyInsight | `uniqueClicks` | `"1178"` → 1178 | 3 |
| `cpm` | String → Float | MetaDailyInsight | `cpm` | `"914.00"` (USD) | 3 |
| `cpc` | String → Float | MetaDailyInsight | `cpc` | `"78.04"` (USD) | 3 |
| `ctr` | String → Float | MetaDailyInsight | `ctr` | `"2.50"` | 3 |

#### Métricas de Click (granulares)

| Campo API | Tipo | Modelo MongoDB | Campo MongoDB | Ejemplo | Sprint |
|-----------|------|---------------|---------------|---------|--------|
| `inline_link_clicks` | String → Int | MetaDailyInsight | `linkClicks` | `"1200"` | 3 |
| `unique_inline_link_clicks` | String → Int | MetaDailyInsight | `uniqueLinkClicks` | `"980"` | 3 |
| `cost_per_inline_link_click` | String → Float | MetaDailyInsight | `costPerLinkClick` | `"0.105"` (USD) | 3 |

#### Métricas de Conversión (extraídas de `actions[]` y `action_values[]`)

| Campo dentro de `actions[]` | action_type | Modelo MongoDB | Campo MongoDB | Ejemplo | Sprint |
|------------------------------|-------------|---------------|---------------|---------|--------|
| `value` | `purchase` o `offsite_conversion.fb_pixel_purchase` | MetaDailyInsight | `purchases` | `11` | 3 |
| `value` | `offsite_conversion.fb_pixel_add_to_cart` | MetaDailyInsight | `atc` | `71` | 3 |
| `value` | `offsite_conversion.fb_pixel_initiate_checkout` | MetaDailyInsight | `checkouts` | `37` | 3 |
| `value` (de `action_values[]`) | `purchase` | MetaDailyInsight | `purchaseValue` | `729861.00` (en moneda local) | 3 |
| `value` (de `cost_per_action_type[]`) | `purchase` | MetaDailyInsight | `costPerPurchase` | `"10351.00"` | 3 |

#### Métricas de Video

| Campo API | Tipo | Modelo MongoDB | Campo MongoDB | Ejemplo | Sprint |
|-----------|------|---------------|---------------|---------|--------|
| `video_play_actions[0].value` | String → Int | MetaDailyInsight | `videoPlays` | `"15420"` | 8 |
| `video_avg_time_watched_actions[0].value` | String → Float | MetaDailyInsight | `avgPlayTime` | `"4.2"` (segundos) | 8 |
| `video_thruplay_watched_actions[0].value` | String → Int | MetaDailyInsight | `thruplays` | `"3200"` | 8 |
| `video_p25_watched_actions[0].value` | String → Int | MetaDailyInsight | `videoPlays25` | `"12000"` | 8 |
| `video_p50_watched_actions[0].value` | String → Int | MetaDailyInsight | `videoPlays50` | `"8500"` | 8 |
| `video_p75_watched_actions[0].value` | String → Int | MetaDailyInsight | `videoPlays75` | `"5200"` | 8 |
| `video_p100_watched_actions[0].value` | String → Int | MetaDailyInsight | `videoPlays100` | `"2100"` | 8 |

**Métricas derivadas de video (calculadas localmente):**

| Métrica | Fórmula | Campo MongoDB | Sprint |
|---------|---------|---------------|--------|
| Scroll Stopper Rate | `(videoPlays con 3s+ / impressions) × 100` | `scrollStopperRate` | 8 |
| Hold Rate | `(thruplays / videoPlays) × 100` | `holdRate` | 8 |
| Frequency | `impressions / reach` | (calculado al vuelo) | 3 |

**Notas importantes sobre Meta API:**
- `spend` viene en USD — se multiplica por `Store.cotizacionDolar` para convertir a ARS
- `actions` es un array de objetos `{action_type, value}` — hay que buscar el tipo correcto
- `action_values` es similar pero contiene el valor monetario de las conversiones
- Los video metrics son arrays de objetos — tomar `[0].value`
- Siempre pedir últimos 3 días en cada sync (Meta puede tardar 72h en consolidar attribution)
- Para totales diarios, SOLO agregar nivel `campaign` (evitar doble/triple conteo con adset/ad)
- Los datos a nivel adset y ad se usan solo para drill-down en Meta Pixel module

---

## 3. CAMPOS CALCULADOS

Estos campos NO vienen de ninguna API. Se calculan en el backend (`metricCalculator.js`).

### 3.1 Campos calculados por orden (Order)

Se ejecutan en `calculateOrderFinancials()` después de cada sync:

| Campo | Fórmula | Modelo | Dependencias | Ejemplo | Sprint |
|-------|---------|--------|-------------|---------|--------|
| `comisionPago` | `totalOrden × (Store.comisionPagoConfig[gateway][cuotas].comisionBase / 100)` | Order | Store.comisionPagoConfig | `$2,826` (2.99% de $94,500) | 2 |
| `comisionCuotas` | `totalOrden × (Store.comisionPagoConfig[gateway][cuotas].comisionCuotas / 100)` — solo si cuotas > 1 | Order | Store.comisionPagoConfig | `$4,725` (5% en 3 cuotas) | 2 |
| `impuestosIBB` | `totalOrden × (Store.tasaIBB / 100)` | Order | Store.tasaIBB | `$3,308` (3.5% CABA) | 2 |
| `feePlataforma` | `totalOrden × (Store.feePlataformaPct / 100)` | Order | Store.feePlataformaPct | `$1,890` (2% TN) | 2 |
| `costoProductos` | `sum(Product.costoUnitario × lineItem.cantidad)` por cada lineItem | Order | Product.costoUnitario | `$16,500` | 5 |
| `totalNeto` | `totalOrden - comisionPago - impuestosIBB - comisionCuotas - feePlataforma - costoEnvio - costoProductos` | Order | Todos los anteriores | `$62,451` | 2 |
| `liquidable` | `totalOrden - comisionPago - comisionCuotas - feePlataforma` | Order | comisionPago, comisionCuotas, feePlataforma | `$85,059` | 4 |
| `esClienteNuevo` | `true` si el customer NO tiene órdenes previas (por fecha) en esa tienda | Order | Order (historial) | `true` / `false` | 2 |

**Tabla de mapeo gateway → medio de pago:**

| Gateway (de TN) | medioPago (normalizado) |
|------------------|----------------------|
| `"Mercado Pago"` | `"mercadopago"` |
| `"mercadopago"` | `"mercadopago"` |
| `"Todo Pago"` | `"todopago"` |
| `"Mobbex"` | `"mobbex"` |
| `"PayWay"` | `"payway"` |
| `"visa"` | `"visa"` |
| `"mastercard"` | `"mastercard"` |
| `"amex"` | `"amex"` |
| `"Transferencia bancaria"` | `"transferencia"` |
| (otro) | `"otro"` |

### 3.2 Campos calculados por día (DailyMetric)

Se ejecutan en `recalculateDailyMetric()` después de cada sync:

| Campo | Fórmula | Tipo | Sprint |
|-------|---------|------|--------|
| `ordenes` | `count(Orders del día)` | Sumable | 1 |
| `ordenesPositivas` | `count(Orders del día donde totalOrden > 0)` | Sumable | 2 |
| `revenue` | `sum(totalOrden) de órdenes positivas` | Sumable | 1 |
| `netRevenue` | `sum(totalNeto)` | Sumable | 2 |
| `aov` | `revenue / ordenesPositivas` | Ratio | 1 |
| `aovNeto` | `netRevenue / ordenesPositivas` | Ratio | 2 |
| `devoluciones` | `count(Orders con status cancelled/refunded)` | Sumable | 2 |
| `costoProductos` | `sum(Order.costoProductos)` | Sumable | 5 |
| `costoEnvio` | `sum(Order.costoEnvio)` | Sumable | 2 |
| `comisionPago` | `sum(Order.comisionPago)` | Sumable | 2 |
| `comisionCuotas` | `sum(Order.comisionCuotas)` | Sumable | 2 |
| `impuestosIBB` | `sum(Order.impuestosIBB)` | Sumable | 2 |
| `feePlataforma` | `sum(Order.feePlataforma)` | Sumable | 2 |
| `profit` | `= netRevenue` (ya neto de todos los costos variables) | Sumable | 2 |
| `profitMargin` | `(netRevenue / revenue) × 100` | Ratio (%) | 2 |
| `ncOrdenes` | `count(Orders donde esClienteNuevo = true)` | Sumable | 2 |
| `ncRevenue` | `sum(totalOrden de órdenes NC)` | Sumable | 2 |
| `ncNetRevenue` | `sum(totalNeto de órdenes NC)` | Sumable | 2 |
| `rcOrdenes` | `ordenesPositivas - ncOrdenes` | Calculado | 2 |
| `rcRevenue` | `revenue - ncRevenue` | Calculado | 2 |
| `ncPct` | `(ncOrdenes / ordenesPositivas) × 100` | Ratio (%) | 2 |
| `adSpend` | `sum(MetaDailyInsight.spend) solo nivel campaign` — ya en ARS | Sumable | 3 |
| `impressions` | `sum(MetaDailyInsight.impressions)` nivel campaign | Sumable | 3 |
| `reach` | `sum(MetaDailyInsight.reach)` nivel campaign | Sumable | 3 |
| `clicks` | `sum(MetaDailyInsight.clicks)` nivel campaign | Sumable | 3 |
| `metaPurchases` | `sum(MetaDailyInsight.purchases)` nivel campaign | Sumable | 3 |
| `metaPurchaseValue` | `sum(MetaDailyInsight.purchaseValue)` nivel campaign — en ARS | Sumable | 3 |
| `roas` | `revenue / adSpend` | Ratio | 3 |
| `trueRoas` | `netRevenue / adSpend` | Ratio | 3 |
| `cpa` | `adSpend / ordenesPositivas` | Ratio | 3 |
| `trueCpa` | `adSpend / count(órdenes con totalNeto > 0)` | Ratio | 3 |
| `ncCpa` | `adSpend / ncOrdenes` | Ratio | 3 |
| `ncRoas` | `ncRevenue / adSpend` | Ratio | 3 |
| `ncTrueRoas` | `ncNetRevenue / adSpend` | Ratio | 3 |
| `cpc` | `adSpend / clicks` | Ratio | 3 |
| `ctr` | `(clicks / impressions) × 100` | Ratio (%) | 3 |
| `cpm` | `(adSpend / impressions) × 1000` | Ratio | 3 |
| `conversionRate` | `(ordenesPositivas / clicks) × 100` | Ratio (%) | 3 |
| `liquidable` | `sum(Order.liquidable)` | Sumable | 4 |
| `pagosRecibidos` | `sum(CashflowEntry.liquidable) donde fechaPago ≤ hoy y estado = 'recibido'` | Sumable | 4 |
| `pagosPendientes` | `sum(CashflowEntry.liquidable) donde estado = 'pendiente'` | Sumable | 4 |

**IMPORTANTE — Ratios sobre rangos:**
Cuando el frontend pide métricas de un rango (ej: últimos 7 días), NO se promedian los ratios diarios. Se suman los valores brutos y se recalcula:
- ROAS del rango = `sum(revenue de 7 días) / sum(adSpend de 7 días)` ✅
- NO: `promedio(ROAS diario de 7 días)` ❌

### 3.3 Breakeven (calculados desde configuración)

| Campo | Fórmula | Modelo | Sprint |
|-------|---------|--------|--------|
| `roasBreakeven` | `1 / (1 - deducciónPct)` donde deducciónPct = total deducciones / revenue (últimos 30 días) | Store.objetivos.breakeven | 5 |
| `cpaBreakeven` | `margenPromedioPorOrden` = netRevenue / ordenes (últimos 30 días) | Store.objetivos.breakeven | 5 |
| `aovMinimo` | `costosFijosOrden / (1 - comisionesVariablesPct)` | Store.objetivos.breakeven | 5 |

### 3.4 Health Indicators (por KPI)

| Campo | Lógica | Valores | Sprint |
|-------|--------|---------|--------|
| `status` | Comparar valor real vs `Store.objetivos.kpis.{target}` con umbrales `warningPct` y `criticalPct` | `'ok'` / `'warn'` / `'critical'` | 11 |
| `diff` | `((valor - target) / target) × 100` | Porcentaje de desviación | 11 |
| `global` | Si algún KPI es `critical` → `critical`; si alguno es `warn` → `warn`; sino → `ok` | Estado global de la tienda | 11 |

---

## 4. FORMATOS DE CSV IMPORT

Para cada tipo de CSV, la app provee un archivo de muestra descargable. El frontend muestra un botón "Descargar plantilla" junto al uploader.

### 4.1 CSV de Costos de Productos (COGS)

**Archivo muestra:** `plantilla_costos_productos.csv`
**Endpoint:** `POST /api/store/:storeId/products/costs`
**Max size:** 10MB
**Encoding:** UTF-8

| Columna | Requerida | Tipo | Formato | Ejemplo |
|---------|-----------|------|---------|---------|
| `sku` | Sí | String | Tal cual aparece en TN | `60\|11\|35` |
| `costo_unitario` | Sí | Number | Sin símbolo $, punto decimal | `25000` |
| `costo_empaque` | No | Number | Sin símbolo $ | `500` |
| `proveedor` | No | String | Nombre libre | `"Fábrica Sur"` |
| `moneda` | No | String | `ARS` o `USD` (default: ARS) | `ARS` |

**Ejemplo completo (3 filas):**

```csv
sku,costo_unitario,costo_empaque,proveedor,moneda
60|11|35,25000,500,Fábrica Sur,ARS
600|50|35,25000,500,Fábrica Sur,ARS
253|07|36,18000,400,Importadora Norte,ARS
```

**Validaciones:**
- `sku` debe existir en al menos un Product de la tienda
- `costo_unitario` debe ser > 0
- SKUs no encontrados se reportan en la respuesta (no bloquean el resto)
- Duplicados de SKU: el último valor gana
- Después del upload se dispara recálculo de `costoProductos` en órdenes afectadas

---

### 4.2 CSV de Órdenes (import histórico)

**Archivo muestra:** `plantilla_ordenes_historicas.csv`
**Endpoint:** `POST /api/store/:storeId/orders/import`
**Max size:** 10MB

| Columna | Requerida | Tipo | Formato | Ejemplo |
|---------|-----------|------|---------|---------|
| `order_id` | Sí | String/Number | ID de TN o interno | `1542` |
| `fecha` | Sí | String | `DD/MM/YYYY` o `YYYY-MM-DD` | `15/03/2026` |
| `total` | Sí | Number | Sin $ ni puntos de miles | `94500` |
| `customer_email` | Sí | String | Email válido | `maria@gmail.com` |
| `customer_name` | No | String | — | `María García` |
| `medio_pago` | No | String | Gateway | `mercadopago` |
| `cuotas` | No | Number | 1-24 | `6` |
| `costo_envio` | No | Number | — | `2800` |
| `status` | No | String | `paid` / `pending` / `cancelled` | `paid` |

**Ejemplo:**

```csv
order_id,fecha,total,customer_email,customer_name,medio_pago,cuotas,costo_envio,status
1542,15/03/2026,94500,maria@gmail.com,María García,mercadopago,6,2800,paid
1543,15/03/2026,168000,juan@hotmail.com,Juan Pérez,visa,1,0,paid
1544,16/03/2026,42000,ana@gmail.com,Ana López,mastercard,3,3500,paid
```

**Validaciones:**
- `order_id` duplicados se ignoran (no sobreescriben)
- Se procesan en orden cronológico para correcta detección NC/RC
- `fecha` acepta múltiples formatos (se parsea con date-fns)

---

### 4.3 CSV de Meta Ads (export de Ads Manager)

**Archivo muestra:** No proveemos plantilla — el usuario exporta directo de Meta Ads Manager
**Endpoint:** `POST /api/store/:storeId/meta/import`

**Columnas esperadas (mapeo automático):**

| Columna Meta Ads Manager | Modelo MongoDB | Campo | Ejemplo |
|--------------------------|---------------|-------|---------|
| `Campaign name` | MetaCampaign | `nombre` (level=campaign) | `"GERF - Conv - TOF"` |
| `Ad set name` | MetaCampaign | `nombre` (level=adset) | `"Lookalike 2%"` |
| `Ad name` | MetaCampaign | `nombre` (level=ad) | `"Video Dione 15s"` |
| `Day` / `Reporting starts` | MetaDailyInsight | `date` | `2026-03-15` |
| `Amount spent` / `Importe gastado` | MetaDailyInsight | `spend` | `125.50` |
| `Impressions` / `Impresiones` | MetaDailyInsight | `impressions` | `58275` |
| `Reach` / `Alcance` | MetaDailyInsight | `reach` | `52538` |
| `Link clicks` / `Clics en el enlace` | MetaDailyInsight | `linkClicks` | `1200` |
| `CTR` | MetaDailyInsight | `ctr` | `2.50` |
| `CPC` | MetaDailyInsight | `cpc` | `78.04` |
| `CPM` | MetaDailyInsight | `cpm` | `914.00` |
| `Purchases` / `Compras` | MetaDailyInsight | `purchases` | `11` |
| `Purchase ROAS` / `ROAS de compra` | — | (se recalcula) | — |
| `Purchase conversion value` / `Valor de conversión de compra` | MetaDailyInsight | `purchaseValue` | `729861` |
| `Adds to cart` / `Añadidos al carrito` | MetaDailyInsight | `atc` | `71` |
| `Checkouts initiated` / `Pagos iniciados` | MetaDailyInsight | `checkouts` | `37` |

**Notas:**
- Se soportan headers en español e inglés (Meta exporta en el idioma del usuario)
- El mapeo de columnas es fuzzy — se buscan coincidencias parciales
- `spend` del CSV puede venir en USD o ARS según la config de la cuenta — el usuario indica la moneda al importar

---

### 4.4 CSV de Comisiones de Pago

**Archivo muestra:** `plantilla_comisiones_pago.csv`
**Uso:** Configurar `Store.comisionPagoConfig` masivamente

| Columna | Requerida | Tipo | Ejemplo |
|---------|-----------|------|---------|
| `medio_pago` | Sí | String | `visa` |
| `cuotas` | Sí | Number | `1` |
| `comision_base` | Sí | Number (%) | `2.99` |
| `comision_cuotas` | Sí | Number (%) | `0` |

**Ejemplo:**

```csv
medio_pago,cuotas,comision_base,comision_cuotas
visa,1,2.99,0
visa,3,2.99,5
visa,6,2.99,12
visa,12,2.99,35
mastercard,1,2.99,0
mastercard,3,2.99,5
mastercard,6,2.99,12
mastercard,12,2.99,35
amex,1,3.49,0
amex,3,3.49,6
debit,1,1.50,0
mercadopago,1,4.99,0
mercadopago,3,4.99,8
mercadopago,6,4.99,18
mercadopago,12,4.99,35
transferencia,1,0,0
```

---

### 4.5 CSV de Costos de Envío

**Archivo muestra:** `plantilla_costos_envio.csv`

| Columna | Requerida | Tipo | Ejemplo |
|---------|-----------|------|---------|
| `zona` | Sí | String | `GBA` |
| `costo_fijo` | Sí | Number | `2000` |
| `porcentaje_orden` | No | Number (%) | `0` |

**Ejemplo:**

```csv
zona,costo_fijo,porcentaje_orden
CABA,1500,0
GBA,2000,0
Interior,3500,0
Patagonia,5500,0
```

---

### 4.6 CSV de Costos Adicionales

**Archivo muestra:** `plantilla_costos_adicionales.csv`

| Columna | Requerida | Tipo | Ejemplo |
|---------|-----------|------|---------|
| `nombre` | Sí | String | `Seguros` |
| `monto` | Sí | Number | `5000` |
| `tipo` | Sí | String | `fijo_mensual` o `porcentaje_por_orden` |

**Ejemplo:**

```csv
nombre,monto,tipo
Seguros,5000,fijo_mensual
Embalaje Premium,2,porcentaje_por_orden
Software ERP,15000,fijo_mensual
Contador,25000,fijo_mensual
```

---

### 4.7 CSV del Pipeline Creativo

**Archivo muestra:** `plantilla_pipeline_creativo.csv`

| Columna | Requerida | Tipo | Ejemplo |
|---------|-----------|------|---------|
| `fecha` | No | String (DD/MM/YYYY) | `15/03/2026` |
| `producto` | No | String | `Zapatillas Dione` |
| `id_proyecto` | Sí | String | `A` |
| `id_hook` | Sí | Number | `1` |
| `status` | Sí | String | `Revisión Lista` / `En Producción` / `Activo` / `Pausado` |
| `receta_creativa` | No | String | `Benefits` / `Emocional` / `Problema-Solución` |
| `formato` | No | String | `Imagen` / `Video` / `Carrusel` / `Colección` |
| `angulo_venta` | No | String | `Problema` / `Aspiracional` / `Social Proof` |
| `nivel_consciencia` | No | String | `Del problema` / `De la solución` / `Del producto` |
| `creative_brief` | No | String (largo) | Texto libre |
| `referencias` | No | String (URL) | Link a carpeta |
| `link_archivo` | No | String (URL) | Link al asset |

**Ejemplo:**

```csv
fecha,producto,id_proyecto,id_hook,status,receta_creativa,formato,angulo_venta,nivel_consciencia,creative_brief
15/03/2026,Zapatillas Dione,A,1,Revisión Lista,Benefits,Imagen,Problema,Del problema,"Hook de dolor: ¿Cansado de zapatillas que duran 2 meses?"
15/03/2026,Zapatillas Dione,A,2,En Producción,Emocional,Video,Aspiracional,De la solución,"Lifestyle video mostrando uso casual"
20/03/2026,Pack Medias,B,1,Activo,Social Proof,Carrusel,Social Proof,Del producto,"Mostrar reviews reales de clientes"
```

---

### 4.8 CSV de Competidores

**Archivo muestra:** `plantilla_competidores.csv`

| Columna | Requerida | Tipo | Ejemplo |
|---------|-----------|------|---------|
| `competidor` | Sí | String | `Escalafy` |
| `producto` | Sí | String | `Zapatillas running` |
| `precio_competidor` | Sí | Number | `89000` |
| `precio_nuestro` | No | Number | `84000` |
| `url` | No | String | `https://competidor.com/producto` |
| `tipo_oferta` | No | String | `descuento` / `3x2` / `envio_gratis` |
| `fecha_inicio_oferta` | No | String (DD/MM/YYYY) | `01/03/2026` |
| `fecha_fin_oferta` | No | String (DD/MM/YYYY) | `31/03/2026` |

---

## 5. CAMPOS DE CONFIGURACIÓN (Store)

Todos configurables por tienda. Se editan en Settings o se cargan por CSV.

### 5.1 Configuración Financiera

| Campo | Tipo | Default | Descripción | Ejemplo |
|-------|------|---------|-------------|---------|
| `cotizacionDolar` | Number | `1200` | Tipo de cambio ARS/USD para convertir ad spend | `1350` |
| `tasaIBB` | Number | `3.5` | % Ingresos Brutos según provincia | `3.5` (CABA) |
| `feePlataformaPct` | Number | `2.0` | % fee que cobra TiendaNube por transacción | `2.0` |

### 5.2 Comisiones de Pago

Array `comisionPagoConfig[]`:

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `medioPago` | String | Medio de pago normalizado | `"visa"` |
| `cuotas` | Number | Cantidad de cuotas | `6` |
| `comisionBase` | Number (%) | Comisión base del procesador | `2.99` |
| `comisionCuotas` | Number (%) | Costo adicional por financiamiento | `12` |

### 5.3 Costos de Envío

Array `costosEnvio[]`:

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `zona` | String | Zona geográfica | `"GBA"` |
| `costoFijo` | Number | Costo fijo por envío | `2000` |
| `porcentajeOrden` | Number (%) | % adicional sobre total orden | `0` |

### 5.4 Costos Adicionales

Array `costosAdicionales[]`:

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `nombre` | String | Nombre del costo | `"Seguros"` |
| `monto` | Number | Monto o porcentaje | `5000` |
| `tipo` | String | `'fijo_mensual'` o `'porcentaje_por_orden'` | `"fijo_mensual"` |

### 5.5 Objetivos y Benchmarks

Object `objetivos`:

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `fase` | String | Fase del cliente | `"escalamiento"` |
| `kpis.roasTarget` | Number | ROAS objetivo | `3.5` |
| `kpis.trueRoasTarget` | Number | True ROAS objetivo | `2.8` |
| `kpis.cpaMaximo` | Number | CPA máximo aceptable (ARS) | `15000` |
| `kpis.trueCpaMaximo` | Number | True CPA máximo | `18000` |
| `kpis.profitMarginMin` | Number (%) | Margen mínimo | `15` |
| `kpis.aovTarget` | Number | AOV objetivo (ARS) | `65000` |
| `kpis.ncPctTarget` | Number (%) | % clientes nuevos objetivo | `40` |
| `kpis.conversionRateTarget` | Number (%) | CVR objetivo | `2.5` |
| `kpis.tasaDevolucionMax` | Number (%) | Tasa de devolución máxima | `5` |
| `breakeven.roasBreakeven` | Number | ROAS breakeven (auto-calculado) | `1.61` |
| `breakeven.cpaBreakeven` | Number | CPA breakeven (auto-calculado) | `42500` |
| `breakeven.aovMinimo` | Number | AOV mínimo (auto-calculado) | `28000` |
| `alertThresholds.warningPct` | Number | % desviación para warning | `15` |
| `alertThresholds.criticalPct` | Number | % desviación para critical | `30` |

### 5.6 Sync y Integración

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `metricasHome` | Array de 5 Strings | KPIs elegidos para Home card | `["ordenes", "revenue", "roas", "profit", "ncPct"]` |
| `syncConfig.autoSync` | Boolean | Si el sync automático está activo | `true` |
| `syncConfig.tnOrdersInterval` | String (cron) | Frecuencia sync TN | `"0 */4 * * *"` |
| `syncConfig.metaInsightsInterval` | String (cron) | Frecuencia sync Meta | `"0 1,7,13,19 * * *"` |
| `integrationStatus.tiendanube.connected` | Boolean | Si TN está conectada | `true` |
| `integrationStatus.tiendanube.lastSync` | Date | Último sync exitoso | `2026-03-28T14:00:00Z` |
| `integrationStatus.metaAds.connected` | Boolean | Si Meta está conectada | `true` |
| `integrationStatus.metaAds.lastSync` | Date | Último sync exitoso | `2026-03-28T13:00:00Z` |

---

## 6. MODELOS MONGODB COMPLETOS

### Resumen de colecciones y tamaño estimado

| Colección | Docs estimados (10 tiendas, 12 meses) | Tamaño aprox por doc | Total estimado | TTL |
|-----------|----------------------------------------|---------------------|---------------|-----|
| Store | 10 | 5 KB | 50 KB | — |
| User | 10-20 | 1 KB | 20 KB | — |
| Order | 36,000 (300/mes × 10 × 12) | 1.5 KB | 54 MB | 12 meses |
| Product | 5,000 (500/tienda × 10) | 1 KB | 5 MB | — |
| Customer | 15,000 | 0.5 KB | 7.5 MB | — |
| DailyMetric | 3,650 (365 × 10) | 2 KB | 7.3 MB | — |
| CashflowEntry | 72,000 (órdenes × 2 promedio cuotas) | 0.5 KB | 36 MB | 12 meses |
| MetaCampaign | 3,000 (300/tienda × 10) | 0.5 KB | 1.5 MB | — |
| MetaDailyInsight | 109,500 (30 obj × 365 × 10) | 0.8 KB | 87.6 MB | — |
| Widget | 500 | 0.5 KB | 0.25 MB | — |
| SyncLog | ~5,000 | 0.3 KB | 1.5 MB | 30 días |
| Alert | ~1,000 | 0.5 KB | 0.5 MB | — |
| Report | ~500 | 5 KB | 2.5 MB | — |
| TopicMap | ~200 | 1 KB | 0.2 MB | — |
| LanguageBank | ~500 | 0.5 KB | 0.25 MB | — |
| Competitor | ~100 | 2 KB | 0.2 MB | — |
| CreativeHook | ~1,000 | 1 KB | 1 MB | — |

**TOTAL ESTIMADO: ~204 MB** (dentro del free tier de 512MB con margen)

**Estrategias de limpieza para mantenerse dentro de 512MB:**
1. TTL en SyncLog: auto-borrado a 30 días
2. Cleanup job diario: archivar Orders > 12 meses (mantener DailyMetric como resumen)
3. Cleanup de CashflowEntry: borrar entries con estado='recibido' > 6 meses
4. MetaDailyInsight: para objetos DELETED, borrar insights > 90 días
5. `.lean()` en todas las queries read-only
6. No guardar imágenes, solo URLs
7. Si se acerca al límite: upgrade a M2 ($9/mes) o M5 ($25/mes)

---

## 7. MAPEO DE CSVS DE REFERENCIA EXISTENTES

Estos CSVs son los documentos que se usan hoy para analizar clientes. El objetivo es que la app replique el mismo análisis de forma automática.

### 7.1 "Daily Tracker - GERF & HOOKS" → Dashboard + Meta Pixel

| Columna CSV | Fuente original | Modelo MongoDB | Campo | Sección en la app |
|-------------|----------------|---------------|-------|-------------------|
| `DATE` | Manual | DailyMetric | `date` | Dashboard |
| `semana` | Manual | (calculado) | — | Dashboard (agrupación) |
| `Importe gastado` | Meta Ads Manager | MetaDailyInsight | `spend` | Dashboard KPI / Meta Pixel |
| `Alcance` | Meta Ads Manager | MetaDailyInsight | `reach` | Meta Pixel |
| `Clicks (FB)` | Meta Ads Manager | MetaDailyInsight | `clicks` | Meta Pixel |
| `CPM` | Meta Ads Manager | MetaDailyInsight | `cpm` | Meta Pixel |
| `CTR unico` | Meta Ads Manager | MetaDailyInsight | `ctr` | Meta Pixel |
| `Añadidos al carrito` | Meta Ads Manager | MetaDailyInsight | `atc` | Meta Pixel |
| `Pago iniciado` | Meta Ads Manager | MetaDailyInsight | `checkouts` | Meta Pixel |
| `Compras` | Meta Ads Manager | MetaDailyInsight | `purchases` | Dashboard / Meta Pixel |
| `Valor de conversion` | Meta Ads Manager | MetaDailyInsight | `purchaseValue` | Dashboard |
| `ROAS - daily` | Calculado | DailyMetric | `roas` | Dashboard KPI |
| `AOV (daily)` | Calculado | DailyMetric | `aov` | Dashboard KPI |
| `CPA - daily` | Calculado | DailyMetric | `cpa` | Dashboard KPI |
| `CVR (daily)` | Calculado | DailyMetric | `conversionRate` | Dashboard |
| `%Ticket` | Calculado | — | (análisis custom) | — |
| `CPC (FB)` | Calculado | DailyMetric | `cpc` | Meta Pixel |
| `Total Ad Spend (FB)` | Acumulado | — | (sum acumulado de spend) | Dashboard |
| `Total carts` | Acumulado | — | (sum acumulado de ATC) | — |
| `Cost per ATC` | Calculado | — | `adSpend / atc` | Meta Pixel |
| `Total checkouts` | Acumulado | — | (sum acumulado) | — |
| `Cost per checkout` | Calculado | — | `adSpend / checkouts` | Meta Pixel |
| `Total sales` | Acumulado | — | (sum acumulado de purchases) | — |
| `CPA - (from start)` | Acumulado | — | (spend acum / purchases acum) | — |
| `Valor total conv` | Acumulado | — | (sum acumulado purchaseValue) | — |
| `ROAS - (from start)` | Acumulado | — | (purchaseValue acum / spend acum) | — |
| `AOV (lifetime)` | Acumulado | — | (purchaseValue acum / purchases acum) | — |
| `Click-to-cart ratio` | Calculado | — | `atc / clicks × 100` | Meta Pixel funnel |
| `Cart-to-purchase` | Calculado | — | `purchases / atc × 100` | Meta Pixel funnel |

### 7.2 "DAILY MANGUZ - HOJA DE ANALISIS" → Dashboard + Objetivos

| Columna CSV | Modelo MongoDB | Campo | Notas |
|-------------|---------------|-------|-------|
| **Fila de OBJETIVO** | Store.objetivos.kpis | Targets | CPM target, CTR target, CVR targets, AOV target, ROAS target |
| `MES` | DailyMetric | (filtro) | Agrupación mensual |
| `Día` | DailyMetric | `date` | Fecha del día |
| `Importe gastado` | MetaDailyInsight | `spend` | — |
| `CPM` | MetaDailyInsight | `cpm` | — |
| `Alcance` | MetaDailyInsight | `reach` | — |
| `Impresiones` | MetaDailyInsight | `impressions` | — |
| `Frecuencia` | Calculado | `impressions / reach` | — |
| `Clics únicos en el enlace` | MetaDailyInsight | `uniqueLinkClicks` | — |
| `CTR` | MetaDailyInsight | `ctr` | — |
| `Visitas a la página de destino` | MetaDailyInsight | (no direct match) | Se usa `linkClicks` como proxy |
| `agregados al carrito` | MetaDailyInsight | `atc` | — |
| `CVR (VISITAS → CARRITOS)` | Calculado | `atc / linkClicks × 100` | Funnel step 1 |
| `Pagos iniciados` | MetaDailyInsight | `checkouts` | — |
| `CVR (CARRITOS → PAGOS INI)` | Calculado | `checkouts / atc × 100` | Funnel step 2 |
| `Compras` | MetaDailyInsight | `purchases` | — |
| `CVR (PAGOS INI → COMPRAS)` | Calculado | `purchases / checkouts × 100` | Funnel step 3 |
| `Costo por compra` | Calculado | `spend / purchases` | = CPA |
| `ROAS` | Calculado | `purchaseValue / spend` | — |
| `Valor de conv` | MetaDailyInsight | `purchaseValue` | — |
| `AOV` | Calculado | `purchaseValue / purchases` | — |
| `CVR (VISITAS → COMPRAS)` | Calculado | `purchases / linkClicks × 100` | Funnel completo |

### 7.3 "GERF - ANALISIS COMERCIAL" → Productos

| Columna CSV | Modelo MongoDB | Campo | Notas |
|-------------|---------------|-------|-------|
| `url` | Product | (informativo) | URL del producto en la tienda |
| `sku` / `SKU` | Product | variantes[].sku | Identificador principal |
| `nombre` | Product | `nombre` | — |
| `id` | Product | `tnProductId` | ID de TiendaNube |
| `categorias` | Product | `categoria` | Pipe-separated |
| `precio_actual` | Product | `precio` | — |
| `precio_promocional` | Product | (no mapeado, se podría agregar) | — |
| `stock_actual` | Product | `stock` | — |
| `FEBRERO` ... `AGOSTO` | Product | `ventas30dias` (por mes) | Ventas por mes — replicar con agregación |
| `Spend mayo` / `Spend Junio` | MetaDailyInsight | (filtrado por producto) | Gasto publicitario atribuible |
| `ventas ecom` | Calculado | Sum de ventas totales | — |
| `SPEND` | Calculado | Sum de spend total | — |
| `IMAGEN` | Product | `imagenUrl` | — |
| `VALORIZADO` | Calculado | `stock × precio` | Capital inmovilizado |

### 7.4 "Pipeline Creativo" → Creativos

| Columna CSV | Modelo MongoDB | Campo | Notas |
|-------------|---------------|-------|-------|
| `Fecha` | CreativeHook | `fecha` | — |
| `Producto (URL/NOMBRE)` | CreativeHook | `producto` | — |
| `ID Proyecto` | CreativeHook | `proyectoId` | — |
| `ID HOOK` | CreativeHook | `hookId` | — |
| `Status` | CreativeHook | `status` | Revisión Lista / En Producción / Activo / Pausado |
| `Receta Creativa` | CreativeHook | `receta` | Benefits / Emocional / Problema-Solución |
| `Formato` | CreativeHook | `formato` | Imagen / Video / Carrusel / Colección |
| `ANGULO DE VENTA` | CreativeHook | `angulo` | — |
| `Nivel de Consciencia` | CreativeHook | `nivelConsciencia` | — |
| `Creative Brief` | CreativeHook | `brief` | Texto libre |
| `Referencias` | CreativeHook | `referencias` | URL |
| `Link Archivo` | CreativeHook | `linkArchivo` | URL |
| `IMPORTE GASTADO` | MetaDailyInsight | (vinculado por ad) | — |
| `CTR` | MetaDailyInsight | (vinculado por ad) | — |
| `CPA` | MetaDailyInsight | (vinculado por ad) | — |
| `COMPRAS` | MetaDailyInsight | (vinculado por ad) | — |

### 7.5 "CAMBIOS EN LAS METRICAS" → Simulador

| Columna CSV | Uso en la app | Notas |
|-------------|--------------|-------|
| `Escenario` | Simulador | Nombre del escenario (NORMAL, Si CPM cambia, etc.) |
| `Importe gastado` | Simulador | Input: Budget |
| `Alcance` | Simulador | Output calculado |
| `CPM` | Simulador | Input: slider |
| `CPC` | Simulador | Output calculado |
| `CTR` | Simulador | Input: slider |
| `Clicks` | Simulador | Output: `(Budget/CPM) × 1000 × (CTR/100)` |
| `CVR` | Simulador | Input: slider |
| `AOV` | Simulador | Input: slider |
| `Compras` | Simulador | Output: `Clicks × (CVR/100)` |
| `CPA` | Simulador | Output: `Budget / Compras` |
| `Valor de Conversión` | Simulador | Output: `Compras × AOV` |
| `ROAS` | Simulador | Output: `Valor / Budget` |

---

## 8. TABLA DE FÓRMULAS MASTER

Referencia rápida de todas las fórmulas del sistema, organizadas por categoría.

### Rentabilidad por Orden

| Métrica | Fórmula | Nivel |
|---------|---------|-------|
| Total Neto | `totalOrden - comisionPago - impuestosIBB - comisionCuotas - feePlataforma - costoEnvio - costoProductos` | Orden |
| Liquidable | `totalOrden - comisionPago - comisionCuotas - feePlataforma` | Orden |
| Comisión Pago | `totalOrden × comisionBase%` | Orden |
| Comisión Cuotas | `totalOrden × comisionCuotas%` (solo si cuotas > 1) | Orden |
| IBB | `totalOrden × tasaIBB%` | Orden |
| Fee Plataforma | `totalOrden × feePlataformaPct%` | Orden |
| Costo Productos | `Σ(costoUnitario × cantidad)` por cada line item | Orden |

### KPIs Agregados por Rango

| Métrica | Fórmula | Tipo |
|---------|---------|------|
| Revenue | `Σ(totalOrden)` de órdenes positivas | Sumable |
| Net Revenue | `Σ(totalNeto)` | Sumable |
| Profit | `= Net Revenue` | Sumable |
| Profit Margin % | `(Net Revenue / Revenue) × 100` | Ratio |
| AOV | `Revenue / Órdenes positivas` | Ratio |
| AOV Neto | `Net Revenue / Órdenes positivas` | Ratio |
| ROAS | `Revenue / Ad Spend` | Ratio |
| True ROAS | `Net Revenue / Ad Spend` | Ratio |
| CPA | `Ad Spend / Órdenes positivas` | Ratio |
| True CPA | `Ad Spend / Órdenes con totalNeto > 0` | Ratio |
| NC % | `(NC Órdenes / Órdenes positivas) × 100` | Ratio |
| NC CPA | `Ad Spend / NC Órdenes` | Ratio |
| NC ROAS | `NC Revenue / Ad Spend` | Ratio |
| NC True ROAS | `NC Net Revenue / Ad Spend` | Ratio |
| RC % | `100 - NC%` | Calculado |
| CPC | `Ad Spend / Clicks` | Ratio |
| CTR | `(Clicks / Impressions) × 100` | Ratio |
| CPM | `(Ad Spend / Impressions) × 1000` | Ratio |
| CVR | `(Órdenes / Clicks) × 100` | Ratio |

### Breakeven

| Métrica | Fórmula |
|---------|---------|
| ROAS Breakeven | `1 / (1 - deducciónPct)` |
| CPA Breakeven | `margenPromedioPorOrden` (últimos 30d) |
| AOV Mínimo | `costosFijosOrden / (1 - comisionesVariablesPct)` |

### Cashflow

| Métrica | Fórmula |
|---------|---------|
| Liquidable Ventas | `Gross Revenue - Total Comisiones de Pago` |
| Comisiones % | `Total Comisiones / Gross Revenue × 100` |
| Pagos Pendientes | `Σ(liquidable)` de entries con `estado = 'pendiente'` |
| Pagos Recibidos | `Σ(liquidable)` de entries con `estado = 'recibido'` |
| Fecha Pago (cuota N) | `paidAt + díasGateway + ((N-1) × 30)` |

### Simulador (What-If)

| Métrica | Fórmula |
|---------|---------|
| Impressions | `(Budget / CPM) × 1000` |
| Clicks | `Impressions × (CTR / 100)` |
| Conversiones | `Clicks × (CVR / 100)` |
| Revenue | `Conversiones × AOV` |
| ROAS | `Revenue / Budget` |
| CPA | `Budget / Conversiones` |

### Creativos (Auto-clasificación ABCDE)

| Tier | Criterio |
|------|----------|
| A | Top 10% (mayor ROAS, menor CPA) |
| B | 10-30% |
| C | 30-60% |
| D | 60-80% |
| E | Bottom 20% |

Scoring: basado en ROAS vs promedio + CPA vs promedio + eficiencia (CTR × CVR / CPM)

### Conversión USD → ARS

| Operación | Fórmula |
|-----------|---------|
| Ad Spend en ARS | `MetaDailyInsight.spend (USD) × Store.cotizacionDolar` |
| Purchase Value en ARS | `MetaDailyInsight.purchaseValue (USD) × Store.cotizacionDolar` |
| Todos los ROAS/CPA | Se calculan con spend ya convertido a ARS |

---

*Documento generado: Marzo 2026*
*Última actualización: al agregar nuevas integraciones o fuentes de datos*