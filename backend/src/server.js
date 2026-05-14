const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');
const { port, nodeEnv } = require('./config/environment');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const storeRoutes = require('./routes/storeRoutes');
const tnRoutes = require('./routes/tnRoutes');
const metaRoutes = require('./routes/metaRoutes');
const cashflowRoutes = require('./routes/cashflowRoutes');
const costosRoutes = require('./routes/costosRoutes');
const productRoutes = require('./routes/productRoutes');
const customerRoutes = require('./routes/customerRoutes');
const creativeRoutes = require('./routes/creativeRoutes');
const competitorRoutes = require('./routes/competitorRoutes');
const topicMapRoutes = require('./routes/topicMapRoutes');
const languageBankRoutes = require('./routes/languageBankRoutes');
const reportRoutes = require('./routes/reportRoutes');
const alertRoutes = require('./routes/alertRoutes');
const tiendaRoutes = require('./routes/tiendaRoutes');
const userSettingsRoutes = require('./routes/userSettingsRoutes');
const userManagementRoutes = require('./routes/userManagementRoutes');
const insightRoutes = require('./routes/insightRoutes');
const teamNoteRoutes = require('./routes/teamNoteRoutes');
const teamRoutes = require('./routes/teamRoutes');
const invitationRoutes = require('./routes/invitationRoutes');
const { startCronJobs } = require('./services/cronJobs');
const errorReporting = require('./utils/errorReporting');
const logger = require('./utils/logger');

const app = express();

// Init Sentry (no-op si no hay SENTRY_DSN). El request handler se inserta acá
// para que capture todo lo que sigue.
errorReporting.initErrorReporting(app);

// Detrás de Railway/Render/Cloudflare hay un proxy. Sin `trust proxy`, los
// rate-limits ven todas las requests como provenientes de la IP del proxy
// y el bruteforce por IP no funciona. `1` confía en un único proxy aguas
// arriba (el del platform). NO usar `true` (acepta cualquier X-Forwarded-For).
app.set('trust proxy', 1);

// Connect to MongoDB
connectDB();

// Security headers
app.use(helmet({
  // El frontend está servido desde el mismo origen en prod, pero igual desactivamos
  // CSP que rompe Vite dev. Para producción se recomienda configurar CSP estricto
  // basado en los dominios usados (TN images, Meta CDN, fonts, etc.).
  contentSecurityPolicy: false,
  // Permitimos cross-origin embedding para que iframes/imágenes externas (TN, Meta)
  // sigan funcionando.
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS — en prod, whitelist explícito vía CORS_ORIGIN (lista coma-separada).
// En dev (sin var seteada) acepta todo.
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
  : null;
app.use(cors(corsOrigins ? {
  origin: (origin, callback) => {
    // Same-origin requests (sin Origin header) o desde whitelist
    if (!origin || corsOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`Origin ${origin} no permitido por CORS`));
  },
  credentials: true,
} : {}));

// Global JSON limit: 1MB es más que suficiente para 99% de los requests.
// Endpoints que reciben payloads grandes (CSV import, MCP briefings) tienen
// override local con un parser dedicado.
const jsonGlobal = express.json({ limit: '1mb' });
const jsonLarge = express.json({ limit: '10mb' });
// Rutas que sí necesitan 10mb: CSV import de Meta y MCP write tools.
app.use(['/api/stores/:id/meta/csv-import', '/api/mcp', '/api/stores/:id/reports'], jsonLarge);
app.use(jsonGlobal);

// Rate limiting general
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Rate limit estricto para login (bruteforce defense)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 intentos cada 15 min por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de login. Esperá 15 minutos.' },
});
app.use('/api/auth/login', loginLimiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: nodeEnv, timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/tn', tnRoutes);
app.use('/api', metaRoutes);
app.use('/api', cashflowRoutes);
app.use('/api', costosRoutes);
app.use('/api', productRoutes);
app.use('/api', customerRoutes);
app.use('/api', creativeRoutes);
app.use('/api', competitorRoutes);
app.use('/api', topicMapRoutes);
app.use('/api', languageBankRoutes);
app.use('/api', reportRoutes);
app.use('/api', alertRoutes);
app.use('/api', insightRoutes);
app.use('/api', teamNoteRoutes);
app.use('/api', tiendaRoutes);
app.use('/api/user', userSettingsRoutes);
app.use('/api/admin/users', userManagementRoutes);
app.use('/api/invitations', invitationRoutes);

// Serve frontend in production
if (nodeEnv === 'production') {
  const publicPath = path.resolve(__dirname, '../public');
  app.use(express.static(publicPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Sentry error handler (capture errors que pasan por next(err)). Va ANTES
// del errorHandler propio para que vea los errors crudos.
errorReporting.attachErrorHandler(app);

// Error handler (must be last)
app.use(errorHandler);

// Red de seguridad: errores async no atrapados se loguean en lugar de tumbar el proceso.
// Muchos controllers no envuelven en try/catch — sin esto un validation error de Mongoose
// crashea el server entero (visto al testear ReportBuilder Save con payload mal mapeado).
process.on('unhandledRejection', (reason) => {
  logger.error(`unhandledRejection: ${reason?.stack || reason?.message || reason}`);
  errorReporting.captureException(reason instanceof Error ? reason : new Error(String(reason)), {
    type: 'unhandledRejection',
  });
});
process.on('uncaughtException', (err) => {
  logger.error(`uncaughtException: ${err?.stack || err?.message || err}`);
  errorReporting.captureException(err, { type: 'uncaughtException' });
});

app.listen(port, () => {
  logger.info(`Server running on port ${port} (${nodeEnv})`);
  startCronJobs();
});

module.exports = app;
