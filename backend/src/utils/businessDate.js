const BUSINESS_TZ = 'America/Argentina/Tucuman';
const BUSINESS_TZ_OFFSET = '-03:00';

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatUtcDateParts(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function shiftToBusinessLocal(dateLike) {
  const date = dateLike instanceof Date ? new Date(dateLike) : new Date(dateLike);
  return new Date(date.getTime() - 3 * 60 * 60 * 1000);
}

function toBusinessDateLabel(dateLike) {
  if (!dateLike) return null;
  if (typeof dateLike === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateLike)) return dateLike;
  return formatUtcDateParts(shiftToBusinessLocal(dateLike));
}

function businessDateKey(label) {
  return new Date(`${label}T00:00:00.000Z`);
}

function dateKeyToLabel(dateLike) {
  return formatUtcDateParts(new Date(dateLike));
}

function addDaysToLabel(label, days) {
  const date = businessDateKey(label);
  date.setUTCDate(date.getUTCDate() + days);
  return formatUtcDateParts(date);
}

function getBusinessDayContext(dateLike) {
  const label = toBusinessDateLabel(dateLike);
  const keyDate = businessDateKey(label);
  const nextLabel = addDaysToLabel(label, 1);
  const sourceStart = new Date(`${label}T00:00:00.000${BUSINESS_TZ_OFFSET}`);
  const sourceEnd = new Date(new Date(`${nextLabel}T00:00:00.000${BUSINESS_TZ_OFFSET}`).getTime() - 1);
  const keyEnd = new Date(`${label}T23:59:59.999Z`);

  return {
    label,
    keyDate,
    keyEnd,
    sourceStart,
    sourceEnd,
  };
}

function buildBusinessDateKeyMatch(from, to, endOfDay = true) {
  const match = {};
  if (from) {
    match.$gte = businessDateKey(toBusinessDateLabel(from));
  }
  if (to) {
    const label = toBusinessDateLabel(to);
    match.$lte = endOfDay ? new Date(`${label}T23:59:59.999Z`) : businessDateKey(label);
  }
  return match;
}

function buildBusinessSourceDateMatch(from, to) {
  const match = {};
  if (from) {
    match.$gte = getBusinessDayContext(from).sourceStart;
  }
  if (to) {
    match.$lte = getBusinessDayContext(to).sourceEnd;
  }
  return match;
}

module.exports = {
  BUSINESS_TZ,
  BUSINESS_TZ_OFFSET,
  toBusinessDateLabel,
  businessDateKey,
  dateKeyToLabel,
  addDaysToLabel,
  getBusinessDayContext,
  buildBusinessDateKeyMatch,
  buildBusinessSourceDateMatch,
};
