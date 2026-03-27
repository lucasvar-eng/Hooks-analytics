# Gap Analysis: Escalafy vs ecom-analytics
## Qué tiene Escalafy y qué nos falta sumar

**Fuentes:** análisis de texto (analisis-escalafy-completo.md) + revisión completa de screenshots del dashboard real

**Leyenda:**
- ✅ Ya está en nuestro plan (PLAN-ARQUITECTURA.md)
- ⚠️ Está parcialmente / hay una versión básica
- ❌ No está — hay que sumarlo

---

## 1. MÉTRICAS GLOBALES (Top KPIs del Dashboard)

| Métrica | Lógica | Estado |
|---|---|---|
| **Ordenes > $0** | Órdenes que efectivamente generaron ingreso neto positivo (filtra órdenes a pérdida) | ❌ No está — calculamos ordenes totales sin este filtro |
| **Ordenes totales** | Total sin filtro | ✅ Está |
| **Revenue** | Ingreso bruto total | ✅ Está |
| **Gross Revenue** | Mismo que revenue bruto (etiquetado explícitamente) | ⚠️ Tenemos revenue pero no la distinción gross vs net |
| **Net Revenue** | Revenue − comisiones de pago − fees de plataforma − impuestos | ❌ No está — falta descontar todos los costos fijos de la transacción |
| **Ad Spend** | Gasto publicitario total (Meta + Google + TikTok) | ⚠️ Solo tenemos Meta |
| **Profit** | Net Revenue − costo de productos − costo de envío − costos adicionales | ⚠️ Hay P&L básico pero sin todos los componentes |
| **Profit Margin %** | Profit / Revenue × 100 | ⚠️ No está como KPI en tiempo real |
| **Profit %** | Profit / Gross Revenue × 100 (variante en sección Tienda) | ❌ No está |
| **ROAS** | Revenue / Ad Spend (estándar) | ✅ Está |
| **True ROAS** | Net Revenue (o Margen) / Ad Spend | ❌ No está |

---

## 2. MÉTRICAS DE RENTABILIDAD POR ORDEN (BLOQUE CRÍTICO)

El modal de detalle por orden de Escalafy muestra el desglose exacto. Esta es la **fórmula real** por pedido:

```
Total Orden (Gross Revenue)              $94.0K
  − Comisiones de Pago                   −$3.9K    ← % variable por tarjeta/banco
  − Impuestos (IBB)                      −$587.50  ← Ingresos Brutos (varía por provincia)
  − Comisiones de Cuotas                 −$0.00    ← SEPARADO, solo aplica si hay cuotas
  − Costo de Envío                       −$6.5K    ← Real por orden
  − Costo de Productos                   −$16.5K   ← COGS del SKU
  − Fee de Plataforma (Fee Shopify)      −$940.00  ← % que cobra la plataforma
= Neto (Total Neto)                      $65.6K    ← Lo que realmente queda
```

| Componente | Estado |
|---|---|
| Comisiones de Pago (% por tarjeta/banco) | ❌ No está |
| **Impuestos IBB (Ingresos Brutos)** | ❌ No está — es un costo LATAM específico que se nos escapó completamente |
| **Comisiones de Cuotas** (separado de comisión base) | ❌ No está — Escalafy lo muestra como línea aparte |
| Costo de Envío real por orden | ⚠️ Tenemos el campo en Order pero no lo sumamos al P&L |
| Costo de Productos (COGS) | ✅ Tenemos ProductCost |
| **Fee de Plataforma** (Fee Shopify / TN por transacción) | ❌ No está — es un % que cobra la plataforma por cada venta |
| **Total Neto** (resultado final por orden) | ❌ No está calculado ni guardado por orden |

---

## 3. MÉTRICAS DE NUEVOS VS RECURRENTES (NC / RC) — BLOQUE ENTERO FALTANTE

Escalafy segmenta TODAS las métricas en tiempo real entre **NC (Nuevos Clientes)** y **RC (Clientes Recurrentes)**. Esto no lo tenemos en absoluto.

### Métricas NC (New Customers / Nuevos Clientes):

| Métrica | Fórmula | Estado |
|---|---|---|
| **NC %** | Órdenes de clientes nuevos / Órdenes totales | ❌ No está |
| **NC Ordenes** | Cantidad de órdenes de clientes que compran por primera vez | ❌ No está |
| **NC Revenue** | Revenue generado por clientes nuevos | ❌ No está |
| **NC CPA** | Ad Spend / NC Ordenes | ❌ No está |
| **NC True CPA** | Ad Spend / NC Ordenes, calculado sobre margen neto | ❌ No está |
| **NC ROAS** | NC Revenue / Ad Spend | ❌ No está |
| **NC True ROAS** | Margen neto de NC / Ad Spend | ❌ No está |

### Métricas RC (Returning Customers / Clientes Recurrentes):

| Métrica | Fórmula | Estado |
|---|---|---|
| **RC %** | Órdenes de clientes recurrentes / Órdenes totales | ❌ No está |
| **RC Ordenes** | Cantidad de órdenes de clientes que repiten compra | ❌ No está |
| **RC Revenue** | Revenue generado por clientes recurrentes | ❌ No está |

> **Por qué importa:** NC vs RC es crítico para evaluar si los ads traen clientes nuevos o solo re-impactan a los existentes. Un ROAS de Meta alto con NC% bajo significa que estás pagando para que tus clientes actuales te compren de vuelta — no estás escalando.

---

## 4. MÉTRICAS DE AOV REFINADAS

| Métrica | Fórmula | Estado |
|---|---|---|
| **AOV** (bruto) | Revenue / Órdenes | ✅ Está |
| **AOV Neto** | Net Revenue / Órdenes | ❌ No está — el AOV real después de descontar fees |
| **Net AOV** por canal | Net Revenue del canal / Órdenes del canal | ❌ No está |

---

## 5. MÉTRICAS DE CPA REFINADAS

| Métrica | Fórmula | Estado |
|---|---|---|
| **CPA** (estándar) | Ad Spend / Órdenes totales | ✅ Está |
| **True CPA** | Ad Spend / Órdenes con margen positivo (>$0) | ❌ No está |
| **NC CPA** | Ad Spend / NC Ordenes | ❌ No está |
| **NC True CPA** | Ad Spend / NC Ordenes (sobre margen) | ❌ No está |

---

## 6. MÉTRICAS DE PERFORMANCE PUBLICITARIO

| Métrica | Fórmula | Estado |
|---|---|---|
| **ROAS estándar** | Revenue / Ad Spend | ✅ Está |
| **True ROAS** global | Net Revenue / Ad Spend total | ❌ No está |
| **ROAS por canal** | Revenue del canal / Ad Spend del canal | ⚠️ Solo tenemos Meta |
| **True ROAS por canal** | Net Revenue del canal / Ad Spend del canal | ❌ No está |
| **NC ROAS** | NC Revenue / Ad Spend | ❌ No está |
| **NC True ROAS** | Margen neto NC / Ad Spend | ❌ No está |
| **CPC** | Ad Spend / Clicks | ✅ Está en Meta |
| **CPM** | (Ad Spend / Impresiones) × 1000 | ✅ Está |
| **CTR** | Clicks / Impresiones | ✅ Está |

---

## 7. MÓDULO CASHFLOW — COMPLETO (NUEVO)

Escalafy tiene una sección entera de **Cashflow** en el sidebar (app.escalafy.com/cashflow). Es uno de los diferenciales más fuertes de la plataforma. Nosotros no tenemos NADA de esto.

### 7.1 KPIs principales del Cashflow

| Métrica | Lógica | Estado |
|---|---|---|
| **Ventas** | Total de ventas brutas en el período | ⚠️ Tenemos revenue pero no en contexto de cashflow |
| **Liquidable Ventas** | Monto que efectivamente se va a cobrar (ventas − comisiones de pago) | ❌ No está |
| **Comisiones de Pago** | Total de comisiones de pasarelas en el período | ❌ No está como KPI agregado |
| **Comisiones %** | Comisiones de Pago / Ventas × 100 (ej: 21.89%) | ❌ No está |
| **Pagos Pendientes** | Dinero vendido pero AÚN NO acreditado (en tránsito por cuotas o plazos) | ❌ No está |
| **Pagos Recibidos** | Dinero que YA entró a la cuenta bancaria | ❌ No está |

### 7.2 Gráfico de Cashflow semanal

Gráfico de barras agrupado por semana con 3 series:
- **Ventas** (rojo/rosa) — lo que se vendió
- **Pagos Recibidos** (azul) — lo que efectivamente se cobró
- **Pagos Pendientes** (naranja) — lo que falta cobrar

La diferencia entre las barras muestra el desfase real entre vender y cobrar. ❌ No tenemos nada similar.

### 7.3 Distribución de Pagos Pendientes

Gráfico donut que muestra la distribución del dinero pendiente por gateway:
- **Mercado Libre** (verde)
- **Mercado Pago** (celeste)

❌ No está.

### 7.4 Tabla de órdenes de cashflow

Tabla filtrable con columnas:

| Columna | Descripción | Estado |
|---|---|---|
| ID Orden | Identificador de la orden | ✅ Tenemos |
| Fecha Creación | Cuándo se hizo la venta | ✅ Tenemos |
| **Fecha Pago** | Cuándo se ESPERA que se acredite el dinero | ❌ No está — dato clave para cashflow |
| Estado | Pendiente / Paid | ⚠️ Tenemos status de orden pero no de acreditación |
| Total Orden | Monto bruto | ✅ Tenemos |
| **Liquidable** | Monto neto después de comisiones (lo que realmente entra) | ❌ No está |
| Origen | Shopify / Mercado Libre / TiendaNube | ⚠️ Tenemos storeId |
| **Gateway** | Pasarela de pago (Mercado Pago, etc.) con icono | ❌ No está como dato estructurado |
| **Cuotas** | Cantidad de cuotas (1, 3, 6, 12, etc.) | ❌ No está |

Filtros disponibles: por ID Orden, por Origen, por Gateway. ❌ No tenemos.

### 7.5 Drill-down semanal

Al hacer click en una semana del gráfico, se abre un detalle que muestra:
- **Liquidable Ventas** de esa semana
- **Pagos Recibidos** de esa semana
- **Pagos Pendientes** de esa semana
- Tabla "Pagos Programados" con todas las órdenes que tienen pago esperado en esa semana

Esto es fundamental para saber: "esta semana me entran $6M de liquidable pero solo cobré $2.9M — tengo $7.8M pendientes".

❌ No tenemos nada de esto.

### 7.6 Selector de rango de cashflow

El date picker del cashflow tiene rangos especiales:
- Últimas / Próximas 2 semanas
- Últimas / Próximas 3 semanas
- Últimas / Próximas 4 semanas
- Últimas / Próximas 6 semanas
- Últimas / Próximas 8 semanas

Esto permite ver **hacia el futuro** (próximas semanas), no solo historial. ❌ No tenemos.

---

## 8. MÓDULO META PIXEL — TRACKING DUAL (NUEVO)

Escalafy tiene un módulo completo "Meta Pixel" (app.escalafy.com/pixel/meta) que va mucho más allá de lo que teníamos documentado. El diferencial clave: **compara las métricas reportadas por Meta vs las métricas rastreadas por su propio pixel (Track IA)** en paralelo.

### 8.1 Tabla de campañas con tracking dual

Cada campaña muestra DOS columnas por métrica — la de Meta y la propia:

| Columna | Descripción | Estado |
|---|---|---|
| Status | Toggle ON/OFF para activar/pausar campaña **directamente** | ❌ No está — nosotros solo leemos |
| Nombre Campaña | Nombre de la campaña de Meta | ✅ Tenemos |
| **Budget** | Presupuesto diario, **editable** con ícono de lápiz | ❌ No está — nosotros solo leemos |
| **Meta Spend** | Gasto reportado por Meta | ✅ Tenemos (MetaDailyInsight.spend) |
| **Escalafy Spend** | Gasto rastreado por pixel propio | ❌ No está — no tenemos pixel propio |
| **Meta Revenue** | Revenue que Meta atribuye a la campaña | ⚠️ Tenemos conversions pero no revenue por campaña |
| **Escalafy Revenue** | Revenue real rastreado por pixel propio | ❌ No está |
| **Meta Profit** | Profit calculado con datos de Meta | ❌ No está — no calculamos profit por campaña |
| **Escalafy Profit** | Profit calculado con datos reales de órdenes | ❌ No está |
| CPA | Costo por adquisición | ✅ Tenemos |
| ROAS | ROAS estándar | ✅ Tenemos |

La campaña es expandible (→) para ver adsets → ads individuales. ❌ No tenemos jerarquía navegable.

### 8.2 Selector de métricas configurables (Modal "Métricas")

Escalafy permite elegir qué columnas mostrar en la tabla de Meta. Las métricas disponibles están agrupadas en 4 categorías:

#### Métricas Básicas:

| Métrica | Estado |
|---|---|
| Meta Spend | ✅ Tenemos |
| Escalafy Spend (pixel propio) | ❌ No está |
| Impressions | ✅ Tenemos |
| Reach | ✅ Tenemos |
| **Frequency** | ❌ No la tenemos — Reach / Impressions |
| CPM | ✅ Tenemos |
| Meta CPM (reportado por Meta) | ⚠️ Es el que tenemos, pero no lo diferenciamos |
| CTR | ✅ Tenemos |
| CPC | ✅ Tenemos |

#### Métricas de Click:

| Métrica | Descripción | Estado |
|---|---|---|
| **Link Clicks** | Clicks en el link del anuncio (no todos los clicks) | ❌ No está — tenemos "clicks" genérico |
| **Clicks** (all) | Todos los clicks (incluye reacciones, comentarios, etc.) | ✅ Tenemos |
| **Cost per Link Click** (Escalafy) | CPC calculado sobre link clicks solamente | ❌ No está |
| **Meta Cost per Link Click** | CPC de link clicks reportado por Meta | ❌ No está |
| **Cost per Unique Link Click** (Escalafy) | CPC de clicks únicos | ❌ No está |
| **Meta Cost per Unique Link Click** | CPC de clicks únicos reportado por Meta | ❌ No está |
| **Unique Link Clicks** | Clicks únicos (personas, no clicks totales) | ❌ No está |
| **Unique CTR** | CTR calculado sobre personas únicas | ❌ No está |

#### Métricas de Video:

| Métrica | Descripción | Estado |
|---|---|---|
| **Video Plays** | Total de reproducciones | ❌ No está |
| **Avg Play Time** | Tiempo promedio de reproducción | ❌ No está |
| **Thruplays** | Reproducciones de 15+ segundos (o completas si <15s) | ❌ No está |
| **Scroll Stopper Rate** | % de personas que se detuvieron a ver el video (3s+) | ❌ No está — métrica clave para evaluar creativos |
| **Hold Rate** | % de retención del video | ❌ No está |
| **Video Plays at 100%** | Reproducciones completas | ❌ No está |
| **Video Plays at 95%** | Reproducciones al 95% | ❌ No está |
| **Video Plays at 75%** | Reproducciones al 75% | ❌ No está |
| **Video Plays at 50%** | Reproducciones al 50% | ❌ No está |

#### Métricas de Conversión:

| Métrica | Descripción | Estado |
|---|---|---|
| **Cost per Purchase** (Escalafy) | CPA calculado con tracking propio | ❌ No está |
| **Meta Cost per Purchase** | CPA reportado por Meta | ⚠️ Tenemos CPA pero no la diferenciación |
| ROAS | Revenue / Spend | ✅ Tenemos |
| **True ROAS** | Net Revenue / Spend | ❌ No está |
| **Net AOV** | AOV después de costos por conversión | ❌ No está |
| **Adds to Cart** | Eventos de agregar al carrito | ❌ No está — evento del funnel |
| **Cost per Add to Cart** | Costo por cada ATC | ❌ No está |
| **Checkouts Initiated** | Checkouts iniciados | ❌ No está — evento del funnel |

---

## 9. GESTIÓN DE COSTOS — PÁGINA DE CONFIGURACIÓN (NUEVO)

Escalafy tiene una página dedicada de configuración de costos (app.escalafy.com/costs) con 5 categorías expandibles:

| Categoría | Descripción | Estado |
|---|---|---|
| **Costos de productos** | COGS por SKU | ✅ Tenemos ProductCost |
| **Comisiones de plataforma** | % que cobra Shopify/TN/ML por transacción | ❌ No está — no tenemos configuración de esto |
| **Comisiones de pago** | Tabla de comisiones por pasarela (Mercado Pago, etc.) | ❌ No está |
| **Costos de Envíos** | Configuración de costos de envío por zona/operador | ❌ No está como tabla configurable |
| **Costos Adicionales** | Bucket para otros costos (seguros, embalaje extra, etc.) | ❌ No está |

Además tiene un botón: **"Solicitar llenar tu dashboard (Últimos 30 días)"** — esto recalcula retroactivamente todos los márgenes con los costos configurados. ❌ No tenemos esta funcionalidad de backfill.

---

## 10. TABLA DE CANALES DE MARKETING (vista comparativa)

Escalafy tiene una tabla que compara todos los canales en simultáneo:

| Columna | Estado |
|---|---|
| Canal (Meta / Mercado Libre / Google / TikTok) | ⚠️ Solo tenemos Meta |
| Ad Spend | ⚠️ Solo Meta |
| ROAS | ⚠️ Solo Meta |
| **True ROAS** | ❌ No está |
| Ordenes | ⚠️ Solo podemos filtrar por UTM, no por canal integrado |
| Revenue | ⚠️ Sin separación por canal de marketing |
| **Net Revenue** | ❌ No está |
| **True CPA** | ❌ No está |
| AOV | ⚠️ Solo global |
| **Net AOV** | ❌ No está |

---

## 11. SECCIÓN DE COSTOS AGREGADOS (en el Dashboard)

Escalafy muestra en el dashboard un bloque de costos con 3 KPIs:

| Métrica | Estado |
|---|---|
| **Costos de productos** (total período) | ⚠️ Existe por SKU pero no como KPI de resumen en dashboard |
| **Costos de envío** (total período) | ❌ No está como KPI agregado |
| **Costos adicionales** (bucket para fees, impuestos, comisiones) | ❌ No está |

---

## 12. TABLA DE ÚLTIMAS VENTAS

| Feature | Estado |
|---|---|
| Tabla de órdenes recientes | ✅ Tenemos modelo Order |
| Columna **Total Neto** por orden | ❌ No calculamos el neto por orden |
| Columna **Origen** del canal (ML / TN / Shopify) | ⚠️ Tenemos storeId pero no etiqueta de canal |
| Modal de detalle por orden con desglose de costos | ❌ No está |

---

## 13. CONFIGURACIÓN LATAM-ESPECÍFICA

| Feature | Descripción | Estado |
|---|---|---|
| **Cotización Dólar** | Configuración del tipo de cambio ARS/USD para convertir métricas. Sección propia en el sidebar. | ❌ No está — crítico para agencias argentinas con gastos en USD (Meta) |
| **Impuestos IBB** | Ingresos Brutos Buenos Aires — costo por transacción variable por provincia | ❌ No está |
| **Comisiones de Mercado Pago** | Variables por: tipo de tarjeta, banco, cuotas, promociones | ❌ No está |
| **Comisiones de Cuotas** | Costo financiero separado de la comisión base (ej: 12 cuotas tiene un costo adicional) | ❌ No está |

---

## 14. DEVOLUCIONES

| Métrica | Estado |
|---|---|
| **Devoluciones** (count en el período) | ❌ No está como KPI del dashboard |
| Impacto de devoluciones en margen | ❌ No está |

---

## 15. RESUMEN FINAL: PRIORIDADES ACTUALIZADAS

### 🔴 Alta prioridad — Diferenciales financieros reales

| # | Feature | Por qué |
|---|---|---|
| 1 | **Total Neto por orden** (fórmula completa con 6 líneas de deducción) | Sin esto NO tenemos rentabilidad real |
| 2 | **Comisiones de Pago** automáticas por tarjeta/banco | En Argentina es ~4-7% del total |
| 3 | **Impuestos IBB** | Puede ser 3-5% según provincia |
| 4 | **Fee de Plataforma** (Shopify/TN por transacción) | Otro 0.5-2% que se come el margen |
| 5 | **Comisiones de Cuotas** | Puede llegar a 20-35% del valor en 12 cuotas |
| 6 | **Cotización Dólar** | Meta cobra en USD, sin conversión el ROAS no tiene sentido |
| 7 | **True ROAS** global y por canal | El ROAS estándar miente |
| 8 | **NC % y RC %** | Saber si estás escalando o re-impactando |

### 🟡 Media prioridad — Completar el cuadro

| # | Feature | Por qué |
|---|---|---|
| 9 | **Módulo Cashflow completo** (Pagos Pendientes, Recibidos, Liquidable, por semana) | Fundamental para LATAM con cuotas |
| 10 | **Net Revenue** como KPI en tiempo real | |
| 11 | **AOV Neto** y **Net AOV** por canal | |
| 12 | **True CPA** y **NC CPA** | |
| 13 | **Tabla de canales de marketing** comparativa | |
| 14 | **Gestión de costos** — página dedicada con 5 categorías configurables | |
| 15 | **Métricas de video** (Scroll Stopper Rate, Hold Rate, Thruplays, percentiles) | Clave para evaluar creativos |
| 16 | **Ordenes > $0** como filtro | |

### 🟢 Baja prioridad / Fase 2

| # | Feature | Por qué |
|---|---|---|
| 17 | Tracking dual (Meta Spend vs Propio Spend) | Requiere pixel propio |
| 18 | Acciones sobre Meta Ads (toggle pausar/activar, editar budget) | Requiere `ads_management` scope |
| 19 | Métricas de click granulares (Link Clicks, Unique Clicks, Cost per Unique) | Nice to have |
| 20 | Checkouts Initiated / Adds to Cart como métricas de campaña | |
| 21 | Frequency (Impresiones / Reach) | |
| 22 | Integración MercadoLibre | |
| 23 | Pixel de atribución propio (Track IA) | Desarrollo pesado |
| 24 | Backfill de costos ("Solicitar llenar dashboard") | |

---

## 16. FÓRMULAS EXACTAS A IMPLEMENTAR

```js
// ───────────────────────────────────────────────
// TOTAL NETO POR ORDEN (el más importante)
// ───────────────────────────────────────────────
totalNeto = totalOrden
  - comisionesDePago          // % variable por tarjeta y banco (ej: 2.99% Visa 1 pago)
  - impuestosIBB              // % según provincia (ej: 3.5% CABA)
  - comisionesDeCuotas        // % adicional si hay cuotas (ej: 3 cuotas = 5%, 12 cuotas = 35%)
  - costoDeEnvio              // Real por orden (ya lo tenemos en Order)
  - costoDeProductos          // ProductCost.unitCost × qty + packagingCost
  - feeDePlataforma           // % que cobra Shopify/TN por transacción (ej: 0.5%-2%)

// ───────────────────────────────────────────────
// KPIs AGREGADOS DEL PERÍODO
// ───────────────────────────────────────────────
netRevenue = sum(totalNeto de todas las órdenes del período)
grossRevenue = sum(totalOrden de todas las órdenes del período)
profit = netRevenue - costosFijosProrrateados
profitMargin = profit / grossRevenue × 100

// ───────────────────────────────────────────────
// TRUE ROAS / TRUE CPA
// ───────────────────────────────────────────────
trueROAS = netRevenue / (adSpendTotal × cotizacionDolar)
trueCPA = (adSpendTotal × cotizacionDolar) / count(órdenes donde totalNeto > 0)

// ───────────────────────────────────────────────
// NC / RC (Nuevos vs Recurrentes)
// ───────────────────────────────────────────────
// Cliente "nuevo" = NO tiene órdenes anteriores en esa tienda
ncPct = count(órdenes de clientes nuevos) / count(órdenes totales) × 100
rcPct = 100 - ncPct
ncCPA = (adSpendTotal × cotizacionDolar) / count(órdenes NC)
ncROAS = sum(revenue de órdenes NC) / (adSpendTotal × cotizacionDolar)
ncTrueROAS = sum(totalNeto de órdenes NC) / (adSpendTotal × cotizacionDolar)

// ───────────────────────────────────────────────
// AOV REFINADOS
// ───────────────────────────────────────────────
aovNeto = netRevenue / count(órdenes > $0)
netAovPorCanal = netRevenueDelCanal / count(órdenes del canal)

// ───────────────────────────────────────────────
// CASHFLOW
// ───────────────────────────────────────────────
liquidableVentas = grossRevenue - totalComisionesDePago
comisionesPct = totalComisionesDePago / grossRevenue × 100
pagosPendientes = sum(liquidable de órdenes donde fechaPago > hoy)
pagosRecibidos = sum(liquidable de órdenes donde estado = 'paid')

// Para cada orden con cuotas:
// Venta $100K en 6 cuotas → 6 pagos de ($100K/6 - comisión) en fechas escalonadas
// fechaPago se calcula: fechaCreación + (númeroCuota × diasEntreCuotas)

// ───────────────────────────────────────────────
// COTIZACIÓN DÓLAR
// ───────────────────────────────────────────────
// Meta cobra en USD → convertir para comparar con revenue ARS
adSpendARS = adSpendUSD × cotizacionDolar
// Todos los ROAS y CPA que involucren ad spend deben usar adSpendARS
```

---

## 17. CAMPOS NUEVOS A AGREGAR AL MODELO DE DATOS

### Modelo `Order` — campos nuevos:

```js
comisionPago: Number,          // Monto de comisión de la pasarela
comisionCuotas: Number,        // Costo adicional por financiamiento en cuotas
impuestosIBB: Number,          // Monto del Ingresos Brutos aplicado
feePlataforma: Number,         // Fee de Shopify/TN por la transacción
totalNeto: Number,             // CALCULADO: total - todos los costos de transacción
liquidable: Number,            // Lo que se va a cobrar (total - comisiones)
esClienteNuevo: Boolean,       // True si es la primera orden de ese customer
cantidadCuotas: Number,        // 1, 3, 6, 12, etc.
fechaPago: Date,               // Cuándo se espera la acreditación
estadoPago: String,            // 'pendiente' | 'paid'
gateway: String,               // 'mercadopago' | 'stripe' | etc.
canal: String,                 // 'tiendanube' | 'mercadolibre' | 'shopify'
```

### Modelo `Store` — campos nuevos:

```js
cotizacionDolar: Number,       // Tipo de cambio ARS/USD (actualizable manualmente)
tasaIBB: Number,               // % de Ingresos Brutos según provincia
feePlataformaPct: Number,      // % que cobra la plataforma por transacción
comisionPagoConfig: [{         // Tabla de comisiones por medio de pago
  medioPago: String,           // 'visa', 'mastercard', 'amex', etc.
  cuotas: Number,              // 1, 3, 6, 12
  comisionBase: Number,        // % comisión base
  comisionCuotas: Number,      // % adicional por cuotas
}],
costosAdicionales: [{          // Bucket de costos adicionales
  nombre: String,
  monto: Number,
  tipo: String,                // 'fijo_mensual' | 'porcentaje_por_orden'
}],
```

### Nuevo modelo `CashflowEntry` (para tracking de pagos):

```js
{
  orderId: ObjectId,           // Referencia a la orden
  storeId: ObjectId,           // Referencia a la tienda
  fechaCreacion: Date,         // Fecha de la venta
  fechaPago: Date,             // Fecha esperada de acreditación
  estado: String,              // 'pendiente' | 'recibido'
  totalOrden: Number,          // Monto bruto
  liquidable: Number,          // Monto que se va a cobrar
  comision: Number,            // Comisión descontada
  gateway: String,             // Pasarela de pago
  cuotas: Number,              // Cantidad de cuotas
  numeroCuota: Number,         // Cuota N de M (para pagos escalonados)
}
```

---

*Actualizado: Marzo 2026 — Revisión final con TODAS las capturas del dashboard real de Escalafy (Dashboard, Cashflow, Meta Pixel, Gestión de Costos)*
