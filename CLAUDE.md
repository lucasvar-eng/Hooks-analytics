# Hooks Analytics — contexto para Claude

App de analytics para e-commerce: cruza **Tiendanube** (órdenes, productos, clientes) con **Meta Ads** (campañas, insights) y costos manuales para dar ROAS real, margen, CAC, LTV, stock, alertas, etc. Multi-tienda y multi-usuario.

- `backend/`: Node 20 + Express + Mongoose (MongoDB Atlas). JWT auth.
- `frontend/`: React 18 + Vite + Redux Toolkit + Tailwind + React Router.
- Producción: un solo servicio Docker en Railway que sirve la API y el frontend buildeado.

Referencia larga (modelos, endpoints, páginas, tools MCP, decisiones de producto): @docs/onboarding/claude-context.md

## Comandos

```bash
cd backend && npm run dev        # API en :3000 (nodemon)
cd frontend && npm run dev       # Vite en :5173, proxy a :3000
cd frontend && npm run build     # build de producción
cd backend && npm run mcp        # servidor MCP stdio (ver docs/claude-mcp.md)
cd backend && node scripts/createUser.js --email x@y.com --name "X" --password "..." --role admin|analyst|viewer
node backend/scripts/recalcStoreRange.js "Nombre tienda" 2026-01-01 2026-01-31   # recalcular DailyMetric
```

No hay tests automatizados. Para validar: `node --check` en los archivos del backend, `npm run build` del frontend y probar el flujo en la app.

## Reglas que importan

- **El `.env` local apunta a la base de PRODUCCIÓN.** Usá `SKIP_CRONS=true` en local: sin eso, el backend local corre los mismos crons que Railway (syncs y alertas duplicados). El servidor MCP no corre crons.
- **Push a `main` = deploy automático a Railway** (`Dockerfile` + `railway.json`, healthcheck `/health`). No hay staging: probá local antes de pushear.
- **El repo es público.** Nunca commitear `.env`, tokens, contraseñas, IDs de cuentas publicitarias ni datos de clientes.
- **`ENCRYPTION_KEY`** cifra (AES-256-GCM, `backend/src/utils/encryption.js`) los tokens de Tiendanube, Meta y Resend guardados en Mongo. Si cambia, todas las integraciones quedan inservibles y hay que reconectarlas.
- **Revenue**: el criterio es "orden pagada y estado != cancelled" en todas las queries. Respetalo en queries nuevas.
- Idioma: UI, docs y commits en español rioplatense. Commits estilo `feat(scope): ...` / `fix(scope): ...`. `BITACORA.md` registra los sprints (lo más reciente arriba).

## Integraciones

**Tiendanube**: un token por tienda en `StoreConnection` (provider `tiendanube`). Hay dos orígenes, según `Store.tnTokenSource`:
- `manual`: OAuth de la app de Tiendanube (`GET /api/tn/connect/:storeId` → autorización → `GET /api/tn/callback`).
- `cro_service`: el token lo entrega una API externa (`CRO_SERVICE_API_URL` + `CRO_SERVICE_API_KEY`).
- El chequeo de token (`checkTiendanubeTokenHealth`) solo corre para `cro_service`, y los errores de sync de las conexiones `manual` no se guardan en `StoreConnection.lastError`. Por eso Settings puede mostrar "Conectada" una tienda que no sincroniza: mirá `synclogs`.

**Meta Ads** (sin OAuth):
1. Cada usuario guarda su access token en `/profile` (`PUT /api/user/meta-token`, cifrado en `User.metaUserToken*`).
2. En Settings de cada tienda: "Traer cuentas" + "Conectar y sincronizar" ("Actualizar cuentas y resincronizar" si ya estaba conectada; se abre con "Re-conectar" o "Cambiar cuentas conectadas"). Llama a `POST /api/stores/:id/connect-meta-manual` y la conexión queda con `connectedByUser` = ese usuario.
3. Si el usuario actualiza su token en `/profile`, se propaga a las conexiones donde es `connectedByUser` y tenían el token anterior.

Detalles de Meta a tener en cuenta:
- La app asume 60 días de vigencia para cualquier token, incluso uno de System User que no vence. Por eso, a partir del día ~53 muestra "vence pronto", intenta refrescarlo (`refreshMetaTokens`, cron diario) y manda mails diarios. La sincronización sigue funcionando porque `getToken` no mira el vencimiento. Mejora pendiente: leer el vencimiento real con `GET /debug_token` al guardar el token.
- Backfill: `POST /api/stores/:id/meta/sync-now` con `{ "daysBack": N }` (máximo 180). El botón de la UI manda 30. Al conectar una tienda se sincronizan 30 días.

**Crons** (`backend/src/services/cronJobs.js`): Tiendanube órdenes cada 4 h, productos cada 12 h, chequeo de token cada 2 h; Meta estructura cada 12 h, insights 4 veces por día, product insights 2 veces por día; cashflow diario; diagnostics (alertas) cada 6 h.

**Email**: Resend. Cada usuario carga su propia API key en `/profile`; `RESEND_API_KEY` del entorno es el fallback.

## Mapa rápido

- Rutas del backend: `backend/src/routes/*`, montadas en `backend/src/server.js`.
- Páginas: `frontend/src/pages/*`. Rutas en `frontend/src/App.jsx` y menú lateral en `frontend/src/pages/StoreLayout.jsx`.
- Permisos por tienda: `StoreAccess` (`owner | admin | editor | viewer`) + `requirePermission(PERMISSIONS.X)` en las rutas. Rol global `admin` ve todo.
- Alertas: `backend/src/services/diagnosticsService.js` (reglas determinísticas, no IA).
