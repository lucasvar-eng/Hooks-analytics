# Plan: Arquitectura Técnica — Plataforma de Analytics Ecommerce

## Contexto

Lucas tiene una agencia de ecommerce con 5+ clientes en Tiendanube. Hoy la información está fragmentada en Meta Ads, Tiendanube, planillas de Google Sheets y documentos HTML estáticos. Quiere centralizar todo en una sola plataforma con dashboard + reportes inteligentes con Claude.

Ya tiene un proyecto fullstack (tiendanube-modules-manager) con Express + Mongoose + React + Vite + Tailwind + Redux + Docker en Railway. La arquitectura del nuevo proyecto **replica exactamente esos patrones** para que pueda mantenerlo.

**Restricción**: $0 de costo adicional (Railway hobby + MongoDB Atlas free 512MB + su suscripción Claude).

---

## Nombre del proyecto: `ecom-analytics`

## Stack (idéntico al existente)

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js + Express 4.18 + Mongoose 8 |
| Frontend | React 18 + Vite 5 + TailwindCSS 3 + Redux Toolkit |
| BD | MongoDB Atlas (free tier 512MB) |
| Deploy | Railway (Docker multi-stage, mismo Dockerfile) |
| Cron | node-cron (en el mismo proceso Express) |
| Charts | Recharts (ligero, React-native) |
| CSV | papaparse (parse) + multer (upload) |
| AI | Claude API (o fallback "copiar contexto") |

---

## Estructura de carpetas

```
ecom-analytics/
├── Dockerfile                    # Multi-stage (copiar del existente)
├── docker-compose.yml            # Dev local
├── railway.json                  # Deploy Railway
├── .env.example
│
├── backend/
│   ├── package.json
│   └── src/
│       ├── server.js
│       ├── config/               # environment, database, oauth, meta, claude, cron
│       ├── middleware/            # auth, errorHandler, rateLimiter, storeContext, upload
│       ├── models/               # 16 modelos (ver abajo)
│       ├── controllers/          # 16 controllers (1 por módulo + auth + sync)
│       ├── routes/               # 16 archivos de rutas
│       ├── services/             # tiendanubeAPI, metaAPI, claudeAPI, sync*, calculators, csvParser
│       ├── jobs/                 # cronManager, syncAllStores, syncMeta, recalculateMetrics, cleanup
│       └── utils/                # logger, LRUMap, validator, dateHelpers, metricFormulas
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── store/                # authSlice, dashboardSlice, storeSlice
│       ├── services/             # api.js + un service por módulo
│       ├── hooks/                # useAuth, useStoreContext, useDateRange, useMetrics
│       ├── components/
│       │   ├── common/           # Header, Sidebar, StoreSelector, DateRangePicker, MetricCard, DataTable, CSVUploader
│       │   ├── dashboard/        # DailyTable, FunnelOverview, MetricTrend, PeriodComparison
│       │   ├── products/         # ProductTable, StockAlert
│       │   ├── customers/        # CohortTable, RFMMatrix, LTVChart
│       │   ├── costs/            # PLStatement, MarginTable
│       │   ├── simulator/        # WhatIfPanel, ScenarioCard
│       │   ├── creatives/        # CreativePipeline, HookCard, ABCDEClassifier
│       │   ├── content/          # TopicMap, LanguageBank, CompetitorView
│       │   └── reports/          # ReportBuilder, ReportViewer
│       └── pages/                # 16 páginas (Login, Dashboard, Targets, Products, Overview, Customers, Stock, Costs, Simulator, Creatives, Topics, Language, Competitors, Channels, Reports, Settings)
```

---

## Modelo de datos MongoDB (16 colecciones)

### Core
- **Store** — Tienda conectada (TN OAuth + Meta OAuth + config sync + currency/timezone)
- **User** — Admin de la plataforma (email, password, role)
- **DailyMetric** — Una fila por tienda por día: funnel completo (spend→CPM→reach→clicks→CTR→visitas→ATC→CVR cadena→purchases→CPA→ROAS→AOV) + acumulados del mes. Índice único: `{storeId, date}`
- **Order** — Órdenes sincronizadas de TN (total, subtotal, shipping, discount, lineItems, customer, UTMs, payment). Índice único: `{storeId, tnOrderId}`
- **Product** — Productos sincronizados (precio, stock, variantes, categorías, salesData con ventas mensuales + velocidad + daysOfStock). Índice único: `{storeId, tnProductId}`
- **Customer** — Clientes (totalOrders, totalSpent, firstPurchase, cohortMonth, RFM score/segment, LTV). Índice único: `{storeId, tnCustomerId}`

### Meta Ads
- **MetaCampaign** — Campañas/AdSets/Ads de Meta (hierarchy con level + parentId, status, budget, clasificación ABCDE)
- **MetaDailyInsight** — Métricas diarias por objeto de Meta (spend, impressions, reach, clicks, conversiones). Índice único: `{storeId, metaId, date}`

### Financiero
- **Target** — Objetivos mensuales por tienda (targets de CPM, CTR, CVR, AOV, ROAS, budget). Índice único: `{storeId, month}`
- **ProductCost** — Costos por SKU (unitCost, packagingCost, validFrom/To, source csv/manual)
- **FixedCost** — Costos fijos mensuales por tienda (items con categoría + monto)

### Contenido
- **CreativeHook** — Hooks publicitarios (receta, formato, ángulo, consciencia, brief, clasificación ABCDE, métricas: daysActive, CTR, CPA, ROAS)
- **TopicMap** — Ángulos de comunicación (status: active/exploration/new/pending, avatars, hookIds, performance)
- **LanguageBank** — Frases de clientes, objeciones, vocabulario (type, text, response, tags, sentiment)
- **Competitor** — Competidores (products con precios, positioning, currentOffers, lastAnalysis de Claude)

### Sistema
- **SyncLog** — Log de sincronizaciones (type, status, recordsFetched/Created/Updated, error). TTL 30 días
- **Report** — Reportes generados por Claude (type, title, content markdown, contextSnapshot, tokensUsed)

### Gestión de 512MB
- TTL en SyncLog (30 días)
- Cleanup job diario: borrar Orders de >12 meses (mantener solo DailyMetric como resumen)
- No guardar imágenes en BD, solo URLs
- `.lean()` en queries read-only

---

## Sistema de Sync (cron jobs)

| Job | Frecuencia | Qué hace |
|-----|-----------|---------|
| syncAllOrders | Cada 6h | Fetch órdenes TN últimos 7 días → upsert Orders → recalcular DailyMetric |
| syncAllProducts | Cada 12h | Fetch productos TN → upsert Products → actualizar salesData/velocity |
| syncAllCustomers | Cada 24h | Fetch clientes que compraron últimos 30 días → upsert → recalcular RFM |
| syncMetaInsights | Cada 6h | Fetch insights Meta del día anterior y hoy → upsert MetaDailyInsight |
| recalculateMetrics | Post-sync órdenes | Cruzar TN + Meta → generar/actualizar DailyMetric del período |
| cleanupOldData | Cada 24h | Borrar datos >12 meses, compactar |

**Flujo del DailyMetric**: Órdenes TN (purchases, revenue, AOV) + Insights Meta (spend, impressions, clicks, ATC, checkouts) → combinar → calcular CVRs, CPA, ROAS → upsert por `{storeId, date}`

---

## Autenticación

1. **Admin**: email + password → JWT 7 días (idéntico al existente)
2. **Tiendanube OAuth**: copiar flujo existente de authController.js (scopes: read_orders, read_products, read_customers)
3. **Meta OAuth**: nuevo flujo — redirect a Facebook Login → callback → long-lived token 60 días → guardar en Store
4. **Middleware storeContext**: extrae storeId de params/header/token, verifica acceso admin

---

## Archivos a copiar del proyecto existente

| Archivo fuente | Destino | Modificaciones |
|---------------|---------|---------------|
| `tiendanube-modules-manager/backend/src/services/tiendanubeAPI.js` | `ecom-analytics/backend/src/services/tiendanubeAPI.js` | Ninguna — copiar literal |
| `tiendanube-modules-manager/backend/src/middleware/errorHandler.js` | Misma ruta | Ninguna |
| `tiendanube-modules-manager/backend/src/middleware/auth.js` | Misma ruta | Agregar storeContext |
| `tiendanube-modules-manager/backend/src/utils/logger.js` | Misma ruta | Ninguna |
| `tiendanube-modules-manager/backend/src/utils/LRUMap.js` | Misma ruta | Ninguna |
| `tiendanube-modules-manager/backend/src/config/environment.js` | Misma ruta | Agregar vars de Meta/Claude |
| `tiendanube-modules-manager/backend/src/config/database.js` | Misma ruta | Ninguna |
| `tiendanube-modules-manager/backend/src/controllers/authController.js` | Misma ruta | Agregar OAuth Meta |
| `tiendanube-modules-manager/Dockerfile` | Misma ruta | Ninguna |
| `tiendanube-modules-manager/railway.json` | Misma ruta | Ninguna |
| `tiendanube-modules-manager/frontend/src/services/api.js` | Misma ruta | Ninguna |
| `tiendanube-modules-manager/frontend/src/store/authSlice.js` | Misma ruta | Adaptar |
| `tiendanube-modules-manager/frontend/src/hooks/useAuth.js` | Misma ruta | Ninguna |

---

## Orden de implementación (10 sprints)

### Sprint 0: Setup (1-2 días)
Crear repo, copiar archivos base, setup monorepo, verificar deploy Railway con hello world.

### Sprint 1: Sync TN + Dashboard básico (3-5 días) — Módulos 1+2
Modelos Order/Product/DailyMetric, syncOrders, syncProducts, metricsCalculator, cronManager. Frontend: layout, DailyTable, MetricGrid.

### Sprint 2: Meta Ads + Funnel completo (3-5 días) — Módulos 1+2 completos
metaAPI.js, OAuth Meta, MetaCampaign/MetaDailyInsight, sync Meta, combinar datos TN+Meta en DailyMetric. Frontend: funnel completo, FunnelOverview.

### Sprint 3: Targets + Overview (2-3 días) — Módulos 3+5
Modelo Target, CRUD, comparación vs actual. Overview multi-tienda con KPIs agregados.

### Sprint 4: Productos + Stock (3-4 días) — Módulos 4+7
salesData en Products, top sellers, alertas stock, dead stock, velocidad, cruce stock↔ads.

### Sprint 5: Clientes + Cohortes (3-4 días) — Módulo 6
syncCustomers, cohortCalculator, RFM scoring, LTV, CohortTable, RFMMatrix.

### Sprint 6: Costos + Rentabilidad (2-3 días) — Módulo 8
ProductCost, FixedCost, upload CSV, P&L, márgenes por SKU/pedido.

### Sprint 7: Simulador (1-2 días) — Módulo 9
Motor what-if con fórmulas encadenadas (CPM→CPC→clicks→purchases→ROAS), sliders.

### Sprint 8: Pipeline creativo (2-3 días) — Módulo 10
CreativeHook CRUD, clasificación ABCDE, vinculación con Meta ads, distribución presupuesto.

### Sprint 9: Contenido + Competencia (2-3 días) — Módulos 11+12+13
TopicMap, LanguageBank, Competitor CRUD, análisis Claude.

### Sprint 10: Canales + Reportes (2-3 días) — Módulos 14+15
Attribution por UTMs, claudeAPI o "copiar contexto", ReportBuilder, export.

---

## Entorno de desarrollo

**Todo se desarrolla y prueba en localhost primero.** Deploy a Railway/producción se hace cuando la app esté estable y validada.

- Backend: `node src/server.js` en localhost:3000
- Frontend: `npm run dev` (Vite) en localhost:5173
- MongoDB: local con `docker-compose up mongo` o MongoDB Compass conectado a Atlas
- No se necesita Docker para desarrollo — solo para deploy final

## Prototipo visual

Archivo: `/Users/lucasvargas/Desktop/ANALISIS ECOM/prototipo-app.html`

Abrir en Chrome para ver el boceto interactivo de todas las pantallas de la app. Incluye las 10 secciones navegables con datos ficticios realistas. **Revisar y corregir antes de empezar el desarrollo.**

## Verificación

1. **Sprint 0**: `npm run dev` → frontend en localhost:5173, backend en localhost:3000/health → 200 OK
2. **Sprint 1**: Conectar una tienda TN → forzar sync manual → ver tabla diaria con datos reales de órdenes
3. **Sprint 2**: Conectar Meta → ver funnel completo con datos combinados TN+Meta idéntico al CSV de referencia "DAILY MANGUZ"
4. **Sprint 3**: Cargar targets → ver badges verde/rojo en dashboard comparando vs real
5. **Post cada sprint**: verificar que todo funcione correctamente en localhost
