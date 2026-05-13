const Store = require('../models/Store');
const User = require('../models/User');
const Order = require('../models/Order');
const DailyMetric = require('../models/DailyMetric');
const MetaDailyInsight = require('../models/MetaDailyInsight');
const { aggregateRange } = require('../services/metricCalculator');
const { getFinancialConsistency } = require('../services/financeService');
const tnAPI = require('../services/tiendanubeAPI');
const shopifyAPI = require('../services/shopifyAPI');
const { syncOrders, syncProducts } = require('../services/syncTiendanube');
const { syncShopifyOrders, syncShopifyProducts } = require('../services/syncShopify');
const { analyze } = require('../services/aiService');
const { DEFAULT_THRESHOLDS } = require('../services/verdictEngine');
const { getEffectiveTarget } = require('../services/targetService');
const { getCostCoverage } = require('../services/costCoverage');
const { isCentralizedTiendanubeStore } = require('../utils/tiendanubeToken');
const { buildBusinessDateKeyMatch, buildBusinessSourceDateMatch } = require('../utils/businessDate');

function safeDelta(current, baseline, invert = false) {
  if (!baseline) return 0;
  const delta = ((current - baseline) / Math.abs(baseline)) * 100;
  return invert ? delta * -1 : delta;
}

function classifyStatus(score, thresholds = { warningPct: 10, criticalPct: 25 }) {
  if (score <= -thresholds.criticalPct) return 'critical';
  if (score <= -thresholds.warningPct) return 'warning';
  return 'ok';
}

function compareAgainstTargets(current, target) {
  if (!target) {
    return { score: 0, status: 'neutral', items: [] };
  }

  const warningPct = target.alertThresholds?.warningPct || 10;
  const criticalPct = target.alertThresholds?.criticalPct || 25;
  const items = [];

  const pushItem = (key, label, currentValue, targetValue, invert = false) => {
    if (!targetValue && targetValue !== 0) return;
    const deltaPct = safeDelta(currentValue || 0, targetValue, invert);
    items.push({
      key,
      label,
      current: currentValue || 0,
      target: targetValue,
      deltaPct,
      status: classifyStatus(deltaPct, { warningPct, criticalPct }),
    });
  };

  pushItem('roas', 'ROAS', current.roas, target.kpis?.roasTarget);
  pushItem('trueRoas', 'True ROAS', current.trueRoas, target.kpis?.trueRoasTarget);
  pushItem('cpa', 'CPA', current.cpa, target.kpis?.cpaMaximo, true);
  pushItem('profitMargin', 'Profit Margin', current.profitMargin, target.kpis?.profitMarginMin);
  pushItem('aov', 'AOV', current.aov, target.kpis?.aovTarget);
  pushItem('ncPct', 'NC %', current.ncPct, target.kpis?.ncPctTarget);
  pushItem('conversionRate', 'CVR', current.conversionRate, target.kpis?.conversionRateTarget);

  const statusRank = { critical: -2, warning: -1, ok: 1 };
  const total = items.reduce((acc, item) => acc + (statusRank[item.status] || 0), 0);

  return {
    score: items.length ? total / items.length : 0,
    status: total <= -1 ? 'critical' : total < 1 ? 'warning' : 'ok',
    items,
  };
}

function buildHealth(current, target, previous) {
  const targetComparison = compareAgainstTargets(current, target);
  const warningPct = target?.alertThresholds?.warningPct || 10;
  const criticalPct = target?.alertThresholds?.criticalPct || 25;

  const acquisitionScore = current.adSpend > 0
    ? [
        classifyStatus(safeDelta(current.ctr, previous.ctr || current.ctr || 0), { warningPct, criticalPct }),
        classifyStatus(safeDelta(current.cpc || 0, target?.kpis?.cpaMaximo || current.cpc || 0, true), { warningPct, criticalPct }),
      ]
    : ['neutral'];

  const conversionScore = [
    classifyStatus(safeDelta(current.conversionRate || 0, target?.kpis?.conversionRateTarget || current.conversionRate || 0), { warningPct, criticalPct }),
    classifyStatus(safeDelta(current.purchaseRate || 0, previous.purchaseRate || current.purchaseRate || 0), { warningPct, criticalPct }),
  ];

  const monetizationScore = [
    classifyStatus(safeDelta(current.aov || 0, target?.kpis?.aovTarget || current.aov || 0), { warningPct, criticalPct }),
    classifyStatus(safeDelta(current.ncPct || 0, target?.kpis?.ncPctTarget || current.ncPct || 0), { warningPct, criticalPct }),
  ];

  const profitabilityScore = [
    classifyStatus(safeDelta(current.trueRoas || 0, target?.kpis?.trueRoasTarget || current.trueRoas || 0), { warningPct, criticalPct }),
    classifyStatus(safeDelta(current.profitMargin || 0, target?.kpis?.profitMarginMin || current.profitMargin || 0), { warningPct, criticalPct }),
  ];

  const liquidityScore = [
    current.liquidable >= 0 ? 'ok' : 'warning',
    current.netRevenue >= 0 ? 'ok' : 'critical',
  ];

  const summarize = (items) => {
    if (items.includes('critical')) return 'critical';
    if (items.includes('warning')) return 'warning';
    if (items.includes('neutral')) return 'neutral';
    return 'ok';
  };

  return {
    acquisition: summarize(acquisitionScore),
    conversion: summarize(conversionScore),
    monetization: summarize(monetizationScore),
    profitability: summarize(profitabilityScore),
    retention: current.rcOrdenes > current.ncOrdenes ? 'ok' : current.ncOrdenes > 0 ? 'warning' : 'neutral',
    liquidity: summarize(liquidityScore),
    overall: targetComparison.status,
  };
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

function normalizeLogoUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('//')) return `https:${url}`;
  return url;
}

exports.list = async (req, res, next) => {
  try {
    const filter =
      req.user.role === 'admin'
        ? {}
        : { _id: { $in: req.user.storeAccess } };

    const stores = await Store.find(filter).select(
      'nombre tnNombre shopifyShopName plataforma logoUrl storeUrl integrationStatus metricasHome objetivos createdAt'
    );
    res.json(stores);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { nombre, tnStoreId, tnAccessToken } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    const store = await Store.create({ nombre: nombre.trim(), tnStoreId, tnAccessToken });

    // Add store to creator's storeAccess
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { storeAccess: store._id },
    });

    res.status(201).json(store);
  } catch (error) {
    next(error);
  }
};

exports.createConnected = async (req, res, next) => {
  try {
    const { platform, aliasNombre, tnAccessToken, tnStoreId, shopifyAccessToken, shopifyShopDomain } = req.body;

    if (!platform || !['tiendanube', 'shopify', 'manual'].includes(platform)) {
      return res.status(400).json({ error: 'Plataforma inválida' });
    }

    if (platform === 'manual') {
      const nombre = aliasNombre?.trim();
      if (!nombre) {
        return res.status(400).json({ error: 'El nombre es requerido para crear una tienda manual' });
      }

      const store = await Store.create({ nombre, plataforma: 'manual' });
      await User.findByIdAndUpdate(req.user._id, { $addToSet: { storeAccess: store._id } });
      return res.status(201).json({
        store,
        connection: { platform: 'manual', connected: false, syncStarted: false },
      });
    }

    if (platform === 'tiendanube') {
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
      const existingStore = await Store.findOne({ tnStoreId: normalizedStoreId }).select('nombre');
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
              ? 'No se pudo validar el token de Tienda Nube para ese Store ID'
              : 'No se pudo validar la conexión con Tienda Nube',
        });
      }
      const resolvedName = resolveTiendanubeStoreName(metadata, aliasNombre?.trim() || `Tienda ${normalizedStoreId}`);
      const store = await Store.create({
        nombre: aliasNombre?.trim() || resolvedName,
        plataforma: 'tiendanube',
        tnAccessToken: useCentralToken ? '' : normalizedToken,
        tnStoreId: normalizedStoreId,
        tnNombre: resolvedName,
        tnTokenSource: useCentralToken ? 'cro_service' : 'manual',
        logoUrl: resolveTiendanubeLogo(metadata),
        storeUrl: resolveStoreUrl(metadata, null),
        integrationStatus: {
          tiendanube: { connected: true },
          metaAds: { connected: false },
          shopify: { connected: false },
        },
      });

      await User.findByIdAndUpdate(req.user._id, { $addToSet: { storeAccess: store._id } });

      res.status(201).json({
        store,
        connection: {
          platform: 'tiendanube',
          connected: true,
          syncStarted: true,
          tokenSource: useCentralToken ? 'cro_service' : 'manual',
          message: useCentralToken
            ? 'Tienda Nube conectada con token centralizado de CRO.'
            : 'Tienda Nube conectada con token manual.',
        },
      });

      syncProducts(store).catch(() => {});
      syncOrders(store).catch(() => {});
      return;
    }

    if (!shopifyAccessToken || !shopifyShopDomain) {
      return res.status(400).json({ error: 'Se requieren shopifyAccessToken y shopifyShopDomain' });
    }

    const normalizedDomain = shopifyAPI.normalizeShopDomain(shopifyShopDomain);
    const normalizedToken = String(shopifyAccessToken).trim();
    const existingStore = await Store.findOne({ shopifyShopDomain: normalizedDomain }).select('nombre');
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
    const resolvedName = metadata?.name || aliasNombre?.trim() || normalizedDomain;

    const store = await Store.create({
      nombre: aliasNombre?.trim() || resolvedName,
      plataforma: 'shopify',
      shopifyAccessToken: normalizedToken,
      shopifyShopDomain: metadata.shopDomain || normalizedDomain,
      shopifyShopName: resolvedName,
      shopifyShopId: metadata.shopId || undefined,
      logoUrl: metadata.logoUrl || null,
      storeUrl: metadata.primaryDomain || `https://${metadata.shopDomain || normalizedDomain}`,
      integrationStatus: {
        tiendanube: { connected: false },
        metaAds: { connected: false },
        shopify: { connected: true },
      },
    });

    await User.findByIdAndUpdate(req.user._id, { $addToSet: { storeAccess: store._id } });

    res.status(201).json({
      store,
      connection: {
        platform: 'shopify',
        connected: true,
        syncStarted: true,
        message: 'Shopify quedó vinculado. Se inició la sincronización de pedidos y productos.',
      },
    });

    (async () => {
      try {
        await syncShopifyProducts(store);
        await syncShopifyOrders(store);
      } catch {}
    })();
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const store = await Store.findByIdAndDelete(req.params.id);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    res.json({ message: 'Tienda eliminada' });
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    res.json(store);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const store = await Store.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!store) return res.status(404).json({ error: 'Store not found' });
    res.json(store);
  } catch (error) {
    next(error);
  }
};

exports.getMetrics = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'from and to query params required' });
    }

    const current = await aggregateRange(id, from, to);

    // Calculate previous period (same duration, immediately before)
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const durationMs = toDate - fromDate;
    const prevTo = new Date(fromDate.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - durationMs);

    const previous = await aggregateRange(
      id,
      prevFrom.toISOString(),
      prevTo.toISOString()
    );
    const target = await getEffectiveTarget(id, { from, to });

    // Calculate deltas
    const deltas = {};
    for (const key of Object.keys(current)) {
      if (['_id', 'observed', 'derived', 'sourceCoverage'].includes(key)) continue;
      const cur = current[key] || 0;
      const prev = previous[key] || 0;
      deltas[key] = prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : 0;
    }

    const targetComparison = compareAgainstTargets(current, target);
    const health = buildHealth(current, target, previous);
    const comparisons = {
      previousPeriod: {
        revenueDeltaPct: safeDelta(current.revenue || 0, previous.revenue || 0),
        profitDeltaPct: safeDelta(current.profit || 0, previous.profit || 0),
        roasDeltaPct: safeDelta(current.roas || 0, previous.roas || 0),
      },
      target: targetComparison,
      breakeven: {
        roasDeltaPct: safeDelta(current.roas || 0, target?.breakeven?.roasBreakeven || 0),
        cpaDeltaPct: safeDelta(current.cpa || 0, target?.breakeven?.cpaBreakeven || 0, true),
        aovDeltaPct: safeDelta(current.aov || 0, target?.breakeven?.aovMinimo || 0),
      },
    };

    const costCoverage = await getCostCoverage(id, from, to);

    res.json({
      current,
      previous,
      deltas,
      target,
      comparisons,
      health,
      sourceCoverage: current.sourceCoverage || {},
      costCoverage,
    });
  } catch (error) {
    next(error);
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50, from, to } = req.query;

    const filter = { storeId: id };
    if (from || to) {
      filter.fechaCreacion = buildBusinessSourceDateMatch(from, to);
    }

    const orders = await Order.find(filter)
      .sort({ fechaCreacion: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Order.countDocuments(filter);

    res.json({ orders, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};

exports.syncNow = async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    if (!store.tnStoreId || (!store.tnAccessToken && store.tnTokenSource !== 'cro_service')) {
      if (!store.shopifyAccessToken || !store.shopifyShopDomain) {
        return res.status(400).json({ error: 'No hay una plataforma conectada' });
      }
    }

    // Run sync in background (don't block the response)
    res.json({ status: 'sync_started' });

    if (store.plataforma === 'shopify' || (store.integrationStatus?.shopify?.connected && store.shopifyAccessToken)) {
      (async () => {
        try {
          await syncShopifyProducts(store);
          await syncShopifyOrders(store);
        } catch (err) {
          console.error('Background sync Shopify failed:', err.message);
        }
      })();
    } else {
      syncProducts(store).catch((err) => {
        console.error('Background sync products failed:', err.message);
      });
      syncOrders(store).catch((err) => {
        console.error('Background sync orders failed:', err.message);
      });
    }
  } catch (error) {
    next(error);
  }
};

exports.getDailyMetrics = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;

    const filter = { storeId: id };
    if (from || to) {
      filter.date = buildBusinessDateKeyMatch(from, to, true);
    }

    const daily = await DailyMetric.find(filter).sort({ date: 1 }).lean();
    res.json(daily);
  } catch (error) {
    next(error);
  }
};

exports.getOrderDetail = async (req, res, next) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      storeId: req.params.id,
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (error) {
    next(error);
  }
};

exports.getExecutiveOverview = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'from and to query params required' });
    }

    const filter =
      req.user.role === 'admin'
        ? {}
        : { _id: { $in: req.user.storeAccess } };

    const stores = await Store.find(filter).select(
      'nombre plataforma logoUrl storeUrl integrationStatus objetivos metricasHome createdAt'
    ).lean();

    const items = await Promise.all(
      stores.map(async (store) => {
        const current = await aggregateRange(store._id, from, to);

        const fromDate = new Date(from);
        const toDate = new Date(to);
        const durationMs = toDate - fromDate;
        const prevTo = new Date(fromDate.getTime() - 1);
        const prevFrom = new Date(prevTo.getTime() - durationMs);
        const previous = await aggregateRange(
          store._id,
          prevFrom.toISOString(),
          prevTo.toISOString()
        );

        const target = await getEffectiveTarget(store._id, { from, to });
        const targetComparison = compareAgainstTargets(current, target);
        const health = buildHealth(current, target, previous);
        const riskFlags = [];

        if (!store.integrationStatus?.tiendanube?.connected) riskFlags.push('TiendaNube desconectada');
        if (current.adSpend > 0 && current.trueRoas < (target?.breakeven?.roasBreakeven || 1)) riskFlags.push('Debajo de breakeven');
        if ((current.officialProfit ?? current.adjustedProfit ?? current.profit) < 0) riskFlags.push('Profit oficial negativo');
        if (current.ncPct < (target?.kpis?.ncPctTarget || 0) && current.ncOrdenes > 0) riskFlags.push('Captación nueva débil');

        return {
          storeId: store._id,
          nombre: store.nombre,
          current,
          previous,
          target,
          targetComparison,
          health,
          pacing: {
            revenueDeltaPct: safeDelta(current.revenue || 0, previous.revenue || 0),
            spendDeltaPct: safeDelta(current.adSpend || 0, previous.adSpend || 0),
            ordersDeltaPct: safeDelta(current.ordenesPositivas || 0, previous.ordenesPositivas || 0),
          },
          riskFlags,
          sourceCoverage: current.sourceCoverage || {},
        };
      })
    );

    const summary = items.reduce(
      (acc, item) => {
        acc.stores += 1;
        acc.revenue += item.current.revenue || 0;
        acc.profit += item.current.officialProfit || item.current.adjustedProfit || item.current.profit || 0;
        acc.adSpend += item.current.adSpend || 0;
        acc.orders += item.current.ordenesPositivas || 0;
        acc.alerts += item.riskFlags.length;
        if (item.health.overall === 'critical') acc.critical += 1;
        if (item.health.overall === 'warning') acc.warning += 1;
        return acc;
      },
      { stores: 0, revenue: 0, profit: 0, adSpend: 0, orders: 0, alerts: 0, critical: 0, warning: 0 }
    );

    summary.trueRoas = summary.adSpend > 0 ? summary.profit / summary.adSpend : 0;

    res.json({ summary, items });
  } catch (error) {
    next(error);
  }
};

exports.getFinancialConsistency = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to query params required' });
    }
    const result = await getFinancialConsistency(req.params.id, from, to);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Generate ad verdict thresholds using AI based on store's historical data.
 */
exports.generateVerdictThresholds = async (req, res, next) => {
  try {
    const storeId = req.params.id;
    const store = await Store.findById(storeId).select('nombre objetivos');
    if (!store) return res.status(404).json({ error: 'Store not found' });

    // Get last 30 days of ad data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const adData = await MetaDailyInsight.aggregate([
      { $match: { storeId: store._id, date: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: null,
          totalSpend: { $sum: '$spend' },
          totalPurchases: { $sum: '$purchases' },
          totalRevenue: { $sum: '$purchaseValue' },
          totalImpressions: { $sum: '$impressions' },
          totalClicks: { $sum: '$clicks' },
          days: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } },
        },
      },
    ]);

    const summary = adData[0] || {};
    const avgRoas = summary.totalSpend > 0 ? summary.totalRevenue / summary.totalSpend : 0;
    const avgCpa = summary.totalPurchases > 0 ? summary.totalSpend / summary.totalPurchases : 0;
    const daysActive = summary.days?.length || 0;

    // Try AI generation
    try {
      const prompt = `Basándote en estos datos de los últimos 30 días de la tienda "${store.nombre}":
- ROAS promedio: ${avgRoas.toFixed(2)}x
- CPA promedio: $${Math.round(avgCpa)}
- Gasto total: $${Math.round(summary.totalSpend || 0)}
- Compras totales: ${summary.totalPurchases || 0}
- Días activos: ${daysActive}
- Objetivos configurados: ${JSON.stringify(store.objetivos?.kpis || {})}

Generá umbrales personalizados para clasificar campañas. Respondé SOLO con un JSON válido (sin markdown, sin texto extra) con esta estructura exacta:
{"escalar":{"roasMin":number,"minSpend":number,"minPurchases":number},"mantener":{"roasMin":number,"minSpend":number},"revisar":{"roasMin":number,"cpaMaxPct":number},"pausar":{"roasMax":number,"minSpend":number,"minDays":number},"testear":{"maxSpend":number,"maxPurchases":number}}`;

      const result = await analyze('dashboard', storeId, null, null, req.user._id);
      // Try to parse JSON from the response
      const jsonMatch = result.analysis.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const thresholds = JSON.parse(jsonMatch[0]);
        return res.json({ thresholds, source: 'ai' });
      }
    } catch {
      // AI not available, generate rule-based defaults
    }

    // Fallback: generate sensible defaults based on data
    const thresholds = { ...DEFAULT_THRESHOLDS };
    if (avgRoas > 0) {
      thresholds.escalar.roasMin = Math.round(avgRoas * 1.5 * 10) / 10;
      thresholds.mantener.roasMin = Math.round(avgRoas * 0.8 * 10) / 10;
      thresholds.revisar.roasMin = Math.round(avgRoas * 0.5 * 10) / 10;
      thresholds.pausar.roasMax = Math.round(avgRoas * 0.3 * 10) / 10;
    }
    if (avgCpa > 0) {
      thresholds.escalar.minSpend = Math.round(avgCpa * 3);
      thresholds.pausar.minSpend = Math.round(avgCpa * 5);
      thresholds.testear.maxSpend = Math.round(avgCpa * 3);
    }

    res.json({ thresholds, source: 'rule_based' });
  } catch (error) {
    next(error);
  }
};
