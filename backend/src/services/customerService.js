const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const logger = require('../utils/logger');

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

module.exports = {
  calculateRFM,
  getCohortTable,
  getSegments,
  getCustomers,
};
