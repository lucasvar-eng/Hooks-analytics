# Contexto de Hooks Analytics — para tu Claude/Codex

> **Cómo usar este archivo**:
> - **Claude Desktop**: pegá el contenido en *Settings → Custom instructions* o como user instructions del proyecto/conversación.
> - **Claude Code (CLI)**: guardalo como `CLAUDE.md` en la raíz del workspace donde laburás con la app.
> - **Codex / otra IA**: como system prompt o user instructions.

---

## Qué es Hooks Analytics

App interna del equipo para centralizar analytics de e-commerce. Conecta **Tienda Nube** + **Meta Ads** + (opcional) **Shopify** + **Google Sheets**, ingesta órdenes/productos/clientes/insights, los cruza, y los expone como métricas de negocio: ROAS real, profit margin, CAC, LTV, recurrencia, segmentación RFM, capital atrapado en stock, etc.

Multi-tienda, multi-usuario. Cada usuario ve solo las tiendas a las que tiene acceso vía `StoreAccess` (modelo de permisos granular).

- **Frontend**: React 18 + Vite + Redux Toolkit + Tailwind + React Router. Servido por el mismo Express en prod (build estático en `/public`).
- **Backend**: Node 20 + Express + Mongoose + MongoDB Atlas. JWT auth. Cifrado AES-256-GCM para tokens de integraciones (`ENCRYPTION_KEY` env).
- **MCP**: server stdio expuesto en `backend/src/mcp/hooksMcpServer.js`. Permite que Claude/Codex lean datos y escriban reportes/notas vía tools tipadas.
- **Email**: Resend, multi-tenant (cada user trae su API key en `User.resendApiKey*`).
- **Observability opt-in**: Sentry vía `SENTRY_DSN`.
- **Deploy**: Railway desde `main`, image Docker que builda frontend + ejecuta backend.

---

## Arquitectura mental

Hay **3 fuentes de datos**:

1. **Tienda Nube** (REST API): `Order`, `Product`, `Customer`. Modelo `Store` apunta a `tnStoreId` y guarda la conexión cifrada en `StoreConnection` (provider `tiendanube`).
2. **Meta Ads** (Graph API): `MetaCampaign`, `MetaDailyInsight` (con granularidad `campaign | adset | ad`), `MetaProductInsight` (atribución a productos). Conexión cifrada en `StoreConnection` (provider `meta`).
3. **Manual / Sheets**: Cashflow manual, costos fijos, competidores, target KPIs, notas del equipo.

Sobre eso, **servicios derivados**:

- `metricCalculator` — `aggregateRange(storeId, from, to)` devuelve toda la lectura cruzada del período (Meta + TN + costos).
- `diagnosticsService.runDiagnostics(store)` — corre 8 reglas determinísticas, persiste `Alert` y manda email a recipients vía Resend.
- `autoInsightsService.buildAutoInsights(storeId, from, to)` — wins/problemas/recordatorios para la página `/insights`.
- `productService.getMonthlyMatrix` — top productos × últimos 12 meses.
- `customerService.getPeriodInsights` — recurrencia, CAC, LTV, top compradores, histograma días-desde.
- `reportTemplateService.buildBriefing(template, storeId, from, to)` — pre-arma el JSON con métricas + estructura del reporte para que la IA externa redacte.

---

## Modelos Mongo clave

| Modelo | Para qué |
|---|---|
| `Store` | Una tienda. Tiene `nombre`, `plataforma`, `objetivos.kpis`, `objetivos.alertThresholds`, refs a las conexiones. |
| `StoreConnection` | Tokens cifrados de TN/Meta/Shopify (uno por `(storeId, provider)`). |
| `User` | Usuario del sistema. Rol global `admin | analyst | viewer`. Tiene `notificationEmail`, `notificationPreferences`, `resendApiKey*` cifrada. |
| `StoreAccess` | Permisos granulares por `(userId, storeId)`. Roles por tienda: `owner | admin | editor | viewer` + `permissions[]` override. |
| `StoreInvitation` | Invitación pendiente de Lucas/admin a otro user. Token + `expiresAt` 7d. |
| `Order` | Orden de TN. Tiene `customerEmail`, `lineItems`, `totalOrden`, `paymentStatus`, `utm_*`. |
| `Product` | Producto de TN. Stock, precio, costoUnitario, categoría. |
| `Customer` | Cliente derivado de Orders. RFM scores, LTV, recency. |
| `MetaCampaign` | Campañas/AdSets/Ads (con `level`). Trae thumbnail, creativeTitle/Body. |
| `MetaDailyInsight` | Insights por día y por entidad. Spend, impressions, atc, checkouts, purchases, videoViews. |
| `MetaProductInsight` | Atribución de spend a productos del catálogo. |
| `Alert` | Alerta generada por el cron de diagnostics. `severidad` info/warning/critical. |
| `Report` / `TeamNote` | Outputs de la IA externa o notas manuales. |
| `AuditLog` | Audit trail de acciones sensibles (login, conexión OAuth, MCP writes, etc.). |
| `CashflowEntry` | Movimientos manuales de tesorería. |
| `Competitor` / `CompetitorSnapshot` | Competidores y snapshots de su catálogo. |
| `TopicMap` / `LanguageBank` | Embebidos en Creativos. Mapa de tópicos por audiencia. |

---

## Endpoints REST principales

Todos requieren `Authorization: Bearer <JWT>` salvo `/api/auth/*` y `/health`.

```
GET    /health                                 — liveness
POST   /api/auth/login                         — login (rate limit 10/15min)
POST   /api/auth/register                      — registrar user (admin only en práctica)
GET    /api/auth/me                            — perfil + storeAccess detallado

GET    /api/stores                             — listado de tiendas con acceso
POST   /api/stores                             — crear store básica
POST   /api/stores/create-connected            — crear + conectar TN/Shopify
GET    /api/stores/:id                         — detalle
PUT    /api/stores/:id                         — update
DELETE /api/stores/:id                         — delete (requiere store:delete)
GET    /api/stores/:id/metrics?from&to         — métricas cruzadas del período
GET    /api/stores/:id/daily-metrics?from&to   — daily metrics raw
GET    /api/stores/:id/connections             — estado de las integraciones
POST   /api/stores/:id/sync/now                — forzar sync

GET    /api/stores/:id/auto-insights?from&to   — wins/problems/reminders determinísticos
GET    /api/stores/:id/alerts?estado=          — listar alerts
POST   /api/stores/:id/alerts/run              — disparar diagnostics on-demand
PUT    /api/stores/:id/alerts/:alertId/acknowledge|resolve

GET    /api/stores/:id/tienda/breakdown        — análisis TN (medios pago, canal, UTM, dist temporal, etc.)
GET    /api/stores/:id/products                — listado paginado
GET    /api/stores/:id/products/overview       — métricas catálogo
GET    /api/stores/:id/products/monthly-matrix?months=12&top=20 — heatmap
GET    /api/stores/:id/products/commercial     — agrupados por categoría + aging
GET    /api/stores/:id/customers               — listado paginado
GET    /api/stores/:id/customers/cohorts       — matriz de retención
GET    /api/stores/:id/customers/segments      — RFM
GET    /api/stores/:id/customers/period-insights?from&to — recurrencia, CAC, top período, histograma

GET    /api/stores/:id/meta/overview?from&to   — totals + funnel + daily
GET    /api/stores/:id/meta/campaigns?from&to  — campañas + frec + hookRate + verdict
POST   /api/stores/:id/meta/csv-import         — carga CSV histórico
POST   /api/stores/:id/connect-meta-manual     — conectar token manual
POST   /api/stores/:id/meta/ad-accounts/preview — preview de ad accounts con un token

GET    /api/stores/:id/creativos               — ads
GET    /api/stores/:id/creativos/angles?from&to — performance por ángulo
GET    /api/stores/:id/competitors             — competidores
GET    /api/stores/:id/cashflow                — saldos + movimientos
GET    /api/stores/:id/reports                 — bandeja de reportes
GET    /api/stores/:id/team                    — miembros + invitaciones

POST   /api/stores/:id/team/invitations        — invitar
POST   /api/invitations/accept                 — aceptar invitación

GET    /api/user/notifications                 — preferencias de notif
PUT    /api/user/notifications                 — update
GET    /api/user/resend-config                 — estado del Resend del user
PUT    /api/user/resend-config                 — guardar API key Resend
POST   /api/user/resend-config/test            — mandar mail de prueba
```

---

## MCP Tools disponibles

Server: `backend/src/mcp/hooksMcpServer.js`. Conexión vía stdio. Cuando una IA externa quiere actuar sobre datos de una tienda, llama a estos:

**Reads:**

- `list_stores` — todas las tiendas accesibles.
- `get_store_overview(store, from, to)` — KPIs Meta + TN + P&L del período.
- `get_sync_status(store)` — último sync por integración.
- `get_ai_context_snapshot(store, section, from, to)` — payload completo para análisis IA (KPIs, daily, alerts, productos top, etc.).
- `get_creative_pipeline(store, from, to)` — pipeline creativo (ads + ángulos).
- `get_commercial_overview(store, from, to)` — productos comerciales.
- `get_reports(store, limit)` — reportes ya guardados (para no duplicar).
- `get_financial_consistency(store, from, to)` — auditoría de coherencia financiera.
- `list_report_templates()` — templates disponibles.
- `get_report_briefing(template_key, store, from, to)` — JSON estructurado: secciones obligatorias + métricas pre-calculadas + system prompt sugerido.

**Writes:**

- `create_report(store, titulo, contenido, summary?, section?, tipo?, from?, to?, confidence?)` — sube un reporte. Markdown en `contenido`. Audit-logged como `mcp.report.created`.
- `save_analysis(...)` — wrapper de `create_report` con `tipo: 'analysis'`.
- `create_team_note(store, section?, text)` — nota interna del equipo.

**Reglas de uso (importante para IAs):**

1. Antes de usar `create_report`, llamar a `list_report_templates` + `get_report_briefing` para tener la estructura esperada.
2. Para análisis ad-hoc sin template: usar `save_analysis` con `tipo: 'analysis'`.
3. Markdown válido en `contenido`. Headings h1-h3 generan TOC sticky en la UI.
4. `confidence` entre 0 y 1 — usalo para indicar qué tan seguro estás del análisis.
5. `qualityNote` para flaggear si hay data faltante (ej. "Datos cargados sólo hasta mayo, no incluye junio aún").

---

## Páginas del frontend (mapa)

```
/login                                 — login
/                                      — home: cards de tiendas
/profile                               — perfil del user (cuenta, notif, Resend, mis tiendas, tutorial Meta)
/admin/users                           — gestión de usuarios (admin global only)
/invitations/accept?token=             — aceptar invitación

/store/:storeId/                       — redirect a /dashboard
/store/:storeId/dashboard              — Resumen (KPIs Meta+TN+P&L, embudo, chart roas timeline)
/store/:storeId/insights               — Auto-insights (wins/problems/reminders)
/store/:storeId/tienda                 — TN: pagos, canal, UTM, dist temporal, daily
/store/:storeId/productos              — Catálogo, indicadores, heatmap mensual
/store/:storeId/clientes               — RFM, period insights, cohortes, pareto
/store/:storeId/meta-ads               — Meta: campañas con verdict, embudo, gasto/revenue daily
/store/:storeId/creativos              — Ads, performance por ángulo, hooks, hipótesis
/store/:storeId/competencia            — Competidores
/store/:storeId/cashflow               — Saldos + proyección
/store/:storeId/costos                 — P&L, breakeven, wizard de costos
/store/:storeId/simulador              — What-if con sliders
/store/:storeId/reportes               — Bandeja de reportes + templates
/store/:storeId/alertas                — Alertas activas/reconocidas/resueltas
/store/:storeId/team                   — Miembros + invitaciones (admin/owner only)
/store/:storeId/settings               — Integraciones, objetivos, costos, ads thresholds
```

---

## Decisiones de producto importantes

1. **No hay IA interna en la app**. Toda la "inteligencia narrada" (análisis, reportes ejecutivos, briefings creativos) viene de IA externa (Claude/Codex) vía MCP. La app solo da datos + reglas determinísticas.
2. **Auto-insights = reglas deterministas**, no IA. El servicio `autoInsightsService.js` corre umbrales sobre datos del período. Sirve para conclusiones repetitivas; cuando hace falta análisis profundo, la IA externa lo hace via MCP.
3. **Cada user trae su Resend**. No hay un Resend centralizado. Esto evita verificar dominio + mantiene aislamiento de cuentas.
4. **No usamos OAuth público de Meta/TN** (por ahora). Cada miembro genera su token manual con tutorial dedicado. Decisión por costo (App Review de Meta toma 2-6 semanas).
5. **Multi-tienda, multi-user con StoreAccess granular**. Roles `owner/admin/editor/viewer` por tienda. Permisos por endpoint vía `requirePermission(PERMISSIONS.X)`.
6. **AuditLog cableado** en endpoints sensibles (login, OAuth, MCP writes, store create/delete, team invitations, integration connects).
7. **Deploy: Railway desde `main`**. Branch de trabajo: `codex/universal-dashboard-builder`. Merge a `main` dispara build.

---

## Flujo típico de uso para una IA externa

Imaginá que el usuario te pide: *"Armame el informe semanal de Limite Deportes para presentarle al cliente"*.

Pasos correctos via MCP:

1. **`list_stores`** → identificar el storeId de "Limite Deportes".
2. **`get_sync_status`** → confirmar que la sync de TN y Meta es reciente. Si no, advertirle al usuario.
3. **`list_report_templates`** → ver si existe el template `weekly-review`.
4. **`get_report_briefing(template_key: "weekly-review", store: <id>, from: <lunes_pasado>, to: <ayer>)`** → recibís un JSON con todas las métricas precalculadas + estructura del reporte (qué secciones cubrir, qué tono usar).
5. Redactar el reporte en markdown siguiendo la estructura.
6. **`create_report(store: <id>, titulo: ..., contenido: <markdown>, tipo: "report", section: "dashboard", from, to, confidence: 0.8)`** → sube el reporte. El usuario lo ve en `/store/X/reportes`.

Si en cambio el usuario te pide un análisis ad-hoc fuera de los templates (ej. *"analizá por qué cayeron las ventas el martes"*):

1. Mismo flow pero usá **`save_analysis`** en lugar de `create_report`, con `tipo: 'analysis'`.
2. Carga el contexto con `get_store_overview` + `get_ai_context_snapshot` con el rango específico.

---

## Lo que NO debe hacer la IA externa

- **No subir reportes con data inventada o estimada sin marcarlo claro**. Usá `qualityNote` para advertir cuando algo está cocinado.
- **No llamar tools de escritura repetidamente** para el mismo análisis. Una vez creado el reporte, no lo dupliques — usá `get_reports` para chequear si ya existe.
- **No exponer tokens, API keys, o credenciales** en el contenido del reporte. Tampoco en TeamNote.
- **No mezclar análisis de tiendas distintas** en un solo reporte. Cada `create_report` apunta a un `storeId` específico.
- **No usar tools de admin** (crear users, modificar settings de tienda) — esas no están expuestas via MCP por diseño.

---

## Comandos / paths útiles

- Repo: `lucasvar-eng/Hooks-analytics`
- Branch principal: `main` (deploy auto a Railway)
- Branch de desarrollo: `codex/universal-dashboard-builder`
- Producción: `https://hooks-analytics-production-36b6.up.railway.app` (subdominio actual, puede cambiar si Lucas agrega dominio propio)
- Bitácora: `BITACORA.md` en la raíz — historial cronológico de sprints.
- Stack envs: ver `.env.example` (tiene comentarios sobre cada variable).

---

## Si te quedan dudas

Pediselas a Lucas vía chat humano. No inventes nada que no esté acá — la app se mueve y este doc puede quedar desactualizado.
