# Hooks Analytics

Plataforma de analytics para agencias de e-commerce. Conecta TiendaNube + Meta Ads, centraliza métricas, genera insights con AI, y permite gestionar múltiples tiendas desde un solo dashboard configurable.

## Requisitos previos

- **Node.js** v18 o superior
- **MongoDB** — cuenta en [MongoDB Atlas](https://www.mongodb.com/atlas) (free tier funciona) o instancia local
- **Git**

### Opcionales (para funcionalidad completa)

- **TiendaNube** — App ID y Secret para sincronizar órdenes/productos
- **Meta (Facebook)** — App ID y Secret para sincronizar campañas/ads
- **Anthropic API Key** o **OpenAI API Key** — para análisis AI, chat, y reportes

---

## Instalación paso a paso

### 1. Clonar el repositorio

```bash
git clone https://github.com/lucasvar-eng/Hooks-analytics.git
cd Hooks-analytics
```

### 2. Configurar variables de entorno

Copiar el archivo de ejemplo y completar los valores:

```bash
cp .env.example .env
```

Editar `.env` con tus datos:

```env
# Obligatorios
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb+srv://tu-usuario:tu-password@tu-cluster.mongodb.net/ecom-analytics
JWT_SECRET=una-clave-secreta-random-larga

# Opcionales — TiendaNube
TN_APP_ID=
TN_APP_SECRET=
TN_CALLBACK_URL=http://localhost:3000/api/tn/callback

# Opcionales — Meta Ads
META_APP_ID=
META_APP_SECRET=
META_CALLBACK_URL=http://localhost:3000/api/meta/callback

# Opcionales — AI (se puede configurar después desde la UI)
ANTHROPIC_API_KEY=
```

> **Nota:** La app funciona sin las claves de TiendaNube, Meta o AI. Podés importar datos manualmente via CSV y configurar AI después desde tu perfil de usuario.

### 3. Instalar dependencias

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 4. Crear el usuario admin

```bash
cd ../backend
node src/seed.js
```

Esto crea un usuario admin con:
- **Email:** `lucas@hooks.com.ar`
- **Password:** `hooks2026`

> Cambiá el email/password en `backend/src/seed.js` antes de correr el seed si querés usar otros datos.

### 5. Build del frontend

```bash
cd ../frontend
npm run build
```

### 6. Copiar build al backend

El backend sirve el frontend como archivos estáticos:

```bash
# Desde la raíz del proyecto
cp -r frontend/dist/* backend/public/
```

En Windows (cmd):
```cmd
xcopy /s /y frontend\dist\* backend\public\
```

### 7. Iniciar el servidor

```bash
cd backend
npm start
```

La app queda corriendo en **http://localhost:3000**

---

## Desarrollo (modo dev)

Si querés desarrollar con hot-reload:

```bash
# Terminal 1 — Backend con nodemon
cd backend
npm run dev

# Terminal 2 — Frontend con Vite (puerto 5173)
cd frontend
npm run dev
```

El frontend en desarrollo corre en `http://localhost:5173` y hace proxy al backend en `:3000`.

---

## Estructura del proyecto

```
ecom-analytics/
├── .env                    # Variables de entorno (no se commitea)
├── .env.example            # Template de variables
├── backend/
│   ├── public/             # Frontend build (archivos estáticos)
│   ├── src/
│   │   ├── config/         # Database, environment
│   │   ├── controllers/    # Lógica de cada módulo
│   │   ├── middleware/      # Auth, error handler
│   │   ├── models/         # Mongoose schemas
│   │   ├── routes/         # Express routes
│   │   ├── services/       # Business logic, cron jobs, AI
│   │   ├── seed.js         # Script para crear admin inicial
│   │   └── server.js       # Entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # Componentes React reutilizables
│   │   ├── hooks/          # Custom hooks
│   │   ├── pages/          # Páginas de la app
│   │   ├── services/       # API client (axios)
│   │   ├── store/          # Redux slices
│   │   └── App.jsx         # Router principal
│   ├── tailwind.config.js
│   └── package.json
└── README.md
```

---

## Módulos principales

| Módulo | Descripción |
|--------|-------------|
| **Dashboard** | Fully configurable con widgets: KPIs, grupos, tablas, notas, separadores |
| **Tienda** | Resumen de ventas, medios de pago, NC/RC, devoluciones |
| **Meta Ads** | Campañas con veredicto automático (ESCALAR/PAUSAR/TESTEAR/REVISAR/MANTENER) |
| **Creativos** | Ranking de ads por performance con tier A-E |
| **Cashflow** | Forecast de cobros, detalle diario, comisiones |
| **Costos** | P&L completo, breakeven, importación de costos CSV |
| **Productos** | Catálogo, perfil por producto, simulador de precio |
| **Clientes** | Segmentación RFM, cohorts, listado filtrable |
| **Simulador** | What-if con sliders: CPM, CTR, CVR, AOV, Budget |
| **Reportes** | Análisis AI guardables + Report Builder multi-sección |
| **TopicMap** | CRUD de tópicos de contenido con status |
| **LanguageBank** | Banco de frases, objeciones, vocabulario, hooks |
| **Competencia** | CRUD competidores + análisis AI por competidor |
| **Alertas** | Alertas automáticas por rule-based diagnostics cada 6h |
| **Settings** | Objetivos, cotización dólar, thresholds de veredictos, métricas home, AI context |
| **User Management** | Admin: crear/editar usuarios, roles, acceso por tienda |

---

## Configuración de AI

La AI se puede configurar de dos formas:

1. **Variables de entorno** (`.env`) — aplica como fallback global
2. **Desde la UI** (Mi Perfil) — cada usuario configura su provider (Anthropic/OpenAI), API key, y modelos

También podés agregar contexto AI por tienda desde Settings > Contexto AI.

---

## Importación de datos sin integraciones

Si no tenés las claves de TiendaNube o Meta:

- **Meta Ads:** Importar CSV desde la pestaña "Importar CSV" en Meta Ads
- **Productos/Costos:** Importar CSV desde Costos > Importar costos
- **Órdenes:** Se sincronizan vía TiendaNube o se pueden cargar manualmente

---

## Deploy en producción

1. Configurar `.env` con `NODE_ENV=production` y un `JWT_SECRET` seguro
2. Build del frontend: `cd frontend && npm run build`
3. Copiar build: `cp -r frontend/dist/* backend/public/`
4. Iniciar: `cd backend && npm start`

Para usar PM2:

```bash
npm install -g pm2
cd backend
pm2 start src/server.js --name ecom-backend
pm2 save
```

---

## Tech Stack

- **Frontend:** React 18, Vite, TailwindCSS, Redux Toolkit, React Router
- **Backend:** Node.js, Express, Mongoose, JWT auth
- **Database:** MongoDB
- **AI:** Anthropic Claude / OpenAI GPT (configurable)
- **Cron:** node-cron (sync TN, sync Meta, diagnostics, cashflow)
