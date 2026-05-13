# Plan Mobile-First + MCP para Hooks Analytics

Documento vivo para revisar la estrategia de producto y arquitectura antes de implementar.

## 1. Decision de producto

Hooks Analytics no deberia ser una app nativa desde cero en esta etapa.

La direccion recomendada es:

> Hooks debe ser una app mobile-first instalable como PWA para humanos, y una plataforma MCP-first para IA.

La UI mobile sirve para monitorear, detectar situaciones y operar rapido. Claude/Codex no deberian depender de navegar esa UI: deberian consultar datos por MCP/API con tools estables, auditadas y con permisos claros.

## 2. Correccion importante despues de revisar el repo

El plan original trataba varias piezas como futuras cuando ya existen parcial o totalmente. El roadmap debe arrancar con gap analysis y hardening, no con redisenar lo que ya esta.

| Tema | Estado real en repo | Implicancia |
|---|---|---|
| Alertas | `backend/src/models/Alert.js` ya existe con `tipo`, `severidad`, `estado`, `fechaDetectada` | No crear modelo nuevo con nombres ingleses |
| Diagnosticos | `backend/src/services/diagnosticsService.js` ya genera alertas rule-based y dedup 24h | Ampliar reglas, no reescribir motor |
| Cron de alertas | `backend/src/services/cronJobs.js` corre diagnostics cada 6h | Ya hay scheduler base |
| Endpoints alertas | `backend/src/controllers/alertController.js` lista/acknowledge/resolve | Falta UI mobile y mejores reglas |
| Audit logs | `backend/src/models/AuditLog.js` ya existe | Falta cablearlo a MCP/endpoints sensibles |
| MCP local | `backend/src/mcp/hooksMcpServer.js` ya expone tools y prompts | Hay que hardenearlo antes de hacerlo remoto |
| Contexto AI | `aiService.buildContext()` es usado por MCP | No eliminar `aiService` entero |

## 3. Riesgos bloqueantes antes de exponer produccion/remoto

Estos puntos tienen prioridad sobre PWA, push o remote MCP.

### 3.1 Tokens OAuth en claro

`Store` guarda `tnAccessToken`, `metaAccessToken` y `shopifyAccessToken` como strings planos. Hay `ENCRYPTION_KEY`, pero hoy no se usa para esos campos.

Bloqueador:

- No exponer remote MCP ni deploy productivo amplio sin cifrado-at-rest de tokens de integraciones.
- Revisar primero `utils/encryption.js` y el patron real de `User.aiConfig` antes de prometer reuse.
- Confirmar que el formato soporta tokens largos de TN/Meta/Shopify sin romper schema ni indices.
- Hacer migracion idempotente de tokens existentes: si ya estan cifrados, no tocarlos; si estan planos, cifrarlos.
- Asegurar que futuros refresh de Meta/TN escriban siempre en formato cifrado.
- Documentar recovery: si se pierde `ENCRYPTION_KEY`, la salida realista es re-OAuth/reconectar tiendas afectadas.

### 3.2 Remote MCP sin modelo de API tokens

La auth actual de la app es JWT de usuario humano. Eso no alcanza para MCP remoto.

Antes de remote MCP hace falta:

- Modelo `ApiToken`
- token hash, no token plano
- scopes
- expiracion
- revocacion
- `lastUsedAt`
- owner/user
- audit log por call

Nunca darle a Claude/Codex un JWT admin humano.

Decision de hash recomendada:

- Token visible una sola vez al crearse.
- Prefijo legible tipo `hk_live_` o `hk_test_` para detectar leaks en logs.
- Entropia minima 32 bytes random.
- Guardar `tokenHash = sha256(token + serverPepper)`.
- Indexar `tokenHash`.
- Comparacion timing-safe.
- No usar bcrypt para lookup por request porque obliga a escanear tokens o mantener identificadores paralelos.
- Expiracion default: 90 dias.
- Solo admins crean/revocan tokens en primera version.

### 3.3 MCP write tools demasiado permisivas

`create_report` y `save_analysis` aceptan `additionalProperties: true`. En local por STDIO es tolerable; remoto no.

Accion:

- whitelist estricta de campos
- `additionalProperties: false`
- validacion de `tipo`, `section`, `confidence`
- limites de longitud para `titulo`, `summary`, `contenido`
- timeout por tool para que una llamada colgada a Mongo no deje al cliente MCP esperando indefinidamente
- definir sanitizacion de markdown: preferible sanitizar al renderizar y validar limites al escribir

### 3.4 Atribucion pobre de escrituras MCP

`resolveAuthorUser()` usa `MCP_DEFAULT_AUTHOR_EMAIL` o primer admin activo. Eso no da trazabilidad real si varias personas/IA escriben.

Accion:

- escrituras MCP remotas deben registrar `apiTokenId`, `userId`, `tool`, `storeId`, `status`, `latencyMs`
- separar "autor humano" de "origen MCP"
- agregar `source: 'mcp' | 'ui' | 'cron'` en entidades que se escriben desde varios canales
- agregar `apiTokenId` opcional en `Report`/`TeamNote` si se escriben desde MCP remoto
- el `userId` del `ApiToken` debe heredarse como `createdBy`/autor humano de la escritura MCP

### 3.5 Hardening HTTP pendiente

Riesgos actuales:

- `app.use(cors())` abierto
- sin Helmet/HSTS/CSP
- rate limit solo por IP global
- errores no manejados solo logueados localmente

Accion:

- CORS por dominios permitidos
- Helmet
- `app.set('trust proxy', 1)` cuando corra detras de Railway/Render antes de rate limits
- rate limit por usuario/token en endpoints sensibles
- bajar `express.json({ limit: '10mb' })` a un default menor; subir limite solo en rutas que realmente reciben payloads grandes
- considerar `hpp` para query params duplicados en endpoints expuestos
- validacion centralizada con Zod/Joi en endpoints sensibles y schemas reutilizables por MCP
- Sentry/Logtail o similar antes de produccion real

## 4. Chat AI interno: decision tecnica

La decision de producto sigue siendo sacar el chat AI como experiencia principal, pero la razon correcta no es solo costo.

Matiz importante:

- El producto no necesariamente paga las APIs si cada usuario carga su propia key.
- Pero mantener un chat dentro de Hooks puede duplicar flujos que Claude/Codex ya resuelven mejor afuera.
- `buildContext()` es valioso y el MCP lo usa. No hay que borrarlo.

Decision recomendada:

1. Ocultar/remover `AIChatPanel` de la navegacion principal, especialmente mobile.
2. Separar `buildContext` en modulo propio de data/contexto.
3. Dejar LLM calls (`chat`, `analyze`, reportes) detras de feature flag o deshabilitadas por default.
4. Mantener endpoints solo si no generan costo automatico ni promesas de producto.
5. Preservar la capacidad de guardar reportes/analisis via MCP.

## 5. PWA vs nativa

| Camino | Pros | Contras | Veredicto |
|---|---|---|---|
| Web responsive | Rapida, barata, un deploy, sirve desktop/mobile | Puede sentirse poco mobile | Base necesaria |
| PWA mobile-first | Instalable sin App Store, bajo costo, un codigo, push posible | Instalacion manual en iPhone, adopcion menor fuera del equipo | Mejor primer paso |
| Capacitor wrapper | Push nativo, icono real, camino a stores | Builds, certificados, riesgo de rechazo si es solo wrapper sin valor nativo | Segunda etapa si mobile valida |
| React Native real | Mejor UX mobile | Reescritura cara, duplica producto | No ahora |

Conclusion:

- Para Lucas + equipo chico, PWA alcanza como primer producto mobile.
- Para clientes externos, PWA puede tener friccion de instalacion.
- App nativa no debe usarse para que IA "vea mejor" la app. La IA debe usar MCP.

## 6. Instalacion sin App Store

PWA:

- abrir URL en Safari/Chrome
- Add to Home Screen
- icono en pantalla de inicio
- modo app
- sin App Store

App nativa iOS real:

- requiere App Store, TestFlight, Ad Hoc o Enterprise/MDM
- TestFlight no es distribucion estable final
- Enterprise no aplica para agencia chica
- una app unlisted igual pasa por App Store

Conclusion: instalable directo sin App Store, si es PWA.

## 7. Experiencia mobile objetivo

No achicar todo el dashboard. Hacer un command center.

### Home mobile

- tiendas/clientes
- estado por tienda
- alertas criticas
- ultima sincronizacion
- accion "Copiar prompt para Claude/Codex" con contexto resumido y rango actual
- deep links a apps de IA solo si hay soporte real; no asumir `claude://` o equivalente

### Store mobile

Prioridad:

1. Resumen
2. Alertas
3. Cashflow
4. Meta Ads
5. Productos criticos
6. Creativos
7. Reportes/notas

Desktop-only al inicio:

- carga masiva de costos
- tablas largas
- configuraciones avanzadas
- auditorias profundas

## 8. MCP como interfaz para IA

El MCP debe ser la puerta estable para Claude/Codex.

Tools existentes utiles:

- `list_stores`
- `get_store_overview`
- `get_sync_status`
- `get_ai_context_snapshot`
- `get_creative_pipeline`
- `get_commercial_overview`
- `get_reports`
- `get_financial_consistency`
- `create_report`
- `save_analysis`
- `create_team_note`

Tools a sumar cuando esten justificadas:

- `get_alerts`
- `get_cashflow_projection`
- `get_costs_overview`
- `get_products_risk`
- `get_customer_segments`
- `create_action_plan` solo si existe antes un modelo `ActionPlan`
- `mark_action_status` solo si existe antes un modelo/flujo de acciones

Prompts MCP a mejorar:

- auditoria diaria
- plan de accion semanal
- briefing de guiones
- briefing de imagenes
- diagnostico de cashflow
- diagnostico de stock

## 9. Notificaciones

Orden realista para agencia ecommerce:

1. Centro de alertas in-app.
2. WhatsApp para Lucas/equipo en alertas criticas.
3. Email como backup/transaccional.
4. Web Push PWA como mejora, no canal principal.
5. Push nativo solo si hay Capacitor/app store.

No empezar por Web Push. Primero tiene que estar claro que las alertas son buenas.

## 10. Roadmap corregido

### Fase A - Gap analysis + hardening bloqueante

Objetivo: no exponer credenciales ni escrituras remotas inseguras.

- Auditar lo que ya existe vs lo que falta.
- Cifrar tokens TN/Meta/Shopify en `Store`.
- Migrar tokens existentes.
- Helmet + CORS por origen + HSTS/CSP razonable.
- Rate limit por usuario/token en endpoints sensibles.
- Whitelist estricta en MCP write tools.
- `additionalProperties: false` en writes.
- Cablear `AuditLog` en MCP writes y endpoints sensibles.
- Error reporting externo.
- Backup Mongo antes de cambios de seguridad/migraciones.

Estimacion: 1 semana.

Definition of Done:

- Script/verificacion confirma que no quedan tokens TN/Meta/Shopify planos en `Store`.
- Migracion de tokens es idempotente y documentada.
- Refresh de tokens escribe en formato cifrado.
- `additionalProperties: false` en todas las MCP write tools.
- Tests o script de schema check validan whitelist de writes.
- `AuditLog` registra al menos MCP writes y endpoints sensibles definidos.
- CORS restrictivo y Helmet activos en entorno productivo.
- `trust proxy` configurado para el proveedor elegido.
- Sentry/Logtail recibe evento de prueba.
- Backup Mongo probado antes de migraciones.

### Fase B - Deploy productivo + PWA base

Objetivo: acceso real desde compu/celular por dominio.

- Railway/Render usando estructura actual.
- HTTPS.
- Variables productivas.
- Build frontend servido correctamente.
- `manifest.webmanifest`, icons, theme color.
- Service worker minimo, sin cache agresivo de datos vivos.
- QA en celular real con Límite Deportes.
- Mongo Atlas IP allowlist restringida a proveedor + IP admin.
- Usuario Mongo con permisos minimos, no root.
- Backups automaticos habilitados antes de escrituras remotas.
- Verificar que Vite no embeba secrets en el bundle publico.

Estimacion: 1 semana.

Definition of Done:

- Login funciona en desktop y mobile real.
- Límite Deportes carga Resumen/Alertas/Cashflow sin errores visibles.
- Health check publico responde.
- Variables publicas del frontend auditadas.
- No hay secrets en `dist`.
- Mongo Atlas conecta solo con usuario/permisos esperados.

### Fase C - Mobile command center selectivo

Objetivo: revisar situaciones desde celular sin reescribir toda la app.

- Home mobile con tiendas y alertas.
- Store overview mobile.
- Alertas mobile-first usando endpoints existentes.
- Cashflow/Meta/Productos criticos como vistas compactas.
- Tablas/configs complejas marcadas como mejor en desktop.
- Ocultar chat AI del nav mobile con feature flag.

Estimacion: 2-3 semanas, o 1 semana si se hace version minima "estado + alertas".

Definition of Done:

- Flujo mobile principal funciona en iPhone/Android: abrir tienda, ver alertas, entrar a evidencia, volver.
- No hay tablas criticas desbordando en las vistas mobile priorizadas.
- Las pantallas desktop-only muestran aviso claro en mobile.
- Chat AI no aparece como experiencia principal.

### Fase D - Notificaciones por canal real

Objetivo: alertas fuera de la app.

- WhatsApp para alertas criticas.
- Email transaccional.
- Preferencias por tienda/usuario.
- Web Push solo despues de validar alertas.

Estimacion: 1 semana.

Definition of Done:

- Al menos una alerta critica de prueba llega por WhatsApp/email al destinatario correcto.
- Preferencias evitan duplicar ruido.
- Las alertas tienen evidencia suficiente para decidir si actuar.

### Fase E - Remote MCP seguro

Objetivo: Claude/Codex conectan sin depender de UI ni maquina local.

Requisito: Fase A cerrada.

- Modelo `ApiToken`.
- scopes iniciales: `read:metrics`, `read:cashflow`, `read:costs`, `read:alerts`, `write:report`, `write:note`.
- default deny.
- token hash SHA-256 con pepper + expiracion 90 dias default + revocacion.
- decidir transporte inicial: SSE para Claude Desktop o Streamable HTTP para Claude Code; si ambos son necesarios, documentar y testear ambos.
- AuditLog obligatorio por call.
- observability MCP: latencia y tasa de error por tool desde `AuditLog`.
- endpoint/admin UI para crear/revocar tokens.
- docs de conexion.

Estimacion: 2 semanas.

Definition of Done:

- Token se muestra una sola vez al crearse.
- Token revocado deja de funcionar inmediatamente.
- Token expirado falla con error claro.
- Tool sin scope falla por default deny.
- Cada call MCP queda en `AuditLog` con tool, store, status y latencia.
- Dashboard o query documentada permite ver error rate/latencia por tool.
- No se usa JWT humano para MCP remoto.

### Fase F - Tools MCP nuevas on demand

Objetivo: sumar profundidad segun uso real.

- `get_alerts` primero, porque el modelo ya existe.
- Luego cashflow/productos/clientes/costos segun lo que Claude/Codex pidan realmente.
- Writes nuevos requieren modelo y ownership antes de exponerse.

Estimacion: continuo.

## 11. Estimacion honesta

- Fase A+B: 2 semanas.
- Fase C minima: +1 semana.
- Fase C completa: +2-3 semanas.
- Fase D: +1 semana.
- Fase E: +2 semanas.

Total razonable:

- V1 segura y usable mobile minima: 3-4 semanas.
- V1 fuerte con notificaciones: 5-7 semanas.
- Remote MCP seguro: 7-9 semanas si se suma despues.

## 12. Preguntas abiertas

1. Si el uso real sera 80% Claude/Codex por MCP y 20% UI, conviene hacer mobile command center completo o solo estado + alertas?
2. Que alertas son suficientemente confiables para molestar por WhatsApp?
3. Que datos pueden leer las IAs sin permiso extra y que datos requieren scopes separados?
4. Hace falta versioning/locking en reportes si MCP y UI pueden escribir, o alcanza `ReportVersion` append-only?
5. Que politica de retencion aplica para ordenes/clientes finales?
6. Como alertar cuando falla refresh de tokens TN/Meta?
7. Que parte de `aiService` debe dividirse entre contexto, providers y features visibles?
8. Remote MCP debe nacer solo read-only y habilitar writes despues?
9. El canal de IA externa en mobile sera solo "copiar prompt" o tambien deep links cuando existan?
10. Que transporte MCP se prioriza primero: SSE, Streamable HTTP, o ambos?

## 13. Veredicto actualizado

La intuicion base sigue correcta:

- PWA/mobile-first antes que app nativa real.
- MCP antes que chat AI interno.
- IA externa con datos reales, no UI scraping.

Pero el orden correcto cambia:

1. Hardening y gap analysis.
2. Deploy/PWA.
3. Mobile command center selectivo.
4. Notificaciones por WhatsApp/email.
5. Remote MCP solo despues de seguridad.

El bloqueador principal no es diseño mobile ni App Store: es seguridad de tokens, auth/scopes y auditoria antes de exponer acceso remoto.
