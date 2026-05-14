# Onboarding de nuevos miembros del equipo

Carpeta con todo lo necesario para sumar a alguien que **no conoce** la app.

## Archivos en esta carpeta

| Archivo | Para qué | Cómo entregarlo |
|---|---|---|
| `1-bienvenida-y-tour.html` | Tour completo de la app, página por página. Onboarding visual. | Mandar por mail/WhatsApp. Se abre con doble click, navega solo. |
| `2-tutorial-meta-access-token.html` | Cómo generar el access token de Meta para conectar sus ad accounts. | Idem. |
| `3-vincular-tienda.html` | Cómo conectar una Tienda Nube o Shopify a la app. | Idem. |
| `claude-context.md` | Brief técnico para que el Claude/Codex de la persona tenga contexto de la app. | Que lo pegue en su `CLAUDE.md` o como "user instructions" en Claude Desktop / Codex / proyecto. |

---

## Paso a paso para sumar a alguien (ejemplo: Valentina)

### 1) Crear su usuario en la app

Desde tu máquina local (apuntando al mismo Mongo Atlas que producción):

```bash
cd "/Users/lucasvargas/Desktop/ANALISIS ECOM/Hooks-analytics/backend"

node scripts/createUser.js \
  --email valentina@ejemplo.com \
  --name "Valentina" \
  --password "valentina2026" \
  --role analyst \
  --notification-email valentina@ejemplo.com
```

Roles globales válidos:
- `admin` — bypass total, ve todas las tiendas (úsalo solo para vos).
- `analyst` — recomendado para miembros del equipo. Permisos granulares por tienda vía `StoreAccess`.
- `viewer` — solo lectura.

**Cambios típicos para Valentina**:
- Reemplazá `valentina@ejemplo.com` por su email real.
- Reemplazá `valentina2026` por una password temporal que vas a compartirle por privado. Ella la debería cambiar al entrar (TODO: agregar endpoint de cambio de password en la app).

### 2) Asignarle acceso a tiendas

Con su cuenta creada, andá a `/admin/users` en la app (te aparece el item "Usuarios" en el header si sos admin global). Buscá su user, click "Editar" y agregá las tiendas que vaya a manejar con el rol que corresponda por tienda (`owner` / `admin` / `editor` / `viewer`).

Alternativamente desde el sidebar de cada tienda: **Equipo → Invitar miembro**. Eso le manda mail (si Resend está configurado) con un link de aceptación; en caso contrario te devuelve el link para que se lo copies a mano.

### 3) Entregarle los tutoriales

Mandale por privado los 3 HTML + el `claude-context.md`:
- `1-bienvenida-y-tour.html` — para que conozca la app.
- `2-tutorial-meta-access-token.html` — antes de conectar sus ad accounts.
- `3-vincular-tienda.html` — para conectar su Tienda Nube.
- `claude-context.md` — para que cargue en su Claude/Codex y pueda hacer análisis con contexto.

Cualquier HTML se abre con doble click en su Mac, no necesita servidor.

### 4) Ella configura el resto sola

Una vez que entre con el email/pass que le pasaste:
1. **`/profile`** — completar `notificationEmail`, **configurar su API key de Resend** (sin esto no recibe alertas/mails de la app).
2. **`/store/<su-tienda>/settings`** — conectar sus tokens de TN y Meta siguiendo los tutoriales.
3. Empezar a usar la app.

---

## Si algo sale mal

| Síntoma | Qué pasó | Cómo resolver |
|---|---|---|
| Script falla con "Ya existe un usuario con email" | Ya creaste el user antes | Andá a `/admin/users` y editá el existente |
| Script falla con "MONGODB_URI no está configurada" | El `.env` no tiene la var o no está apuntando bien | Verificá que `cd backend && cat ../.env \| grep MONGO` devuelva algo |
| El user creado no puede ver ninguna tienda | Le falta `StoreAccess` | Asignale las tiendas desde `/admin/users` o invitala desde el panel Equipo de cada tienda |
| No le llegan los mails de la app | No configuró su API key de Resend | Que vaya a `/profile` → "Email service (Resend)" y siga el tutorial |
