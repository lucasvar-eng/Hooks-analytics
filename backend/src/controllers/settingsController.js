const Store = require('../models/Store');
const { recalculateAllOrders } = require('../services/orderFinancials');
const { recalculateDailyMetric } = require('../services/metricCalculator');
const { syncOrders, syncProducts } = require('../services/syncTiendanube');
const { syncShopifyOrders, syncShopifyProducts } = require('../services/syncShopify');
const { syncMetaStructure, syncMetaInsights } = require('../services/syncMeta');
const tnAPI = require('../services/tiendanubeAPI');
const shopifyAPI = require('../services/shopifyAPI');
const metaAPI = require('../services/metaAPI');
const { isCentralizedTiendanubeStore } = require('../utils/tiendanubeToken');
const storeConnections = require('../services/storeConnections');
const DailyMetric = require('../models/DailyMetric');
const { dateKeyToLabel } = require('../utils/businessDate');
const Target = require('../models/Target');
const ImportBatch = require('../models/ImportBatch');
const { getCurrentMonthRange } = require('../services/targetService');
const { logAudit } = require('../services/auditLogService');
const { loadUserMetaToken } = require('./userSettingsController');
const logger = require('../utils/logger');

function normalizeLogoUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('//')) return `https:${url}`;
  return url;
}

function resolveTiendanubeStoreName(metadata, fallbackName) {
  if (!metadata) return fallbackName;
  if (typeof metadata.name === 'string' && metadata.name.trim()) return metadata.name.trim();
  if (metadata.name?.es) return metadata.name.es;
  if (metadata.name?.pt) return metadata.name.pt;
  if (metadata.name?.en) return metadata.name.en;
  if (metadata.store_name) return metadata.store_name;
  if (metadata.business_name) return metadata.business_name;
  return fallbackName;
}

function resolveTiendanubeLogo(metadata) {
  const candidate =
    metadata?.logo?.src ||
    metadata?.logo?.url ||
    metadata?.logo ||
    metadata?.main_image ||
    metadata?.images?.[0]?.src ||
    metadata?.images?.[0]?.url ||
    null;
  return normalizeLogoUrl(candidate);
}

function resolveStoreUrl(metadata, fallback) {
  const candidate =
    metadata?.original_domain ||
    metadata?.domain ||
    metadata?.domains?.[0]?.url ||
    metadata?.primaryDomain ||
    fallback ||
    null;
  if (!candidate) return null;
  if (String(candidate).startsWith('http')) return candidate;
  return `https://${String(candidate).replace(/^\/+/, '')}`;
}

function sanitizeMetaAccounts(accounts = []) {
  return accounts
    .map((account) => ({
      id: account.id,
      accountId: account.account_id,
      name: account.name,
      status: account.account_status,
      currency: account.currency,
      isActive: account.account_status === 1,
    }))
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
}

function resolveSelectedMetaAccount(accounts, requestedId) {
  const normalizedRequested = String(requestedId || '').trim();
  if (!normalizedRequested) return null;

  return (
    accounts.find((account) => account.id === normalizedRequested) ||
    accounts.find((account) => account.account_id === normalizedRequested) ||
    accounts.find((account) => `act_${account.account_id}` === normalizedRequested) ||
    null
  );
}

function buildSelectedMetaAccounts(accounts, requestedIds = []) {
  const normalizedIds = [...new Set(
    requestedIds
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  )];

  return normalizedIds
    .map((requestedId) => resolveSelectedMetaAccount(accounts, requestedId))
    .filter(Boolean);
}

exports.getSettings = async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id).select(
      'cotizacionDolar tasaIBB feePlataformaPct comisionPagoConfig costosEnvio costosAdicionales objetivos googleSheets'
    );
    if (!store) return res.status(404).json({ error: 'Store not found' });
    res.json(store);
  } catch (error) {
    next(error);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const allowedFields = [
      'cotizacionDolar',
      'tasaIBB',
      'feePlataformaPct',
      'comisionPagoConfig',
      'costosEnvio',
      'costosAdicionales',
      'objetivos',
      'metricasHome',
      'adVerdictThresholds',
      'googleSheets',
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const store = await Store.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!store) return res.status(404).json({ error: 'Store not found' });

    await logAudit({
      storeId: store._id,
      userId: req.user?._id,
      action: 'settings.updated',
      entityType: 'Store',
      entityId: store._id,
      details: { updatedFields: Object.keys(updates) },
    });

    res.json(store);
  } catch (error) {
    next(error);
  }
};

/**
 * Manual TiendaNube connection — paste access_token and store_id directly.
 * Useful when OAuth callback is not configured for the current environment.
 */
exports.connectTNManual = async (req, res, next) => {
  try {
    const { tnAccessToken, tnStoreId } = req.body;

    if (!tnStoreId) {
      return res.status(400).json({ error: 'Se requiere tnStoreId' });
    }

    const normalizedStoreId = String(tnStoreId).trim();
    const normalizedToken = String(tnAccessToken || '').trim();
    const useCentralToken = !normalizedToken && isCentralizedTiendanubeStore(normalizedStoreId);

    if (!normalizedToken && !useCentralToken) {
      return res.status(400).json({
        error: 'Se requiere tnAccessToken para esa tienda. Solo MANGUZ y Limite Deportes usan token centralizado.',
      });
    }

    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const existingStore = await Store.findOne({
      _id: { $ne: store._id },
      tnStoreId: normalizedStoreId,
    }).select('nombre');

    if (existingStore) {
      return res.status(409).json({
        error: `El tnStoreId ${normalizedStoreId} ya está vinculado a la tienda "${existingStore.nombre}"`,
      });
    }

    let metadata;
    try {
      metadata = await tnAPI.validateConnection(normalizedStoreId, normalizedToken || null);
    } catch (error) {
      const status = error.response?.status;
      return res.status(400).json({
        error:
          status === 401 || status === 403
            ? 'No se pudo validar el token de Tienda Nube para ese tnStoreId'
            : 'No se pudo validar la conexión con TiendaNube',
      });
    }

    store.tnStoreId = normalizedStoreId;
    store.tnTokenSource = useCentralToken ? 'cro_service' : 'manual';
    store.plataforma = 'tiendanube';
    store.tnNombre = resolveTiendanubeStoreName(metadata, store.tnNombre || store.nombre);
    store.logoUrl = resolveTiendanubeLogo(metadata) || store.logoUrl;
    store.storeUrl = resolveStoreUrl(metadata, store.storeUrl);
    store.integrationStatus.tiendanube.connected = true;
    store.integrationStatus.tiendanube.lastSync = new Date();
    await store.save();

    if (!useCentralToken && normalizedToken) {
      await storeConnections.setConnection(store._id, 'tiendanube', {
        accessToken: normalizedToken,
        metadata: { tnStoreId: store.tnStoreId, tnNombre: store.tnNombre, tokenSource: 'manual' },
        connectedByUser: req.user?._id,
      });
    } else if (useCentralToken) {
      // Si se mueve de manual a centralizado, borrar la conexión guardada
      await storeConnections.clearConnection(store._id, 'tiendanube');
    }

    await logAudit({
      storeId: store._id,
      userId: req.user?._id,
      action: 'integration.tiendanube.connected',
      entityType: 'Store',
      entityId: store._id,
      details: {
        tnStoreId: store.tnStoreId,
        mode: useCentralToken ? 'cro_service' : 'manual',
      },
    });

    logger.info(`Manual TN connection for store ${store.nombre} (tnStoreId: ${store.tnStoreId})`);

    // Trigger initial sync in background
    res.json({
      success: true,
      message: useCentralToken
        ? 'TiendaNube conectada con token centralizado de CRO. Sincronización iniciada...'
        : 'TiendaNube conectada. Sincronización iniciada...',
    });

    syncOrders(store).catch((err) => {
      logger.error(`Initial TN orders sync failed: ${err.message}`);
    });
    syncProducts(store).catch((err) => {
      logger.error(`Initial TN products sync failed: ${err.message}`);
    });
  } catch (error) {
    next(error);
  }
};

exports.connectShopifyManual = async (req, res, next) => {
  try {
    const { shopifyAccessToken, shopifyShopDomain } = req.body;

    if (!shopifyAccessToken || !shopifyShopDomain) {
      return res.status(400).json({ error: 'Se requieren shopifyAccessToken y shopifyShopDomain' });
    }

    const normalizedDomain = shopifyAPI.normalizeShopDomain(shopifyShopDomain);
    const normalizedToken = String(shopifyAccessToken).trim();

    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const existingStore = await Store.findOne({
      _id: { $ne: store._id },
      shopifyShopDomain: normalizedDomain,
    }).select('nombre');

    if (existingStore) {
      return res.status(409).json({
        error: `El dominio ${normalizedDomain} ya está vinculado a la tienda "${existingStore.nombre}"`,
      });
    }

    let metadata;
    try {
      metadata = await shopifyAPI.validateConnection(normalizedDomain, normalizedToken);
    } catch (error) {
      const status = error.response?.status;
      return res.status(400).json({
        error:
          status === 401 || status === 403
            ? 'El Admin API access token de Shopify no es válido para ese dominio'
            : 'No se pudo validar la conexión con Shopify',
      });
    }

    store.plataforma = 'shopify';
    store.shopifyShopDomain = metadata.shopDomain || normalizedDomain;
    store.shopifyShopName = metadata.name || store.shopifyShopName || store.nombre;
    store.shopifyShopId = metadata.shopId || store.shopifyShopId;
    store.logoUrl = metadata.logoUrl || store.logoUrl;
    store.storeUrl = metadata.primaryDomain || store.storeUrl;
    store.integrationStatus.shopify.connected = true;
    store.integrationStatus.shopify.lastSync = new Date();
    store.storeUrl = metadata.primaryDomain || store.storeUrl;
    await store.save();

    await storeConnections.setConnection(store._id, 'shopify', {
      accessToken: normalizedToken,
      metadata: {
        shopDomain: store.shopifyShopDomain,
        shopName: store.shopifyShopName,
        shopId: store.shopifyShopId,
      },
      connectedByUser: req.user?._id,
    });

    await logAudit({
      storeId: store._id,
      userId: req.user?._id,
      action: 'integration.shopify.connected',
      entityType: 'Store',
      entityId: store._id,
      details: {
        shopifyShopDomain: store.shopifyShopDomain,
        mode: 'manual',
      },
    });

    res.json({
      success: true,
      message: 'Shopify conectado. Sincronización iniciada.',
      metadata,
    });

    (async () => {
      try {
        await syncShopifyProducts(store);
        await syncShopifyOrders(store);
      } catch (err) {
        logger.error(`Initial Shopify sync failed: ${err.message}`);
      }
    })();
  } catch (error) {
    next(error);
  }
};

exports.previewMetaAdAccounts = async (req, res, next) => {
  try {
    let token = String(req.body.metaAccessToken || '').trim();
    let usedSavedToken = false;
    if (!token) {
      // Fallback: usar el token guardado en el perfil del user
      token = await loadUserMetaToken(req.user._id);
      usedSavedToken = !!token;
    }
    if (!token) {
      return res.status(400).json({
        error: 'No hay token de Meta. Pasá uno en el body o guardalo en /profile.',
      });
    }

    const accounts = await metaAPI.getAdAccounts(token);
    const sanitized = sanitizeMetaAccounts(accounts);

    res.json({
      success: true,
      accounts: sanitized,
      usedSavedToken,
    });
  } catch (error) {
    const status = error.response?.status;
    res.status(400).json({
      error:
        status === 401 || status === 403
          ? 'El access token de Meta no es válido o no tiene permisos suficientes'
          : 'No se pudieron obtener las cuentas publicitarias de Meta',
    });
  }
};

exports.connectMetaManual = async (req, res, next) => {
  try {
    let token = String(req.body.metaAccessToken || '').trim();
    const requestedAccountId = String(req.body.metaAdAccountId || '').trim();
    const requestedAccountIds = Array.isArray(req.body.metaAdAccountIds)
      ? req.body.metaAdAccountIds
      : [];
    const expiresAtInput = req.body.metaTokenExpiresAt ? new Date(req.body.metaTokenExpiresAt) : null;
    const selectionSeed = requestedAccountIds.length ? requestedAccountIds : [requestedAccountId];

    if (!token) {
      // Fallback: usar el token guardado en el perfil del user
      token = await loadUserMetaToken(req.user._id);
    }
    if (!token || selectionSeed.filter(Boolean).length === 0) {
      return res.status(400).json({ error: 'Falta el token de Meta (guardalo en /profile o pasalo en el body) o no seleccionaste ninguna cuenta publicitaria.' });
    }

    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const accounts = await metaAPI.getAdAccounts(token);
    const selectedAccounts = buildSelectedMetaAccounts(accounts, selectionSeed);

    if (!selectedAccounts.length) {
      return res.status(400).json({
        error: 'Ninguna de las cuentas publicitarias seleccionadas está disponible para este token de Meta',
      });
    }

    const inactiveAccounts = selectedAccounts.filter((account) => account.account_status !== 1);
    if (inactiveAccounts.length > 0) {
      return res.status(400).json({
        error: 'Hay cuentas publicitarias seleccionadas que no están activas en Meta',
      });
    }

    for (const account of selectedAccounts) {
      await metaAPI.getInsightsForAdAccount(account.id, token, {
        level: 'ad',
        datePreset: 'last_7d',
        fields: ['campaign_id', 'campaign_name', 'ad_id', 'ad_name', 'spend', 'impressions', 'clicks'],
      });
    }

    const primaryAccount = selectedAccounts[0];
    const expiresAt =
      expiresAtInput && !Number.isNaN(expiresAtInput.getTime())
        ? expiresAtInput
        : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    store.metaAdAccountId = primaryAccount.id;
    store.metaAdAccounts = selectedAccounts.map((account, index) => ({
      id: account.id,
      accountId: account.account_id,
      name: account.name,
      status: account.account_status,
      currency: account.currency,
      isPrimary: index === 0,
      connectedAt: new Date(),
    }));
    store.metaTokenExpiresAt = expiresAt;
    store.integrationStatus.metaAds.connected = true;
    await store.save();

    await storeConnections.setConnection(store._id, 'meta', {
      accessToken: token,
      expiresAt,
      metadata: {
        adAccountId: store.metaAdAccountId,
        adAccounts: store.metaAdAccounts.map((account) => ({
          id: account.id,
          accountId: account.accountId,
          name: account.name,
          currency: account.currency,
          isPrimary: account.isPrimary,
        })),
      },
      connectedByUser: req.user?._id,
    });

    await logAudit({
      storeId: store._id,
      userId: req.user?._id,
      action: 'integration.meta.connected',
      entityType: 'Store',
      entityId: store._id,
      details: {
        metaAdAccountId: store.metaAdAccountId,
        metaAccountName: primaryAccount.name,
        metaAccountIds: selectedAccounts.map((account) => account.id),
      },
    });

    res.json({
      success: true,
      message: 'Meta Ads conectado. Sincronización inicial iniciada...',
      account: {
        id: primaryAccount.id,
        accountId: primaryAccount.account_id,
        name: primaryAccount.name,
        currency: primaryAccount.currency,
      },
      accounts: selectedAccounts.map((account, index) => ({
        id: account.id,
        accountId: account.account_id,
        name: account.name,
        currency: account.currency,
        isPrimary: index === 0,
      })),
    });

    (async () => {
      try {
        await syncMetaStructure(store);
        await syncMetaInsights(store, 30);
      } catch (err) {
        logger.error(`Initial Meta sync failed for ${store.nombre}: ${err.message}`);
      }
    })();
  } catch (error) {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      return res.status(400).json({
        error: 'El access token de Meta no es válido o perdió permisos para esa cuenta publicitaria',
      });
    }
    next(error);
  }
};

exports.syncMetaManual = async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const hasMetaAccounts =
      Array.isArray(store.metaAdAccounts) && store.metaAdAccounts.some((item) => item?.id);
    const metaToken = await storeConnections.getToken(store._id, 'meta');

    if (!metaToken || (!store.metaAdAccountId && !hasMetaAccounts)) {
      return res.status(400).json({ error: 'La tienda no tiene Meta configurado' });
    }

    const daysBack = Math.max(1, Math.min(Number(req.body.daysBack || 30), 180));

    res.json({
      success: true,
      message: `Sincronización de Meta iniciada para los últimos ${daysBack} días`,
    });

    (async () => {
      try {
        await syncMetaStructure(store);
        await syncMetaInsights(store, daysBack);
      } catch (err) {
        logger.error(`Manual Meta sync failed for ${store.nombre}: ${err.message}`);
      }
    })();
  } catch (error) {
    next(error);
  }
};

exports.getTargets = async (req, res, next) => {
  try {
    const targets = await Target.find({ storeId: req.params.id, isActive: true })
      .sort({ periodStart: -1 })
      .limit(24)
      .lean();
    res.json(targets);
  } catch (error) {
    next(error);
  }
};

exports.upsertTarget = async (req, res, next) => {
  try {
    const monthRange = getCurrentMonthRange();
    const periodStart = req.body.periodStart ? new Date(req.body.periodStart) : monthRange.periodStart;
    const periodEnd = req.body.periodEnd ? new Date(req.body.periodEnd) : monthRange.periodEnd;

    periodStart.setHours(0, 0, 0, 0);
    periodEnd.setHours(23, 59, 59, 999);

    const payload = {
      storeId: req.params.id,
      periodStart,
      periodEnd,
      phase: req.body.phase || 'crecimiento',
      kpis: req.body.kpis || {},
      breakeven: req.body.breakeven || {},
      alertThresholds: req.body.alertThresholds || { warningPct: 10, criticalPct: 25 },
      notes: req.body.notes || '',
      source: 'manual',
      isActive: true,
      createdBy: req.user?._id,
    };

    const target = await Target.findOneAndUpdate(
      { storeId: req.params.id, periodStart, periodEnd },
      payload,
      { upsert: true, new: true, runValidators: true }
    );

    await Store.findByIdAndUpdate(req.params.id, {
      objetivos: {
        fase: payload.phase,
        kpis: payload.kpis,
        breakeven: payload.breakeven,
        alertThresholds: payload.alertThresholds,
      },
    });

    await logAudit({
      storeId: req.params.id,
      userId: req.user?._id,
      action: 'targets.upserted',
      entityType: 'Target',
      entityId: target._id,
      details: {
        periodStart,
        periodEnd,
        phase: payload.phase,
      },
    });

    res.json(target);
  } catch (error) {
    next(error);
  }
};

exports.getImportBatches = async (req, res, next) => {
  try {
    const batches = await ImportBatch.find({ storeId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(batches);
  } catch (error) {
    next(error);
  }
};

/**
 * Recalculate all order financials + DailyMetrics.
 * Used when financial config changes (tasaIBB, comisiones, etc.)
 */
exports.recalculate = async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    res.json({ status: 'recalculation_started' });

    // Run in background
    (async () => {
      try {
        const processed = await recalculateAllOrders(store);

        // Recalculate all DailyMetrics that exist
        const dailyMetrics = await DailyMetric.find({ storeId: store._id }).select('date');
        for (const dm of dailyMetrics) {
          await recalculateDailyMetric(store._id, dateKeyToLabel(dm.date));
        }

        logger.info(`Full recalculation done for ${store.nombre}: ${processed} orders, ${dailyMetrics.length} days`);
      } catch (error) {
        logger.error(`Recalculation failed for ${store.nombre}: ${error.message}`);
      }
    })();
  } catch (error) {
    next(error);
  }
};
