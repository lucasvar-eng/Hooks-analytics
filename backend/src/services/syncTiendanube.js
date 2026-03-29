const tnAPI = require('./tiendanubeAPI');
const Order = require('../models/Order');
const Product = require('../models/Product');
const SyncLog = require('../models/SyncLog');
const { recalculateDailyMetric } = require('./metricCalculator');
const logger = require('../utils/logger');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function mapTnOrderToSchema(tnOrder) {
  return {
    tnOrderNumber: String(tnOrder.number),
    customerName: tnOrder.customer?.name,
    customerEmail: tnOrder.customer?.email?.toLowerCase(),
    totalOrden: parseFloat(tnOrder.total) || 0,
    subtotal: parseFloat(tnOrder.subtotal) || 0,
    descuento: parseFloat(tnOrder.discount || 0),
    costoEnvio: parseFloat(tnOrder.shipping_cost_owner || 0),
    gateway: tnOrder.gateway_name,
    medioPago: tnOrder.payment_details?.method,
    cantidadCuotas: tnOrder.payment_details?.installments || 1,
    paymentStatus: tnOrder.payment_status,
    paidAt: tnOrder.paid_at ? new Date(tnOrder.paid_at) : null,
    estado: tnOrder.status,
    canal: 'tiendanube',
    fechaCreacion: new Date(tnOrder.created_at),
    lineItems: (tnOrder.products || []).map((p) => ({
      tnProductId: String(p.product_id),
      nombre: p.name,
      cantidad: p.quantity,
      precioUnitario: parseFloat(p.price) || 0,
      subtotal: (parseFloat(p.price) || 0) * p.quantity,
    })),
  };
}

async function syncOrders(store) {
  const startTime = Date.now();
  const lastSync =
    store.integrationStatus?.tiendanube?.lastSync || new Date(0);
  let page = 1;
  let hasMore = true;
  const perPage = 200;
  let totalRecords = 0;
  const affectedDates = new Set();

  const log = await SyncLog.create({
    storeId: store._id,
    type: 'tiendanube_orders',
    status: 'running',
  });

  try {
    while (hasMore) {
      const response = await tnAPI.get(
        store.tnStoreId,
        '/orders',
        store.tnAccessToken,
        {
          updated_at_min: lastSync.toISOString(),
          per_page: perPage,
          page,
          status: 'any',
          fields:
            'id,number,total,subtotal,discount,shipping_cost_customer,shipping_cost_owner,gateway,gateway_name,payment_status,payment_details,paid_at,customer,products,status,created_at,updated_at,cancelled_at',
        }
      );

      const orders = response.data;

      for (const tnOrder of orders) {
        await Order.findOneAndUpdate(
          { storeId: store._id, tnOrderId: String(tnOrder.id) },
          { ...mapTnOrderToSchema(tnOrder) },
          { upsert: true, new: true }
        );

        // Track dates for DailyMetric recalculation
        const dateStr = new Date(tnOrder.created_at)
          .toISOString()
          .split('T')[0];
        affectedDates.add(dateStr);
      }

      totalRecords += orders.length;
      hasMore = orders.length === perPage;
      page++;

      if (hasMore) await sleep(500);
    }

    // Update last sync timestamp
    store.integrationStatus.tiendanube.lastSync = new Date();
    store.integrationStatus.tiendanube.connected = true;
    await store.save();

    // Recalculate DailyMetrics for affected dates
    for (const dateStr of affectedDates) {
      await recalculateDailyMetric(store._id, new Date(dateStr));
    }

    log.status = 'success';
    log.recordsFetched = totalRecords;
    log.duration = Date.now() - startTime;
    await log.save();

    logger.info(
      `Sync orders complete for ${store.nombre}: ${totalRecords} orders in ${log.duration}ms`
    );
  } catch (error) {
    log.status = 'error';
    log.error = error.message;
    log.duration = Date.now() - startTime;
    await log.save();
    logger.error(`Sync orders failed for ${store.nombre}: ${error.message}`);
    throw error;
  }
}

function mapTnProductToSchema(tnProduct) {
  const mainVariant = tnProduct.variants?.[0];
  return {
    nombre: tnProduct.name?.es || tnProduct.name?.en || tnProduct.name,
    precio: parseFloat(mainVariant?.price || tnProduct.price || 0),
    stock: tnProduct.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0,
    variantes: (tnProduct.variants || []).map((v) => ({
      tnVariantId: String(v.id),
      nombre: v.name || '',
      precio: parseFloat(v.price || 0),
      stock: v.stock || 0,
    })),
    categoria: tnProduct.categories?.[0]?.name?.es || '',
    imagenUrl: tnProduct.images?.[0]?.src,
  };
}

async function syncProducts(store) {
  const startTime = Date.now();
  let page = 1;
  let hasMore = true;
  const perPage = 200;
  let totalRecords = 0;

  const log = await SyncLog.create({
    storeId: store._id,
    type: 'tiendanube_products',
    status: 'running',
  });

  try {
    while (hasMore) {
      const response = await tnAPI.get(
        store.tnStoreId,
        '/products',
        store.tnAccessToken,
        {
          per_page: perPage,
          page,
          fields:
            'id,name,price,variants,categories,images,created_at,updated_at',
        }
      );

      const products = response.data;

      for (const tnProduct of products) {
        await Product.findOneAndUpdate(
          { storeId: store._id, tnProductId: String(tnProduct.id) },
          { ...mapTnProductToSchema(tnProduct) },
          { upsert: true, new: true }
        );
      }

      totalRecords += products.length;
      hasMore = products.length === perPage;
      page++;

      if (hasMore) await sleep(500);
    }

    log.status = 'success';
    log.recordsFetched = totalRecords;
    log.duration = Date.now() - startTime;
    await log.save();

    logger.info(
      `Sync products complete for ${store.nombre}: ${totalRecords} products in ${log.duration}ms`
    );
  } catch (error) {
    log.status = 'error';
    log.error = error.message;
    log.duration = Date.now() - startTime;
    await log.save();
    logger.error(
      `Sync products failed for ${store.nombre}: ${error.message}`
    );
    throw error;
  }
}

module.exports = { syncOrders, syncProducts };
