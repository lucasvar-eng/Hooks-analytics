const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const MetaDailyInsight = require('../models/MetaDailyInsight');
const { buildBusinessSourceDateMatch } = require('../utils/businessDate');
const logger = require('../utils/logger');

async function rebuildCustomersFromOrders(storeId) {
  const storeObjectId = new mongoose.Types.ObjectId(storeId);

  const grouped = await Order.aggregate([
    {
      $match: {
        storeId: storeObjectId,
        estado: { $nin: ['cancelled'] },
        $or: [
          { customerEmail: { $exists: true, $ne: null, $ne: '' } },
          { externalCustomerId: { $exists: true, $ne: null, $ne: '' } },
        ],
      },
    },
    { $sort: { fechaCreacion: 1 } },
    {
      $group: {
        _id: {
          externalCustomerId: '$externalCustomerId',
          email: '$customerEmail',
        },
        email: { $last: '$customerEmail' },
        externalCustomerId: { $last: '$externalCustomerId' },
        name: { $last: '$customerName' },
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: '$totalOrden' },
        firstPurchase: { $first: '$fechaCreacion' },
        lastOrderDate: { $last: '$fechaCreacion' },
        orderDates: { $push: '$fechaCreacion' },
      },
    },
  ]);

  await Customer.deleteMany({ storeId });

  const docs = grouped
    .filter((customer) => customer.email || customer.externalCustomerId)
    .map((customer) => {
      const firstPurchase = customer.firstPurchase || customer.lastOrderDate || new Date();
      const cohortMonth = `${firstPurchase.getFullYear()}-${String(firstPurchase.getMonth() + 1).padStart(2, '0')}`;

      const secondOrderDate = customer.orderDates?.[1] || null;
      const firstToSecondOrderLag = secondOrderDate
        ? Math.round((new Date(secondOrderDate) - new Date(firstPurchase)) / (1000 * 60 * 60 * 24))
        : null;

      return {
        storeId,
        email: customer.email || `${customer.externalCustomerId}@no-email.local`,
        externalCustomerId: customer.externalCustomerId,
        name: customer.name,
        totalOrders: customer.totalOrders,
        totalSpent: customer.totalSpent,
        firstPurchase,
        lastOrderDate: customer.lastOrderDate,
        cohortMonth,
        ltv: customer.totalSpent,
        firstToSecondOrderLag,
      };
    });

  if (docs.length > 0) {
    await Customer.insertMany(docs, { ordered: false });
  }

  logger.info(`Customers rebuilt for store ${storeId}: ${docs.length} records`);
  return docs.length;
}

/**
 * Calculate RFM scores for all customers of a store.
 * R = days since last purchase (lower = better → higher score)
 * F = total orders (higher = better)
 * M = total spent (higher = better)
 */
async function calculateRFM(storeId) {
  const customers = await Customer.find({ storeId, totalOrders: { $gt: 0 } });
  if (customers.length === 0) return 0;

  const now = new Date();

  // Get distributions for percentile-based scoring
  const recencies = customers.map((c) =>
    c.lastOrderDate ? Math.floor((now - c.lastOrderDate) / (1000 * 60 * 60 * 24)) : 999
  );
  const frequencies = customers.map((c) => c.totalOrders);
  const monetaries = customers.map((c) => c.totalSpent);

  const getQuintile = (arr, val, inverse = false) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = sorted.indexOf(val);
    const pct = idx / sorted.length;
    const score = inverse
      ? pct < 0.2 ? 5 : pct < 0.4 ? 4 : pct < 0.6 ? 3 : pct < 0.8 ? 2 : 1
      : pct < 0.2 ? 1 : pct < 0.4 ? 2 : pct < 0.6 ? 3 : pct < 0.8 ? 4 : 5;
    return score;
  };

  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    const r = recencies[i];
    const rScore = getQuintile(recencies, r, true); // inverse: lower days = higher score
    const fScore = getQuintile(frequencies, c.totalOrders);
    const mScore = getQuintile(monetaries, c.totalSpent);

    c.recency = r;
    c.frequency = c.totalOrders;
    c.monetary = c.totalSpent;
    c.rfmScore = `${rScore}-${fScore}-${mScore}`;
    c.rfmSegment = getSegment(rScore, fScore, mScore);
    c.ltv = c.totalSpent; // simple LTV = total spent
    c.repurchaseRate = c.totalOrders > 1 ? ((c.totalOrders - 1) / c.totalOrders) * 100 : 0;
    c.purchaseDensity = c.recency != null ? c.totalOrders / Math.max(c.recency, 1) : c.totalOrders;

    await c.save();
  }

  logger.info(`RFM calculated for ${customers.length} customers in store ${storeId}`);
  return customers.length;
}

function getSegment(r, f, m) {
  const avg = (r + f + m) / 3;
  if (r >= 4 && f >= 4 && m >= 4) return 'champions';
  if (r >= 3 && f >= 3 && m >= 3) return 'loyal';
  if (r >= 4 && f <= 2) return 'new';
  if (r <= 2 && f >= 3) return 'at_risk';
  if (r <= 1 && f >= 2) return 'lost';
  if (r >= 3 && f <= 2 && m <= 2) return 'promising';
  if (avg >= 3) return 'potential';
  return 'hibernating';
}

/**
 * Get cohort retention table.
 * Each row = acquisition month, columns = month N (0, 1, 2, ...), values = % retention.
 */
async function getCohortTable(storeId) {
  // Get all customers with cohort month
  const customers = await Customer.find({
    storeId,
    cohortMonth: { $exists: true, $ne: null },
  }).lean();

  if (customers.length === 0) return [];

  // Get all orders grouped by customer
  const orders = await Order.aggregate([
    {
      $match: {
        storeId: new mongoose.Types.ObjectId(storeId),
        estado: { $nin: ['cancelled'] },
      },
    },
    {
      $group: {
        _id: '$customerEmail',
        orderMonths: {
          $addToSet: {
            $dateToString: { format: '%Y-%m', date: '$fechaCreacion' },
          },
        },
      },
    },
  ]);

  const orderMap = {};
  for (const o of orders) {
    orderMap[o._id] = o.orderMonths;
  }

  // Group customers by cohort
  const cohorts = {};
  for (const c of customers) {
    if (!cohorts[c.cohortMonth]) cohorts[c.cohortMonth] = [];
    cohorts[c.cohortMonth].push({
      email: c.email,
      orderMonths: orderMap[c.email] || [],
    });
  }

  // Build cohort table
  const result = [];
  const sortedCohorts = Object.keys(cohorts).sort();

  for (const cohortMonth of sortedCohorts) {
    const members = cohorts[cohortMonth];
    const total = members.length;
    const months = {};

    for (const member of members) {
      for (const orderMonth of member.orderMonths) {
        const diff = monthDiff(cohortMonth, orderMonth);
        if (diff >= 0) {
          months[diff] = (months[diff] || 0) + 1;
        }
      }
    }

    // Convert to percentages
    const retention = {};
    for (const [monthN, count] of Object.entries(months)) {
      retention[monthN] = total > 0 ? (count / total) * 100 : 0;
    }

    result.push({ cohortMonth, total, retention });
  }

  return result;
}

function monthDiff(from, to) {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

/**
 * Get customer segments with counts and revenue.
 */
async function getSegments(storeId) {
  const segments = await Customer.aggregate([
    { $match: { storeId: new mongoose.Types.ObjectId(storeId), rfmSegment: { $exists: true } } },
    {
      $group: {
        _id: '$rfmSegment',
        count: { $sum: 1 },
        totalRevenue: { $sum: '$totalSpent' },
        avgOrders: { $avg: '$totalOrders' },
        avgSpent: { $avg: '$totalSpent' },
      },
    },
    { $sort: { totalRevenue: -1 } },
  ]);

  return segments;
}

/**
 * Get paginated customer list.
 */
async function getCustomers(storeId, page = 1, limit = 50, segment) {
  const filter = { storeId };
  if (segment) filter.rfmSegment = segment;

  const [customers, total] = await Promise.all([
    Customer.find(filter)
      .sort({ totalSpent: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Customer.countDocuments(filter),
  ]);

  return { customers, total, page, limit };
}

async function getQualityChecks(storeId) {
  const storeObjectId = new mongoose.Types.ObjectId(storeId);
  const [customersWithoutRealEmail, ordersWithoutCustomer, sparseCohorts] = await Promise.all([
    Customer.countDocuments({
      storeId,
      email: /@no-email\.local$/,
    }),
    Order.countDocuments({
      storeId: storeObjectId,
      estado: { $nin: ['cancelled'] },
      $and: [
        { $or: [{ customerEmail: { $exists: false } }, { customerEmail: null }, { customerEmail: '' }] },
        { $or: [{ externalCustomerId: { $exists: false } }, { externalCustomerId: null }, { externalCustomerId: '' }] },
      ],
    }),
    Customer.aggregate([
      { $match: { storeId: storeObjectId, cohortMonth: { $exists: true, $ne: null } } },
      { $group: { _id: '$cohortMonth', count: { $sum: 1 } } },
      { $match: { count: { $lt: 3 } } },
    ]),
  ]);

  return {
    customersWithoutRealEmail,
    ordersWithoutCustomer,
    sparseCohorts: sparseCohorts.map((item) => item._id),
  };
}

/**
 * Insights del período (top clientes, recurrencia, CAC, histograma de
 * días desde última compra). Lo que las planillas Daily Tracker tenían
 * a mano y la app no agregaba en una sola call.
 */
async function getPeriodInsights(storeId, from, to) {
  const storeObjectId = new mongoose.Types.ObjectId(storeId);
  const dateMatch = (from || to) ? buildBusinessSourceDateMatch(from, to) : null;

  const orderMatch = {
    storeId: storeObjectId,
    estado: { $nin: ['cancelled'] },
  };
  if (dateMatch) orderMatch.fechaCreacion = dateMatch;

  const metaMatch = { storeId: storeObjectId, granularity: 'campaign' };
  if (from && to) {
    metaMatch.date = { $gte: new Date(from), $lte: new Date(`${to}T23:59:59.999Z`) };
  }

  const now = new Date();

  const [
    topPeriodCustomers,
    customerStats,
    daysSinceAgg,
    spendAgg,
  ] = await Promise.all([
    // Top clientes por gasto en el período
    Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: '$customerEmail',
          customerName: { $first: '$customerName' },
          ordenes: { $sum: 1 },
          totalSpent: { $sum: '$totalOrden' },
        },
      },
      { $match: { _id: { $ne: null, $ne: '' } } },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
    ]),

    // Compradores únicos del período + flag de "nuevo" o "recurrente"
    // esClienteNuevo se setea cuando la orden es la primera del cliente.
    Order.aggregate([
      { $match: { ...orderMatch, customerEmail: { $exists: true, $ne: null, $ne: '' } } },
      {
        $group: {
          _id: '$customerEmail',
          isNew: { $max: { $cond: [{ $eq: ['$esClienteNuevo', true] }, 1, 0] } },
          ordenes: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          totalUnique: { $sum: 1 },
          newOnly: { $sum: { $cond: [{ $eq: ['$isNew', 1] }, 1, 0] } },
          // Recurrente real = compradores con >1 orden en el período O ya tenía órdenes antes
          recurrentInPeriod: { $sum: { $cond: [{ $gt: ['$ordenes', 1] }, 1, 0] } },
        },
      },
    ]),

    // Histograma de días desde última compra (sobre TODOS los customers de la tienda)
    Customer.aggregate([
      { $match: { storeId: storeObjectId, lastOrderDate: { $exists: true, $ne: null } } },
      {
        $project: {
          daysSinceLast: {
            $floor: {
              $divide: [{ $subtract: [now, '$lastOrderDate'] }, 1000 * 60 * 60 * 24],
            },
          },
        },
      },
      {
        $bucket: {
          groupBy: '$daysSinceLast',
          boundaries: [0, 7, 30, 60, 90, 180, 365, Infinity],
          default: '365+',
          output: { count: { $sum: 1 } },
        },
      },
    ]),

    // Ad spend total del período (solo Meta por ahora — TN no tiene spend propio)
    MetaDailyInsight.aggregate([
      { $match: metaMatch },
      { $group: { _id: null, totalSpend: { $sum: '$spend' } } },
    ]),
  ]);

  const stats = customerStats[0] || { totalUnique: 0, newOnly: 0, recurrentInPeriod: 0 };
  const recurrencePct = stats.totalUnique > 0
    ? (stats.recurrentInPeriod / stats.totalUnique) * 100
    : 0;

  const adSpend = spendAgg[0]?.totalSpend || 0;
  // CAC: spend / nuevos compradores del período
  const cac = stats.newOnly > 0 ? adSpend / stats.newOnly : null;

  // LTV promedio (de TODOS los customers — heuristica)
  const ltvAgg = await Customer.aggregate([
    { $match: { storeId: storeObjectId, ltv: { $gt: 0 } } },
    { $group: { _id: null, avgLtv: { $avg: '$ltv' }, count: { $sum: 1 } } },
  ]);
  const avgLtv = ltvAgg[0]?.avgLtv || 0;
  const cacLtvRatio = cac && avgLtv > 0 ? cac / avgLtv : null;

  // Format histograma con labels descriptivos
  const bucketLabels = {
    0: '0-7 días',
    7: '8-30 días',
    30: '31-60 días',
    60: '61-90 días',
    90: '91-180 días',
    180: '181-365 días',
    365: '+365 días',
  };
  const histogram = (daysSinceAgg || []).map((b) => ({
    bucket: bucketLabels[b._id] || `+${b._id}`,
    lowerDay: b._id,
    count: b.count,
  }));

  return {
    topPeriodCustomers,
    period: {
      uniqueCustomers: stats.totalUnique,
      newCustomers: stats.newOnly,
      recurrentCustomers: stats.recurrentInPeriod,
      recurrencePct,
      adSpend,
      cac,
      avgLtv,
      cacLtvRatio,
    },
    daysSinceLastPurchase: histogram,
  };
}

module.exports = {
  rebuildCustomersFromOrders,
  calculateRFM,
  getCohortTable,
  getSegments,
  getCustomers,
  getQualityChecks,
  getPeriodInsights,
};
