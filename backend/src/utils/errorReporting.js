/**
 * Wrapper opt-in para error reporting externo (Sentry).
 * Activación: setear SENTRY_DSN en el .env. Sin la var, este módulo es no-op
 * (no se importa @sentry/node, no abre conexiones).
 *
 * Llamadas:
 *   initErrorReporting(app?) — al boot, antes de routes (si pasás `app`
 *     instala request handler de Sentry; opcional para apps sin servir HTTP).
 *   captureException(err, context?) — reporta a Sentry. Si está apagado,
 *     loguea y sigue.
 *   getSentry() — devuelve la instancia o null.
 */
const logger = require('./logger');

let Sentry = null;
let initialized = false;

function isEnabled() {
  return !!process.env.SENTRY_DSN;
}

function initErrorReporting(app) {
  if (!isEnabled()) {
    logger.info('[errorReporting] SENTRY_DSN no configurado — error reporting externo apagado.');
    return null;
  }
  if (initialized) return Sentry;

  // Lazy require: solo si está activado.
  // eslint-disable-next-line global-require
  Sentry = require('@sentry/node');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || undefined,
    // Sampling razonable: 100% de errors, 10% de performance traces.
    tracesSampleRate: 0.1,
    // Filtros básicos
    beforeSend(event) {
      // No reportar requests que dieron 404 — son ruido.
      if (event.tags?.statusCode === '404') return null;
      return event;
    },
  });

  // Si tenemos `app` Express, le metemos el request handler. Tiene que ir
  // ANTES de cualquier otro middleware o route.
  if (app && typeof app.use === 'function' && Sentry.Handlers?.requestHandler) {
    app.use(Sentry.Handlers.requestHandler({
      user: ['id', 'email'],
      ip: true,
    }));
  }

  initialized = true;
  logger.info(`[errorReporting] Sentry activado (env=${process.env.NODE_ENV || 'development'}).`);
  return Sentry;
}

/**
 * Coloca el error handler de Sentry justo antes del errorHandler de Express.
 * Esto captura los errors que pasan por next(err).
 */
function attachErrorHandler(app) {
  if (!initialized || !Sentry?.Handlers?.errorHandler) return;
  app.use(Sentry.Handlers.errorHandler());
}

function captureException(err, context = {}) {
  if (!initialized || !Sentry) {
    logger.error(`[errorReporting] (no Sentry) ${err?.stack || err?.message || err}`);
    return;
  }
  try {
    Sentry.captureException(err, { extra: context });
  } catch (e) {
    logger.error(`[errorReporting] Sentry capture falló: ${e.message}`);
  }
}

function captureMessage(message, level = 'info', context = {}) {
  if (!initialized || !Sentry) return;
  try {
    Sentry.captureMessage(message, { level, extra: context });
  } catch {
    // silent
  }
}

module.exports = {
  isEnabled,
  initErrorReporting,
  attachErrorHandler,
  captureException,
  captureMessage,
  getSentry: () => Sentry,
};
