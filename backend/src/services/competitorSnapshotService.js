const CompetitorSnapshot = require('../models/CompetitorSnapshot');
const Competitor = require('../models/Competitor');
const logger = require('../utils/logger');

const SNAPSHOT_FIELDS = [
  'nombre',
  'url',
  'positioning',
  'avatar',
  'awarenessLevel',
  'mainOffer',
  'angles',
  'territories',
  'objectionsDetected',
  'notas',
  'analysisResult',
];

const COMPARABLE_LABELS = {
  nombre: 'Nombre',
  url: 'URL',
  positioning: 'Posicionamiento',
  avatar: 'Avatar',
  awarenessLevel: 'Awareness target',
  mainOffer: 'Oferta principal',
  angles: 'Ángulos',
  territories: 'Territorios',
  objectionsDetected: 'Objeciones',
  notas: 'Notas',
  analysisResult: 'Análisis AI',
};

function pickSnapshotFields(competitor) {
  const out = {};
  for (const f of SNAPSHOT_FIELDS) {
    const value = competitor[f];
    if (Array.isArray(value)) {
      out[f] = [...value];
    } else if (value !== undefined && value !== null) {
      out[f] = value;
    }
  }
  return out;
}

/**
 * Crea snapshot del estado actual del competidor.
 * Llamar ANTES de modificar el competidor para preservar el "before".
 */
async function createSnapshot(competitorId, { source = 'manual', userId } = {}) {
  const competitor = await Competitor.findById(competitorId).lean();
  if (!competitor) return null;

  const payload = {
    storeId: competitor.storeId,
    competitorId: competitor._id,
    capturedAt: new Date(),
    source,
    triggeredBy: userId || undefined,
    ...pickSnapshotFields(competitor),
  };

  const snap = await CompetitorSnapshot.create(payload);
  logger.debug(`Snapshot creado: competitor=${competitorId} source=${source}`);
  return snap;
}

/**
 * Lista snapshots ordenados por fecha desc (más reciente primero).
 */
async function listSnapshots(competitorId, { limit = 20 } = {}) {
  return CompetitorSnapshot
    .find({ competitorId })
    .sort({ capturedAt: -1 })
    .limit(limit)
    .lean();
}

function normalizeForCompare(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map((v) => String(v || '').trim()).filter(Boolean).join('|||');
  return String(value).trim();
}

function diffSnapshots(prev, curr) {
  const changes = [];
  for (const f of SNAPSHOT_FIELDS) {
    const prevVal = prev?.[f];
    const currVal = curr?.[f];
    const a = normalizeForCompare(prevVal);
    const b = normalizeForCompare(currVal);
    if (a === b) continue;
    changes.push({
      field: f,
      label: COMPARABLE_LABELS[f] || f,
      previous: Array.isArray(prevVal) ? (prevVal || []) : (prevVal || ''),
      current: Array.isArray(currVal) ? (currVal || []) : (currVal || ''),
    });
  }
  return changes;
}

/**
 * Devuelve el diff entre el competidor actual y su snapshot inmediatamente anterior.
 * Útil para "qué cambió desde el último análisis".
 */
async function getLatestDiff(competitorId) {
  const [competitor, lastSnap] = await Promise.all([
    Competitor.findById(competitorId).lean(),
    CompetitorSnapshot.findOne({ competitorId }).sort({ capturedAt: -1 }).lean(),
  ]);

  if (!competitor) return null;
  if (!lastSnap) {
    return {
      hasPrevious: false,
      changes: [],
      previousAt: null,
      currentAt: new Date(),
    };
  }

  return {
    hasPrevious: true,
    changes: diffSnapshots(lastSnap, competitor),
    previousAt: lastSnap.capturedAt,
    currentAt: new Date(),
    previousSource: lastSnap.source,
  };
}

/**
 * Diff entre dos snapshots arbitrarios (por id).
 */
async function diffSnapshotsByIds(competitorId, fromId, toId) {
  const [from, to] = await Promise.all([
    CompetitorSnapshot.findOne({ _id: fromId, competitorId }).lean(),
    CompetitorSnapshot.findOne({ _id: toId, competitorId }).lean(),
  ]);
  if (!from || !to) return null;
  return {
    fromAt: from.capturedAt,
    toAt: to.capturedAt,
    changes: diffSnapshots(from, to),
  };
}

async function deleteAllForCompetitor(competitorId) {
  await CompetitorSnapshot.deleteMany({ competitorId });
}

module.exports = {
  createSnapshot,
  listSnapshots,
  getLatestDiff,
  diffSnapshotsByIds,
  deleteAllForCompetitor,
  SNAPSHOT_FIELDS,
  COMPARABLE_LABELS,
};
