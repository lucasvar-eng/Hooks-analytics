const connectDB = require('../src/config/database');
const mongoose = require('mongoose');
const DailyMetric = require('../src/models/DailyMetric');
const Order = require('../src/models/Order');
const MetaDailyInsight = require('../src/models/MetaDailyInsight');
const { buildBusinessSourceDateMatch } = require('../src/utils/businessDate');

async function main() {
  await connectDB();

  const storeId = new mongoose.Types.ObjectId('69cadede3936709190d773b8');
  const start = new Date('2026-03-31T00:00:00.000Z');
  const end = new Date('2026-03-31T23:59:59.999Z');
  const localMatch = buildBusinessSourceDateMatch('2026-03-31', '2026-03-31');

  const [dailyMetric, orderAggUtc, orderAggLocal, metaCampaign, metaByGranularity] = await Promise.all([
    DailyMetric.findOne({ storeId, date: start }).lean(),
    Order.aggregate([
      {
        $match: {
          storeId,
          fechaCreacion: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          paidOrders: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0],
            },
          },
          revenueAll: { $sum: '$totalOrden' },
          revenuePaid: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalOrden', 0],
            },
          },
          netRevenuePaid: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalNeto', 0],
            },
          },
          liquidablePaid: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$liquidable', 0],
            },
          },
          statuses: {
            $push: {
              tnOrderId: '$tnOrderId',
              estado: '$estado',
              paymentStatus: '$paymentStatus',
              totalOrden: '$totalOrden',
              totalNeto: '$totalNeto',
              liquidable: '$liquidable',
              fechaCreacion: '$fechaCreacion',
            },
          },
        },
      },
    ]),
    Order.aggregate([
      {
        $match: {
          storeId,
          fechaCreacion: localMatch,
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          paidOrders: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0],
            },
          },
          revenueAll: { $sum: '$totalOrden' },
          revenuePaid: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalOrden', 0],
            },
          },
          netRevenuePaid: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalNeto', 0],
            },
          },
          liquidablePaid: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$liquidable', 0],
            },
          },
          statuses: {
            $push: {
              tnOrderId: '$tnOrderId',
              estado: '$estado',
              paymentStatus: '$paymentStatus',
              totalOrden: '$totalOrden',
              totalNeto: '$totalNeto',
              liquidable: '$liquidable',
              fechaCreacion: '$fechaCreacion',
            },
          },
        },
      },
    ]),
    MetaDailyInsight.aggregate([
      {
        $match: {
          storeId,
          granularity: 'campaign',
          date: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          rows: { $sum: 1 },
          spend: { $sum: '$spend' },
          purchases: { $sum: '$purchases' },
          purchaseValue: { $sum: '$purchaseValue' },
          accountIds: { $addToSet: '$adAccountId' },
        },
      },
    ]),
    MetaDailyInsight.aggregate([
      {
        $match: {
          storeId,
          date: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$granularity',
          rows: { $sum: 1 },
          spend: { $sum: '$spend' },
          purchases: { $sum: '$purchases' },
          purchaseValue: { $sum: '$purchaseValue' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  console.log(JSON.stringify({
    date: '2026-03-31',
    dailyMetric,
    orderAggUtc: orderAggUtc[0] || null,
    orderAggLocal: orderAggLocal[0] || null,
    metaCampaign: metaCampaign[0] || null,
    metaByGranularity,
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // noop
  }
  process.exit(1);
});
