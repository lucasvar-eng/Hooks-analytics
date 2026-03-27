# Plan: Arquitectura Técnica v2 — Plataforma de Analytics Ecommerce (Visión Lucas)

## Contexto

Lucas tiene una agencia de ecommerce con 5+ clientes en Tiendanube. Hoy la información está fragmentada en Meta Ads, Tiendanube, planillas de Google Sheets y documentos HTML estáticos. Quiere una plataforma centralizada que le permita:

1. **Ver el estado de todos sus clientes de un vistazo** (Home con cards de cada tienda, métricas configurables, alertas de problemas)
2. **Profundizar en cada tienda** con análisis detallado (Dashboard, Cashflow, Costos, Rentabilidad, Productos, etc.)
3. **Entender la rentabilidad real** (no solo ROAS, sino Net Revenue, True ROAS, márgenes netos por orden)
4. **Gestionar flujo de caja** (cuándo se acredita el dinero, pagos pendientes, liquidable)
5. **Tomar decisiones con IA** (análisis automáticos, alertas de problemas, chat con datos)

Ya tiene un proyecto fullstack (tiendanube-modules-manager) con Express + Mongoose + React + Vite + Tailwind + Redux + Docker en Railway. La arquitectura del nuevo proyecto **replica exactamente esos patrones**.

**Restricción**: $0 de costo adicional (Railway hobby + MongoDB Atlas free 512MB + suscripción Claude).

---

## Nombre del proyecto: `ecom-analytics`

## Stack (idéntico al existente)

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js + Express 4.18 + Mongoose 8 |
| Frontend | React 18 + Vite 5 + TailwindCSS 3 + Redux Toolkit |
| BD | MongoDB Atlas (free tier 512MB) |
| Deploy | Railway (Docker multi-stage) |
| Cron | node-cron (en el mismo proceso Express) |
| Charts | Recharts (ligero, React-native) |
| CSV | papaparse (parse) + multer (upload) |
| AI | Claude API (tool_use) |

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
│       ├── models/               # 17 modelos (ver abajo)
│       ├── controllers/          # 17 controllers
│       ├── routes/               # 17 archivos de rutas
│       ├── services/             # tiendanubeAPI, metaAPI, claudeAPI, sync*, calculators, csvParser
│       ├── jobs/                 # cronManager, syncAllStores, syncMeta, recalculateMetrics, cleanup, diagnostics
│       └── utils/                # logger, LRUMap, validator, dateHelpers, metricFormulas, alertEngine
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── store/                # authSlice, homeSlice, storeSlice, widgetSlice
│       ├── services/             # api.js + un service por módulo
│       ├── hooks/                # useAuth, useStoreContext, useDateRange, useMetrics, useWidget
│       ├── components/
│       │   ├── common/           # Header, Sidebar, StoreCard, DateRangePicker, MetricCard, DataTable, CSVUploader, AlertBadge, HealthIndicator, DeviationBadge, InsightBar, BreakevenLine
│       │   ├── home/             # StoreGrid, ConfigurableMetricsSelector
│       │   ├── dashboard/        # KPITopBar, TiendaSection, NCRCSection, MarketingMixSection, CostosSection, LatestSalesTable, Devoluciones, OrderDetailModal
│       │   ├── cashflow/         # CashflowKPIs, WeeklyCashflowChart, PendingPaymentsDonut, CashflowTable, WeeklyDrilldown
│       │   ├── metapixel/        # CampaignTable, ExpandableHierarchy, MetricSelector, ResultsTable, AdThumbnails
│       │   ├── costos/           # CostCategoryEditor, CSVUploadZone, PandLSummary, BreakEvenCalculator
│       │   ├── productos/        # ProductTable, ProductProfileModal, PerProductSimulator, StockAlerts, DeadStockView
│       │   ├── clientes/         # CohortTable, RFMMatrix, LTVChart, CustomerSegments
│       │   ├── simulador/        # WhatIfPanel, SliderSet, ScenarioComparison
│       │   ├── creativos/        # AutoClassificationGrid (ABCDE), AdCreativeView, PerformanceFunnel, CampaignResultsTable
│       │   ├── contenido/        # TopicMap, LanguageBank, CompetitorCardEditable
│       │   ├── competencia/      # CompetitorCard (prices, offers, creatives), AIAnalysisPanel
│       │   ├── reportes/         # ReportBuilder, ReportViewer, SavedReportsList
│       │   ├── settings/         # CotizacionDolarPanel, ImpuestosConfig, ComisionesPagoTable, IntegrationStatus, ObjetivosPanel, BreakevenAutoCalc
│       │   └── widgets/          # WidgetContainer, WidgetEditor, WidgetLibrary
│       └── pages/                # Home, Dashboard, Cashflow, MetaPixel, Costos, Productos, Clientes, Simulador, Creativos, Contenido, Competencia, Reportes, Settings
```

---

## Modelo de datos MongoDB (17 colecciones)

### Core

- **Store** — Tienda conectada (TN OAuth + Meta OAuth + config financiero + integrations status)
- **User** — Admin de la plataforma (email, password, role)
- **DailyMetric** — Una fila por tienda por día: data de ventas (órdenes, revenue, AOV) + Meta (spend, impressions, reach, clicks) + derived (ROAS, CPA). Índice único: `{storeId, date}`
- **Order** — Órdenes sincronizadas de TN con desglose financiero completo (total, net, cost breakdown, payment info). Índice único: `{storeId, tnOrderId}`
- **Product** — Productos sincronizados (precio, stock, variantes, COGS, márgenes, sales velocity). Índice único: `{storeId, tnProductId}`
- **Customer** — Clientes (totalOrders, totalSpent, firstPurchase, cohortMonth, RFM, LTV, esClienteNuevo). Índice único: `{storeId, tnCustomerId}`

### Financial (NEW)

- **CashflowEntry** — Tracking de acreditaciones y pagos pendientes (orderId, fechaCreacion, fechaPago, estado, liquidable, gateway, cuotas)

### Meta Ads

- **MetaCampaign** — Campañas/AdSets/Ads de Meta (hierarchy con level + parentId, status, budget, clasificación automática)
- **MetaDailyInsight** — Métricas diarias por objeto de Meta (spend, impressions, reach, clicks, ATC, checkouts, video metrics). Índice único: `{storeId, metaId, date}`

### Configuration & Content

- **Store** ampliado — campos de configuración de costos, impuestos, comisiones, cotización dólar, alertas, métricas de home configuradas
- **TopicMap** — Ángulos de comunicación (status, avatars, hookIds)
- **LanguageBank** — Frases de clientes, objeciones, vocabulario
- **Competitor** — Competidores (productos con precios, ofertas, creativos descritos)

### System

- **Widget** — Configuración de widgets por página (storeId, pageId, type, config, position)
- **SyncLog** — Log de sincronizaciones (type, status, recordsFetched, error). TTL 30 días
- **Report** — Reportes generados por Claude (type, title, content markdown, contextSnapshot, tokensUsed)
- **Alert** — Alertas automáticas detectadas (storeId, tipo, descripción, métricas, fechaDetectada, estado)

---

## ARQUITECTURA DE NAVEGACIÓN — TWO-LEVEL

### Level 1: HOME (Agency View)

**Propósito**: Responder "¿Cómo están mis clientes hoy?"

**Layout**:
- Header con logo + calendario global (Meta Ads Manager style)
  - Presets: "Últimos 7 días", "Este mes", "Mes pasado"
  - Rango custom
  - Comparación vs período anterior
- Grid de CARDS (una por tienda)
  - Logo tienda + nombre
  - 5 MÉTRICAS CONFIGURABLES (user elige cuáles 5)
  - ALERT INDICATOR (rojo si hay problema detectado)
  - Click → enter that store

**Configuración**:
- En Settings de cada store, user elige qué 5 KPIs mostrar en la card de Home
- Ej: Ordenes >$0, Revenue, Profit, ROAS, NC %
- Los alertas se calculan por un cron job (diagnostics) que corre cada 6h

**Métricas disponibles para elegir**:
Ordenes, Revenue, Net Revenue, Profit, Profit Margin %, ROAS, True ROAS, AOV, AOV Neto, Ad Spend, CPA, True CPA, NC %, RC %, Devoluciones

---

### Level 2: INSIDE A STORE (Operational View)

**Propósito**: Profundizar en la operación de una tienda

**Layout**:
- Header global con calendario (igual que Level 1, aplica a TODO)
  - Algunas secciones pueden OVERRIDE con su propio rango de fechas
- **Sidebar izquierdo** con todas las secciones:
  1. **Resumen Configurable** (summary con widgets elegidos)
  2. Dashboard
  3. Cashflow
  4. Meta Pixel
  5. Costos
  6. Productos
  7. Clientes
  8. Simulador
  9. Creativos
  10. Contenido
  11. Competencia
  12. Reportes
  13. Settings
- "Back to Home" button en sidebar
- Todo filtrado por `storeId`

---

## WIDGET SYSTEM (NEW)

**Concepto**: Cada página (sección) es configurable con widgets. User puede elegir qué KPIs y bloques ver.

**Tipos de widget**:
- **KPI Card** — métrica + valor + comparativa anterior período
- **Data Table** — columnas configurables (como metric selector de Escalafy)
- **Line Chart** — serie temporal
- **Bar Chart** — comparativa
- **Funnel** — pasos de conversión
- **Donut/Pie** — distribución
- **Text/Notes** — notas libres

**Ejemplo**:
- Home Summary (Level 1) es una colección de widgets KPI
- Configuración de store → "Choose Home Metrics" → seleccionar 5 KPIs de lista
- Store Summary (Level 2, primera sección) → user elige widgets (ej: 3 KPI cards + 1 table)

**Data model — Widget**:
```js
{
  _id: ObjectId,
  storeId: ObjectId,
  pageId: String,              // 'home' | 'dashboard' | 'cashflow' | etc.
  type: String,                // 'kpi' | 'table' | 'chart' | 'funnel' | 'donut' | 'text'
  title: String,
  config: {
    // KPI card
    metric: String,            // ej: 'revenue' | 'roas' | etc.

    // Table
    columns: [String],         // ['orderId', 'customer', 'total', 'net'] — user elige cuáles
    filters: {},               // predicados para mongoQuery

    // Chart
    xAxis: String,             // 'date' | 'week'
    series: [String],          // ej: ['revenue', 'profit']

    // Funnel
    steps: [String],           // ej: ['impressions', 'clicks', 'atc', 'purchases']

    // Donut
    groupBy: String,           // 'gateway' | 'channel' | etc.
  },
  position: Number,            // orden en la página (0, 1, 2, ...)
  createdAt: Date,
  updatedAt: Date,
}
```

---

## CAPA DE ANÁLISIS CONTEXTUAL (NEW)

### Concepto

Cada vista no solo muestra datos crudos sino que los interpreta contra los **objetivos configurados** para esa tienda. Esto transforma el dashboard de "informativo" a "accionable".

### Componentes comunes

- **`HealthIndicator`** — Semáforo (🟢🟡🔴) en cada KPI card que compara valor real vs objetivo
  - 🟢 Dentro del objetivo o mejor
  - 🟡 Desviación > `warningPct` (default 15%)
  - 🔴 Desviación > `criticalPct` (default 30%)
- **`DeviationBadge`** — Texto "+23% sobre objetivo" o "-12% bajo target" junto a cada métrica
- **`InsightBar`** — Barra resumen por sección con 1-2 líneas de contexto generadas por reglas (no IA):
  - Ej: "CPA 23% por encima del máximo. ROAS dentro del rango esperado."
  - Ej: "Margen neto saludable. NC% cayó 8pp vs mes anterior."
- **`BreakevenLine`** — Línea de referencia en charts que marca el punto de equilibrio (calculado desde costos)

### Cálculos de breakeven automáticos

Se derivan de los datos de costos configurados en Settings:

```js
// Break-even ROAS: por debajo de este ROAS, la tienda pierde plata
roasBreakeven = totalOrden / (totalOrden - comisionPago - impuestosIBB - comisionCuotas - feePlataforma - costoEnvio - costoProductos)

// Break-even CPA: máximo que se puede pagar por adquisición sin perder
cpaBreakeven = AOV × (1 - (costoPct_total))  // donde costoPct_total incluye todas las deducciones como %

// AOV mínimo: debajo de este AOV promedio, no hay margen
aovMinimo = (costoFijoPromedioPorOrden) / (1 - costoPct_variable)
```

### Capas por sección

| Sección | Capa de análisis |
|---------|-----------------|
| **Home cards** | Semáforo por tienda (verde=todo OK, amarillo=algún KPI fuera, rojo=problema crítico) |
| **Dashboard** | HealthIndicator en cada KPI card + InsightBar resumen arriba |
| **Cashflow** | BreakevenLine en chart semanal + alerta si liquidable < costos operativos |
| **Meta Pixel** | Semáforo en ROAS/CPA por campaña vs targets + flag en campañas bajo breakeven |
| **Costos** | P&L con línea de breakeven + margen de seguridad % + tendencia de márgenes |
| **Productos** | Flag en productos con margen < objetivo + ranking por contribución al profit |
| **Clientes** | NC% vs target + alerta si RC revenue cae + LTV vs CPA ratio |
| **Simulador** | Comparar escenarios vs breakeven, mostrar "zona segura" en sliders |
| **Creativos** | Auto-tier (ABCDE) contextualizado: A = supera target, E = bajo breakeven |

### Settings > Objetivos (nuevo panel)

Dentro de Settings de cada tienda, nueva sección "Objetivos y Benchmarks":

1. **Fase del cliente** — Selector: Crecimiento / Escalamiento / Rentabilidad / Mantenimiento
   - Cada fase precarga targets sugeridos (ej: Crecimiento acepta ROAS más bajo, NC% más alto)
2. **KPIs Target** — Inputs editables para cada métrica objetivo
3. **Breakeven automático** — Calculado en tiempo real desde los costos configurados (read-only, se actualiza al cambiar costos/comisiones/impuestos)
4. **Umbrales de alerta** — Configurar % de desviación para warning (🟡) y critical (🔴)

---

## SECCIONES DETALLADAS POR MÓDULO

### 1. HOME (Level 1)

**Componentes**:
- `StoreGrid` — grid responsive de cards
- `StoreCard` — card individual con 5 métricas + alert badge
- `DateRangePicker` — global para toda la Home
- `AlertBadge` — indicador rojo si hay alerta

**Funcionalidad**:
- Click en card → navigate a `/store/{storeId}/dashboard`
- Botón engranaje en card → ir a settings de esa tienda
- Alerts se cargan de la colección `Alert` (poblada por cron diagnostics)

---

### 2. DASHBOARD (por tienda)

**KPIs Top (8 cards)**:
- Ordenes >$0
- Revenue
- Ad Spend
- Net Revenue
- Profit
- Profit Margin %
- ROAS
- True ROAS

**Secciones**:

#### Tienda
- Ordenes
- Revenue
- Net Revenue
- AOV
- AOV Neto
- Ordenes >$0

#### NC/RC (Nuevos vs Recurrentes)
- NC %
- NC Órdenes
- NC Revenue
- NC CPA
- NC ROAS
- NC True ROAS
- RC %
- RC Órdenes
- RC Revenue

#### Mix de Marketing
Tarjetas por canal (de momento solo Meta, pero estructura preparada para Google Ads, TikTok Ads):
- Ad Spend
- ROAS
- CPA
- CPC

#### Costos
- Costos de Productos
- Costos de Envío
- Costos Adicionales

#### Últimas Ventas
- Tabla con columnas: ID Orden, Cliente, Total, Comisiones, Impuestos, Costo Envío, Costo Productos, Fee, Total Neto
- Click en fila → order detail modal con desglose completo

#### Devoluciones
- Contador de devoluciones en el período

**Fórmulas de cálculo** (en backend service `metricCalculator.js`):
```js
ordenesGrandes = count(orders donde totalOrden > 0)
revenue = sum(totalOrden)
netRevenue = sum(totalNeto)
adSpend = sum(MetaDailyInsight.spend × cotizacionDolar)
profit = netRevenue - costosFixosProrateados
profitMargin = profit / revenue × 100
roas = revenue / adSpend
trueROAS = netRevenue / adSpend
aov = revenue / ordenesGrandes
aovNeto = netRevenue / ordenesGrandes

// NC vs RC
ncOrdenes = count(orders donde esClienteNuevo = true)
ncRevenue = sum(revenue de órdenes NC)
ncCPA = adSpend / ncOrdenes
ncROAS = ncRevenue / adSpend
ncTrueROAS = sum(totalNeto NC) / adSpend

rcPct = (1 - ncPct) × 100
```

---

### 3. CASHFLOW MODULE (NEW)

**Propósito**: Ver desfase entre vender y cobrar (crítico para LATAM con cuotas)

**KPIs principales**:
- **Ventas** — gross revenue en período
- **Liquidable Ventas** — ventas - comisiones de pago
- **Comisiones de Pago** — monto total de comisiones
- **Comisiones %** — comisiones / ventas
- **Pagos Pendientes** — dinero vendido pero aún no acreditado
- **Pagos Recibidos** — dinero ya en la cuenta

**Gráfico semanal**:
- Barras agrupadas por semana: 3 series
  - Ventas (rojo)
  - Pagos Recibidos (azul)
  - Pagos Pendientes (naranja)
- Muestra el desfase visual

**Distribución de pagos pendientes**:
- Donut: Mercado Libre (verde) vs Mercado Pago (celeste)

**Tabla de Pagos Programados**:
- Columnas: ID Orden, Fecha Creación, Fecha Pago, Estado, Total Orden, Liquidable, Gateway, Cuotas
- Filtrable por gateway, rango de fecha pago

**Drill-down semanal**:
- Click en una semana del gráfico → modal con detail
- Muestra liquidable + pagos recibidos + pagos pendientes de esa semana
- Tabla de órdenes que tienen pago esperado en esa semana

**Date range especial**:
- Selector permite elegir "Próximas 2/3/4/6/8 semanas" (FORWARD looking, no solo histórico)
- Esto es clave para forecasting de cash

**Data model — CashflowEntry**:
```js
{
  orderId: ObjectId,
  storeId: ObjectId,
  fechaCreacion: Date,
  fechaPago: Date,          // cuándo se acredita
  estado: String,           // 'pendiente' | 'recibido'
  totalOrden: Number,
  liquidable: Number,       // total - comisión pago
  comision: Number,
  gateway: String,          // 'mercadopago' | 'stripe' | etc.
  cuotas: Number,           // 1, 3, 6, 12, etc.
  numeroCuota: Number,      // cuota N de M
}
```

**Cálculo de fechaPago**:
- Para orden de 1 pago (cuotas=1): fechaPago = fechaCreación + 3 días
- Para orden de 6 cuotas: 6 entradas en CashflowEntry, espaciadas ~30 días
  - Cuota 1: fechaCreación + 3 días
  - Cuota 2: fechaCreación + 33 días
  - Cuota 3: fechaCreación + 63 días
  - etc.

---

### 4. META PIXEL MODULE (NEW)

**Propósito**: Análisis granular de campañas Meta con métricas en tiempo real

**Tabla de campañas**:
- Status (toggle) — FUTURE: pausar/activar directamente (requiere ads_management scope)
- Nombre Campaña
- Budget (editable) — FUTURE (requiere ads_management scope)
- Meta Spend
- Meta Revenue (atribuido por Meta)
- Meta Profit
- CPA
- ROAS
- Expandible: → AdSets → Ads individuales

**Selector de métricas** (Modal):
Agrupa en 4 categorías:

**Básicas**:
- Spend
- Impressions
- Reach
- Frequency (Reach / Impressions × 1000)
- CPM
- CTR
- CPC

**Click**:
- Link Clicks
- Cost per Link Click
- Unique Link Clicks
- Unique CTR

**Video**:
- Video Plays
- Avg Play Time
- Thruplays
- Scroll Stopper Rate (% que vio 3s+)
- Hold Rate
- Video Plays at 100%
- Video Plays at 95%
- Video Plays at 75%
- Video Plays at 50%

**Conversión**:
- Cost per Purchase (CPA)
- ROAS
- True ROAS (Net Revenue / Spend)
- Net AOV
- Adds to Cart
- Cost per ATC
- Checkouts Initiated

**Resultados x Anuncio**:
- Tabla con thumbnails de creativo (desde Meta)
- Columnas: Importe Gastado, Alcance, CTR, ATC, Pagos Iniciados, Compras, CPA
- Muestra el funnel completo por ad

---

### 5. COSTOS (Expandido)

**5 categorías configurables**:

1. **Costos de productos** (COGS)
   - CSV upload para batch (SKU, unitCost, packagingCost)
   - Tabla editable con filas por producto
   - Validación: unitCost > 0

2. **Comisiones de plataforma** (TN/Shopify)
   - Dropdown: % fijo (default depende plataforma: TN ~2%, Shopify ~2.9%)
   - Editable por usuario

3. **Comisiones de pago**
   - Tabla: Medio de Pago | Cuotas | Comisión Base | Comisión Cuotas
   - Ej: Visa | 1 | 2.99% | 0%
   - Ej: Visa | 3 | 2.99% | 5%
   - Ej: Visa | 12 | 2.99% | 35%
   - Valores por defecto Argentina pero editables

4. **Costos de Envíos**
   - Tabla: Zona | Costo Fijo | % de Orden
   - Ej: GBA | $2000 | 5%
   - Ej: Interior | $3500 | 8%

5. **Costos Adicionales**
   - Tabla: Nombre | Monto | Tipo (fijo_mensual | porcentaje_por_orden)
   - Ej: Seguros | $5000 | fijo_mensual
   - Ej: Embalaje Premium | 2% | porcentaje_por_orden

**P&L Summary**:
```
Revenue (Gross)                    $100,000
  − Costo de Productos             −$30,000
  − Costo de Envío                 −$8,000
  − Comisiones (pago + cuotas)     −$5,000
  − Impuestos (IBB)                −$3,500
  − Fee Plataforma                 −$1,000
= Net Revenue                      $52,500

  − Costos Fijos (prorrated)       −$10,000
= Profit Neto                      $42,500

Profit Margin % = $42,500 / $100,000 = 42.5%
```

**Punto de Equilibrio**:
```
Costos Fijos / Margen Contribución Unitario
```

---

### 6. PRODUCTOS (Expandido)

**Vista lista**:
- Tabla: SKU, Nombre, Precio, Stock, Últimas Ventas (últimos 30 días), Velocidad (unidades/día), Días de Stock
- Alertas: stock bajo (< 5 unidades), stock crítico (0), dead stock (sin venta en 90 días)

**Click en producto → Profitability Profile**:
- Nombre + foto
- Precio de venta
- Costo COGS
- Costo de Envío (promedio)
- Comisión de Plataforma
- Comisión de Pago
- Impuestos IBB
- = Net Margin (%)
- Últimas 10 órdenes de este SKU

**Per-product Simulator**:
- Sliders: Precio (+/- %), Costo COGS (+/- %), Costo Envío (+/- %)
- Cálculo en vivo de nuevo margin
- Botón "What if aumentar precio 10%" → recalcula
- Botón "What if bajar costo de envío en 15%" → recalcula
- Guarda simulaciones para comparar

---

### 7. SIMULADOR GENERAL (Keep v1 design)

**Propósito**: What-if scenario a nivel de tienda completa

**Inputs (sliders)**:
- CPM (Cost per Mille)
- CTR (Click Through Rate)
- CVR (Conversion Rate)
- AOV (Average Order Value)
- Budget (Ad Spend)
- ROAS (Read-only output)

**Motor**:
```
Impressions = (Budget / CPM) × 1000
Clicks = Impressions × (CTR / 100)
Conversiones = Clicks × (CVR / 100)
Revenue = Conversiones × AOV
ROAS = Revenue / Budget
```

**Salida**:
- Antes vs Después (2 cards lado a lado)
- Tabla con resultados detallados
- Export como PNG

---

### 8. CREATIVOS (Expandido con clasificación automática)

**Auto-classification (ABCDE)**:
- Cron job sincroniza meta ads + daily insights
- Para cada ad, calcula scoring basado en:
  - CTR vs CPM → eficiencia
  - CPA vs promedio → costo
  - ROAS vs 1x (rentabilidad)
- Clasifica automáticamente en tiers:
  - A: Top 10% (mayor ROAS, menor CPA)
  - B: 10-30%
  - C: 30-60%
  - D: 60-80%
  - E: Tail 20%

**Grid visual**:
- Cada creativo muestra: thumbnail de Meta, nombre, KPIs clave, tier (A-E con color)
- Colores: A=verde, B=azul, C=amarillo, D=naranja, E=rojo

**Per-ad funnel**:
- Click en ad → ver: Importe Gastado, Alcance, CTR, ATC, Pagos Iniciados, Compras, CPA

**Resultados x Campaña**:
- Tabla: Nombre Campaña | Spend | Reach | CTR | ATC | Compras | CPA | ROAS
- Total row al final

**Resultados x Anuncio**:
- Tabla: Thumbnail | Ad Name | Spend | Reach | CTR | ATC | Compras | CPA | Tier

---

### 9. CONTENIDO

Mantener v1 design:
- TopicMap: ángulos de comunicación, avatars, performance
- LanguageBank: frases de clientes, objeciones, vocabulario, sentiment

---

### 10. COMPETENCIA (Keep v1 + AI)

**Competitor cards**:
- Nombre + logo
- 3 tabs: Precios | Ofertas | Creativos

**Tab Precios**:
- Tabla: Producto | Precio Competidor | Precio Nuestro | Diferencia | % Diferencia

**Tab Ofertas**:
- Tabla: Descripción | Tipo (descuento | 3x2 | envío gratis) | Fecha Inicio | Fecha Fin

**Tab Creativos**:
- Tabla: Descripción | URL Imagen | Ángulo | Formato

**AI Analysis**:
- Botón "Analizar competencia"
- Envía: nuestros precios + productos + ofertas + creativos
- + datos de competidor (lo mismo)
- Claude analiza y retorna insights en markdown
- Guardado en Report model

---

## AI INTEGRATION (3 capas, sin Layer 4)

### Layer 1: Analysis & Reports
- Botón "Generar análisis" en cada sección (Dashboard, Cashflow, Meta Pixel, Creativos, etc.)
- Backend arma structured prompt con datos de la sección
- Llama Claude API (sin tool_use)
- Retorna análisis en markdown (200-500 palabras)
- Guardado en Report model
- Frontend muestra en modal con botón "Save as Report"

**Ejemplo**:
- Dashboard → "Generar análisis" → Claude recibe:
  - Últimos 7 días de KPIs (órdenes, revenue, ROAS, profit margin)
  - Comparativa vs período anterior
  - Prompt: "Analiza el performance del dashboard. ¿Qué tendencias ves? ¿Qué está funcionando bien? ¿Qué hay que mejorar?"
  - Claude retorna análisis (sin acceso a datos reales, puro contexto)

### Layer 2: Chat with Data (Tool Use)

**Chat panel** en las páginas principales (o en sidebar mini-chat):
- User escribe pregunta: "¿Cuál es mi producto más rentable?" "¿Qué campaña tiene mejor ROAS?"
- Backend usa Claude API con tool_use
- Tools disponibles (definidos en sistema prompt):
  - `getMetricsByDateRange(storeId, dateStart, dateEnd, metrics[])`
  - `getTopProducts(storeId, limit, orderBy)`
  - `getOrderDetail(storeId, orderId)`
  - `getCampaignPerformance(storeId, campaignId)`
  - `getCompetitorData(storeId, competitorId)`
  - `getCustomerSegment(storeId, segment)`
  - `getCashflowForecast(storeId, weeks)`
- Backend ejecuta las queries MongoDB
- Claude interpreta y responde en lenguaje natural

**Ejemplo**:
- User: "¿Qué pasó con mi ROAS el mes pasado?"
- Claude usa tool: `getMetricsByDateRange(..., ['roas', 'spend', 'revenue'])`
- Backend retorna datos
- Claude: "Tu ROAS cayó de 2.8x a 2.1x. El spend aumentó 20% pero la revenue solo 10%. Sugiero revisar la calidad de tus creativos o audiencias..."

### Layer 3: Automated Alerts & Diagnostics

**Cron job** (ejecuta cada 6 horas):
```
1. Calcula KPIs principales de cada store
2. Detecta anomalías (compara con promedio histórico)
3. Arma structured prompt con hallazgos
4. Envía a Claude API
5. Claude retorna lista priorizada de alertas
6. Guarda en Alert model
7. Frontend muestra en Home cards (alert badge)
8. User puede clickear badge → ver detalles
```

**Detecciones automáticas**:
- SKUs con margen neto negativo
- Campañas operando a pérdida
- Zonas de envío que destruyen márgenes
- Descuentos mal aplicados (causando órdenes negativas)
- Alta frecuencia en un ad (puede estar quemado)
- Caída repentina en ROAS vs 7 días anteriores
- Stock crítico en top sellers

**Alert model**:
```js
{
  storeId: ObjectId,
  tipo: String,           // 'negative_margin' | 'low_stock' | 'roas_drop' | etc.
  titulo: String,
  descripcion: String,
  metricas: {},          // datos relevantes
  severidad: String,     // 'critical' | 'warning' | 'info'
  fechaDetectada: Date,
  estado: String,        // 'activa' | 'resuelta' | 'ignorada'
  actions: [],           // acciones sugeridas
}
```

### Layer 4: NOT in scope
- Pausar campañas automáticamente
- Enviar WhatsApp/Telegram
- Cualquier acción irreversible sin aprobación manual

---

## ORDEN DE DATOS Y CÁLCULOS

### Sincronización de datos (cron jobs)

| Job | Frecuencia | Qué hace |
|-----|-----------|---------|
| syncAllOrders | Cada 6h | Fetch órdenes TN últimos 7 días → upsert Orders → calcular campos financieros → crear CashflowEntries |
| syncAllProducts | Cada 12h | Fetch productos TN → upsert Products con velocity, stock alertas |
| syncAllCustomers | Cada 24h | Fetch clientes últimos 30 días → upsert → recalcular RFM, marcar esClienteNuevo |
| syncMetaInsights | Cada 6h | Fetch insights Meta (spend, impressions, conversions, video metrics, ATC, checkouts) → upsert MetaDailyInsight |
| recalculateMetrics | Post-sync órdenes | Cruzar TN + Meta → generar DailyMetric del período (órdenes, revenue, ROAS, CPA, ROAS true, NC/RC, etc.) |
| detectAnomalies | Cada 6h | Cron de diagnostics: compila KPIs, detecta problemas, llama Claude, guarda Alerts |
| cleanupOldData | Cada 24h | Borrar SyncLog >30 días, archivar Orders >12 meses |

**Flujo post-sync**:
```
syncAllOrders trae órdenes nuevas
  ↓
Para cada orden, calcula:
  - totalNeto = totalOrden - comisionesPago - impuestosIBB - comisionesCuotas - costoEnvio - costoProductos - feePlataforma
  - liquidable = totalOrden - comisionesPago
  - esClienteNuevo = verificar si customer.totalOrders era 0 antes
  - Crea N CashflowEntry (una por cuota, con fechaPago calculada)
  ↓
recalculateMetrics corre después
  Agrupa órdenes por date + storeId
  Suma por date:
    - totalOrdenes = count
    - ordenesGrandes = count(total > 0)
    - revenue = sum(totalOrden)
    - netRevenue = sum(totalNeto)
    - costoProductos = sum(costosProductos)
    - costoEnvio = sum(costoEnvio)
    - comisionesTotales = sum(comisionesPago + comisionesCuotas)
    - ncOrdenes = count(esClienteNuevo = true)
    - ncRevenue = sum(revenue NC)

  Fetch MetaDailyInsight para ese date:
    - spend = sum(spend) × cotizacionDolar
    - impressions, reach, clicks, ATC, checkouts, videoMetrics

  Calcula derivadas:
    - ROAS = revenue / spend
    - trueROAS = netRevenue / spend
    - CPA = spend / ordenesGrandes
    - trueCPA = spend / count(totalNeto > 0)
    - ncCPA = spend / ncOrdenes
    - ncROAS = ncRevenue / spend
    - ncTrueROAS = sum(totalNeto NC) / spend

  Upsert DailyMetric con todo esto
```

---

## Autenticación

1. **Admin login**: email + password → JWT 7 días (idéntico existente)
2. **Tiendanube OAuth**: copiar flujo existente (scopes: read_orders, read_products, read_customers)
3. **Meta OAuth**: nuevo flujo — redirect a Facebook Login → callback → long-lived token 60 días
4. **Middleware storeContext**: extrae storeId de params/header/URL, verifica permisos

---

## Modelo de datos MongoDB (campos completos)

### Store (ampliado)

```js
{
  _id: ObjectId,
  nombre: String,
  tnAccessToken: String,
  tnStoreId: String,
  tnNombre: String,

  // Meta OAuth
  metaAccessToken: String,
  metaPageId: String,
  metaPixelId: String,
  metaBusinessAccountId: String,

  // Configuración financiera
  cotizacionDolar: Number,          // ARS/USD, updatable manualmente
  tasaIBB: Number,                  // % (default 3.5 CABA)
  feePlataformaPct: Number,         // % (default 2% TN)

  // Comisiones de pago configurables
  comisionPagoConfig: [{
    medioPago: String,              // 'visa' | 'mastercard' | 'amex' | 'debit'
    cuotas: Number,                 // 1 | 3 | 6 | 12
    comisionBase: Number,           // % (ej: 2.99)
    comisionCuotas: Number,         // % adicional (ej: 3%)
  }],

  // Costos de envío
  costosEnvio: [{
    zona: String,
    costoFijo: Number,
    porcentajeOrden: Number,
  }],

  // Costos adicionales
  costosAdicionales: [{
    nombre: String,
    monto: Number,
    tipo: String,                   // 'fijo_mensual' | 'porcentaje_por_orden'
  }],

  // Widget configuration
  metricasHome: [String],           // 5 KPIs elegidos (ej: ['ordenes', 'revenue', 'roas'])
  widgets: [ObjectId],              // refs a Widget docs

  // Objetivos y benchmarks por tienda
  objetivos: {
    fase: String,                   // 'crecimiento' | 'escalamiento' | 'rentabilidad' | 'mantenimiento'
    kpis: {
      roasTarget: Number,           // ej: 3.5
      trueRoasTarget: Number,       // ej: 2.8
      cpaMaximo: Number,            // ej: $15,000
      trueCpaMaximo: Number,        // ej: $18,000
      profitMarginMin: Number,      // % (ej: 15)
      aovTarget: Number,            // ej: $65,000
      ncPctTarget: Number,          // % nuevos clientes objetivo (ej: 40)
      conversionRateTarget: Number, // % (ej: 2.5)
      tasaDevolucionMax: Number,    // % máximo aceptable (ej: 5)
    },
    breakeven: {
      roasBreakeven: Number,        // calculado automático desde costos
      cpaBreakeven: Number,         // calculado automático
      aovMinimo: Number,            // calculado automático
    },
    alertThresholds: {
      warningPct: Number,           // % desviación para amarillo (default 15)
      criticalPct: Number,          // % desviación para rojo (default 30)
    },
  },

  // Alert config
  alertConfig: {
    enabledTypes: [String],         // qué alertas activar
    recipients: [String],           // email address
  },

  // Integration status
  integrationStatus: {
    tiendanube: { connected: Boolean, lastSync: Date },
    metaAds: { connected: Boolean, lastSync: Date },
    googleAds: { connected: Boolean, lastSync: Date },
    tiktokAds: { connected: Boolean, lastSync: Date },
    mercadolibre: { connected: Boolean, lastSync: Date },
  },

  createdAt: Date,
  updatedAt: Date,
}
```

### Order (ampliado)

```js
{
  _id: ObjectId,
  storeId: ObjectId,
  tnOrderId: String,
  tnOrderNumber: String,

  // Cliente
  customerId: ObjectId,             // ref a Customer
  customerName: String,
  customerEmail: String,

  // Montos brutos
  totalOrden: Number,               // Gross revenue
  subtotal: Number,
  descuento: Number,

  // Costos y deducciones
  comisionPago: Number,             // Monto (calculado desde config)
  comisionCuotas: Number,           // Monto adicional (si hay cuotas)
  impuestosIBB: Number,             // Monto IBB
  feePlataforma: Number,            // Monto fee
  costoEnvio: Number,

  // COGS
  costoProductos: Number,           // Sum de productCost × qty por cada línea

  // Derivados
  totalNeto: Number,                // totalOrden - todas las deducciones
  liquidable: Number,               // totalOrden - comisionPago

  // Cliente nuevo vs recurrente
  esClienteNuevo: Boolean,

  // Cuotas y pago
  cantidadCuotas: Number,           // 1, 3, 6, 12, etc.
  fechaPago: Date,                  // Fecha esperada de acreditación (cuota 1)
  estadoPago: String,               // 'pendiente' | 'paid'
  gateway: String,                  // 'mercadopago' | 'stripe' | 'otro'

  // Referencia
  canal: String,                    // 'tiendanube' | 'mercadolibre' | 'shopify'

  // Line items
  lineItems: [{
    productId: ObjectId,            // ref a Product
    tnProductId: String,
    nombre: String,
    cantidad: Number,
    precioUnitario: Number,
    costoUnitario: Number,          // from ProductCost
    subtotal: Number,
  }],

  // UTM / referrer
  utm_source: String,
  utm_medium: String,
  utm_campaign: String,
  utm_content: String,

  // Status
  estado: String,                   // 'pendiente' | 'confirmada' | 'enviada' | 'entregada'
  esDevolucion: Boolean,
  fechaCreacion: Date,

  createdAt: Date,
  updatedAt: Date,

  // Index
  index: { storeId: 1, tnOrderId: 1 }  // unique
}
```

### CashflowEntry (NEW)

```js
{
  _id: ObjectId,
  orderId: ObjectId,                // ref Order
  storeId: ObjectId,

  fechaCreacion: Date,              // Fecha de venta
  fechaPago: Date,                  // Cuándo se acredita

  estado: String,                   // 'pendiente' | 'recibido'

  // Montos
  totalOrden: Number,               // Monto bruto
  liquidable: Number,               // Monto a cobrar (total - comisión pago)
  comision: Number,                 // Deducción

  // Cuotas
  gateway: String,
  cuotas: Number,                   // Total de cuotas
  numeroCuota: Number,              // Cuota N de M

  createdAt: Date,

  // Index
  index: { storeId: 1, fechaPago: 1 }  // para queries de rango
}
```

### DailyMetric (ampliado)

```js
{
  _id: ObjectId,
  storeId: ObjectId,
  date: Date,                       // YYYY-MM-DD

  // Órdenes
  totalOrdenes: Number,
  ordenesGrandes: Number,           // count(total > 0)

  // Revenue
  revenue: Number,                  // Gross
  netRevenue: Number,               // After all deductions

  // Costos
  costoProductos: Number,
  costoEnvio: Number,
  comisionesTotales: Number,        // pagos + cuotas
  impuestosIBB: Number,
  feePlataforma: Number,

  // Profit
  profit: Number,                   // netRevenue - costos fijos prorrados
  profitMargin: Number,             // profit / revenue × 100

  // AOV
  aov: Number,                      // revenue / ordenesGrandes
  aovNeto: Number,                  // netRevenue / ordenesGrandes

  // NC vs RC
  ncOrdenes: Number,
  ncRevenue: Number,
  rcOrdenes: Number,
  rcRevenue: Number,
  ncPct: Number,                    // % de órdenes nuevas

  // Devoluciones
  devoluciones: Number,

  // Meta data
  metaSpend: Number,                // En ARS (USD × cotización)
  metaImpressions: Number,
  metaReach: Number,
  metaClicks: Number,
  metaATC: Number,
  metaCheckouts: Number,
  metaVideoPlays: Number,
  metaVideoScrollStopperRate: Number,

  // Derived from Meta + Orders
  roas: Number,                     // revenue / spend
  trueROAS: Number,                 // netRevenue / spend
  cpa: Number,                      // spend / ordenesGrandes
  trueCPA: Number,                  // spend / count(net > 0)
  cpc: Number,                      // spend / clicks
  cpm: Number,                      // (spend / impressions) × 1000
  ctr: Number,                      // (clicks / impressions) × 100

  ncCPA: Number,                    // spend / ncOrdenes
  ncROAS: Number,                   // ncRevenue / spend
  ncTrueROAS: Number,               // sum(neto NC) / spend

  createdAt: Date,
  updatedAt: Date,

  // Index
  index: { storeId: 1, date: 1 }    // unique
}
```

### MetaCampaign

```js
{
  _id: ObjectId,
  storeId: ObjectId,
  metaId: String,                   // ID de Meta

  nombre: String,
  status: String,                   // 'ACTIVE' | 'PAUSED' | 'DELETED'
  budget: Number,                   // Budget diario en USD

  level: String,                    // 'campaign' | 'adset' | 'ad'
  parentId: ObjectId,               // ref a parent campaign (si es adset/ad)

  // Auto-classification
  clasificacion: String,            // 'A' | 'B' | 'C' | 'D' | 'E'
  scoreRoas: Number,
  scoreCPA: Number,
  scoreEfficiency: Number,

  createdAt: Date,
  updatedAt: Date,

  // Index
  index: { storeId: 1, metaId: 1 }
}
```

### MetaDailyInsight

```js
{
  _id: ObjectId,
  storeId: ObjectId,
  metaId: String,
  date: Date,

  // Básico
  spend: Number,                    // USD
  impressions: Number,
  reach: Number,
  clicks: Number,

  // Click breakdown
  linkClicks: Number,
  uniqueLinkClicks: Number,
  costPerLinkClick: Number,

  // Conversiones
  purchases: Number,
  atc: Number,                      // Add to Cart
  checkouts: Number,                // Checkout Initiated
  costPerPurchase: Number,

  // Video
  videoPlays: Number,
  avgPlayTime: Number,              // segundos
  thruplays: Number,
  scrollStopperRate: Number,        // %
  holdRate: Number,                 // %
  videoPlays100: Number,
  videoPlays95: Number,
  videoPlays75: Number,
  videoPlays50: Number,

  // Derived
  cpm: Number,
  ctr: Number,
  cpc: Number,

  createdAt: Date,

  // Index
  index: { storeId: 1, metaId: 1, date: 1 }  // unique
}
```

### Widget

```js
{
  _id: ObjectId,
  storeId: ObjectId,
  pageId: String,                   // 'home' | 'dashboard' | 'cashflow' | etc.

  type: String,                     // 'kpi' | 'table' | 'chart' | 'funnel' | 'donut' | 'text'
  title: String,

  config: {
    // KPI
    metric: String,                 // 'revenue' | 'roas' | etc.

    // Table
    columns: [String],
    filters: Object,
    limit: Number,

    // Chart
    xAxis: String,                  // 'date' | 'week'
    series: [String],

    // Funnel
    steps: [String],

    // Donut
    groupBy: String,
  },

  position: Number,                 // orden

  createdAt: Date,
  updatedAt: Date,
}
```

### Product

```js
{
  _id: ObjectId,
  storeId: ObjectId,
  tnProductId: String,

  nombre: String,
  precio: Number,

  // Stock
  stock: Number,
  stockMinimo: Number,
  stockAlerta: Boolean,

  // Variantes
  variantes: [{
    tnVariantId: String,
    nombre: String,
    precio: Number,
    stock: Number,
  }],

  // Costo
  costoUnitario: Number,            // from ProductCost
  costoEmpaque: Number,

  // Márgenes
  margenBruto: Number,              // precio - costoUnitario
  margenBrutoPct: Number,
  margenNeto: Number,               // después de costos + comisiones (simplificado)

  // Ventas
  ventas30dias: Number,             // unidades vendidas
  velocity: Number,                 // unidades por día
  diasDeStock: Number,              // stock / velocity
  ultimaVenta: Date,

  // Categoría
  categoria: String,

  // Imagen
  imagenUrl: String,

  createdAt: Date,
  updatedAt: Date,

  // Index
  index: { storeId: 1, tnProductId: 1 }  // unique
}
```

### Alert

```js
{
  _id: ObjectId,
  storeId: ObjectId,

  tipo: String,                     // 'negative_margin' | 'low_stock' | 'roas_drop' | 'high_frequency' | etc.
  titulo: String,
  descripcion: String,

  metricas: Object,                 // datos relevantes (producto, valor, threshold, etc.)

  severidad: String,                // 'critical' | 'warning' | 'info'

  fechaDetectada: Date,
  estado: String,                   // 'activa' | 'resuelta' | 'ignorada'

  actions: [{
    titulo: String,
    descripcion: String,
    link: String,                   // URL a sección relevante
  }],

  createdAt: Date,
  updatedAt: Date,
}
```

---

## Archivos a copiar del proyecto existente

| Archivo fuente | Destino | Modificaciones |
|---------------|---------|---------------|
| `tiendanube-modules-manager/backend/src/services/tiendanubeAPI.js` | `ecom-analytics/backend/src/services/tiendanubeAPI.js` | Ninguna — copiar literal |
| `tiendanube-modules-manager/backend/src/middleware/errorHandler.js` | Misma ruta | Ninguna |
| `tiendanube-modules-manager/backend/src/middleware/auth.js` | Misma ruta | Agregar storeContext middleware |
| `tiendanube-modules-manager/backend/src/utils/logger.js` | Misma ruta | Ninguna |
| `tiendanube-modules-manager/backend/src/utils/LRUMap.js` | Misma ruta | Ninguna |
| `tiendanube-modules-manager/backend/src/config/environment.js` | Misma ruta | Agregar vars de Meta/Claude/Cron |
| `tiendanube-modules-manager/backend/src/config/database.js` | Misma ruta | Ninguna |
| `tiendanube-modules-manager/backend/src/controllers/authController.js` | Misma ruta | Agregar OAuth Meta |
| `tiendanube-modules-manager/Dockerfile` | Misma ruta | Ninguna |
| `tiendanube-modules-manager/railway.json` | Misma ruta | Ninguna |
| `tiendanube-modules-manager/frontend/src/services/api.js` | Misma ruta | Ninguna |
| `tiendanube-modules-manager/frontend/src/store/authSlice.js` | Misma ruta | Adaptar para stores múltiples |
| `tiendanube-modules-manager/frontend/src/hooks/useAuth.js` | Misma ruta | Ninguna |

---

## Sprint Plan (11 sprints)

### Sprint 0: Setup (1-2 días)
Crear repo, copiar archivos base, structure monorepo, deploy hello world a Railway, verificar MongoDB Atlas connection, setup environment variables.

**Verificación**: `npm run dev` → frontend en localhost:5173, backend en localhost:3000/health → 200 OK

---

### Sprint 1: Core Sync + Home (3-5 días)
- Modelos: Order, Product, DailyMetric, CashflowEntry, Customer
- Jobs: syncAllOrders, syncAllProducts, syncAllCustomers
- calculators service con fórmulas de ROAS, CPA, Net Revenue, NC/RC
- Frontend: Home page con store cards (métricas hardcoded por ahora)
- Settings page stub para elegir 5 metrics de Home

**Verificación**: Conectar una tienda TN → forzar sync manual → ver órdenes en DB → Home muestra cards con datos

---

### Sprint 2: Dashboard completo + Net Revenue (3-5 días)
- Dashboard full: 8 KPI cards top + todas las secciones (Tienda, NC/RC, Marketing Mix, Costos, Últimas Ventas, Devoluciones)
- Cálculo de totalNeto por orden (fórmula completa con comisiones, impuestos, fees)
- Order detail modal con desglose de costos
- recalculateMetrics job con NC/RC logic
- DailyMetric con todos los campos derivados

**Verificación**: Dashboard muestra KPIs correctos, order detail modal de ejemplo, Net Revenue = Revenue - costos

---

### Sprint 3: Meta Ads OAuth + Meta Pixel module (3-5 días)
- metaAPI.js service (OAuth 2.0 flow, long-lived token)
- MetaCampaign, MetaDailyInsight modelos
- syncMetaInsights job
- Meta Pixel page: tabla de campañas expandible, metric selector modal
- Integration de datos TN + Meta en DailyMetric (ROAS, CPA cálculos)

**Verificación**: Conectar Meta Ads → sincronizar insights → Meta Pixel page muestra campañas con spend + ROAS

---

### Sprint 4: Cashflow module (2-3 días)
- CashflowEntry model poblado por syncAllOrders
- Cashflow page: KPI cards, weekly chart (ventas vs pagos recibidos vs pendientes)
- Distribución donut (Mercado Libre vs Mercado Pago)
- Tabla de pagos programados con drill-down por semana
- Date picker con opciones forward-looking (próximas 2-8 semanas)

**Verificación**: Cashflow page muestra chart, tabla tiene datos correctos, drill-down funciona

---

### Sprint 5: Costos + P&L (3-4 días)
- ProductCost model
- Costos page: 5 categorías configurables (productos, comisiones plataforma, comisiones pago, envíos, adicionales)
- CSV upload para COGS
- P&L summary: revenue - todos los costos = profit, profit margin %
- Break-even calculator

**Verificación**: Cargar costos por CSV → P&L actualiza → profit margin % es correcto

---

### Sprint 6: Productos + Per-product simulation (3-4 días)
- Product page: tabla con stock, velocity, últimas ventas
- Click en producto → Profitability Profile modal
- Per-product simulator (sliders precio, COGS, envío)
- Stock alerts (bajo, crítico, dead stock)

**Verificación**: Click en producto → simulator funciona, margen recalcula con sliders

---

### Sprint 7: Clientes + Cohorts (3-4 días)
- syncAllCustomers con RFM + LTV + esClienteNuevo flag
- Customers page: cohort table, RFM matrix, LTV chart
- Customer segments (new, repeat, whales)

**Verificación**: Customers page muestra cohorts, RFM matrix, LTV trends

---

### Sprint 8: Creativos expandido (2-3 días)
- Auto-classification cron (basado en ROAS + CPA vs promedio)
- Creativos page: grid con clasificación A-E, thumbnails de Meta
- Per-ad funnel, campaign results table, ad results table

**Verificación**: Creativos page muestra ads clasificados, colores A-E correctos, thumbnails cargan

---

### Sprint 9: Contenido + Competencia + AI (3-4 días)
- TopicMap, LanguageBank páginas (keep v1)
- Competencia page: cards con tabs de precios/ofertas/creativos
- Claude API integration (Layer 1: analysis button) → generar insights por sección → guardar como Report
- Claude API Layer 2 (chat): definir tools, test que Claude puede ejecutar queries

**Verificación**: Dashboard → "Generar análisis" → Claude retorna texto, guardable como Report. Chat funciona con tools

---

### Sprint 10: Simulador + Widget system (3-4 días)
- Simulador general: sliders CPM/CTR/CVR/AOV/Budget → ROAS output
- Widget system: crear widgets, configurar Home metrics, configurable dashboard per store
- Home metric selector: user elige 5 metrics, se guardan en Store.metricasHome, Home actualiza

**Verificación**: Home metric selector funciona, simulador sliders dan ROAS output correcto, widgets guardables

---

### Sprint 11: Layer 3 Alerts + Settings + Polish (3-4 días)
- Cron diagnostics: detectar problemas, mandar a Claude, guardar Alerts
- Home: alert badges en cards con contador de alertas
- Settings page: cotización dólar, tasaIBB, comisiones config, integration status, **objetivos/benchmarks panel**
- Capa de análisis contextual: HealthIndicator + DeviationBadge + InsightBar en cada sección
- Breakeven automático calculado desde costos configurados
- Polish: validaciones, error handling, performance

**Verificación**: Crear alerta manual → aparece en Home badge, Settings de store funciona, todo tiene validaciones

---

## Verificación final (post-Sprint 11)

1. **Home**: 5+ tiendas con cards mostrando métricas configuradas, alerts funcionales
2. **Dashboard**: Todos los KPIs, NC/RC, últimas ventas con modal detalle, profit margin % correcto
3. **Cashflow**: Chart semanal + tabla + drill-down, fecha pago forecast
4. **Meta Pixel**: Campañas expandibles, metric selector, ad results table
5. **Costos**: 5 categorías configurables, P&L resumen, break-even
6. **Productos**: Top sellers, dead stock, per-product simulator
7. **Clientes**: Cohorts, RFM, LTV
8. **Creativos**: A-E auto-classification, per-ad funnel
9. **AI**: Analysis button genera reportes, chat funciona con tools, alerts automáticas
10. **Settings**: Cotización dólar, impuestos, comisiones, integration status, **objetivos/benchmarks con breakeven automático**
11. **Exportable**: Reports PDF, CSV tables

---

## Consideraciones técnicas

### Gestión del 512MB
- TTL en SyncLog (30 días)
- Cleanup job: borrar Orders >12 meses (mantener DailyMetric como resumen)
- No guardar imágenes en BD, solo URLs
- `.lean()` en queries read-only
- Índices correctos para evitar slow queries

### Performance
- Caching en frontend (Redux state per store)
- Lazy load de charts en tablas grandes
- Paginación en Últimas Ventas (50 por página)
- Agregaciones en MongoDB para históricos (no traer 30,000 órdenes al frontend)

### Seguridad
- storeContext middleware en TODAS las rutas (no exponer datos de otras tiendas)
- Validar JWT en cada request
- Rate limiting en endpoints de sync (evitar DoS)
- CORS configurado para Railway

### Cron jobs reliability
- node-cron en un solo instancia (Railway hobby tier)
- Logging en SyncLog de cada ejecución
- Retry logic en caso de failure (reintentar 3x)
- Alertar vía email si un job falla consistentemente

---

## NOTAS DE DESARROLLO

### Prioridades
1. **Rentabilidad real** es lo diferencial: totalNeto, True ROAS, margen por orden
2. **Cashflow** es crítico para LATAM con cuotas: Mercado Pago escalonado
3. **NC vs RC** permite evaluar escalamiento vs re-impact
4. **AI Diagnostics** (Layer 3) ahorra horas de análisis manual

### Decisiones de diseño
- Home muestra solo resumen (5 metrics) → no saturar al usuario
- Settings centralizado en /store/{storeId}/settings (no settings globales)
- Dates siempre en ARS/local timezone (no UTC en UI)
- Meta spend siempre en ARS (USD × cotización) para comparar con revenue

### Cambios desde v1
- ✅ TWO-LEVEL navigation (Home + per-store)
- ✅ Widget system para configurabilidad
- ✅ Cashflow module con forecast
- ✅ Meta Pixel ampliado con video metrics + selector configurable
- ✅ NC/RC como primer nivel de segmentación
- ✅ AI en 3 capas (analysis, chat, alerts)
- ✅ Costos: 5 categorías configurables
- ✅ Competencia con AI analysis
- ✅ Per-product simulation vs simulator general
- ✅ Auto-classification ABCDE en creativos

---

*Versión 2 — Marzo 2026*
*Documento definitivo de referencia para construcción de ecom-analytics con visión Lucas (Agency + Deep Analytics + Rentabilidad Real)*
