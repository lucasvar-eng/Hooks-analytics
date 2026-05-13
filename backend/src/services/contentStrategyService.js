const TopicMap = require('../models/TopicMap');
const LanguageBank = require('../models/LanguageBank');
const Competitor = require('../models/Competitor');

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

async function getTopicMapOverview(storeId) {
  const topics = await TopicMap.find({ storeId }).sort({ updatedAt: -1 }).lean();
  const activeTopics = topics.filter((item) => item.status === 'active');
  const scalingTopics = topics.filter((item) => item.stage === 'scaling');
  const testingTopics = topics.filter((item) => item.stage === 'testing');
  const highPriority = topics.filter((item) => item.priority === 'high');
  const missingHypothesis = topics.filter((item) => !String(item.hypothesis || '').trim());
  const missingAngle = topics.filter((item) => !String(item.angle || '').trim());
  const missingTerritory = topics.filter((item) => !String(item.territory || '').trim());

  return {
    summary: {
      total: topics.length,
      active: activeTopics.length,
      scaling: scalingTopics.length,
      testing: testingTopics.length,
      highPriority: highPriority.length,
      missingHypothesis: missingHypothesis.length,
      missingAngle: missingAngle.length,
      missingTerritory: missingTerritory.length,
    },
    statusBreakdown: toBreakdown(countBy(topics, (item) => item.status || 'draft')),
    awarenessBreakdown: toBreakdown(countBy(topics, (item) => item.awarenessLevel || 'unknown')),
    stageBreakdown: toBreakdown(countBy(topics, (item) => item.stage || 'unknown')),
    avatarBreakdown: toBreakdown(countBy(topics, (item) => item.avatar || 'Sin avatar')),
    territoryBreakdown: toBreakdown(countBy(topics, (item) => item.territory || 'Sin territorio')).slice(0, 8),
    gaps: {
      missingHypothesis: missingHypothesis.slice(0, 6).map((item) => item.nombre),
      missingAngle: missingAngle.slice(0, 6).map((item) => item.nombre),
      missingTerritory: missingTerritory.slice(0, 6).map((item) => item.nombre),
    },
  };
}

async function getLanguageBankOverview(storeId) {
  const entries = await LanguageBank.find({ storeId }).sort({ updatedAt: -1 }).lean();
  const hooks = entries.filter((item) => item.tipo === 'hook');
  const objections = entries.filter((item) => item.tipo === 'objecion');
  const unresolvedObjections = objections.filter((item) => !String(item.response || '').trim());
  const missingAvatar = entries.filter((item) => !String(item.avatar || '').trim());
  const missingAngle = entries.filter((item) => !String(item.angle || '').trim());
  const missingTerritory = entries.filter((item) => !String(item.territory || '').trim());

  return {
    summary: {
      total: entries.length,
      hooks: hooks.length,
      objections: objections.length,
      unresolvedObjections: unresolvedObjections.length,
      missingAvatar: missingAvatar.length,
      missingAngle: missingAngle.length,
      missingTerritory: missingTerritory.length,
    },
    typeBreakdown: toBreakdown(countBy(entries, (item) => item.tipo || 'frase')),
    sentimentBreakdown: toBreakdown(countBy(entries, (item) => item.sentiment || 'neutro')),
    awarenessBreakdown: toBreakdown(countBy(entries, (item) => item.awarenessLevel || 'unknown')),
    avatarBreakdown: toBreakdown(countBy(entries, (item) => item.avatar || 'Sin avatar')),
    topTags: toBreakdown(
      countBy(entries.flatMap((item) => item.tags || []).map((tag) => ({ tag })), (item) => item.tag || 'Sin tag')
    ).slice(0, 10),
    gaps: {
      unresolvedObjections: unresolvedObjections.slice(0, 6).map((item) => item.texto),
      missingAvatar: missingAvatar.slice(0, 6).map((item) => item.texto),
      missingAngle: missingAngle.slice(0, 6).map((item) => item.texto),
    },
  };
}

async function getCompetitorOverview(storeId) {
  const competitors = await Competitor.find({ storeId }).sort({ updatedAt: -1 }).lean();
  const analyzed = competitors.filter((item) => item.lastAnalysis || String(item.analysisResult || '').trim());
  const withUrl = competitors.filter((item) => String(item.url || '').trim());
  const missingAngles = competitors.filter((item) => !(item.angles || []).length);
  const missingTerritories = competitors.filter((item) => !(item.territories || []).length);
  const missingObjections = competitors.filter((item) => !(item.objectionsDetected || []).length);

  return {
    summary: {
      total: competitors.length,
      analyzed: analyzed.length,
      pendingAnalysis: Math.max(competitors.length - analyzed.length, 0),
      withUrl: withUrl.length,
      uniqueAngles: [...new Set(competitors.flatMap((item) => item.angles || []).filter(Boolean))].length,
      uniqueTerritories: [...new Set(competitors.flatMap((item) => item.territories || []).filter(Boolean))].length,
      missingAngles: missingAngles.length,
      missingTerritories: missingTerritories.length,
      missingObjections: missingObjections.length,
    },
    awarenessBreakdown: toBreakdown(countBy(competitors, (item) => item.awarenessLevel || 'unknown')),
    avatarBreakdown: toBreakdown(countBy(competitors, (item) => item.avatar || 'Sin avatar')),
    angleBreakdown: toBreakdown(
      countBy(competitors.flatMap((item) => (item.angles || []).map((angle) => ({ angle }))), (item) => item.angle || '')
    ).slice(0, 10),
    territoryBreakdown: toBreakdown(
      countBy(competitors.flatMap((item) => (item.territories || []).map((territory) => ({ territory }))), (item) => item.territory || '')
    ).slice(0, 10),
    gaps: {
      pendingAnalysis: competitors
        .filter((item) => !item.lastAnalysis && !String(item.analysisResult || '').trim())
        .slice(0, 6)
        .map((item) => item.nombre),
      missingAngles: missingAngles.slice(0, 6).map((item) => item.nombre),
      missingTerritories: missingTerritories.slice(0, 6).map((item) => item.nombre),
    },
  };
}

module.exports = {
  getTopicMapOverview,
  getLanguageBankOverview,
  getCompetitorOverview,
};
