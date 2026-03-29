# ROADMAP DE IMPLEMENTACIÓN — ecom-analytics

> Plan de desarrollo completo. 11 sprints. Cada detalle especificado.
> Prioridad: calidad sobre velocidad. No hay deadline.

---

## 1. RESUMEN DEL PROYECTO

**ecom-analytics** es una plataforma de analytics para una agencia de ecommerce en Argentina con 10+ clientes en TiendaNube que operan con Meta Ads.

**Problema**: La información hoy está fragmentada en Meta Ads Manager, panel de TiendaNube, Google Sheets y documentos HTML estáticos. No hay visibilidad de rentabilidad real (True ROAS), no hay cashflow tracking, y cada análisis requiere horas de trabajo manual.

**Solución**: Una plataforma centralizada que:
1. Sincroniza datos de TiendaNube + Meta Ads automáticamente
2. Calcula rentabilidad REAL (descontando comisiones, impuestos IBB, cuotas, fees, COGS, envío)
3. Muestra el desfase entre vender y cobrar (cashflow con cuotas)
4. Clasifica creativos automáticamente (ABCDE)
5. Genera análisis y reportes con Claude AI
6. Soporta múltiples usuarios

**Diferenciador**: Las complejidades financieras de Argentina (comisiones variables de Mercado Pago, cuotas, IBB, cotización dólar) están resueltas nativamente.

---

## 2. STACK TECNOLÓGICO CONFIRMADO

| Capa | Tecnología | Versión | Justificación |
|------|-----------|---------|---------------|
| **Backend** | Node.js + Express | 18 LTS + 4.18 | Idéntico al proyecto existente |
| **ORM** | Mongoose | 8.x | Idéntico al existente |
| **Frontend** | React + Vite | 18 + 5 | Idéntico al existente |
| **CSS** | TailwindCSS | 3.x | Idéntico al existente |
| **State** | Redux Toolkit + React Query | Latest | Estado global + cache de server |
| **Charts** | Recharts | 2.x | Liviano, React-native |
| **CSV** | PapaParse + Multer | Latest | Parse CSV + file upload |
| **BD** | MongoDB Atlas | Free tier (512MB) | $0, escalable a M2 si necesario |
| **Deploy** | Railway | Hobby plan | Docker multi-stage, $0 |
| **Cron** | node-cron | Latest | En el mismo proceso Express |
| **AI** | Claude API (Anthropic) | claude-sonnet-4-6 / claude-opus-4-6 | tool_use para chat, sonnet para bulk |
| **Auth** | JWT | 7 días expiry | Email + password |
| **Dates** | date-fns | 3.x | Manipulación de fechas sin moment |

---

## 3. ARQUITECTURA DE AI

### 3.1 Estrategia General

La AI no es un feature secundario — es crítico para el valor de la plataforma. La integración se diseña en 3 capas + configuración centralizada.

### 3.2 Configuración de AI (Settings > Integraciones AI)

```
Settings > AI Configuration
├── Provider: [Claude (default)] [OpenAI] [Custom]
├── API Key: [*****] (encriptada en BD)
├── Modelo para análisis: [claude-sonnet-4-6] (económico, para L1 y L3)
├── Modelo para chat: [claude-sonnet-4-6] (inteligente, para L2)
├── Modelo para reportes: [claude-opus-4-6] (calidad máxima)
├── Budget mensual estimado: $XX USD (calculado automáticamente)
├── Tokens usados este mes: XX,XXX
└── Test connection: [Probar] ✅ Conectado
```

**Modelo de datos — AIConfig (dentro de Settings globales o por User):**

```js
{
  provider: String,              // 'anthropic' | 'openai' | 'custom'
  apiKey: String,                // encriptada con AES-256
  models: {
    analysis: String,            // para L1 (reportes de sección)
    chat: String,                // para L2 (chat con datos)
    diagnostics: String,         // para L3 (alertas automáticas)
    reports: String,             // para reportes completos
    competitor: String,          // para análisis de competencia
  },
  maxTokensPerRequest: Number,   // default 4096
  maxRequestsPerDay: Number,     // rate limiting propio
  tokensUsedThisMonth: Number,   // tracking de uso
}
```

**Arquitectura para múltiples providers:**
El backend tiene un servicio `aiService.js` con interface unificada:

```js
// services/aiService.js
class AIService {
  async analyze(prompt, context, options)    // L1
  async chat(messages, tools, options)       // L2 (con tool_use)
  async diagnose(storeData, options)         // L3
  async generateReport(data, template)       // Reportes
}
```

Internamente usa `AnthropicProvider` o `OpenAIProvider` según config. Esto permite cambiar de provider sin tocar la lógica de negocio.

### 3.3 Layer 1 — Análisis por Sección

**Qué hace**: Botón "Generar análisis" en cada sección (Dashboard, Cashflow, Meta Pixel, Creativos, Productos, Clientes, Competencia). El backend arma un prompt estructurado con los datos de esa sección y lo envía a Claude.

**Flujo:**

```
Usuario clickea "Generar análisis" en Dashboard
  → Frontend envía POST /api/store/:id/ai/analyze { section: 'dashboard', dateRange }
  → Backend:
    1. Fetch métricas del rango (DailyMetric aggregation)
    2. Fetch comparativa vs período anterior
    3. Fetch objetivos de la tienda (Store.objetivos)
    4. Armar structured prompt:
       - Contexto del cliente (nombre, rubro, fase, targets)
       - Datos del período (KPIs con deltas)
       - Instrucciones específicas por sección
    5. Llamar Claude API (sin tool_use, solo texto)
    6. Guardar respuesta en Report model
  → Frontend muestra en modal con opción "Guardar como Reporte"
```

**Prompt template para Dashboard:**

```
Sos un analista de ecommerce experto en el mercado argentino.

CONTEXTO DEL CLIENTE:
- Tienda: {store.nombre}
- Rubro: {store.rubro}
- Fase actual: {store.objetivos.fase}
- Targets: ROAS {target}, CPA máx {target}, NC% {target}

DATOS DEL PERÍODO ({from} a {to}):
- Órdenes: {ordenes} ({delta}% vs anterior)
- Revenue: ${revenue} ({delta}%)
- Net Revenue: ${netRevenue} ({delta}%)
- ROAS: {roas}x ({delta}%) — Target: {target}x — Breakeven: {breakeven}x
- True ROAS: {trueRoas}x ({delta}%)
- CPA: ${cpa} ({delta}%) — Máximo: ${target}
- Profit Margin: {profitMargin}% ({delta}pp)
- NC%: {ncPct}% ({delta}pp) — Target: {target}%
- Ad Spend: ${adSpend} ({delta}%)
- AOV: ${aov} ({delta}%)
- Devoluciones: {devoluciones}

ANALIZAR:
1. ¿Qué tendencias positivas y negativas ves?
2. ¿Hay métricas que están por debajo del target? ¿Cuáles y por cuánto?
3. ¿El ROAS está por encima del breakeven? ¿Con cuánto margen?
4. ¿El NC% indica que estamos escalando o re-impactando?
5. ¿Qué 2-3 acciones concretas recomendás?

Responder en español, máximo 400 palabras, usar bullet points.
```

**Modelo sugerido**: `claude-sonnet-4-6` (económico, rápido, suficiente para análisis estructurado)
**Tokens estimados**: ~1,500 input + ~500 output = ~2,000 por request
**Costo estimado**: ~$0.006 USD por análisis

### 3.4 Layer 2 — Chat con Datos (Tool Use)

**Qué hace**: Chat panel en las páginas principales donde el usuario hace preguntas en lenguaje natural y Claude ejecuta queries contra la BD.

**Flujo:**

```
Usuario escribe: "¿Cuál es mi producto más rentable?"
  → Frontend envía POST /api/store/:id/ai/chat { message, conversationHistory }
  → Backend:
    1. Armar system prompt con contexto del cliente
    2. Definir tools disponibles (funciones que Claude puede llamar)
    3. Llamar Claude API con tool_use
    4. Claude decide qué tool usar y con qué parámetros
    5. Backend ejecuta la query MongoDB
    6. Enviar resultado de vuelta a Claude
    7. Claude interpreta y responde en lenguaje natural
  → Frontend muestra la respuesta
```

**Tools disponibles para Claude:**

```js
const tools = [
  {
    name: 'getMetricsByDateRange',
    description: 'Obtener métricas agregadas de la tienda para un rango de fechas',
    input_schema: {
      type: 'object',
      properties: {
        dateStart: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
        dateEnd: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
        metrics: { type: 'array', items: { type: 'string' }, description: 'Lista de métricas a incluir' },
      },
      required: ['dateStart', 'dateEnd']
    }
  },
  {
    name: 'getTopProducts',
    description: 'Obtener los productos con más ventas o mejor margen',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
        orderBy: { type: 'string', enum: ['ventas', 'revenue', 'margen', 'stock'] },
        dateStart: { type: 'string' },
        dateEnd: { type: 'string' },
      },
      required: ['orderBy']
    }
  },
  {
    name: 'getCampaignPerformance',
    description: 'Obtener métricas de campañas de Meta Ads',
    input_schema: {
      type: 'object',
      properties: {
        level: { type: 'string', enum: ['campaign', 'adset', 'ad'] },
        status: { type: 'string', enum: ['ACTIVE', 'PAUSED', 'all'] },
        orderBy: { type: 'string', enum: ['spend', 'roas', 'cpa', 'purchases'] },
        limit: { type: 'number' },
      }
    }
  },
  {
    name: 'getCustomerSegments',
    description: 'Obtener segmentación de clientes (NC vs RC, RFM, cohorts)',
    input_schema: {
      type: 'object',
      properties: {
        segmentType: { type: 'string', enum: ['nc_rc', 'rfm', 'cohort', 'top_spenders'] },
        limit: { type: 'number' },
      },
      required: ['segmentType']
    }
  },
  {
    name: 'getCashflowForecast',
    description: 'Obtener proyección de cashflow para las próximas semanas',
    input_schema: {
      type: 'object',
      properties: {
        weeks: { type: 'number', description: 'Cantidad de semanas a proyectar (2-8)' },
      }
    }
  },
  {
    name: 'getOrderDetails',
    description: 'Obtener detalle de órdenes con filtros',
    input_schema: {
      type: 'object',
      properties: {
        dateStart: { type: 'string' },
        dateEnd: { type: 'string' },
        minTotal: { type: 'number' },
        esClienteNuevo: { type: 'boolean' },
        limit: { type: 'number' },
      }
    }
  },
  {
    name: 'getCompetitorData',
    description: 'Obtener datos de un competidor específico',
    input_schema: {
      type: 'object',
      properties: {
        competitorId: { type: 'string' },
      },
      required: ['competitorId']
    }
  },
];
```

**System prompt para chat:**

```
Sos el analista de datos de la tienda "{store.nombre}".
Tenés acceso a las siguientes herramientas para consultar datos reales.
Siempre usá las herramientas antes de responder — nunca inventes datos.
Respondé en español, sé conciso y accionable.
Cuando des recomendaciones, basalas en los datos que consultaste.
El contexto del cliente: {fase}, {targets}, {rubro}.
La moneda es ARS (pesos argentinos).
```

**Modelo sugerido**: `claude-sonnet-4-6` (necesita razonamiento para elegir tools)
**Costo estimado**: ~$0.02-0.05 por conversación (depende de cantidad de tool calls)

### 3.5 Layer 3 — Diagnósticos Automáticos

**Qué hace**: Cron job cada 6 horas que analiza KPIs de cada tienda, detecta anomalías y genera alertas con recomendaciones.

**Flujo:**

```
Cron job (cada 6h)
  → Para cada Store:
    1. Calcular KPIs de últimos 7 días vs 7 días anteriores
    2. Detectar anomalías con reglas hardcoded:
       - ROAS cayó >20%
       - CPA subió >25%
       - 0 ventas en 48h+
       - Stock crítico en top sellers
       - NC% cayó >10pp
       - Campaña con spend >$X y 0 conversiones
       - Productos con margen negativo
    3. Si hay anomalías: armar prompt con hallazgos
    4. Enviar a Claude para priorización y recomendaciones
    5. Guardar Alerts en BD
    6. Frontend muestra badges en Home cards
```

**Modelo sugerido**: `claude-sonnet-4-6` (económico para batch)
**Frecuencia**: 4x/día × 10 tiendas = 40 requests/día
**Costo estimado**: ~$0.24/día = ~$7/mes

### 3.6 Análisis de Competencia con AI

**Flujo:**

```
Usuario va a Competencia > Competidor X > "Analizar con AI"
  → Backend recopila:
    1. Datos del competidor (productos, precios, ofertas, creativos descritos)
    2. Datos propios (mismos campos para comparar)
    3. Contexto del mercado (rubro, target, fase)
  → Prompt a Claude:
    "Comparar nuestros precios vs competidor.
     Identificar oportunidades de diferenciación.
     Analizar si sus ofertas nos afectan.
     Sugerir ajustes de precio o comunicación."
  → Guardar como Report
```

### 3.7 Generación de Reportes

Dos tipos de reportes:

**A. Reporte de Métricas (sin AI):**
- Template HTML/PDF con KPIs del período
- Tablas, charts, comparativas
- Sin interpretación — solo datos

**B. Reporte con Análisis AI:**
- Igual que A pero con secciones de análisis generado por Claude
- Interpretación de tendencias
- Recomendaciones priorizadas
- Pasos a seguir concretos

**Template de reporte completo:**

```
1. Resumen Ejecutivo (AI generated)
2. KPIs del Período (datos)
3. Análisis de Performance (AI generated)
4. Funnel de Conversión (datos + AI)
5. Top/Bottom Productos (datos)
6. NC vs RC (datos + AI)
7. Cashflow Status (datos)
8. Recomendaciones y Próximos Pasos (AI generated)
```

### 3.8 Optimización de Costos AI

| Acción | Ahorro |
|--------|--------|
| Usar sonnet para L1 y L3, opus solo para reportes completos | ~60% vs todo opus |
| Cachear análisis: no regenerar si datos no cambiaron | ~40% menos requests |
| Limitar L3 a tiendas con cambios significativos | ~50% menos requests L3 |
| Batch de diagnósticos: enviar todas las tiendas en 1 prompt | ~70% menos requests L3 |
| Rate limiting propio: max 50 requests/día por defecto | Control de gasto |

**Estimación mensual (10 tiendas):**

| Layer | Requests/mes | Costo estimado |
|-------|-------------|---------------|
| L1 (análisis on-demand) | ~200 | ~$1.20 |
| L2 (chat) | ~300 | ~$9.00 |
| L3 (diagnósticos) | ~1,200 | ~$7.20 |
| Reportes | ~40 | ~$2.40 |
| Competencia | ~20 | ~$1.20 |
| **TOTAL** | **~1,760** | **~$21/mes** |

---

## 4. PLAN DE SPRINTS DETALLADO

---

### SPRINT 0: Setup (2-3 días)

**Objetivo**: Repo configurado, monorepo funcionando, deploy hello world a Railway.

#### Backend

**Estructura de carpetas:**
```
ecom-analytics/
├── backend/
│   ├── package.json
│   └── src/
│       ├── server.js              # Express + MongoDB connect + CORS + routes
│       ├── config/
│       │   ├── environment.js     # Todas las env vars
│       │   └── database.js        # Mongoose connection
│       ├── middleware/
│       │   ├── auth.js            # JWT verify
│       │   ├── errorHandler.js    # Error middleware global
│       │   └── storeContext.js    # Extrae storeId, verifica acceso
│       ├── models/
│       │   └── User.js            # Email + password + role
│       ├── controllers/
│       │   └── authController.js  # Login + register
│       ├── routes/
│       │   └── authRoutes.js      # POST /login, POST /register
│       └── utils/
│           └── logger.js          # Console wrapper
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx                # Router + AuthProvider
│       ├── main.jsx               # Entry point
│       ├── index.css              # Tailwind imports
│       ├── services/
│       │   └── api.js             # Axios instance con JWT interceptor
│       ├── store/
│       │   ├── store.js           # Redux store config
│       │   └── authSlice.js       # Login/logout/token
│       ├── hooks/
│       │   └── useAuth.js         # Custom hook auth
│       └── pages/
│           └── Login.jsx          # Página de login
├── Dockerfile                     # Multi-stage build
├── docker-compose.yml             # Dev local (mongo + app)
├── railway.json                   # Deploy config
├── .env.example                   # Template de env vars
└── .gitignore
```

**Endpoints:**
| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Login → JWT |
| `POST` | `/api/auth/register` | Registro (admin only) |
| `GET` | `/health` | Health check |

**Variables de entorno (.env.example):**
```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
PORT=3000
NODE_ENV=development

# TiendaNube (Sprint 1)
TN_APP_ID=
TN_APP_SECRET=
TN_CALLBACK_URL=

# Meta (Sprint 3)
META_APP_ID=
META_APP_SECRET=
META_CALLBACK_URL=

# Claude AI (Sprint 9)
ANTHROPIC_API_KEY=
AI_MODEL_ANALYSIS=claude-sonnet-4-6
AI_MODEL_CHAT=claude-sonnet-4-6
AI_MODEL_REPORTS=claude-opus-4-6
```

#### Frontend

**Páginas:**
| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/login` | `Login.jsx` | Formulario email + password |

**Estado Redux:**
- `authSlice`: `{ token, user, isAuthenticated }`

#### Criterios de Verificación
- [ ] `npm run dev` → frontend en `localhost:5173`
- [ ] Backend en `localhost:3000/health` → `{ status: 'ok' }`
- [ ] Login funcional con JWT
- [ ] Deploy a Railway → URL pública responde `/health`
- [ ] MongoDB Atlas conectado
- [ ] Dark theme base aplicado con Tailwind

#### Dependencias Externas
- Cuenta Railway (hobby plan)
- Cluster MongoDB Atlas (free tier)
- Repo Git configurado (Hooks-analytics)

---

### SPRINT 1: Core Sync TN + Home (4-6 días)

**Objetivo**: Sincronizar órdenes y productos de TiendaNube. Home page con cards de tiendas mostrando métricas básicas.

#### Backend — Modelos

| Modelo | Campos clave | Índices |
|--------|-------------|---------|
| **Store** | nombre, tnAccessToken, tnStoreId, integrationStatus, metricasHome, cotizacionDolar, tasaIBB, feePlataformaPct, comisionPagoConfig, objetivos | — |
| **Order** | storeId, tnOrderId, tnOrderNumber, customerName, customerEmail, totalOrden, subtotal, descuento, costoEnvio, gateway, medioPago, cantidadCuotas, paymentStatus, paidAt, estado, canal, fechaCreacion, lineItems[] | `{storeId, tnOrderId}` unique |
| **Product** | storeId, tnProductId, nombre, precio, stock, variantes[], imagenUrl, ventas30dias, velocity, diasDeStock, ultimaVenta | `{storeId, tnProductId}` unique |
| **DailyMetric** | storeId, date, ordenes, revenue, aov + (campos vacíos para sprints futuros) | `{storeId, date}` unique |
| **SyncLog** | type, storeId, status, recordsFetched, recordsCreated, recordsUpdated, error, duration | TTL 30 días |

#### Backend — Services

| Archivo | Funciones | Descripción |
|---------|-----------|-------------|
| `tiendanubeAPI.js` | `get(endpoint, params, token)` | Wrapper de Axios para API TN con auth y rate limiting |
| `syncTiendanube.js` | `syncOrders(store)`, `syncProducts(store)` | Sync incremental con paginación |
| `metricCalculator.js` | `recalculateDailyMetric(storeId, date)` | Agrega Orders → DailyMetric (básico por ahora) |

#### Backend — Routes / Controllers

| Método | Ruta | Descripción | Response |
|--------|------|-------------|----------|
| `GET` | `/api/stores` | Listar todas las tiendas | `[{id, nombre, integrationStatus, metricasHome}]` |
| `POST` | `/api/stores` | Crear tienda | `{id, nombre}` |
| `GET` | `/api/stores/:id` | Detalle de tienda | `{...store}` |
| `PUT` | `/api/stores/:id` | Actualizar tienda | `{...store}` |
| `GET` | `/api/stores/:id/metrics` | Métricas del rango | `{current, previous, deltas}` |
| `POST` | `/api/stores/:id/sync/now` | Forzar sync manual | `{status: 'sync_started'}` |
| `GET` | `/api/stores/:id/orders` | Últimas órdenes | `[{...order}]` (paginado) |
| `GET` | `/api/tn/callback` | OAuth callback TN | Redirect a frontend |
| `GET` | `/api/tn/connect/:storeId` | Iniciar OAuth TN | Redirect a TN |

#### Backend — Jobs

| Job | Cron | Función |
|-----|------|---------|
| `syncTnOrders` | `0 */4 * * *` | Sync órdenes cada 4h |
| `syncTnProducts` | `0 */12 * * *` | Sync productos cada 12h |

#### Frontend — Pages

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/` | `Home.jsx` | Grid de cards de tiendas |
| `/store/:id/*` | `StoreLayout.jsx` | Layout con sidebar (stub por ahora) |

#### Frontend — Components

| Componente | Ubicación | Qué muestra | Data source |
|-----------|-----------|-------------|-------------|
| `Header` | common | Logo + DateRangePicker + user menu | — |
| `DateRangePicker` | common | Selector de fechas con presets | Redux dateSlice |
| `StoreGrid` | home | Grid responsive de StoreCards | GET /api/stores |
| `StoreCard` | home | Logo + nombre + 5 métricas + alert badge (placeholder) | GET /api/stores/:id/metrics |
| `MetricValue` | common | Número formateado + delta % + color | Props |

#### Frontend — State

| Slice | Estado | Acciones |
|-------|--------|----------|
| `authSlice` | `{token, user}` | login, logout |
| `dateSlice` | `{from, to, preset, compareEnabled, overrides}` | setPreset, setCustomRange, toggleCompare |
| `storeSlice` | `{stores[], selectedStoreId}` | fetchStores, selectStore |

#### Criterios de Verificación
- [ ] Crear una tienda en la app
- [ ] Conectar con TN OAuth → token guardado
- [ ] Forzar sync manual → órdenes aparecen en BD
- [ ] Home muestra card con nombre + revenue + órdenes del período seleccionado
- [ ] Cambiar DateRange → métricas actualizan
- [ ] Cron jobs logueados en SyncLog

#### Limitaciones Sprint 1
- No hay Net Revenue (falta config de costos)
- No hay Meta Ads
- No hay NC/RC (se agrega en Sprint 2)
- Home metrics son básicas (revenue, ordenes, AOV)
- No hay alerts en cards

---

### SPRINT 2: Dashboard Completo + Net Revenue (4-6 días)

**Objetivo**: Dashboard con 8 KPI cards, todas las secciones, cálculo de totalNeto, modal de detalle de orden, NC/RC.

#### Backend — Modelos modificados

| Modelo | Campos nuevos |
|--------|--------------|
| **Order** | `comisionPago, comisionCuotas, impuestosIBB, feePlataforma, costoProductos, totalNeto, liquidable, esClienteNuevo` |
| **Customer** | `storeId, tnCustomerId, name, email, totalOrders, totalSpent, firstPurchase, cohortMonth, lastOrderDate` |
| **DailyMetric** | Todos los campos de costos + NC/RC + profit + profitMargin |

#### Backend — Services

| Archivo | Funciones nuevas |
|---------|-----------------|
| `metricCalculator.js` | `calculateOrderFinancials(order, store)` — calcula totalNeto con 6 líneas de deducción |
| `metricCalculator.js` | `classifyCustomer(order, store)` — determina esClienteNuevo |
| `metricCalculator.js` | `recalculateDailyMetric()` — ahora incluye costos, NC/RC, profit |

#### Backend — Routes nuevas

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/stores/:id/orders/:orderId` | Detalle de orden con desglose de costos |
| `PUT` | `/api/stores/:id/settings` | Actualizar config financiera (tasaIBB, fees, comisiones) |
| `GET` | `/api/stores/:id/settings` | Obtener config |

#### Frontend — Pages

| Ruta | Componente |
|------|-----------|
| `/store/:id/dashboard` | `Dashboard.jsx` |

#### Frontend — Components del Dashboard

| Componente | Qué muestra |
|-----------|-------------|
| `KPITopBar` | 8 cards: Órdenes >$0, Revenue, Ad Spend (placeholder), Net Revenue, Profit, Profit Margin %, ROAS (placeholder), True ROAS (placeholder) |
| `TiendaSection` | Órdenes, Revenue, Net Revenue, AOV, AOV Neto, Órdenes >$0 |
| `NCRCSection` | NC %, NC Órdenes, NC Revenue, NC CPA (placeholder), NC ROAS (placeholder), RC %, RC Órdenes, RC Revenue |
| `MarketingMixSection` | Placeholder — "Conectar Meta Ads para ver datos" |
| `CostosSection` | Costos de Productos, Costos de Envío, Costos Adicionales (placeholder) |
| `LatestSalesTable` | Tabla: ID, Cliente, Total, Comisiones, Impuestos, Envío, COGS, Fee, Total Neto |
| `OrderDetailModal` | Modal al clickear orden: desglose completo de costos |
| `DevolucionesCounter` | Contador de devoluciones en el período |

#### Criterios de Verificación
- [ ] Dashboard muestra 8 KPI cards (las de Meta como placeholder)
- [ ] totalNeto se calcula correctamente por cada orden
- [ ] Click en orden → modal con desglose de 6 líneas de deducción
- [ ] NC/RC funciona: primera compra de un email = NC, repetida = RC
- [ ] Cambiar tasaIBB en Settings → órdenes se recalculan
- [ ] Profit Margin % = Net Revenue / Revenue × 100

---

### SPRINT 3: Meta Ads OAuth + Meta Pixel Module (4-6 días)

**Objetivo**: Conectar Meta Ads, sincronizar campañas e insights, módulo Meta Pixel con tabla expandible.

#### Backend — Modelos

| Modelo | Campos clave |
|--------|-------------|
| **MetaCampaign** | storeId, metaId, nombre, status, budget, level (campaign/adset/ad), parentId, objective, thumbnailUrl |
| **MetaDailyInsight** | storeId, metaId, date, spend, impressions, reach, clicks, uniqueClicks, linkClicks, cpm, cpc, ctr, purchases, atc, checkouts, purchaseValue, costPerPurchase |
| **Store** (ampliar) | metaAccessToken, metaAdAccountId, metaTokenExpiresAt, metaPageId |

#### Backend — Services

| Archivo | Funciones |
|---------|-----------|
| `metaAPI.js` | `exchangeToken(code)`, `refreshLongLivedToken(token)`, `getCampaigns(adAccountId, token)`, `getAdSets(...)`, `getAds(...)`, `getInsights(objectId, dateRange, token)` |
| `syncMeta.js` | `syncMetaStructure(store)`, `syncMetaInsights(store)` |
| `metricCalculator.js` | Actualizar `recalculateDailyMetric()` para incluir datos Meta (adSpend, ROAS, CPA, etc.) |

#### Backend — Routes nuevas

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/meta/connect/:storeId` | Iniciar OAuth Meta |
| `GET` | `/api/meta/callback` | Callback OAuth Meta |
| `GET` | `/api/stores/:id/meta/campaigns` | Listar campañas con métricas |
| `GET` | `/api/stores/:id/meta/campaigns/:campaignId/adsets` | AdSets de una campaña |
| `GET` | `/api/stores/:id/meta/adsets/:adsetId/ads` | Ads de un AdSet |
| `POST` | `/api/stores/:id/meta/import` | Import CSV de Meta Ads Manager |

#### Backend — Jobs nuevos

| Job | Cron |
|-----|------|
| `syncMetaStructure` | `30 */12 * * *` |
| `syncMetaInsights` | `0 1,7,13,19 * * *` |
| `refreshMetaTokens` | `0 2 * * *` |

#### Frontend — Pages

| Ruta | Componente |
|------|-----------|
| `/store/:id/meta-pixel` | `MetaPixel.jsx` |

#### Frontend — Components

| Componente | Qué muestra |
|-----------|-------------|
| `CampaignTable` | Tabla de campañas: Status, Nombre, Budget, Spend, Revenue, Profit, CPA, ROAS |
| `ExpandableHierarchy` | Click en campaña → AdSets → Ads (accordion) |
| `MetricSelector` | Modal para elegir qué columnas mostrar (4 categorías: Básicas, Click, Video, Conversión) |
| `CSVImportMeta` | Upload de CSV de Ads Manager como fallback |

#### Criterios de Verificación
- [ ] OAuth Meta funciona → token guardado
- [ ] Sync trae campañas, adsets, ads
- [ ] Insights diarios sincronizados
- [ ] Dashboard ahora muestra Ad Spend, ROAS, True ROAS, CPA reales
- [ ] Meta Pixel page muestra tabla de campañas expandible
- [ ] CSV import de Meta Ads funciona como fallback
- [ ] Cotización dólar se aplica (spend USD → ARS)

#### Dependencia Externa
- Meta for Developers app creada (PENDIENTE — hasta que esté, usar CSV import)

---

### SPRINT 4: Cashflow Module (3-4 días)

**Objetivo**: Módulo de cashflow con tracking de pagos pendientes/recibidos, chart semanal, forecast forward-looking.

#### Backend — Modelos

| Modelo | Campos |
|--------|--------|
| **CashflowEntry** | orderId, storeId, fechaCreacion, fechaPago, estado ('pendiente'/'recibido'), totalOrden, liquidable, comision, gateway, cuotas, numeroCuota |

#### Backend — Services

| Archivo | Funciones |
|---------|-----------|
| `cashflowService.js` | `generateCashflowEntries(order, store)` — crea N entries por cuota, `getCashflowForecast(storeId, weeks)`, `getCashflowHistory(storeId, dateRange)` |

#### Backend — Routes

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/stores/:id/cashflow?from=&to=` | KPIs + chart data + tabla |
| `GET` | `/api/stores/:id/cashflow/forecast?weeks=4` | Forecast forward-looking |
| `GET` | `/api/stores/:id/cashflow/week/:weekNumber` | Drill-down semanal |

#### Backend — Jobs

| Job | Cron |
|-----|------|
| `updateCashflowStates` | `0 0 * * *` (diario, marca como 'recibido' las entries cuya fechaPago pasó) |

#### Frontend — Pages

| Ruta | Componente |
|------|-----------|
| `/store/:id/cashflow` | `Cashflow.jsx` |

#### Frontend — Components

| Componente | Qué muestra |
|-----------|-------------|
| `CashflowKPIs` | 6 cards: Ventas, Liquidable Ventas, Comisiones de Pago, Comisiones %, Pagos Pendientes, Pagos Recibidos |
| `WeeklyCashflowChart` | Barras agrupadas por semana: Ventas (rojo) + Pagos Recibidos (azul) + Pagos Pendientes (naranja) |
| `PendingPaymentsDonut` | Donut: distribución por gateway |
| `CashflowTable` | Tabla: ID Orden, Fecha Creación, Fecha Pago, Estado, Total, Liquidable, Gateway, Cuotas |
| `WeeklyDrilldown` | Modal al clickear semana del chart: detalle de esa semana |
| `CashflowDatePicker` | Presets especiales: Próximas 2/3/4/6/8 semanas |

#### Criterios de Verificación
- [ ] Órdenes generan CashflowEntries (N por cuota)
- [ ] Fecha de pago calculada correctamente (días gateway + 30 × cuota)
- [ ] Chart semanal muestra las 3 barras
- [ ] Drill-down por semana funciona
- [ ] Date picker con "Próximas X semanas" muestra forecast
- [ ] KPIs de liquidable y comisiones son correctos

---

### SPRINT 5: Costos + P&L (3-5 días)

**Objetivo**: Página de gestión de costos con 5 categorías, upload CSV de COGS, P&L summary, break-even automático.

#### Backend — Routes

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/stores/:id/products/costs` | Upload CSV de costos (COGS) |
| `GET` | `/api/stores/:id/products/costs/template` | Descargar plantilla CSV |
| `PUT` | `/api/stores/:id/settings/costos` | Actualizar configuración de costos |
| `GET` | `/api/stores/:id/pnl?from=&to=` | P&L del período |
| `GET` | `/api/stores/:id/breakeven` | Breakeven calculado |

#### Frontend — Pages

| Ruta | Componente |
|------|-----------|
| `/store/:id/costos` | `Costos.jsx` |

#### Frontend — Components

| Componente | Qué muestra |
|-----------|-------------|
| `CostCategoryEditor` | 5 secciones expandibles: Productos, Comisiones Plataforma, Comisiones Pago, Envíos, Adicionales |
| `CSVUploadZone` | Drag & drop + botón "Descargar plantilla" + progress + resultado (actualizados / no encontrados) |
| `ComisionesPagoTable` | Tabla editable: Medio Pago × Cuotas × Comisión Base × Comisión Cuotas |
| `PandLSummary` | P&L: Revenue - cada línea de costo = Profit, Profit Margin % |
| `BreakEvenCalculator` | Muestra ROAS Breakeven, CPA Breakeven, AOV Mínimo (auto-calculados, read-only) |

**CSV Templates generados:**
- `plantilla_costos_productos.csv`
- `plantilla_comisiones_pago.csv`
- `plantilla_costos_envio.csv`
- `plantilla_costos_adicionales.csv`

#### Criterios de Verificación
- [ ] Upload CSV de costos → productos actualizados, órdenes recalculadas
- [ ] P&L muestra Revenue - todos los costos = Profit correcto
- [ ] Break-even se recalcula al cambiar costos
- [ ] Comisiones de pago editables por medio/cuotas
- [ ] Descargar plantilla CSV funciona
- [ ] Cada plantilla tiene datos de ejemplo

---

### SPRINT 6: Productos + Per-product Simulation (3-5 días)

**Objetivo**: Página de productos con tabla, perfil de rentabilidad, simulador por producto, alertas de stock.

#### Backend — Services

| Archivo | Funciones |
|---------|-----------|
| `productService.js` | `getProductsWithMetrics(storeId, dateRange)`, `getProductProfile(storeId, productId)`, `simulateProduct(productId, changes)` |

#### Backend — Routes

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/stores/:id/products` | Lista con métricas (paginado) |
| `GET` | `/api/stores/:id/products/:productId/profile` | Perfil de rentabilidad |
| `POST` | `/api/stores/:id/products/:productId/simulate` | Simulador (body: {precio, cogs, envio}) |
| `GET` | `/api/stores/:id/products/alerts` | Alertas de stock |

#### Frontend — Pages

| Ruta | Componente |
|------|-----------|
| `/store/:id/productos` | `Productos.jsx` |

#### Frontend — Components

| Componente | Qué muestra |
|-----------|-------------|
| `ProductTable` | SKU, Nombre, Precio, Stock, Ventas 30d, Velocity, Días de Stock, Margen % |
| `ProductProfileModal` | Click en producto: foto + precio + COGS + envío + comisiones + IBB + fee = Net Margin %, últimas 10 órdenes |
| `PerProductSimulator` | Sliders: Precio ±%, COGS ±%, Envío ±% → recálculo de margen en vivo |
| `StockAlerts` | Badges: stock bajo (<5), stock crítico (0), dead stock (sin venta 90d) |
| `DeadStockView` | Tabla de productos sin ventas en 90+ días con stock > 0 |

#### Criterios de Verificación
- [ ] Tabla muestra todos los productos con métricas
- [ ] Click en producto → perfil con desglose de rentabilidad
- [ ] Simulador recalcula margen al mover sliders
- [ ] Alertas de stock aparecen correctamente
- [ ] Dead stock detectado (sin ventas 90d + stock > 0)

---

### SPRINT 7: Clientes + Cohorts (3-5 días)

**Objetivo**: Sincronización de clientes, RFM scoring, LTV, tabla de cohorts, segmentación.

#### Backend — Modelos modificados

| Modelo | Campos nuevos |
|--------|--------------|
| **Customer** | rfmScore, rfmSegment ('champions'/'loyal'/'at_risk'/'lost'...), ltv, recency, frequency, monetary |

#### Backend — Services

| Archivo | Funciones |
|---------|-----------|
| `customerService.js` | `syncCustomers(store)`, `calculateRFM(storeId)`, `calculateLTV(storeId)`, `getCohortTable(storeId)` |

#### Backend — Routes

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/stores/:id/customers` | Lista paginada |
| `GET` | `/api/stores/:id/customers/cohorts` | Tabla de cohorts |
| `GET` | `/api/stores/:id/customers/rfm` | Matriz RFM |
| `GET` | `/api/stores/:id/customers/segments` | Segmentos con totales |

#### Frontend — Pages

| Ruta | Componente |
|------|-----------|
| `/store/:id/clientes` | `Clientes.jsx` |

#### Frontend — Components

| Componente | Qué muestra |
|-----------|-------------|
| `CohortTable` | Tabla: Mes de adquisición × Mes N → % retención |
| `RFMMatrix` | Grid visual: R (1-5) × F (1-5) × color por segmento |
| `LTVChart` | Gráfico de línea: LTV promedio por cohorte en el tiempo |
| `CustomerSegments` | Cards: Champions, Loyal, At Risk, Lost, con conteo y revenue |

#### Criterios de Verificación
- [ ] Cohort table muestra retención por mes
- [ ] RFM scoring funciona (5 levels por cada dimensión)
- [ ] LTV calculado por cohorte
- [ ] Segmentos correctos (champions = alto R + alto F + alto M)

---

### SPRINT 8: Creativos Expandido (3-4 días)

**Objetivo**: Auto-clasificación ABCDE de ads, thumbnails, funnel por ad, tabla de resultados por campaña.

#### Backend — Services

| Archivo | Funciones |
|---------|-----------|
| `creativeService.js` | `autoClassifyAds(storeId)` — scoring ABCDE basado en ROAS + CPA vs promedios |

#### Backend — Routes

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/stores/:id/creativos` | Ads con clasificación + métricas |
| `GET` | `/api/stores/:id/creativos/campaigns` | Resultados por campaña |
| `POST` | `/api/stores/:id/creativos/hooks` | CRUD pipeline creativo |
| `POST` | `/api/stores/:id/creativos/hooks/import` | Import CSV pipeline |

#### Frontend — Pages

| Ruta | Componente |
|------|-----------|
| `/store/:id/creativos` | `Creativos.jsx` |

#### Frontend — Components

| Componente | Qué muestra |
|-----------|-------------|
| `AutoClassificationGrid` | Grid de ads: thumbnail + nombre + tier (A-E con color) + KPIs |
| `AdCreativeView` | Click en ad → funnel: Spend → Reach → CTR → ATC → Checkouts → Purchases → CPA |
| `CampaignResultsTable` | Tabla: Campaña, Spend, Reach, CTR, ATC, Compras, CPA, ROAS, Total row |
| `AdResultsTable` | Tabla: Thumbnail, Ad Name, Spend, CTR, CPA, Tier |
| `PipelineCreativo` | Kanban o tabla del pipeline creativo (import CSV) |

#### Criterios de Verificación
- [ ] Ads clasificados automáticamente A-E con colores
- [ ] Thumbnails cargan desde Meta
- [ ] Per-ad funnel muestra todo el embudo
- [ ] Pipeline creativo importable por CSV

---

### SPRINT 9: Contenido + Competencia + AI L1/L2 (4-6 días)

**Objetivo**: TopicMap, LanguageBank, competitors con análisis AI, integración Claude L1 (análisis) y L2 (chat).

#### Backend — Modelos

| Modelo | Campos |
|--------|--------|
| **TopicMap** | storeId, nombre, status, avatars, hookIds, performance |
| **LanguageBank** | storeId, tipo, texto, response, tags, sentiment |
| **Competitor** | storeId, nombre, productos[], ofertas[], creativos[], lastAnalysis |
| **Report** | storeId, tipo, titulo, contenido (markdown), section, dateRange, tokensUsed |

#### Backend — Services

| Archivo | Funciones |
|---------|-----------|
| `aiService.js` | `analyze(section, storeId, dateRange)`, `chat(messages, tools, storeId)`, `analyzeCompetitor(storeId, competitorId)` |

#### Backend — Routes

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/stores/:id/ai/analyze` | Generar análisis L1 |
| `POST` | `/api/stores/:id/ai/chat` | Chat L2 con tool_use |
| `POST` | `/api/stores/:id/ai/competitor/:competitorId` | Análisis de competidor |
| `CRUD` | `/api/stores/:id/topics` | TopicMap |
| `CRUD` | `/api/stores/:id/language` | LanguageBank |
| `CRUD` | `/api/stores/:id/competitors` | Competitors |
| `GET` | `/api/stores/:id/reports` | Lista de reportes |
| `POST` | `/api/ai/test-connection` | Test de conexión AI |
| `PUT` | `/api/ai/config` | Configurar AI (API key, modelos) |

#### Frontend — Pages

| Ruta | Componente |
|------|-----------|
| `/store/:id/contenido` | `Contenido.jsx` |
| `/store/:id/competencia` | `Competencia.jsx` |

#### Frontend — Components

| Componente | Qué muestra |
|-----------|-------------|
| `TopicMapGrid` | Ángulos de comunicación con status, avatars, performance |
| `LanguageBankTable` | Tabla de frases, objeciones, vocabulario con sentiment |
| `CompetitorCard` | Card con 3 tabs: Precios, Ofertas, Creativos |
| `AIAnalysisPanel` | Botón "Analizar con AI" → resultado en markdown |
| `ChatPanel` | Chat sidebar/modal para preguntar sobre datos |
| `AnalysisButton` | Botón "Generar análisis" en cada sección (Dashboard, Cashflow, etc.) |
| `ReportViewer` | Modal con análisis generado, botón "Guardar como Reporte" |
| `AIConfigPanel` | Settings: API key, modelos, test connection, tokens usados |

#### Dependencia Externa
- API key de Anthropic (ANTHROPIC_API_KEY)

#### Criterios de Verificación
- [ ] Config AI: guardar API key, test connection
- [ ] Dashboard → "Generar análisis" → Claude retorna análisis en markdown
- [ ] Chat: "¿Cuál es mi producto más rentable?" → Claude usa tool → responde con datos
- [ ] Competidor → "Analizar" → Claude compara precios y sugiere acciones
- [ ] Reportes guardables y consultables
- [ ] TopicMap y LanguageBank CRUD funcional

---

### SPRINT 10: Simulador + Widget System + Reports (4-5 días)

**Objetivo**: Simulador what-if, sistema de widgets configurables, generador de reportes exportables.

#### Backend — Modelos

| Modelo | Campos |
|--------|--------|
| **Widget** | storeId, pageId, type, title, config, position |

#### Backend — Routes

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/stores/:id/simulate` | Ejecutar simulación what-if |
| `CRUD` | `/api/stores/:id/widgets` | Gestión de widgets |
| `PUT` | `/api/stores/:id/settings/home-metrics` | Elegir 5 métricas de Home |
| `POST` | `/api/stores/:id/reports/generate` | Generar reporte (con o sin AI) |
| `GET` | `/api/stores/:id/reports/:id/export` | Exportar como PDF/HTML |

#### Frontend — Pages

| Ruta | Componente |
|------|-----------|
| `/store/:id/simulador` | `Simulador.jsx` |
| `/store/:id/reportes` | `Reportes.jsx` |

#### Frontend — Components

| Componente | Qué muestra |
|-----------|-------------|
| `WhatIfPanel` | Sliders: CPM, CTR, CVR, AOV, Budget → resultados calculados |
| `ScenarioComparison` | Antes vs Después lado a lado |
| `WidgetContainer` | Container que renderiza widgets según config |
| `WidgetEditor` | Modal para crear/editar widget (tipo, métrica, config) |
| `WidgetLibrary` | Panel lateral con widgets disponibles para agregar |
| `HomeMetricSelector` | UI para elegir 5 KPIs de Home cards |
| `ReportBuilder` | Seleccionar secciones + rango + con/sin AI → generar |
| `ReportViewer` | Vista del reporte generado con opción export |
| `SavedReportsList` | Tabla de reportes guardados |

#### Criterios de Verificación
- [ ] Simulador: mover sliders → ROAS output recalcula en vivo
- [ ] Comparación antes/después funciona
- [ ] Home metric selector: elegir 5 KPIs → cards actualizan
- [ ] Widgets creables y posicionables
- [ ] Reporte generado con AI incluye análisis por sección
- [ ] Export PDF/HTML funciona

---

### SPRINT 11: Layer 3 Alerts + Settings + Multi-user + Polish (4-6 días)

**Objetivo**: Diagnósticos automáticos con AI, sistema de alertas, gestión de usuarios, responsive, light/dark toggle, pulido final.

#### Backend — Modelos

| Modelo | Campos nuevos |
|--------|--------------|
| **Alert** | storeId, tipo, titulo, descripcion, metricas, severidad, fechaDetectada, estado, actions[] |
| **User** | role ('admin'/'viewer'/'analyst'), stores[] (acceso por tienda) |

#### Backend — Services

| Archivo | Funciones |
|---------|-----------|
| `diagnosticsService.js` | `runDiagnostics(store)` — detecta anomalías + envía a Claude L3 |
| `alertService.js` | `createAlert(...)`, `resolveAlert(...)`, `getActiveAlerts(storeId)` |

#### Backend — Routes

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/stores/:id/alerts` | Alertas activas |
| `PUT` | `/api/alerts/:id/resolve` | Marcar alerta como resuelta |
| `PUT` | `/api/alerts/:id/ignore` | Ignorar alerta |
| `CRUD` | `/api/users` | Gestión de usuarios |
| `PUT` | `/api/users/:id/stores` | Asignar tiendas a usuario |

#### Backend — Jobs

| Job | Cron |
|-----|------|
| `diagnostics` | `30 0,6,12,18 * * *` (cada 6h) |

#### Frontend — Components

| Componente | Qué muestra |
|-----------|-------------|
| `AlertBadge` | Badge rojo en Home cards con contador |
| `AlertDetailModal` | Detalle de alerta con acciones sugeridas |
| `HealthIndicator` | Semáforo verde/amarillo/rojo en KPI cards |
| `DeviationBadge` | "+23% sobre objetivo" o "-12% bajo target" |
| `InsightBar` | Barra resumen por sección con texto contextual |
| `BreakevenLine` | Línea de referencia en charts |
| `UserManagement` | CRUD usuarios + asignación de tiendas |
| `ThemeToggle` | Switch light/dark en header |
| `CotizacionDolarPanel` | Input de cotización + historial |
| `IntegrationStatus` | Cards de estado de TN + Meta + AI |
| `ObjetivosPanel` | Fase del cliente + KPIs target + breakeven auto |

#### Responsive (Mobile)
- Home: cards stack vertical en mobile
- Dashboard: KPIs en 2 columnas, tablas con scroll horizontal
- Sidebar: hamburger menu en mobile
- Charts: escalan a ancho completo
- Modals: full-screen en mobile

#### Theme Toggle
- Dark theme (default): fondo `#0f1117`, cards `#1a1d26`
- Light theme: fondo `#f8f9fa`, cards `#ffffff`
- Stored en localStorage + Redux
- Tailwind `dark:` classes

#### Criterios de Verificación
- [ ] Cron diagnostics detecta anomalías y genera alertas
- [ ] Home cards muestran badges de alerta
- [ ] Health indicators (semáforos) en KPI cards
- [ ] InsightBar muestra texto contextual por sección
- [ ] Multi-user: crear usuario viewer → solo ve tiendas asignadas
- [ ] Toggle light/dark funciona
- [ ] Mobile: Home, Dashboard y Cashflow se ven bien en 375px
- [ ] Cotización dólar editable + breakeven se recalcula

---

## 5. DEPENDENCIAS ENTRE SPRINTS

```
Sprint 0 ─────► Sprint 1 ─────► Sprint 2 ─────► Sprint 3
  (setup)        (TN sync)       (dashboard)      (Meta)
                    │                │                │
                    │                ▼                │
                    │           Sprint 4 ◄───────────┘
                    │          (cashflow)
                    │                │
                    ▼                ▼
               Sprint 7         Sprint 5
              (clientes)        (costos)
                    │                │
                    │                ▼
                    │           Sprint 6
                    │          (productos)
                    │                │
                    ▼                ▼
               Sprint 8         Sprint 9 ◄── API Key Claude
              (creativos)      (AI + contenido)
                    │                │
                    └────────┬───────┘
                             ▼
                        Sprint 10
                    (simulador + widgets)
                             │
                             ▼
                        Sprint 11
                    (alerts + polish)
```

**Dependencias críticas:**

| Sprint | Depende de | Dependencia externa |
|--------|-----------|-------------------|
| 1 | 0 | TN App ID + Secret (del repo existente) |
| 2 | 1 | — |
| 3 | 2 | Meta App ID + Secret (PENDIENTE, CSV fallback) |
| 4 | 2, 3 | — |
| 5 | 2 | — |
| 6 | 5 | — |
| 7 | 1 | — |
| 8 | 3 | — |
| 9 | 2 | ANTHROPIC_API_KEY |
| 10 | 5, 9 | — |
| 11 | Todo | — |

**Sprints paralelizables:**
- Sprint 5 y Sprint 7 pueden desarrollarse en paralelo
- Sprint 6 y Sprint 8 pueden desarrollarse en paralelo (después de sus dependencias)

---

## 6. INTEGRACIÓN CON SISTEMA EXISTENTE

### Extracción de tokens de tiendanube-modules-manager

El proyecto `tiendanube-modules-manager` ya tiene:
- OAuth flow funcional con TiendaNube
- Tokens de acceso de los clientes
- Configuración de Railway y Docker

**Estrategia:**

1. **Copiar archivos base** (sin modificar el proyecto existente):
   - `tiendanubeAPI.js` → copiar literal
   - `errorHandler.js` → copiar literal
   - `auth.js` → copiar, agregar storeContext
   - `logger.js` → copiar literal
   - `LRUMap.js` → copiar literal
   - `environment.js` → copiar, agregar vars nuevas
   - `database.js` → copiar literal
   - `Dockerfile` → copiar literal
   - `railway.json` → copiar literal
   - `api.js` (frontend) → copiar literal
   - `authSlice.js` → copiar, adaptar
   - `useAuth.js` → copiar literal

2. **Tokens de TN**: Se pueden exportar de la BD del proyecto existente (MongoDB) y cargar en el nuevo proyecto como Seeds, o el usuario reconecta cada tienda via OAuth en la nueva app.

3. **Railway**: Crear un proyecto NUEVO en Railway (no interferir con el existente). Misma cuenta, diferente proyecto. Diferente base de datos Atlas.

---

## 7. ESTIMACIÓN DE ALMACENAMIENTO

### Escenario: 10 tiendas × 300 órdenes/mes × 12 meses

| Colección | Documentos | Tamaño |
|-----------|-----------|--------|
| Orders | 36,000 | 54 MB |
| CashflowEntry | 72,000 | 36 MB |
| MetaDailyInsight | 109,500 | 88 MB |
| DailyMetric | 3,650 | 7 MB |
| Products | 5,000 | 5 MB |
| Customers | 15,000 | 8 MB |
| Otros | ~3,000 | 5 MB |
| **TOTAL** | | **~203 MB** |

**Dentro del free tier (512MB)** con margen. Si se agregan más clientes:

| Clientes | Almacenamiento estimado | Plan necesario |
|----------|----------------------|---------------|
| 10 | ~200 MB | Free (512MB) ✅ |
| 20 | ~400 MB | Free (apretado) ⚠️ |
| 25+ | ~500 MB+ | M2 ($9/mes) o M5 ($25/mes) |

**Mitigación:**
- Cleanup job borra Orders > 12 meses (DailyMetric queda como resumen)
- CashflowEntry: borrar entries recibidas > 6 meses
- MetaDailyInsight: borrar de objetos DELETED > 90 días
- SyncLog: TTL 30 días automático

---

## 8. RIESGOS Y MITIGACIONES

| Riesgo | Impacto | Probabilidad | Mitigación |
|--------|---------|-------------|-----------|
| Meta API app no aprobada | No hay datos de ads | Media | CSV import como fallback completo |
| MongoDB Atlas 512MB insuficiente | App deja de funcionar | Baja (con cleanup) | Upgrade a M2 ($9/mes), cleanup agresivo |
| Claude API rate limits | Chat/análisis degradado | Baja | Cache de análisis, rate limiting propio |
| Token TN invalidado | Sync se corta | Baja | Alert automática + reconexión en Settings |
| Token Meta expira | Sync Meta se corta | Media | Auto-refresh 7 días antes, alert si falla |
| Railway hobby tier down | App no disponible | Muy baja | Railway tiene 99.9% uptime |
| Cron jobs se solapan | Datos inconsistentes | Baja | Lock con flag en SyncLog, skip si hay job running |
| Cotización dólar desactualizada | ROAS incorrecto | Media | Reminder en Dashboard si no se actualiza en 7+ días |
| Volumen de órdenes > 300/mes | Sync lento, storage | Media | Paginación eficiente, upgrade storage si necesario |

---

## 9. MÉTRICAS DE ÉXITO

### Por Sprint

| Sprint | Métrica de éxito |
|--------|-----------------|
| 0 | Deploy en Railway responde /health |
| 1 | Sync 1 tienda TN → Home muestra card con revenue |
| 2 | totalNeto calculado ≠ totalOrden (costos se descuentan) |
| 3 | ROAS en Dashboard = Revenue / (Meta Spend × cotización) |
| 4 | Cashflow chart muestra desfase vender vs cobrar |
| 5 | P&L: Revenue - costos = Profit correcto al centavo |
| 6 | Producto más vendido ≠ producto más rentable (diferencia visible) |
| 7 | Cohort table muestra retención real mes a mes |
| 8 | Top 10% ads clasificados como A, bottom 20% como E |
| 9 | Claude responde con datos REALES de la tienda (no inventados) |
| 10 | Simulador: cambiar CPM → ROAS cambia proporcionalmente |
| 11 | Alert aparece automáticamente cuando ROAS cae >20% |

### Globales

| Criterio | Definición |
|----------|-----------|
| **Correctitud** | Métricas coinciden con cálculo manual (verificar con CSVs de referencia) |
| **Performance** | Dashboard carga en <2 segundos con 30 días de data |
| **Usabilidad** | Un usuario nuevo puede navegar sin instrucciones |
| **Confiabilidad** | Sync cron no falla 2 veces seguidas sin alert |
| **Cobertura** | Las 13 secciones del sidebar funcionan con datos reales |

---

*Documento generado: Marzo 2026*
*Se actualiza al completar cada sprint*