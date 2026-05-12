# Bitácora — Hooks Analytics

Registro de cambios trabajados sobre la app y trabajo pendiente.
La bitácora se ordena de **arriba hacia abajo** por orden cronológico inverso (lo más reciente arriba).

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
