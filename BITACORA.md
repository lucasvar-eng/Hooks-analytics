# Bitácora — Hooks Analytics

Registro de cambios trabajados sobre la app y trabajo pendiente.
La bitácora se ordena de **arriba hacia abajo** por orden cronológico inverso (lo más reciente arriba).

---

## 2026-05-13 — Competencia: scraping URL + snapshot temporal + reorder sidebar

**Branch**: `codex/universal-dashboard-builder` (continúa)
**Tienda usada para validar**: Límite Deportes

### Trabajo hecho

Cierra los 2 features pendientes de Competencia + reorder de la sidebar.

**Feature 1 — Scraping de URL del competidor (sin dependencias externas)**:

- Nuevo `backend/src/services/competitorScrapeService.js`. Hace fetch del HTML con axios (User-Agent legítimo, timeout 15s, tolera certificados SSL inválidos vía agente con `rejectUnauthorized: false` — read-only sin credentials). Parsea con regex puro:
  - title, meta description, og:title, og:description, og:site_name
  - h1 / h2 / h3 (primeros)
  - Párrafos ricos (60-600 chars, hasta 8)
  - Buttons + CTAs (text de `<button>` y `<a class="btn|button|cta">`)
  - Precios visibles (regex `$\d{1,3}(?:[.,]\d{3})*`)
  - Lang attribute del `<html>`
  - Decodifica entidades HTML comunes (á, é, ñ, ¿, ¡, etc. + numéricas).
- Deriva 2 sugerencias automáticas con heurísticas (no AI):
  - `positioning` ← og:description o meta description corta
  - `mainOffer` ← primer H1 o primer párrafo grande
- Sin cheerio/puppeteer — ~250 líneas, 0 deps nuevas.

**Endpoints nuevos** en `competitorRoutes.js`:
- `POST /competitors/:id/scrape` — fetchea + parsea, devuelve `{ parsed, suggestions }` SIN aplicar nada.
- `POST /competitors/:id/scrape/apply?force=true` — aplica campos seleccionados. Por default solo escribe en campos vacíos, `force=true` sobrescribe.

**Feature 2 — Snapshot temporal + diff visual**:

- Nuevo modelo `CompetitorSnapshot.js`: copia histórica de los 11 campos cualitativos + `source` (analyze/scrape/update/manual) + `triggeredBy` + `capturedAt` con índice descendente.
- Nuevo `backend/src/services/competitorSnapshotService.js`:
  - `createSnapshot(competitorId, { source, userId })` — copia estado actual a un snapshot.
  - `listSnapshots(competitorId, limit)` — timeline descendente.
  - `getLatestDiff(competitorId)` — diff entre estado actual y último snapshot. Normaliza arrays + strings para comparar.
  - `diffSnapshotsByIds(competitorId, fromId, toId)`.
- `competitorController.analyze`, `update`, `applyScrape` crean snapshot ANTES de pisar — preserva el "before". `remove` borra snapshots asociados.
- Endpoints nuevos:
  - `GET /competitors/:id/snapshots` — timeline.
  - `GET /competitors/:id/diff` — qué cambió desde el último snapshot.

**Frontend — 2 modales + 1 componente + integración**:

- `CompetidorScrapeModal.jsx`: muestra resultados del scrape con checkboxes por campo, preview de "lo que se vio en el sitio" (título, meta, H1/H2, CTAs, precios, texto destacado). Default marca solo los campos vacíos; toggle "Sobreescribir campos que ya tengan valor" para forzar.
- `CompetidorHistoria.jsx`: timeline embebido en el detail modal. Destaca arriba el "cambió desde X" si hay changes pendientes vs último snapshot, después lista todos los snapshots con diff entre consecutivos (cajitas rojo/verde "Antes" / "Ahora").
- `CompetidorDetailModal.jsx`: sección nueva "Historia de cambios", botón "Scrapear sitio" en footer junto a "Re-analizar".
- `CompetidorCard.jsx`: botón "Scrapear" para competidores con URL + sin análisis (alternativa rápida a "Analizar con AI" que consume tokens).
- `Competencia.jsx`: 2 handlers nuevos (`handleScrape` + `handleApplyScrape`) + estado `scrapeState` para el modal.

**Reorder sidebar** (`StoreLayout.jsx`):
- Tienda movida de "General" a "Ventas" (queda con Productos y Clientes — las 3 vistas operativas de la tienda).
- General queda con solo Resumen.

**Validación runtime con dexter.com.ar real**:
- Click "Scrapear" en card → modal abre con loading state → 5 segundos después muestra:
  - Sugerencias: Posicionamiento ("Somos la mejor tienda deportiva del país...") + Oferta principal ("¡Bienvenido a Dexter!").
  - Datos crudos: title, meta description, H1, H2, CTAs (Mujer · Hombre · Categorías), precios ($219.999 · $159.999 · ...), texto destacado.
- Click "Aplicar 2 campos" → competidor actualizado, snapshot creado.
- Click en card → modal de detalle muestra los nuevos campos cargados + "Historia de cambios" con bloque "Cambió desde …" arriba (diff rojo→verde por campo) + timeline con "Scrape del sitio · primer snapshot".
- Build frontend clean.
- SSL inválido (Stock Center primer test) ya tolerado con `httpsAgent: insecureHttpsAgent`.

### Pendientes (actualiza backlog)

- [x] **Scraping URL competidor** — listo.
- [x] **Snapshot temporal + diff** — listo.
- [x] **Reorder sidebar (Tienda → Ventas)** — listo.
- [ ] **Auto-extracción de objeciones desde comments Meta Ads** → llena LanguageBank.
- [ ] **Alert en Resumen cuando un competidor cambia** (a partir del flag `hasPrevious + changes.length > 0` que ya devuelve `/diff`).
- [ ] **Endpoint detalle cliente** `/customers/:id/orders` para enriquecer modal de perfil.

---

## 2026-05-13 — Mover Topic Map + Lenguaje a Creativos

**Branch**: `codex/universal-dashboard-builder` (continúa)
**Tienda usada para validar**: Límite Deportes

### Trabajo hecho

Cierra la decisión tomada en sesión: TopicMap + LanguageBank tenían 0 entries en TODA la base (≠ Competencia que sí le ve valor). Los movemos a tabs/bloques dentro de Creativos (donde realmente se usan los hooks y los ángulos) y los sacamos del sidebar.

**Componentes nuevos** en `frontend/src/components/creativos/`:

- `HipotesisAngulos.jsx` — bloque embebido para registrar ángulos creativos que estás probando.
  - Form simplificado: nombre + status + stage + ángulo + hipótesis + nota performance. Reducido de 15 → 6 campos vs la página standalone original.
  - Grid de 3 cols con cards livianas (badges status/stage/ángulo + hipótesis + nota).
  - Empty state explicativo con ejemplo concreto (ángulo precio vs autoridad).
  - Consume `/api/stores/:id/topic-maps` (sin cambios backend).

- `HooksFrases.jsx` — banco de frases comerciales reutilizables.
  - 4 tipos: Hook · Objeción · Frase · Vocabulario (badges de color por tipo).
  - Form simplificado: tipo + texto + tags + response (solo objeciones). Reducido de 10 → 4 campos.
  - Filtros chip por tipo con conteos dinámicos.
  - **Click en una card copia el texto al portapapeles** (con feedback "✓ Copiado"). Si es objeción, copia "frase + Respuesta: …".
  - Empty state explicativo con ejemplos por tipo.
  - Consume `/api/stores/:id/language-bank` (sin cambios backend).

**Cambios en `Creativos.jsx`**: suma `HipotesisAngulos` y `HooksFrases` al `SortableLayout` existente, después de `AnglePerformanceTable`. Los 5 bloques quedan reordenables.

**Cambios en `StoreLayout.jsx`**:
- Saco `topic-map` y `language-bank` de `NAV_ITEMS` y sus íconos del map.
- Muevo Competencia de grupo "Contenido" a "Marketing" (queda junto a Meta Ads + Creativos).
- El grupo "Contenido" desaparece — todo lo creativo vive ahora en Marketing.

**Cambios en `App.jsx`**:
- Saco los imports de `TopicMap` y `LanguageBank` (las páginas standalone).
- Las routes `/topic-map` y `/language-bank` ahora son `<Navigate to="../creativos" replace />` para no romper bookmarks viejos.

**Archivos eliminados** (vacíos después de la migración):
- `frontend/src/pages/TopicMap.jsx` (367 líneas)
- `frontend/src/pages/LanguageBank.jsx` (342 líneas)

Los modelos, controllers, routes y services del backend (TopicMap, LanguageBank, contentStrategyService) siguen intactos — el contexto AI los sigue usando, los endpoints siguen respondiendo, y los componentes nuevos consumen los mismos endpoints.

**Validación en runtime** (Límite, seeds temporales):
- Sidebar limpio: Marketing ahora incluye Meta Ads · Creativos · Competencia. Topic Map y Lenguaje no aparecen.
- `/topic-map` y `/language-bank` redirigen a `/creativos`.
- Creativos renderiza con 5 bloques: KPIs · galería · performance por ángulo · hipótesis · hooks/frases.
- Empty states se muestran con CTA centrales cuando no hay data.
- Con 1 hipótesis seed: la card renderea con badges Borrador/Testing/autoridad + texto de hipótesis.
- Con 3 frases seed (hook/objeción/frase): filtros chip con conteos correctos, cada card muestra tipo, texto, tags y "click para copiar". Objeción muestra respuesta con borde verde lateral.
- Build frontend: clean, sin nuevos warnings.
- Seeds eliminados al cerrar — quedan empty states.

### Decisión de diseño clave

**Reducción agresiva del schema visible**: TopicMap tenía 15 campos cargables, LanguageBank tenía 10. Los nuevos componentes muestran 6 y 4 respectivamente. Los campos del schema completo (awareness, avatar, territory, symptom, objection, etc.) siguen existiendo en la DB pero se ocultan en el form para no fricción. Si se necesitan, se rescatan los archivos standalone del git history y se reactivan.

### Pendientes (actualiza backlog)

- [x] **Mover TopicMap + LanguageBank** — listo.
- [x] **Sacar bloque AI viejo** de TopicMap y LanguageBank — listo por consecuencia (las páginas standalone se eliminaron).
- [ ] **Scraping automático URL competidor**: aún pendiente.
- [ ] **Snapshot temporal competidor** + diff entre análisis.
- [ ] **Auto-extracción de objeciones desde comments Meta Ads** → llena LanguageBank automáticamente.
- [ ] **Endpoint detalle cliente** `/customers/:id/orders` para enriquecer modal de perfil.

---

## 2026-05-13 — Competencia (rediseño operativo)

**Branch**: `codex/universal-dashboard-builder` (continúa)
**Tienda usada para validar**: Límite Deportes (`69cadede3936709190d773b8`)

### Trabajo hecho

Aplicar el patrón Productos/Clientes/Resumen a Competencia. La página de 326 líneas pasó a 360 orquestando 7 componentes nuevos en `components/competencia/`. Reemplaza forms gigantes + grid de cards chicas por un layout enfocado en lectura rápida + acciones.

**Decisión de diseño**: simplificar drásticamente. Vino con feedback explícito de Lucas — "está confuso con tantos colores chips y contenedores, hacelo más grande y simple". Pasamos de 4 cards por fila con chips coloridos por categoría a 2 cards grandes con paleta unificada (solo verde/amber/gris funcionales).

**Estructura nueva** (todo dentro de SortableLayout `hooks-competencia-layout-${storeId}`):

1. `CompetenciaMetricsRow` — 4 de 8 métricas configurables. Defaults: Competidores cargados · Analizados con AI · Oportunidades pendientes · Último análisis. Tones automáticos (warn si < 50% analizados).
2. `FiltersBar` (inline en page) — chips por estado (Todos · Analizados · Pendientes · Sin URL · Con oportunidades) + búsqueda por nombre/URL/ángulo/oferta + botones "Comparar (N)" y "+ Agregar competidor".
3. `CompetidorCard` × N — grid de 2 columnas. Card grande con: header (avatar + nombre + URL + badge status), oferta principal destacada, 3 columnas con avatar/awareness/posicionamiento, lista bullets de ángulos+territorios+objeciones, top 3 oportunidades con borde lateral verde, footer con tiempo + acciones (Comparar/Ver detalle/Analizar/Editar según estado).
4. `ActionCardsCompetencia` — 2 cards: **Sin análisis** (top 5 pendientes con CTA Analizar/Editar) + **Oportunidades hot** (top 6 extraídas del markdown de todos los análisis).

**Modales nuevos**:

- `AddCompetidorModal` — form simplificado: nombre + URL + notas obligatorios. Sección "Campos avanzados" colapsable con posicionamiento, awareness, avatar, oferta, ángulos/territorios/objeciones manuales. Filosofía: AI completa cuando se ejecuta "Analizar", el form pesado es opt-in.
- `CompetidorDetailModal` — vista expandida: datos cargados en cards (avatar/awareness/posicionamiento/oferta), tags de ángulos/territorios/objeciones (objeciones en amber), análisis AI markdown completo, sección "Oportunidades focalizadas" con botón para generar via endpoint `/opportunities`. Footer con Eliminar / Re-analizar / Editar.
- `CompetidorCompareModal` — tabla de comparación lado a lado (2-3 competidores) con filas: URL, Oferta principal, Posicionamiento, Avatar, Awareness target, Ángulos, Territorios, Objeciones. Permite quitar de comparación o saltar al detalle.
- `GlossaryModalCompetencia` — explica flujo de análisis (4 pasos), campos del competidor (URL, posicionamiento, oferta, avatar, awareness con sus 5 niveles Schwartz), framework copy (ángulos vs territorios vs objeciones) y outputs de la IA.

**Empty state nuevo**: cuando no hay competidores cargados, card centrada "No hay competidores cargados" con CTA "+ Agregar primer competidor" en verde grande.

**Backend sin cambios**: los 6 endpoints existentes (`list`, `create`, `update`, `delete`, `analyze`, `opportunities`) + el `/overview` ya cubrían todo lo necesario. Sin migraciones.

**Validación en runtime** (Límite, seeds temporales):
- Empty state: render correcto, CTA funciona, abre modal "Agregar".
- Modal de agregar: form básico se ve limpio, "Campos avanzados" colapsable funciona.
- Con seeds (Stock Center analyzed + Dribbling pending + Sporting sin URL): los 3 estados renderean correctamente con badges y CTAs apropiados (Analizar / Editar / Comparar / Ver detalle).
- Modal de detalle: markdown de análisis AI se renderiza con headings, bullets y código. Footer con acciones funciona.
- Filtros chip con conteos: 5 chips dinámicos según estado.
- Build frontend: clean.
- Seeds eliminados al cerrar — la página queda en empty state listo para que el equipo cargue competidores reales.

**Bocetos**: `docs/bocetos/competencia-v1.html` (estructura inicial) + `competencia-v2.html` (simplificación post-feedback de Lucas).

### Pendientes (actualiza backlog)

- [x] **Competencia** — rediseño listo.
- [ ] **TopicMap + LanguageBank**: mover de la sidebar a tabs/cards dentro de Creativos y Meta. Decisión tomada con Lucas — la captura manual de fragmentos abstractos no funciona como pestaña standalone (0 entries globales en 30+ tiendas), vive mejor donde se usan.
- [ ] **Scraping automático URL competidor**: pegás dominio → fetch HTML + AI extrae headlines/oferta sin que el usuario complete el form. Hoy el flujo es manual + "Analizar con AI" usa el endpoint existente que toma los datos cargados.
- [ ] **Snapshot temporal de competidores**: cada análisis guarda versión histórica + diff entre snapshots para detectar cambios ("Atléticos cambió su oferta el 02/05").
- [ ] **Alerts en Resumen** cuando un competidor analizado cambia su oferta o lanza algo nuevo.
- [ ] **Endpoint detalle cliente** (`/customers/:id/orders`) — pendiente desde el rediseño de Clientes para enriquecer el modal de perfil con histórico de compras concreto.

---

## 2026-05-13 — Clientes (rediseño operativo)

**Branch**: `codex/universal-dashboard-builder` (continúa)
**Tienda usada para validar**: Límite Deportes (`69cadede3936709190d773b8`)

### Trabajo hecho

Cierro la 3ra pantalla grande del backlog (Clientes). La página pasó de 248 líneas + tabs (Lista / Cohorts) a 187 líneas orquestando 10 componentes nuevos en `components/clientes/`. Aplica el patrón establecido en Productos: tabla principal arriba con filtros chip + sort + scroll vertical interno + KPIs configurables + SortableLayout + drill-down modal.

**Estructura nueva** (todo dentro de SortableLayout `hooks-clientes-layout-${storeId}`):
1. `ClientesMetricsRow` — 4 de 10 métricas configurables (Clientes totales · VIP · En riesgo · Tasa recompra son los defaults). Catálogo nuevo `clientesMetricsCatalog.js` con tones automáticos.
2. `SegmentMap` — barra apilada horizontal con toggle Cantidad/Facturación + grid 4×2 con los 8 segmentos RFM. Click filtra la tabla.
3. `ClientesTable` — tabla con 8 chips por segmento (con dot de color + count), búsqueda, sort por columna, scroll vertical 720px, paginación cliente. 10 columnas: Cliente · Compras · Gasto total · Ticket promedio · Última compra · Días sin comprar · Score RFM · Segmento · Mes de alta · Demora 2da.
4. `ActionCards` (2 cols): **En riesgo recuperar** (top 5 con más gasto del segmento at_risk) + **Mejores premiar** (top 5 champions). El "unlock" diferencial de la página.
5. `ParetoCard` — concentración de facturación calculada en cliente (top 1/5/10/20/50/100%) con 2 insights destacados: regla 80/20 y Top 10% vs Dormidos.
6. `CohortHeatmap` — rediseño con buckets de color (gris → azul → verde según %). Filtra cohorts con muestra < 3.
7. `QualityCards` (inline en page) — 3 checks: sin email real / órdenes sin cliente / cohorts débiles.

**Modales nuevos**:
- `CustomerProfileModal` — drill-down al click en fila o action card. Muestra resumen (compras, gasto, ticket, recencia, fechas, demora 2da, tasa de recompra del cliente) + 3 tiles RFM coloreados por score + acción sugerida según segmento.
- `GlossaryModal` — botón "Glosario" arriba a la derecha + tooltip ⓘ en cada KPI/columna/segmento. Explica métricas, score RFM, los 8 segmentos (con acción concreta por cada uno), cohortes y Pareto.

**Catálogo de segmentos único** (`segmentsCatalog.js`): label en español, color, badge class, descripción corta, glossary largo y acción de marketing. Cualquier componente que muestra un segmento importa desde acá. Mapeo de IDs del backend (`champions`, `loyal`, `at_risk`, `lost`, `hibernating`, `new`, `promising`, `potential`) → labels español (Mejores, Fieles, En riesgo, Perdidos, Dormidos, Nuevos, Prometedores, Potenciales).

**Cambios clave en el backend**: ninguno. Endpoint `/customers?limit=5000` ya retornaba todos los datos necesarios (4.491 clientes de Límite en 1.26s · 2.6MB). Toda la lógica de filtrado, sort, búsqueda, derivación de top N, cálculo de Pareto y métricas globales corre 100% en cliente.

**Validación end-to-end en runtime** (Límite, 4.491 clientes):
- KPIs reales: Mejores+Fieles 313 ($60.3M), En riesgo 178 ($27M), Tasa de recompra 11,5% (en amber automático por estar bajo el 15%).
- Pareto: Top 20% → 44% de la facturación (no llega a 80/20 puro). Top 10% $115,6M vs Dormidos $143,3M — los mejores te dan **menos** que los dormidos en Límite. La copy reactiva correcta ("Los 449 mejores te dan menos que los 1.972 dormidos").
- Cohortes M1 = 1-6% (muy baja, coherente con tasa recompra 11,5%).
- Quality: 0 sin email · 0 órdenes huérfanas · 1 cohort débil (2023-04).
- Click en card del segmento Mejores → tabla filtra a 219 filas con scores 5-5-5/4-5-5 (Ana Jorgelina Dip 8 compras $824k, Emiliano Iautaro Ramirez 2 compras $811k, etc).
- Modal de cliente (Soledad Suarez): Score 2-5-5 → R amber, F+M emerald. Acción sugerida del segmento En riesgo embebida.

**Bocetos**: `docs/bocetos/clientes-v1.html` + `clientes-v2.html` (HTML standalone para iterar diseño con Lucas antes de implementar). v1 = estructura general. v2 = traducciones al español + modal de glosario (feedback explícito de Lucas).

**Decisión de UX importante**: traducir TODO al español (segmentos, métricas, copy) — Lucas pidió que la app no use jerga técnica. Mantuvimos "LTV" y "RFM" entre paréntesis en el glosario como referencia para usuarios que sí conocen los términos.

### Pendientes (actualiza backlog de 2026-05-13)

- [x] **Clientes** — listo.
- [ ] **IA**: re-introducir Claude/análisis en una versión más limpia. LanguageBank.jsx y TopicMap.jsx aún tienen el bloque "Análisis asistido" — quedó pendiente porque sus archivos tienen cambios previos no commiteados de otra sesión.
- [ ] **Bug `stockSharePct`** en `commercial.categoryConcentration` cuando no hay COGS (heredado de Productos).
- [ ] **Endpoint detalle de cliente** (`/customers/:id/orders`) para enriquecer `CustomerProfileModal` con histórico de compras concreto. Hoy muestra lo derivado del agregado.

---

## 2026-05-13 — Costos (rediseño operativo)

**Branch**: `codex/universal-dashboard-builder` (continúa)
**Tienda usada para validar**: Límite Deportes (`69cadede3936709190d773b8`)
**Stack**: backend Node/Express/MongoDB Atlas · frontend React 18 + Vite + Tailwind

### Trabajo hecho — 5 commits pusheados

| Hash | Tier | Resumen |
|---|---|---|
| `36ce356` | T14 | feat(costos): rediseño operativo con P&L visual y configuración unificada |
| `324ed34` | T15 | docs: entrada inicial de bitácora 2026-05-13 |
| `61e97e8` | T16 | feat(costos): tab "Comisiones y fees" en el acordeón — IBB, fee plataforma, comisiones por medio de pago |
| `db99416` | T17 | chore(ui): sacar bloque "Análisis asistido" de 9 páginas (Tienda, Meta, Creativos, Cashflow, Costos, Productos, Clientes, Competencia, Dashboard). Tenía mucho texto y no estaba bien armado — se va a re-introducir más limpio |
| `26a635c` | T18 | feat(productos): rediseño operativo con tabla principal arriba, sort, scroll vertical interno, KPIs configurables |

### Detalle

Aplicar el patrón del 2026-05-12 (Tienda/Meta/Creativos/Cashflow) a Costos. La página pasó de 636 líneas + 7 secciones planas a 116 líneas + 7 componentes nuevos en `components/costs/`.

**Nueva estructura**:
1. `TopInsightBar`
2. `CoverageBanner` — banner amber condicional (cobertura < 40%). En Límite hoy: "0 de 1.869 productos con costo cargado". CTA "Cargar costos" abre el acordeón en tab Top sellers.
3. `PnLBreakdown` — hero visual con barras horizontales proporcionales sobre facturación. Líneas con valor 0 cuya cobertura está marcada como ausente se renderizan con patrón rayado amber en lugar de barra roja diminuta. Profit estimado al final con `!` cuando hay faltantes. Chip de salud del dato derivado de `dataSource === 'orders'`.
4. `BreakevenCard` — 3 mínimos (ROAS / CPA / Ticket) + comparación mín vs real abajo. Tone (verde/amber/rojo) según ratio actual/mínimo. Hace la lectura "estoy bien o no" inmediata.
5. `CostCoverageChecklist` — 5 filas (cogs, comisiones, fijos, envío, ads), con `⚠ falta` clickeable que abre el acordeón.
6. `CostsConfigAccordion` — colapsable con tabs internas: **Top sellers** (CostsWizard con prop nuevo `embedded`), **Importar CSV** (CSVUploadPanel extraído), **Costos fijos** (FixedCostsPanel extraído). `forwardRef` expone `open(tab)` para que banner/checklist puedan abrirlo + scroll suave.
7. `ClaudeActionBar` + `AIAnalysisPanel` (footer).

**Decisiones**:
- Costos = vista global de la operación. El detalle por SKU (margen unitario, productos sin costo individual, dead stock) queda para Productos (próxima pantalla).
- Alto contraste explícito sin tocar tokens globales: `text-gray-200/300` directos en componentes nuevos. No prendí `data-contrast='high'` global para no afectar Tienda/Cashflow.
- `additionalProperties: true` mental: el conteo "X de 5 cargados" del acordeón se sincronizó con el checklist (4 components de coverage + Meta connected).
- No toqué los ~29 cambios pendientes en otros archivos (aiService.js, syncMeta, etc.).

**Validación en runtime**: 7d (rango actual), Límite Deportes. Banner aparece, conteo "2 de 5" matchea checklist (Envío + Ads ✓), Click en CTA abre acordeón con scroll suave al elemento, tabs cambian, ClaudeActionBar conectado al final con `mode="costos"`.

**Bocetos**: `docs/bocetos/costos-v1.html` (HTML standalone usado para iterar diseño con Lucas antes de implementar).

### Detalle T16 — Tab Comisiones y fees (`61e97e8`)

`CommissionsPanel` con form para `Store.tasaIBB`, `Store.feePlataformaPct`, y tabla CRUD para `Store.comisionPagoConfig[]`. Persiste contra `PUT /api/stores/:id/costos` que ya existía. Tab agregado al `CostsConfigAccordion` entre "Top sellers" y "Importar CSV".

`CostCoverageChecklist` ahora linkea cada fila faltante al tab correcto del acordeón (cogs → wizard, paymentCommission → commissions, fixedCosts → fixed, shippingCost → csv). `Costos.jsx` dispatch `fetchStoreMetrics` después del save para refrescar coverage en Redux sin reload.

### Detalle T17 — Cleanup AI block (`db99416`)

Saqué `<ClaudeActionBar>` + `<AIAnalysisPanel>` de 9 páginas. Lucas: "tiene mucho texto y no está bien armado todo eso, lo deberíamos sacar y después vemos bien como sumamos la parte de IA". LanguageBank y TopicMap quedaron pendientes — su bloque AI vive en cambios de otra sesión todavía no commiteados, no los toqué.

### Detalle T18 — Productos rediseñado (`26a635c`)

Iteración con bocetos `docs/bocetos/productos-{v1,v2,v3}.html`:
- v1: salud catálogo como hero arriba + 4 KPIs + acciones + tabla.
- v2: feedback de Lucas — la tabla es lo más importante, va arriba; agregar ID y categoría; centrado; sort visible; rediseñar cards nativas con color (Aging, Concentración, Comercial por categoría).
- v3: tabla más ancha (1640px) con scroll vertical interno (max 720px) + header sticky; 25 filas por defecto; KPIs configurables vía picker (4 de 10 métricas disponibles, persist localStorage).

**Componentes nuevos en `components/productos/`** (8 archivos):
- `ProductsTable` — 15 columnas, filtros chip con conteo dinámico, búsqueda, sort por columna (asc/desc cycle), paginación cliente (10/25/50/100), scroll vertical interno.
- `ProductsMetricsRow` + `productosMetricsCatalog` — picker con 10 métricas: Rotación / Sin movimiento / Sin stock / Stock atrapado / Sobrestock / Productos totales / Ingresos período / Unidades vendidas / Ticket promedio / Cobertura costos. Defaults: 4 primeras.
- `ActionCards` (Capital atrapado + Hay que reponer) — derivadas en cliente de `products`.
- `CatalogHealth` — barra apilada con 4 buckets exclusivos (sin stock incluye los que vendieron pero quedaron en 0, evita overlap).
- `CategoryTable`, `AgingChart`, `ConcentrationChart` — rediseño con color y barras visuales.
- `ProductProfileModal` extraído de la página vieja.

**Página**: 528 → 104 líneas, solo orquesta componentes. Removido: h1 redundante, card "Conciliación con tienda" (vive en Costos), card "Cobertura de costos" (vive en Costos), grid 3 cards Top sellers / Stock lento / Dead stock-bajo retorno, assortmentMatrix (4 cards), stockHealth (4 cards). La tabla con filtros chip cubre los mismos cortes con menos clicks.

**Bug menor del backend pendiente**: `commercial.categoryConcentration[].stockSharePct` devuelve 0% cuando no hay COGS — la sub-barra "Stock" en `ConcentrationChart` queda plana en Límite. Cuando se carguen costos se acomoda. Si queremos mostrarlo siempre, habría que fallback a stockUnits-share en frontend o cambiar el cálculo backend.

### Pendientes (actualiza el backlog de 2026-05-12)

- [x] **Costos** — listo.
- [x] **Productos** — listo.
- [ ] **Clientes** — sigue. Segmentos RFM con CTA por segmento.
- [ ] **IA**: re-introducir Claude/análisis en una versión más limpia (acción de chat + reporte guardado en MCP). Definir copy + ubicación primero.
- [ ] **LanguageBank y TopicMap**: sacar bloque "Análisis asistido" — quedó pendiente porque sus archivos tienen cambios previos no commiteados.
- [ ] **Bug `stockSharePct`** en `commercial.categoryConcentration` cuando no hay COGS — la barra de stock queda en 0%.

---

## 2026-05-12 — Tienda + Meta Ads + Creativos + Cashflow (rediseño operativo de 4 pantallas)

**Branch**: `codex/universal-dashboard-builder` (continúa)
**Tienda usada para validar**: Límite Deportes (`69cadede3936709190d773b8`)
**Stack**: backend Node/Express/MongoDB Atlas · frontend React 18 + Vite + Tailwind

### Trabajo hecho — 14 commits pusheados a la branch

| Hash | Tier | Resumen |
|---|---|---|
| `3c187a2` | T0 | fix: editor de umbrales del Resumen — los cambios no se persistían y el "Cerrar" del header descartaba silenciosamente |
| `385ba40` | T1 | feat(tienda): aplicar SourceMetricsRow del Resumen + reducir contenedores (logo TN único, sin "TIENDA" repetido) |
| `258ac4b` | T2 | feat(tienda): rediseño comercial — sacar Constructor de hoja, tabs internos, NC vs RC redundante. Layout plano con DailySalesRevenueChart, PaymentMethodsChart (donut), ChannelChart |
| `214bd6c` | T3 | feat(tienda): rediseño del chart de ventas y facturación por día — más alto, gradientes, glow, mejor día con ★, tooltip prolijo |
| `7dfc930` | T4 | feat(tienda): valores siempre visibles en chart + tabla DailySalesTable (reemplaza top clientes) |
| `d983aca` | T5 | feat(tienda): expandir filas del detalle diario con top productos vendidos por día + medio de pago top (agregaciones backend nuevas en getTiendaBreakdown) |
| `160523e` | T6 | feat(meta-ads): rediseño completo + embudo de adquisición + chart spend/revenue. Endpoint `/meta/overview` nuevo con totals + funnel + daily |
| `f3c00a7` | T7 | feat(meta-ads): embudo con forma real (cono, sin impresiones) + tabla de campañas filtrable (search, status pills, sort) |
| `3893b59` | T8 | style(meta-ads): centrar columnas numéricas + más padding en CampaignsTableRich |
| `142f212` | T9 | feat(creativos): Capa 1 — galería de anuncios con thumbnails reales + filtros + selección múltiple |
| `966e400` | T10 | feat(creativos): Capa 2 — modal comparador side-by-side con highlight automático del ganador por métrica |
| `a86775b` | T11 | feat(creativos): Capa 3 — análisis IA por ángulo (modelo AdAnalysis, servicio adAnalysisService con Claude Haiku, tabla agrupada por ángulo, modal con rationale) |
| `c6592e0` | T12 | refactor(creativos): sacar recomendaciones automáticas y llamadas a API desde UI (eran señales falsas — no consideraban madurez de muestra). Doc nuevo `docs/research/analisis-creativos-pendiente.md` |
| `fab4ec5` | T13 | feat(cashflow): rediseño completo + carga manual + cash gap detector (modelos CashflowManualEntry y BankAccountBalance, servicio manualCashflow, 3 componentes UI) |

### Detalle por tier

**T0 — Fix umbrales del Resumen** (`3c187a2`)
Tres bugs en `SourceMetricsRow.jsx`:
1. El "Guardar" del picker estaba lejos del editor de umbrales y el "Cerrar" del header descartaba sin guardar (botón engañoso).
2. Checkbox "Invertir": al desmarcar quedaba `invert: 0` en vez de eliminarse.
3. `useEffect` con `customThresholds` en deps cerraba el editor en cada keystroke.
Fix: thresholds se persisten EN VIVO al tipear (cada cambio actualiza `customThresholds` + localStorage). El Guardar global solo aplica a selección de métricas y nombres custom. `useRef` para detectar el flanco cerrado→abierto sin retrigger.

**T1-T5 — Pantalla Tienda completa**
Aplicar el patrón Resumen v4 + agregar valor accionable:
- T1: reemplazar 6 KPI cards "TIENDA" repetidas por una `SourceMetricsRow` con logo TN único.
- T2: sacar header "Tienda" + Constructor de hoja + tabs internos. Layout plano: KPIs → DailySalesRevenueChart → PaymentMethodsChart (donut) + ChannelChart en grid → tabla diaria.
- T3-T4: chart con valores siempre visibles ($728k encima de cada barra, número de órdenes al lado de cada dot), eje Y con grid, línea ámbar con glow real, mejor día con ★, hover con tooltip detallado.
- T5: agregaciones backend nuevas (`dailyTopProducts`, `dailyTopGateway`) → fila expandible de la tabla diaria muestra top 6 productos vendidos ese día + medio de pago dominante. **Esto es el diferencial vs cualquier otra herramienta** — el usuario sabe QUÉ se vendió cada día, no solo cuánto.

**T6-T8 — Pantalla Meta Ads completa**
- T6: `aggregateInsightMap` extendido con `atc`, `checkouts`, `linkClicks` (faltaban). Endpoint nuevo `GET /meta/overview` con totals + funnel + daily array. Frontend: `metaMetricsCatalog` con 14 métricas y tones (ROAS, CTR), `MetaFunnel` y `MetaSpendRevenueChart`.
- T7: embudo sin "Impresiones" (no es acción del usuario). Barras CENTRADAS horizontalmente con conector trapezoidal SVG → forma real de cono. Tabla `CampaignsTableRich` con search, pills filtro de status, sort por columna, % spend con minibarra, tones por valor.
- T8: padding `p-4` en cada celda + alineación centrada de columnas numéricas.

**T9-T12 — Pantalla Creativos (3 capas + cleanup)**
- T9 Capa 1: `creativosMetricsCatalog` con 10 métricas a nivel ad. `AdGalleryCard` con thumbnail real (4:5), tier badge, métricas overlay, ⚠ SANGRANDO automático. `AdGallery` con search/filtros/sort/selección.
- T10 Capa 2: `AdCompareModal` overlay para 2-4 ads con thumbnail + copy completo (headline + body) + métricas en grid + ★ del ganador en cada métrica + bandera "GANADOR EN N DE M MÉTRICAS".
- T11 Capa 3: modelo `AdAnalysis` (cache por ad con angle, hook, tone, cta, target, rationale). Servicio `adAnalysisService` con Claude Haiku 4.5. 3 endpoints: `POST /analyze` (batch), `GET /angles` (perf por ángulo), `GET /analyses` (hidratar state). UI: `AnglePerformanceTable` agrupada + `AdAnalysisModal` con tags coloridos + rationale. **Problema descubierto**: cuenta Anthropic sin créditos → sembré 11 análisis manuales en MongoDB para validar la UI.
- T12 cleanup: feedback del usuario — recomendaciones automáticas (Pausar/Escalar) eran señales falsas porque no consideraban madurez de muestra ni criterios por tienda. **Saqué**: columna Recomendación, insight clave automático con proyecciones, botones que disparan API a Claude. **Quedó**: vista comparativa neutra de métricas + lectura del mensaje descriptiva. Doc `docs/research/analisis-creativos-pendiente.md` con las 5 preguntas a resolver antes de re-introducir recomendaciones.

**T13 — Cashflow completo (Opción A)**
Cashflow ahora es módulo financiero completo, no solo "lo que liquida TN". 3 secciones:
1. **UnifiedProjectionChart**: barras verde/rojo (ingresos/egresos por día) + línea ámbar de saldo acumulado proyectado partiendo de las cuentas líquidas. Marcador HOY y CASH GAP. Selector 14d/30d/60d/90d/180d. Tooltip con desglose.
2. **BankBalancesPanel**: 3 tiles (Líquido / Por cobrar / Por pagar). Lista editable de cuentas con CRUD modal.
3. **ManualMovementsTable**: tabla CRUD con filtros (tipo, categoría, estado), modal con form completo, recurrencia opcional (sueldos mensuales se generan a 12 meses).

Backend nuevo:
- Modelo `CashflowManualEntry` con taxonomía cerrada (14 categorías: mercaderia, sueldos, impuestos, ventas-local, mayorista-b2b, etc.).
- Modelo `BankAccountBalance` con 7 tipos de cuenta.
- Servicio `manualCashflow.js` con CRUD + `getUnifiedProjection` que combina TN + manuales día por día.
- Movimientos previstos vencidos se proyectan al día actual (deuda pendiente).
- 7 endpoints nuevos.

**Validación end-to-end con datos reales**: cargué Banco Galicia CC $5M + egreso "Pago Salomon $30M" → cash gap detector se activó automáticamente con banner rojo "Tu saldo proyectado entra en rojo el 12/05 con déficit de −$24.469.962".

### Decisión importante: análisis de creativos quedó pendiente de modelo

El sistema de recomendaciones automáticas (Pausar/Escalar/etc.) inferidas solo del ROAS de un grupo era débil — no consideraba ventana de muestreo ni criterios por tienda. **Sacamos toda esa capa de la UI** hasta tener un modelo de evaluación robusto. Ver `docs/research/analisis-creativos-pendiente.md` para las preguntas a resolver. La clasificación por ángulo se mantiene visible (es factual).

---

## Pendientes / Backlog (actualizado 2026-05-12)

### Crítico (data integrity)
- [ ] `target.breakeven.roasBreakeven` no llega al frontend en `metrics.target` (Breakeven ROAS muestra `—`).
- [ ] Cuenta Anthropic sin créditos → endpoint `POST /creativos/analyze` falla con 400. Cargar saldo o setear `ANTHROPIC_API_KEY` en `.env` para que el batch de análisis funcione.

### Pantallas que faltan (las 3 grandes pendientes)
- [ ] **Costos**: aplicar el patrón. Hoy tiene CostsWizard pero la página entera necesita el tratamiento de Tienda/Meta/Cashflow.
- [ ] **Productos**: dead stock (1742 detectados con definición laxa), KPIs con tones, filtros por tipo de problema, lista accionable.
- [ ] **Clientes**: segmentos RFM con CTA específico por segmento.

### Análisis de creativos profundo (cuando retomemos)
Ver `docs/research/analisis-creativos-pendiente.md`. Las 5 preguntas a definir:
- Ventana mínima de muestreo (cuánto tiempo / spend antes de evaluar)
- Diferenciación por tienda (thresholds desde `targetService`)
- Diferenciación por objetivo de campaña (sales vs traffic vs engagement)
- Construcción iterativa por cliente (ML que aprenda del histórico)
- Manejo de ángulos infrarrepresentados (¿pausar o dar más chance?)

### Sync nuevo / pixel
- [ ] **Hooks Pixel propio** para funnel real (visitas → carrito → checkout → compra). API pública de TN no expone visitas/carritos abandonados. Es el unlock para tener funnel a nivel tienda como hoy lo tenemos a nivel ad de Meta.
- [ ] **Carritos abandonados** vía endpoint TN `/orders/abandoned-checkouts` (1-2h, doable sin pixel).
- [ ] **Medios de envío** como dimensión: agregar `metodoEnvio` al modelo `Order` + sync de TN.
- [ ] **Visitas únicas** por GA4 si Hooks Pixel se posterga.

### Bugs conocidos / polish
- [ ] **Timezone en input dates** del cashflow modal: el form usa `new Date().toISOString().slice(0,10)` para default, que en horario tarde (después de 21h ART) puede mostrar un día +1. Fix: parsear local con `new Date(y, m-1, d)`.
- [ ] **Pills de salud del Resumen** (Acq/Conv/Profit/Cash) clickeables → drilldown a la sección que las disparó.
- [ ] **Date range picker** integrado al header más sutil.
- [ ] **Definición de Dead Stock / Sobrestock** más estricta (toca backend).
- [ ] **Componente unificado `MetricCard`** para reemplazar las 8 implementaciones distintas.

### Persistencia backend (Fase 2 del Resumen)
- [ ] Modelo `MetricsConfig` por store + endpoint REST para persistir selección de métricas, nombres custom y thresholds (hoy todo en localStorage).
- [ ] Reglas de alertas computadas en backend (`deriveResumen.jsx` → endpoint `/api/stores/:id/resumen/alerts`).
- [ ] Endpoint consolidado `/api/stores/:id/resumen` (metrics + costCoverage + alerts + highlights en un round trip).

### Funcionalidad — contexto del negocio estructurado
- [ ] Brand book PDF + parsed (tono, paleta, dont's, target).
- [ ] Estrategia activa de la tienda ("2x1 hasta 15/06").
- [ ] Posicionamiento (tier, multimarca vs single brand).
- [ ] Competidores (3-5 con URLs).

### Tailwind / safelist
- [ ] Si se agregan más componentes con BEM modifiers dinámicos, ampliar el regex de `safelist` en `tailwind.config.js`.

---

## 2026-05-11 — Sesión completa de mejoras estructurales + Resumen v4

**Branch**: `codex/universal-dashboard-builder`
**Stack**: backend Node/Express/MongoDB Atlas · frontend React 18 + Vite + Tailwind
**Tienda usada para validar**: Límite Deportes (storeId `69cadede3936709190d773b8`)

### Trabajo hecho — 8 commits pusheados a origin

| Hash | Tier | Resumen |
|---|---|---|
| `4c86bb2` | T1 | fix: data integrity + cost coverage badge |
| `b8d7c6e` | T2 | feat: onboarding flow real (OAuth + seed default + error handling) |
| `6fc1016` | T3 | feat: markdown renderer con tablas + Claude action bar collapsable |
| `d13e2bb` | T4 | feat: costs wizard + CSV preview + cost coverage badge en Costos |
| `66f9b19` | T5 | feat: Tienda 7→4 tabs + polish duplicaciones y relleno |
| `67f56cb` | T6 | feat: Resumen v4 — KPIs por fuente + buzón atención + highlights |
| `11d469d` | T7 | feat(resumen): logos + delta chips + tones condicionales |
| _pending_ | T8 | feat(resumen): logos reales + editor de thresholds custom |

### Detalle por tier

**Tier 1 — Data integrity** (`4c86bb2`)
- ReportBuilder Save: payload reescrito (`titulo`, `contenido`, `section`, `dateRange`); antes reventaba con validation error.
- Dashboard Profit/Margen: rompe la confusión entre Profit de Contribución (bruto, 90%) y Profit Oficial (neto, 52%). Ahora se muestran como métricas separadas con labels claros.
- Wireados los deltas correctamente desde `metrics.deltas` (antes eran `undefined` por mismatch de path).
- Componente `MetricCompleteness` con badge "Preliminar" + tooltip listando los costos faltantes — aplicado en 4 páginas.
- Backend `services/costCoverage.js`: calcula presencia de 7 componentes de costo (COGS, comisión MP, comisión cuotas, IBB, fee plataforma, costo envío, costos fijos). Expuesto en `/api/stores/:id/metrics` como `costCoverage`.
- `StoreLayout` dispara `fetchStoreMetrics` global para que el badge esté disponible en cualquier página.
- `asyncHandler` middleware + handlers globales `unhandledRejection` / `uncaughtException`: validation errors ya no tumban el server.

**Tier 2 — Onboarding** (`b8d7c6e`)
- Settings: botón OAuth real para Tiendanube y Meta (antes solo permitía pegar Access Token raw). El form manual de token queda como collapsable "avanzado".
- Banner verde/rojo automático al volver del callback OAuth.
- Botón "Reconectar" para ambas integraciones.
- **Bug latente arreglado**: el `redirectUri` default de Meta apuntaba a `/api/meta/callback` que no existía (metaRoutes se monta en `/api`). Cambiado a `/api/callback`.
- Callbacks redirigen a `/store/:id/settings?xxx_connected=true` (antes a `/store/:id`).
- Settings error path: si el fetch falla muestra "No se pudo cargar la configuración" con Reintentar (antes mostraba shell con todos los badges en "No conectada" falso).
- `PageBlockLayout` nuevo prop `defaultPresetId`: si la tienda no tiene layout guardado, arranca con preset aplicado. Dashboard usa "executive" → tiendas existentes ya no aterrizan en "Esta hoja está vacía".
- CSV upload (Costos): preview con tabla de primeras 10 filas + cuenta total antes de "Confirmar e importar". Botón Cancelar.

**Tier 3 — UX polish** (`6fc1016`)
- Markdown renderer reemplazado por `marked` con GFM (tablas, strikethrough, autolinks). `utils/markdown.js` util compartido.
- Estilos `.markdown-body` en `index.css` para tema oscuro: tablas con bordes, headings con jerarquía, code blocks, blockquotes.
- Aplicado en Reportes (detalle), Competencia, AIAnalysisPanel.
- `ClaudeActionBar` collapsable por default (~200px → ~40px). Persistencia en localStorage compartido.

**Tier 4 — Wizard de carga de costos** (`d13e2bb`)
- Backend: `GET /api/stores/:id/products/cost-load-priority` devuelve productos SIN costo cargado, ordenados por revenue del período. Aggregation sobre `Order.lineItems` para priorizar lo más impactante.
- Frontend: `CostsWizard.jsx` con tabla editable (producto / precio / vendido / revenue / stock + inputs costo unitario y empaque). Al guardar genera CSV en memoria y reusa endpoint POST existente.
- Badge "Preliminar" agregado a Profit Oficial y Margen Oficial en bloque "Verdad Financiera" de Costos.
- `productRoutes` envuelto en `asyncHandler`.

**Tier 5 — Tienda 7→4 tabs + polish** (`66f9b19`)
- Tabs reducidos: Resumen / Medios de Pago / Detalle Diario / Diagnóstico.
- NC/RC integrado al Resumen como cards (era tab redundante).
- Top Clientes pasa a vista compacta dentro de Resumen con link a `/clientes`.
- Sync y Fuentes + Integridad de Datos agrupados bajo "Diagnóstico" (admin/debug separados de sales metrics).
- KPI hero de Tienda: 8 → 6 (sacado NC % y Devoluciones, duplicados con KPI secundario).
- Cashflow: eliminada card "Bruto total" (igual a "Total liquidable").
- Clientes: eliminada columna "Total gastado" (igual a LTV).
- Productos: Stock Valorizado "Sin datos" en lugar de "$0" cuando no hay costos.
- Dashboard: subLabels redundantes eliminados (Ingresos "Facturación del período", etc.); mantienen los que decodifican siglas (AOV "Ticket promedio").

**Tier 6 — Resumen v4** (`67f56cb`)
Rediseño completo del Dashboard luego de iterar bocetos HTML (v1 → v4) con feedback de Lucas.
- Estructura: Header con health pills → 3 source rows (Meta / Tiendanube / P&L) → Buzón Atención → 3 Highlight cards → Análisis AI.
- `SourceMetricsRow.jsx`: cada fila con header (logo + sync + período), grid de KPIs, picker inline editable.
- Picker: usuario elige hasta 6 métricas + puede renombrar con lápiz. Persistencia localStorage por store.
- `AttentionPanel.jsx`: buzón estilo Linear con acordeón expandible. Detail con tabla embedded (top zombies, dead stock, etc.).
- `HighlightCard.jsx`: mini tabla reutilizable (Top productos / Campañas / Stock crítico).
- `metricsCatalog.js`: 14 métricas Meta, 7 TN, 6 P&L con `getValue`, `getDelta`, `getSub`, `getTone`.
- `deriveResumen.jsx`: derivador frontend de alertas + highlights desde data ya disponible en Redux. (Fase 2: mover a backend.)
- Sale: PageBlockLayout del Dashboard, ExecutiveSnapshot + MasterMetricBoard (siguen en uso en Tienda y MetaAds), panel derecho de Análisis/Alertas/Wins/Acciones/Notas.

**Tier 7 — Iteración estética** (`11d469d`)
- Logos SVG inline (Meta infinity loop, Tiendanube nube, P&L barras).
- Labels: 10px gris uppercase → 13px blanco con tracking natural. Mejor contraste.
- Deltas como chips con fondo color tenue + border (no texto suelto).
- Tones condicionales por threshold (good / warn / bad / null) basados en `getTone(value)` del catalog. Aplicados con tinte de fondo gradient + box-shadow inset 3px en el borde lateral.
- Thresholds default: ROAS good>=2.5x bad<=1.5x; CVR good>=1% bad<=0.3%; Margen neto good>=30% bad<=10%; True ROAS good>=2x bad<=1x; %NC bad>=90% (invert).
- **Bug Tailwind arreglado**: las clases construidas dinámicamente (`className={\`...--${tone}\`}`) no eran detectadas por el extractor y se purgaban del CSS final. Agregado a `safelist` en `tailwind.config.js` con regex que cubre todos los BEM modifiers de los componentes del Resumen.

**Tier 8 — Logos reales + thresholds editables** (pendiente commit)
- Logos PNG oficiales de Meta y Tiendanube en `frontend/src/assets/`. `SourceLogos.jsx` los importa.
- Editor de thresholds por métrica accesible desde el picker (botón con icono de gráfico al lado del lápiz, solo aparece si la métrica tiene `getTone`).
- Inputs "Verde a partir de", "Rojo a partir de", checkbox "Invertir" (para CPA, %NC, etc.).
- Persistencia localStorage por store + métrica (`hooks-resumen-{source}-{storeId}:thresholds`).
- `applyCustomThreshold` en `SourceMetricsRow` usa el threshold custom si existe; sino cae al `getTone` del catalog.

---

## Pendientes / Backlog

### Crítico (rompe data integrity)
- [ ] `target.breakeven.roasBreakeven` no llega al frontend en `metrics.target` — el KPI "Breakeven ROAS" del P&L muestra `—`. Investigar `targetService.getEffectiveTarget`.

### Persistencia backend (Fase 2 del Resumen)
- [ ] Modelo `MetricsConfig` por store + endpoint REST para persistir selección de métricas, nombres custom y thresholds (hoy todo en localStorage).
- [ ] Reglas de alertas computadas en backend, no en frontend (`deriveResumen.jsx` → endpoint `/api/stores/:id/resumen/alerts`).
- [ ] Endpoint consolidado `/api/stores/:id/resumen` que devuelva metrics + costCoverage + alerts + highlights en un solo round trip.

### Replicar patrón Resumen en otras páginas
- [ ] Tienda — source rows + tones + atención
- [ ] Meta Ads — source rows + tones + atención + verdict strip
- [ ] Costos — header con cobertura clara + tones + wizard prominente
- [ ] Productos — KPIs con tones + filtros por tipo de problema
- [ ] Clientes — segmentos RFM con CTA específico por segmento

### Funcionalidad
- [ ] **Contexto del negocio estructurado** (más allá del `aiContext` texto libre de hoy):
  - Brand book PDF + parsed (tono, paleta, dont's, target)
  - Estrategia activa de la tienda (ej. "2x1 hasta 15/06", "liquidación temporada")
  - Posicionamiento (tier, multimarca vs single brand)
  - Competidores (3-5 con URLs)
- [ ] **Análisis AI con contexto enriquecido**: el AI lee el contexto + lista de productos + campañas activas y devuelve planes específicos (no "considerá pausar campañas con bajo ROAS" sino "pausar HKS Vuelta al Cole y mover spend a CBO Best Sellers con Salomon Alphaglide").
- [ ] **Wizard "cargá top sellers"**: lo hicimos en Costos pero podría ofrecerse desde la alerta del Resumen "Cobertura 0%" directamente.

### UX y polish
- [ ] Pills de salud del Resumen (Acq/Conv/Profit/Cash) clickeables → drilldown a la sección que las disparó.
- [ ] Date range picker integrado al header más sutil (hoy se ve como card aparte).
- [ ] Definición de Dead Stock / Sobrestock más estricta (hoy 94% del catálogo es "dead stock" por definición muy laxa — toca backend).
- [ ] Logos oficiales más prolijos: Meta debería ser el infinity loop M, hoy el PNG es genérico. Si Lucas pasa el SVG oficial, lo reemplazamos.
- [ ] Exportar Reportes a PDF (hoy solo MD y JSON).
- [ ] Componente unificado `MetricCard` para reemplazar las 8 implementaciones distintas que el agent B detectó en el diagnóstico inicial (Dashboard, Tienda, Creativos, Costos, etc.).

### Reglas de Tailwind / safelist
- [ ] Si se agregan más componentes con BEM modifiers dinámicos, ampliar el regex de `safelist` en `tailwind.config.js`.

### Diagnóstico inicial que quedó sin atacar
Del punch list runtime de Límite del 2026-05-11:
- [ ] Settings: si `integrationStatus.connected` no se updatea correctamente cuando la conexión se hace por CSV (no OAuth), el badge dice "No conectada" engañosamente. Detectado en código, mitigación parcial con error path arreglado.
- [ ] Patrón "Análisis AI" se repite al pie de muchas páginas con el mismo botón vacío. Consolidar.

---

## Setup local

```bash
# Backend (puerto 3000)
cd backend && npm install && npm run dev

# Frontend (puerto 5173)
cd frontend && npm install && npm run dev
```

**Variables de entorno** (.env en raíz):
- `MONGODB_URI`: Atlas (no local) — ver `.env.example`
- `JWT_SECRET`: para auth
- `TN_APP_ID` / `TN_APP_SECRET` / `TN_CALLBACK_URL`: OAuth Tiendanube
- `META_APP_ID` / `META_APP_SECRET` / `META_CALLBACK_URL`: OAuth Meta. **OJO**: si lo configurás en producción debe apuntar a `https://{dominio}/api/callback` (no `/api/meta/callback`).
- `ANTHROPIC_API_KEY`: para análisis AI (opcional)

**Credenciales seed**: `lucas@hooks.com.ar` (password seteada por Lucas, no en seed.js actual).

**Storage del usuario por tienda** (localStorage):
- `hooks-resumen-meta-{storeId}:selected` / `:names` / `:thresholds`
- `hooks-resumen-tn-{storeId}:*`
- `hooks-resumen-pnl-{storeId}:*`
- `hooks-claude-actionbar-collapsed` (global)
- `hooks-insight-panel-open` (global)
- `hooks-appearance` (global)
