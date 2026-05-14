# Deploy a Railway

Guía operativa para subir Hooks Analytics a Railway. Asume que ya está en GitHub y que tenés una cuenta de Railway.

## 1. Pre-deploy — checklist

- [ ] Branch `main` con la versión que querés deployar (mergea desde `codex/universal-dashboard-builder` cuando esté listo).
- [ ] `MongoDB Atlas` ya creado y accesible (usá el `MONGODB_URI` del `.env` local).
- [ ] Cuenta de Resend creada con API key (opcional pero recomendado para invitaciones).
- [ ] `ENCRYPTION_KEY` generado y **guardado en un lugar seguro** (1Password / Bitwarden). Si se pierde, se pierden todos los tokens cifrados.
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] `JWT_SECRET` generado:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
  ```

## 2. Crear el servicio en Railway

1. **New Project** → Deploy from GitHub repo → seleccionar `lucasvar-eng/Hooks-analytics`.
2. Railway detecta el `railway.json` y el `Dockerfile` automáticamente. Usa Docker, no Nixpacks.
3. **Settings → Networking** → "Generate Domain". Te da algo como `hooks-analytics-production.up.railway.app`.

## 3. Variables de entorno (Settings → Variables)

Pegá todo de una en el **raw editor** del Variables tab:

```
NODE_ENV=production
PORT=3000

MONGODB_URI=mongodb+srv://...
ENCRYPTION_KEY=<el hex de 64 chars que generaste>
JWT_SECRET=<el random de generación>

CORS_ORIGIN=https://hooks-analytics-production.up.railway.app
APP_PUBLIC_URL=https://hooks-analytics-production.up.railway.app

# Email (opcional pero recomendado)
RESEND_API_KEY=re_...
EMAIL_FROM="Hooks Analytics <onboarding@resend.dev>"

# OAuth (cuando tengas las apps registradas)
TN_APP_ID=
TN_APP_SECRET=
TN_CALLBACK_URL=https://hooks-analytics-production.up.railway.app/api/tn/callback
META_APP_ID=
META_APP_SECRET=
META_CALLBACK_URL=https://hooks-analytics-production.up.railway.app/api/meta/callback

# Token central CRO (opcional)
CRO_SERVICE_API_URL=https://app.ecomclub.com.ar/api/service/stores
CRO_SERVICE_API_KEY=

# Observabilidad (opcional, recomendado)
SENTRY_DSN=

# MCP
MCP_DEFAULT_AUTHOR_EMAIL=lucas@hooks.com.ar
```

`CORS_ORIGIN` y `APP_PUBLIC_URL` tienen que apuntar al dominio que Railway te dio. Si después conectás un dominio propio, los actualizás.

## 4. MongoDB Atlas — hardening

Antes del primer deploy productivo:

1. **Network Access** → Add IP Address → **Railway IP** (en el dashboard de Railway, Settings → Networking → "Static Outbound IPv4"). Borrar la regla `0.0.0.0/0` si la tenías para desarrollo.
2. **Database Access** → crear un usuario con scope `readWrite` solo a la DB `hooks-analytics` (no usar root para producción).
3. **Backup** → verificar en el cluster que tenga snapshots automáticos. M0/M2/M5 no los incluyen — si estás ahí, agendar `mongodump` periódico o subir a M10.

## 5. Decidir qué pasa con los crons locales

Cuando deployes:
- Railway corre los crons del backend (sync TN, sync Meta, refresh tokens, alertas, etc.) en su instancia.
- Si dejás corriendo el backend local con `nodemon`, los crons se ejecutan **dos veces** (alertas duplicadas, syncs duplicados, posibles race conditions).

**Recomendación**: parar el backend local (`Ctrl+C` en nodemon) cuando Railway esté arriba. Para desarrollo, usar Railway como "fuente de verdad" y solo levantar local cuando estés iterando código.

Si necesitás correr ambos en paralelo (raro), agregamos una env var `SKIP_CRONS=true` para deshabilitar en una de las instancias.

## 6. Verificación post-deploy

1. **Health**: `https://TU-DOMINIO.up.railway.app/health` → debe devolver `{"status":"ok",...}`.
2. **Login**: entrar con `lucas@hooks.com.ar` y la pass habitual.
3. **Listado de tiendas**: ver que aparezcan las stores migradas.
4. **Sync manual**: en alguna tienda, click "Forzar sincronización" desde el chip del header. Esperar 2-3 min, ver que actualice.
5. **Email**: ir a `/store/X/team` → invitar a un email tuyo de prueba. Verificar que llegue el mail.

## 7. Setup adicional opcional

### Sentry (recomendado)
1. Crear proyecto en sentry.io (free tier 5k events/mes).
2. Copiar el DSN al Railway Variables.
3. Sentry empieza a recibir errors no manejados automáticamente.

### Dominio propio
Si tenés un dominio (ej. `hooks.tudominio.com`):
1. Railway → Settings → Networking → Custom Domain → ingresar el dominio.
2. Railway te da un CNAME target. Configuralo en tu DNS provider.
3. Esperar SSL automático (5-15 min).
4. Actualizar `APP_PUBLIC_URL` y `CORS_ORIGIN` con el dominio propio.

### Verificar dominio en Resend
Si querés mandar mails a cualquier email (no solo al de signup de Resend):
1. Resend → Domains → Add Domain (`tudominio.com`).
2. Agregar los DNS records que te da (TXT, MX, CNAME).
3. Esperar verificación.
4. Actualizar `EMAIL_FROM="Hooks Analytics <notificaciones@tudominio.com>"`.

## 8. Rollback

Si algo se rompe, Railway permite hacer rollback al deploy anterior desde **Deployments**.
MongoDB Atlas: si hay corruption de datos, restaurar desde el último snapshot.

## 9. Troubleshooting frecuente

| Síntoma | Causa probable | Fix |
|---|---|---|
| Login funciona pero todas las requests dan 401 | `JWT_SECRET` distinto al que firmó el token | Asegurarse que el `JWT_SECRET` del Railway sea el mismo que el local que firmó |
| Las invitaciones no mandan mail | `RESEND_API_KEY` no seteada o dominio no verificado | Ver `/profile` → "Email service (Resend)" — el user puede traer su propia key |
| Tokens TN/Meta inservibles | `ENCRYPTION_KEY` distinta a la que cifró los tokens | Restaurar la `ENCRYPTION_KEY` original o re-conectar las integraciones manualmente |
| CORS error en frontend | `CORS_ORIGIN` no coincide con la URL desde donde se sirve el front | Actualizar la var al dominio correcto |
| Health check falla | Mongo no conecta, IP no whitelist | Verificar `MONGODB_URI` y el Network Access de Atlas |
