const mongoose = require('mongoose');
const AdAnalysis = require('../models/AdAnalysis');
const MetaDailyInsight = require('../models/MetaDailyInsight');

/**
 * Lectura de análisis de ads ya clasificados. El análisis vivía adentro de la
 * app (Anthropic API) y migró a MCP: la IA externa clasifica los ads y guarda
 * AdAnalysis docs. La app solo lee y agrega.
 */

/**
 * Estadísticas agrupadas por ángulo. Combina los AdAnalysis con las métricas
 * agregadas de MetaDailyInsight para devolver performance promedio por ángulo.
 */
async function getAngleStats({ storeId, from, to }) {
  const storeObjectId = new mongoose.Types.ObjectId(storeId);
  const analyses = await AdAnalysis.find({ storeId: storeObjectId }).lean();
  if (analyses.length === 0) {
    return { angles: [], totalAnalyzed: 0 };
  }

  const metaIds = analyses.map((a) => a.metaId);

  const dateMatch = from && to
    ? { $gte: new Date(from), $lte: new Date(to + 'T23:59:59.999Z') }
    : null;

  const insightMatch = {
    storeId: storeObjectId,
    metaId: { $in: metaIds },
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
        clicks: { $sum: '$clicks' },
        purchases: { $sum: '$purchases' },
        purchaseValue: { $sum: '$purchaseValue' },
      },
    },
  ]);

  const insightMap = new Map(insightsAgg.map((i) => [i._id, i]));

  const byAngle = {};
  for (const an of analyses) {
    const ins = insightMap.get(an.metaId) || { spend: 0, impressions: 0, clicks: 0, purchases: 0, purchaseValue: 0 };
    if (!byAngle[an.angle]) {
      byAngle[an.angle] = {
        angle: an.angle,
        label: an.angleLabel,
        ads: 0,
        spend: 0,
        revenue: 0,
        purchases: 0,
        impressions: 0,
        clicks: 0,
        sampleHook: an.hook,
      };
    }
    byAngle[an.angle].ads += 1;
    byAngle[an.angle].spend += Number(ins.spend || 0);
    byAngle[an.angle].revenue += Number(ins.purchaseValue || 0);
    byAngle[an.angle].purchases += Number(ins.purchases || 0);
    byAngle[an.angle].impressions += Number(ins.impressions || 0);
    byAngle[an.angle].clicks += Number(ins.clicks || 0);
  }

  const angles = Object.values(byAngle).map((g) => ({
    ...g,
    roas: g.spend > 0 ? g.revenue / g.spend : 0,
    ctr: g.impressions > 0 ? (g.clicks / g.impressions) * 100 : 0,
    cpa: g.purchases > 0 ? g.spend / g.purchases : null,
  }));

  angles.sort((a, b) => b.roas - a.roas);

  return { angles, totalAnalyzed: analyses.length };
}

/**
 * Devuelve todos los análisis del store indexados por metaId.
 */
async function getAllAnalyses(storeId) {
  const items = await AdAnalysis.find({ storeId: new mongoose.Types.ObjectId(storeId) }).lean();
  const byMetaId = {};
  for (const item of items) {
    byMetaId[item.metaId] = item;
  }
  return byMetaId;
}

module.exports = {
  getAngleStats,
  getAllAnalyses,
};
