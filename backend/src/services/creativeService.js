const mongoose = require('mongoose');
const Store = require('../models/Store');
const MetaCampaign = require('../models/MetaCampaign');
const MetaDailyInsight = require('../models/MetaDailyInsight');
const TopicMap = require('../models/TopicMap');
const LanguageBank = require('../models/LanguageBank');
const Competitor = require('../models/Competitor');
const metaAPI = require('./metaAPI');
const { buildBusinessDateKeyMatch } = require('../utils/businessDate');
const storeConnections = require('./storeConnections');

function getConfiguredMetaAccounts(store) {
  const configured = Array.isArray(store?.metaAdAccounts) ? store.metaAdAccounts.filter((item) => item?.id) : [];
  if (configured.length) return configured;
  if (store?.metaAdAccountId) return [{ id: store.metaAdAccountId, isPrimary: true }];
  return [];
}

function buildDateOptions(from, to) {
  if (from && to) {
    return { dateFrom: String(from).slice(0, 10), dateTo: String(to).slice(0, 10) };
  }
  return { datePreset: 'last_30d' };
}

async function fetchLiveAdInsights(store, from, to) {
  const token = await storeConnections.getToken(store?._id, 'meta');
  const accounts = getConfiguredMetaAccounts(store);
  if (!token || !accounts.length) return [];

  const options = {
    level: 'ad',
    ...buildDateOptions(from, to),
  };

  const chunks = await Promise.allSettled(
    accounts.map((account) => metaAPI.getInsightsForAdAccount(account.id, token, options))
  );

  return chunks
    .filter((result) => result.status === 'fulfilled')
    .flatMap((result) => result.value || []);
}

function metricsFromInsightRow(row) {
  const spend = Number(row.spend || 0);
  const impressions = Number(row.impressions || 0);
  const reach = Number(row.reach || 0);
  const clicks = Number(row.clicks || 0);
  const purchases = metaAPI.parseActions(row.actions, 'purchase');
  const purchaseValue = metaAPI.parseActionValues(row.action_values, 'purchase');

  return {
    spend,
    impressions,
    reach,
    clicks,
    purchases,
    purchaseValue,
    roas: spend > 0 ? purchaseValue / spend : 0,
    cpa: purchases > 0 ? spend / purchases : spend > 0 ? Infinity : 0,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
  };
}

function aggregateInsightRows(rows, idKey, nameKey) {
  const map = new Map();

  for (const row of rows || []) {
    const id = row[idKey];
    if (!id) continue;

    const current = map.get(id) || {
      id,
      nombre: row[nameKey] || '',
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      purchases: 0,
      purchaseValue: 0,
    };

    current.nombre = current.nombre || row[nameKey] || '';
    current.spend += Number(row.spend || 0);
    current.impressions += Number(row.impressions || 0);
    current.reach += Number(row.reach || 0);
    current.clicks += Number(row.clicks || 0);
    current.purchases += metaAPI.parseActions(row.actions, 'purchase');
    current.purchaseValue += metaAPI.parseActionValues(row.action_values, 'purchase');
    map.set(id, current);
  }

  return map;
}

async function fetchLiveCampaignMetadata(store) {
  const token = await storeConnections.getToken(store?._id, 'meta');
  const accounts = getConfiguredMetaAccounts(store);
  if (!token || !accounts.length) return new Map();

  const chunks = await Promise.allSettled(
    accounts.map((account) => metaAPI.getCampaigns(account.id, token))
  );

  const map = new Map();
  chunks
    .filter((result) => result.status === 'fulfilled')
    .flatMap((result) => result.value || [])
    .forEach((campaign) => {
      map.set(campaign.id, {
        nombre: campaign.name || '',
        status: campaign.status || '',
        objective: campaign.objective || '',
      });
    });

  return map;
}

/**
 * Auto-classify ads into ABCDE tiers based on ROAS and CPA vs averages.
 */
async function autoClassifyAds(storeId, from, to) {
  const dateMatch = from || to ? buildBusinessDateKeyMatch(from, to, true) : null;

  // Get ad-level metrics
  const match = {
    storeId: new mongoose.Types.ObjectId(storeId),
    level: 'ad',
  };

  const ads = await MetaCampaign.find(match).lean();
  if (ads.length === 0) return [];

  const store = await Store.findById(storeId).select('metaAdAccountId metaAdAccounts').lean();
  const liveRows = await fetchLiveAdInsights(store, from, to);
  const liveMap = aggregateInsightRows(liveRows, 'ad_id', 'ad_name');

  let insightMap = {};
  if (!liveMap.size) {
    const insightMatch = {
      storeId: new mongoose.Types.ObjectId(storeId),
      metaId: { $in: ads.map((a) => a.metaId) },
      granularity: 'ad',
    };
    if (dateMatch) insightMatch.date = dateMatch;

    const insightsAgg = await MetaDailyInsight.aggregate([
      { $match: insightMatch },
      {
        $group: {
          _id: '$metaId',
          spend: { $sum: '$spend' },
          impressions: { $sum: '$impressions' },
          reach: { $sum: '$reach' },
          clicks: { $sum: '$clicks' },
          purchases: { $sum: '$purchases' },
          purchaseValue: { $sum: '$purchaseValue' },
        },
      },
    ]);

    for (const i of insightsAgg) {
      insightMap[i._id] = i;
    }
  }

  // Calculate derived metrics + averages
  const enriched = ads.map((ad) => {
    const live = liveMap.get(ad.metaId);
    const ins = live || insightMap[ad.metaId] || { spend: 0, impressions: 0, reach: 0, clicks: 0, purchases: 0, purchaseValue: 0 };
    const roas = ins.spend > 0 ? ins.purchaseValue / ins.spend : 0;
    const cpa = ins.purchases > 0 ? ins.spend / ins.purchases : ins.spend > 0 ? Infinity : 0;
    const ctr = ins.impressions > 0 ? (ins.clicks / ins.impressions) * 100 : 0;

    return {
      ...ad,
      nombre: ad.nombre || live?.nombre || `Ad ${ad.metaId}`,
      metrics: { ...ins, roas, cpa, ctr },
    };
  });

  // Only classify ads with spend
  const withSpend = enriched.filter((a) => a.metrics.spend > 0);
  if (withSpend.length === 0) {
    return enriched.map((a) => ({
      ...a,
      status: a.status || 'ACTIVE',
      tier: 'E',
    }));
  }

  const avgRoas = withSpend.reduce((s, a) => s + a.metrics.roas, 0) / withSpend.length;
  const avgCpa = withSpend.reduce((s, a) => s + (isFinite(a.metrics.cpa) ? a.metrics.cpa : 0), 0) / withSpend.length;

  // Classify
  return enriched.map((ad) => {
    if (ad.metrics.spend === 0) return { ...ad, tier: 'E' };

    const r = ad.metrics.roas;
    const c = ad.metrics.cpa;

    let tier;
    if (r >= avgRoas * 1.5 && c <= avgCpa * 0.7) tier = 'A';
    else if (r >= avgRoas * 1.2 && c <= avgCpa * 0.9) tier = 'B';
    else if (r >= avgRoas * 0.8 && c <= avgCpa * 1.2) tier = 'C';
    else if (r >= avgRoas * 0.5) tier = 'D';
    else tier = 'E';

    return { ...ad, tier, status: ad.status || 'ACTIVE' };
  });
}

/**
 * Get campaign-level results table.
 */
async function getCampaignResults(storeId, from, to) {
  const dateMatch = from || to ? buildBusinessDateKeyMatch(from, to, true) : null;

  // Get campaign-level insights
  const campaigns = await MetaCampaign.find({
    storeId,
    level: 'campaign',
  }).lean();

  const store = await Store.findById(storeId).select('metaAdAccountId metaAdAccounts').lean();
  const liveRows = await fetchLiveAdInsights(store, from, to);
  const liveMap = aggregateInsightRows(liveRows, 'campaign_id', 'campaign_name');
  const liveCampaignMeta = await fetchLiveCampaignMetadata(store);

  let insightMap = {};
  if (!liveMap.size) {
    const insightMatch = {
      storeId: new mongoose.Types.ObjectId(storeId),
      granularity: 'campaign',
    };
    if (dateMatch) insightMatch.date = dateMatch;

    const insightsAgg = await MetaDailyInsight.aggregate([
      {
        $match: {
          ...insightMatch,
          metaId: { $in: campaigns.map((c) => c.metaId) },
        },
      },
      {
        $group: {
          _id: '$metaId',
          spend: { $sum: '$spend' },
          impressions: { $sum: '$impressions' },
          reach: { $sum: '$reach' },
          clicks: { $sum: '$clicks' },
          purchases: { $sum: '$purchases' },
          purchaseValue: { $sum: '$purchaseValue' },
        },
      },
    ]);

    for (const i of insightsAgg) insightMap[i._id] = i;
  }

  return campaigns.map((c) => {
    const live = liveMap.get(c.metaId);
    const liveMeta = liveCampaignMeta.get(c.metaId) || {};
    const ins = live || insightMap[c.metaId] || { spend: 0, impressions: 0, reach: 0, clicks: 0, purchases: 0, purchaseValue: 0 };
    return {
      ...c,
      nombre: c.nombre || live?.nombre || liveMeta.nombre || `Campaña ${c.metaId}`,
      status: c.status || liveMeta.status || 'ACTIVE',
      objective: c.objective || liveMeta.objective || '',
      metrics: {
        ...ins,
        roas: ins.spend > 0 ? ins.purchaseValue / ins.spend : 0,
        cpa: ins.purchases > 0 ? ins.spend / ins.purchases : 0,
        ctr: ins.impressions > 0 ? (ins.clicks / ins.impressions) * 100 : 0,
      },
    };
  });
}

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function toBreakdown(map) {
  return Object.entries(map)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

async function getFrameworkOverview(storeId) {
  const sid = new mongoose.Types.ObjectId(storeId);
  const [topics, hooks, objections, competitors] = await Promise.all([
    TopicMap.find({ storeId }).sort({ updatedAt: -1 }).lean(),
    LanguageBank.find({ storeId, tipo: 'hook' }).sort({ updatedAt: -1 }).lean(),
    LanguageBank.find({ storeId, tipo: 'objecion' }).sort({ updatedAt: -1 }).lean(),
    Competitor.find({ storeId }).sort({ updatedAt: -1 }).lean(),
  ]);

  const activeTopics = topics.filter((item) => item.status === 'active');
  const unresolvedObjections = objections.filter((item) => !item.response || !item.response.trim());
  const competitorAngles = competitors.flatMap((item) => item.angles || []);
  const competitorTerritories = competitors.flatMap((item) => item.territories || []);
  const ownAngles = new Set(
    [...topics.map((item) => item.angle), ...hooks.map((item) => item.angle)]
      .filter(Boolean)
      .map((item) => item.trim().toLowerCase())
  );
  const ownTerritories = new Set(
    [...topics.map((item) => item.territory), ...hooks.map((item) => item.territory)]
      .filter(Boolean)
      .map((item) => item.trim().toLowerCase())
  );

  const whitespaceSplit = (value) => String(value || '').trim();
  const strategicGaps = {
    missingResponses: unresolvedObjections.slice(0, 8).map((item) => ({
      texto: item.texto,
      avatar: item.avatar || null,
      awarenessLevel: item.awarenessLevel || 'unknown',
    })),
    competitorAngles: [...new Set(competitorAngles.map(whitespaceSplit).filter(Boolean))]
      .filter((item) => !ownAngles.has(item.toLowerCase()))
      .slice(0, 8),
    competitorTerritories: [...new Set(competitorTerritories.map(whitespaceSplit).filter(Boolean))]
      .filter((item) => !ownTerritories.has(item.toLowerCase()))
      .slice(0, 8),
  };

  const summary = {
    topics: topics.length,
    activeTopics: activeTopics.length,
    hooks: hooks.length,
    objections: objections.length,
    unresolvedObjections: unresolvedObjections.length,
    competitors: competitors.length,
  };

  return {
    summary,
    awarenessBreakdown: toBreakdown(
      countBy([...topics, ...hooks, ...objections, ...competitors], (item) => item.awarenessLevel || 'unknown')
    ),
    avatarBreakdown: toBreakdown(
      countBy([...topics, ...hooks, ...objections, ...competitors], (item) => item.avatar || 'Sin avatar')
    ),
    territoryBreakdown: toBreakdown(
      countBy(
        [
          ...topics.map((item) => item.territory),
          ...hooks.map((item) => item.territory),
          ...competitors.flatMap((item) => item.territories || []),
        ],
        (item) => item || 'Sin territorio'
      )
    ).slice(0, 8),
    strategicGaps,
    highlightedTopics: activeTopics.slice(0, 6).map((item) => ({
      nombre: item.nombre,
      priority: item.priority || 'medium',
      avatar: item.avatar || null,
      awarenessLevel: item.awarenessLevel || 'unknown',
      angle: item.angle || null,
      territory: item.territory || null,
      stage: item.stage || 'unknown',
    })),
  };
}

async function getCreativePipeline(storeId, from, to) {
  const [ads, framework] = await Promise.all([
    autoClassifyAds(storeId, from, to),
    getFrameworkOverview(storeId),
  ]);

  const withSpend = ads.filter((ad) => (ad.metrics?.spend || 0) > 0);
  const sortedBySpend = [...withSpend].sort((a, b) => (b.metrics?.spend || 0) - (a.metrics?.spend || 0));

  const escalar = sortedBySpend
    .filter((ad) => ['A', 'B'].includes(ad.tier))
    .slice(0, 6)
    .map((ad) => ({
      type: 'escalar',
      title: ad.nombre,
      reason: `Tier ${ad.tier} con ROAS ${ad.metrics?.roas?.toFixed(2) || '0.00'}x y ${ad.metrics?.purchases || 0} compras`,
      priority: ad.tier === 'A' ? 'high' : 'medium',
      metaId: ad.metaId,
    }));

  const pausar = sortedBySpend
    .filter((ad) => ['D', 'E'].includes(ad.tier) && (ad.metrics?.spend || 0) >= 50000)
    .slice(0, 6)
    .map((ad) => ({
      type: 'pausar',
      title: ad.nombre,
      reason: `Tier ${ad.tier} con spend ${Math.round(ad.metrics?.spend || 0).toLocaleString('es-AR')} y ROAS ${ad.metrics?.roas?.toFixed(2) || '0.00'}x`,
      priority: ad.tier === 'E' ? 'high' : 'medium',
      metaId: ad.metaId,
    }));

  const testear = [
    ...(framework?.strategicGaps?.missingResponses || []).slice(0, 3).map((item) => ({
      type: 'testear',
      title: item.texto,
      reason: `Objeción sin respuesta${item.avatar ? ` para avatar ${item.avatar}` : ''}`,
      priority: 'high',
    })),
    ...(framework?.strategicGaps?.competitorAngles || []).slice(0, 3).map((item) => ({
      type: 'testear',
      title: item,
      reason: 'Ángulo detectado en competencia y todavía no cubierto',
      priority: 'medium',
    })),
    ...(framework?.strategicGaps?.competitorTerritories || []).slice(0, 3).map((item) => ({
      type: 'testear',
      title: item,
      reason: 'Territorio abierto por explorar en framework creativo',
      priority: 'medium',
    })),
  ].slice(0, 8);

  const summary = {
    adsConSpend: withSpend.length,
    tierA: ads.filter((ad) => ad.tier === 'A').length,
    tierB: ads.filter((ad) => ad.tier === 'B').length,
    tierDOrE: ads.filter((ad) => ['D', 'E'].includes(ad.tier)).length,
    escalar: escalar.length,
    pausar: pausar.length,
    testear: testear.length,
  };

  return {
    summary,
    escalar,
    pausar,
    testear,
  };
}

function buildCreativeMasterSheet({ from, to, pipeline, frameworkOverview, brief }) {
  const updatedAt = new Date().toISOString();
  const dateLabel = new Date().toISOString().slice(0, 10);

  const pipelineRows = [
    ...(pipeline?.escalar || []).map((item) => ({
      updated_at: updatedAt,
      period_from: from || '',
      period_to: to || '',
      bucket: 'escalar',
      priority: item.priority || '',
      title: item.title || '',
      reason: item.reason || '',
      meta_id: item.metaId || '',
      action: 'Escalar o duplicar ganador',
      owner: '',
      status: 'pendiente',
    })),
    ...(pipeline?.pausar || []).map((item) => ({
      updated_at: updatedAt,
      period_from: from || '',
      period_to: to || '',
      bucket: 'pausar',
      priority: item.priority || '',
      title: item.title || '',
      reason: item.reason || '',
      meta_id: item.metaId || '',
      action: 'Revisar, pausar o rehacer',
      owner: '',
      status: 'pendiente',
    })),
    ...(pipeline?.testear || []).map((item) => ({
      updated_at: updatedAt,
      period_from: from || '',
      period_to: to || '',
      bucket: 'testear',
      priority: item.priority || '',
      title: item.title || '',
      reason: item.reason || '',
      meta_id: item.metaId || '',
      action: 'Diseñar test o concepto nuevo',
      owner: '',
      status: 'backlog',
    })),
  ];

  const historicoRows = [
    {
      snapshot_date: dateLabel,
      period_from: from || '',
      period_to: to || '',
      ads_con_spend: pipeline?.summary?.adsConSpend || 0,
      escalar: pipeline?.summary?.escalar || 0,
      pausar: pipeline?.summary?.pausar || 0,
      testear: pipeline?.summary?.testear || 0,
      tier_a: pipeline?.summary?.tierA || 0,
      tier_b: pipeline?.summary?.tierB || 0,
      tier_d_e: pipeline?.summary?.tierDOrE || 0,
      brief_confidence: brief?.confidence != null ? Number((brief.confidence * 100).toFixed(0)) : '',
      note: brief?.title || 'Snapshot manual del pipeline creativo',
    },
  ];

  const backlogRows = [
    ...(pipeline?.testear || []).map((item) => ({
      created_at: dateLabel,
      source: 'pipeline',
      priority: item.priority || '',
      hypothesis: item.title || '',
      reason: item.reason || '',
      status: 'pendiente',
      linked_meta_id: item.metaId || '',
    })),
    ...((brief?.ideas || []).map((idea) => ({
      created_at: dateLabel,
      source: 'brief_ai',
      priority: idea.priority || 'medium',
      hypothesis: `${idea.hook} · ${idea.angle}`,
      reason: idea.why || '',
      status: 'pendiente',
      linked_meta_id: '',
    })) || []),
  ];

  const frameworkRows = [
    ...((frameworkOverview?.highlightedTopics || []).map((item) => ({
      type: 'topic',
      name: item.nombre || '',
      priority: item.priority || '',
      avatar: item.avatar || '',
      awareness_level: item.awarenessLevel || '',
      angle: item.angle || '',
      territory: item.territory || '',
      notes: item.stage || '',
    })) || []),
    ...((frameworkOverview?.strategicGaps?.missingResponses || []).map((item) => ({
      type: 'objection_gap',
      name: item.texto || '',
      priority: 'high',
      avatar: item.avatar || '',
      awareness_level: item.awarenessLevel || '',
      angle: '',
      territory: '',
      notes: 'Objeción sin respuesta',
    })) || []),
    ...((frameworkOverview?.strategicGaps?.competitorAngles || []).map((item) => ({
      type: 'angle_gap',
      name: item || '',
      priority: 'medium',
      avatar: '',
      awareness_level: '',
      angle: item || '',
      territory: '',
      notes: 'Detectado en competencia y no cubierto',
    })) || []),
    ...((frameworkOverview?.strategicGaps?.competitorTerritories || []).map((item) => ({
      type: 'territory_gap',
      name: item || '',
      priority: 'medium',
      avatar: '',
      awareness_level: '',
      angle: '',
      territory: item || '',
      notes: 'Territorio abierto por explorar',
    })) || []),
  ];

  return {
    documentName: `pipeline-creativo-maestro-${dateLabel}`,
    tabs: [
      {
        name: 'Pipeline actual',
        mode: 'overwrite',
        description: 'Vista operativa del momento. Se pisa en cada actualización.',
        keyColumns: [],
        columns: ['updated_at', 'period_from', 'period_to', 'bucket', 'priority', 'title', 'reason', 'meta_id', 'action', 'owner', 'status'],
        rows: pipelineRows,
      },
      {
        name: 'Historico',
        mode: 'append_unique',
        description: 'Snapshots por fecha para seguir evolución del pipeline.',
        keyColumns: ['snapshot_date', 'period_from', 'period_to'],
        columns: ['snapshot_date', 'period_from', 'period_to', 'ads_con_spend', 'escalar', 'pausar', 'testear', 'tier_a', 'tier_b', 'tier_d_e', 'brief_confidence', 'note'],
        rows: historicoRows,
      },
      {
        name: 'Backlog tests',
        mode: 'append_unique',
        description: 'Hipótesis y tests creativos pendientes.',
        keyColumns: ['created_at', 'source', 'hypothesis'],
        columns: ['created_at', 'source', 'priority', 'hypothesis', 'reason', 'status', 'linked_meta_id'],
        rows: backlogRows,
      },
      {
        name: 'Framework',
        mode: 'overwrite',
        description: 'Mapa de topics, gaps, territorios y ángulos vigentes.',
        keyColumns: [],
        columns: ['type', 'name', 'priority', 'avatar', 'awareness_level', 'angle', 'territory', 'notes'],
        rows: frameworkRows,
      },
    ],
  };
}

async function getCreativeMasterSheet(storeId, from, to, brief = null) {
  const [pipeline, frameworkOverview] = await Promise.all([
    getCreativePipeline(storeId, from, to),
    getFrameworkOverview(storeId),
  ]);

  return buildCreativeMasterSheet({
    from,
    to,
    pipeline,
    frameworkOverview,
    brief,
  });
}

module.exports = {
  autoClassifyAds,
  getCampaignResults,
  getFrameworkOverview,
  getCreativePipeline,
  buildCreativeMasterSheet,
  getCreativeMasterSheet,
};
