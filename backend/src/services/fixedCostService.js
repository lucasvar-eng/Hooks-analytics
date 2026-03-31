const FixedCost = require('../models/FixedCost');

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function daysBetweenInclusive(from, to) {
  const ms = endOfDay(to) - startOfDay(from);
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
}

function getRange(from, to) {
  const rangeStart = from ? startOfDay(from) : startOfDay(new Date());
  const rangeEnd = to ? endOfDay(to) : endOfDay(new Date());
  return { rangeStart, rangeEnd };
}

function prorateCost(cost, rangeStart, rangeEnd) {
  const effectiveStart = cost.periodStart ? startOfDay(cost.periodStart) : rangeStart;
  const effectiveEnd = cost.periodEnd ? endOfDay(cost.periodEnd) : rangeEnd;
  const overlapStart = effectiveStart > rangeStart ? effectiveStart : rangeStart;
  const overlapEnd = effectiveEnd < rangeEnd ? effectiveEnd : rangeEnd;

  if (overlapStart > overlapEnd) return 0;

  const overlapDays = daysBetweenInclusive(overlapStart, overlapEnd);

  if (cost.cadence === 'daily') return cost.monto * overlapDays;
  if (cost.cadence === 'weekly') return (cost.monto / 7) * overlapDays;
  if (cost.cadence === 'one_time') return overlapDays > 0 ? cost.monto : 0;

  const monthDays = 30;
  return (cost.monto / monthDays) * overlapDays;
}

async function getFixedCostsForRange(storeId, from, to) {
  const { rangeStart, rangeEnd } = getRange(from, to);
  const costs = await FixedCost.find({
    storeId,
    active: true,
    $or: [
      { periodStart: { $exists: false }, periodEnd: { $exists: false } },
      {
        $and: [
          { $or: [{ periodStart: { $exists: false } }, { periodStart: { $lte: rangeEnd } }] },
          { $or: [{ periodEnd: { $exists: false } }, { periodEnd: { $gte: rangeStart } }] },
        ],
      },
    ],
  }).lean();

  const lines = costs.map((cost) => ({
    ...cost,
    allocatedAmount: prorateCost(cost, rangeStart, rangeEnd),
  }));

  const total = lines.reduce((sum, line) => sum + (line.allocatedAmount || 0), 0);
  return { total, lines };
}

module.exports = {
  getFixedCostsForRange,
};
