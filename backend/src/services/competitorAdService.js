const Competitor = require('../models/Competitor');
const CompetitorAd = require('../models/CompetitorAd');

const PLATFORMS = ['meta', 'google', 'youtube', 'tiktok', 'microsoft', 'other'];
const STATUSES = ['active', 'inactive', 'unknown'];
const FORMATS = ['image', 'video', 'carousel', 'search', 'display', 'shopping', 'unknown'];

function normalizeList(value, maxItems = 20) {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : String(value).split(',');
  const seen = new Set();
  const out = [];
  for (const raw of arr) {
    const item = String(raw || '').trim();
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.slice(0, 80));
    if (out.length >= maxItems) break;
  }
  return out;
}

function cleanString(value, maxLength = 4000) {
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function cleanDate(value) {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

function cleanEnum(value, allowed, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function sanitizeAdInput(body = {}, defaults = {}) {
  const payload = {
    platform: cleanEnum(body.platform || defaults.platform, PLATFORMS, 'meta'),
    sourceUrl: cleanString(body.sourceUrl, 1000),
    externalAdId: cleanString(body.externalAdId, 160),
    advertiserName: cleanString(body.advertiserName, 200),
    advertiserId: cleanString(body.advertiserId, 160),
    status: cleanEnum(body.status || defaults.status, STATUSES, 'unknown'),
    format: cleanEnum(body.format || defaults.format, FORMATS, 'unknown'),
    startedAt: cleanDate(body.startedAt),
    endedAt: cleanDate(body.endedAt),
    countries: normalizeList(body.countries, 20),
    primaryText: cleanString(body.primaryText, 12000),
    headline: cleanString(body.headline, 500),
    description: cleanString(body.description, 1000),
    cta: cleanString(body.cta, 120),
    landingUrl: cleanString(body.landingUrl, 1000),
    mediaUrl: cleanString(body.mediaUrl, 1000),
    thumbnailUrl: cleanString(body.thumbnailUrl, 1000),
    hook: cleanString(body.hook, 300),
    angle: cleanString(body.angle, 200),
    avatar: cleanString(body.avatar, 200),
    awarenessLevel: cleanEnum(body.awarenessLevel, [
      'unaware',
      'problem-aware',
      'solution-aware',
      'product-aware',
      'most-aware',
      'unknown',
    ], 'unknown'),
    offer: cleanString(body.offer, 300),
    objection: cleanString(body.objection, 300),
    notes: cleanString(body.notes, 2000),
    tags: normalizeList(body.tags, 30),
    source: cleanEnum(body.source || defaults.source, ['manual', 'mcp', 'scanner', 'import'], 'manual'),
  };

  if (body.confidence != null && body.confidence !== '') {
    const confidence = Number(body.confidence);
    if (!Number.isNaN(confidence)) payload.confidence = Math.max(0, Math.min(confidence, 1));
  }

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });

  return payload;
}

async function assertCompetitor(storeId, competitorId) {
  const competitor = await Competitor.findOne({ _id: competitorId, storeId }).lean();
  if (!competitor) {
    const err = new Error('Competidor no encontrado');
    err.status = 404;
    throw err;
  }
  return competitor;
}

async function listCompetitorAds(storeId, competitorId, filters = {}) {
  await assertCompetitor(storeId, competitorId);
  const query = { storeId, competitorId };
  if (filters.platform) query.platform = cleanEnum(filters.platform, PLATFORMS, filters.platform);
  if (filters.status) query.status = cleanEnum(filters.status, STATUSES, filters.status);
  const limit = Math.max(1, Math.min(Number(filters.limit || 100), 300));
  return CompetitorAd.find(query)
    .sort({ lastSeenAt: -1, createdAt: -1 })
    .limit(limit)
    .lean();
}

async function getAdsOverview(storeId) {
  const [summaryAgg, latestAds, longRunners] = await Promise.all([
    CompetitorAd.aggregate([
      { $match: { storeId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          meta: { $sum: { $cond: [{ $eq: ['$platform', 'meta'] }, 1, 0] } },
          google: { $sum: { $cond: [{ $in: ['$platform', ['google', 'youtube']] }, 1, 0] } },
          withHook: { $sum: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$hook', ''] } }, 0] }, 1, 0] } },
        },
      },
    ]),
    CompetitorAd.find({ storeId }).sort({ firstSeenAt: -1, createdAt: -1 }).limit(8).lean(),
    CompetitorAd.find({ storeId, status: 'active' }).sort({ firstSeenAt: 1 }).limit(8).lean(),
  ]);

  const summary = summaryAgg[0] || { total: 0, active: 0, meta: 0, google: 0, withHook: 0 };
  return {
    summary,
    latestAds,
    longRunners,
  };
}

async function createCompetitorAd(storeId, competitorId, body = {}, { userId, source = 'manual' } = {}) {
  await assertCompetitor(storeId, competitorId);
  const payload = sanitizeAdInput(body, { source });
  const now = new Date();
  const ad = await CompetitorAd.create({
    ...payload,
    storeId,
    competitorId,
    firstSeenAt: cleanDate(body.firstSeenAt) || now,
    lastSeenAt: cleanDate(body.lastSeenAt) || now,
    createdBy: userId || undefined,
    updatedBy: userId || undefined,
  });
  return ad;
}

async function updateCompetitorAd(storeId, competitorId, adId, body = {}, { userId } = {}) {
  await assertCompetitor(storeId, competitorId);
  const payload = sanitizeAdInput(body);
  if (body.firstSeenAt) payload.firstSeenAt = cleanDate(body.firstSeenAt);
  if (body.lastSeenAt) payload.lastSeenAt = cleanDate(body.lastSeenAt);
  payload.updatedBy = userId || undefined;

  const ad = await CompetitorAd.findOneAndUpdate(
    { _id: adId, storeId, competitorId },
    payload,
    { new: true }
  );
  if (!ad) {
    const err = new Error('Anuncio competitivo no encontrado');
    err.status = 404;
    throw err;
  }
  return ad;
}

async function deleteCompetitorAd(storeId, competitorId, adId) {
  await assertCompetitor(storeId, competitorId);
  const result = await CompetitorAd.deleteOne({ _id: adId, storeId, competitorId });
  return result.deletedCount > 0;
}

module.exports = {
  PLATFORMS,
  STATUSES,
  FORMATS,
  sanitizeAdInput,
  listCompetitorAds,
  getAdsOverview,
  createCompetitorAd,
  updateCompetitorAd,
  deleteCompetitorAd,
};
