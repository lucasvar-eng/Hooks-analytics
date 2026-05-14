const tnAPI = require('./tiendanubeAPI');
const Order = require('../models/Order');
const Product = require('../models/Product');
const SyncLog = require('../models/SyncLog');
const { isCentralizedTiendanubeStore, invalidateTiendanubeToken } = require('../utils/tiendanubeToken');
const { getStoreToken } = require('../utils/tokenAccess');
const { recalculateDailyMetric } = require('./metricCalculator');
const { calculateOrderFinancials, classifyCustomer } = require('./orderFinancials');
const { generateCashflowEntries } = require('./cashflow');
const { rebuildCustomersFromOrders, calculateRFM } = require('./customerService');
const { refreshProductDerivedMetrics } = require('./productService');
const logger = require('../utils/logger');
const { toBusinessDateLabel } = require('../utils/businessDate');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function mapTnOrderToSchema(tnOrder) {
  return {
    tnOrderNumber: String(tnOrder.number),
    externalCustomerId: tnOrder.customer?.id ? String(tnOrder.customer.id) : undefined,
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
  const tnToken = getStoreToken(store, 'tn');
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
      let response;
      try {
        response = await tnAPI.get(
          store.tnStoreId,
          '/orders',
          tnToken,
          {
            updated_at_min: lastSync.toISOString(),
            per_page: perPage,
            page,
            status: 'any',
            fields:
              'id,number,total,subtotal,discount,shipping_cost_customer,shipping_cost_owner,gateway,gateway_name,payment_status,payment_details,paid_at,customer,products,status,created_at,updated_at,cancelled_at',
          }
        );
      } catch (error) {
        if (error.response?.status !== 422) throw error;
        response = await tnAPI.get(
          store.tnStoreId,
          '/orders',
          tnToken,
          {
            updated_at_min: lastSync.toISOString(),
            per_page: perPage,
            page,
            status: 'any',
          }
        );
      }

      const orders = response.data;

      for (const tnOrder of orders) {
        const order = await Order.findOneAndUpdate(
          { storeId: store._id, tnOrderId: String(tnOrder.id) },
          { ...mapTnOrderToSchema(tnOrder) },
          { upsert: true, new: true }
        );

        // Calculate financials + NC/RC for each order
        if (order.estado !== 'cancelled') {
          await calculateOrderFinancials(order, store);
          await classifyCustomer(order, store);
          await generateCashflowEntries(order);
        }

        // Track dates for DailyMetric recalculation
        const dateStr = toBusinessDateLabel(tnOrder.created_at);
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
      await recalculateDailyMetric(store._id, dateStr);
    }

    await rebuildCustomersFromOrders(store._id);
    await calculateRFM(store._id);
    await refreshProductDerivedMetrics(store._id);

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
  const localizedName = tnProduct.name?.es || tnProduct.name?.en || tnProduct.name;
  const localizedHandle = tnProduct.handle?.es || tnProduct.handle?.en || tnProduct.handle || '';
  const rootCategory = (tnProduct.categories || []).find((category) => !category.parent);
  const childCategory = (tnProduct.categories || []).find((category) => category.parent);

  return {
    nombre: localizedName,
    sku: mainVariant?.sku || '',
    handle: localizedHandle,
    productUrl: tnProduct.canonical_url || (localizedHandle ? `https://${tnProduct.store_domain || ''}/productos/${localizedHandle}` : ''),
    activo: Boolean(tnProduct.published),
    estadoPublicacion: tnProduct.published ? 'activo' : 'inactivo',
    precio: parseFloat(mainVariant?.price || tnProduct.price || 0),
    stock: tnProduct.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0,
    variantes: (tnProduct.variants || []).map((v) => ({
      tnVariantId: String(v.id),
      nombre: v.name || '',
      sku: v.sku || '',
      precio: parseFloat(v.price || 0),
      stock: v.stock || 0,
    })),
    categoria: rootCategory?.name?.es || rootCategory?.name?.en || '',
    subcategoria: childCategory?.name?.es || childCategory?.name?.en || '',
    imagenUrl: tnProduct.images?.[0]?.src,
  };
}

async function syncProducts(store) {
  const startTime = Date.now();
  const tnToken = getStoreToken(store, 'tn');
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
      let response;
      try {
        response = await tnAPI.get(
          store.tnStoreId,
          '/products',
          tnToken,
          {
            per_page: perPage,
            page,
            fields:
              'id,name,price,variants,categories,images,created_at,updated_at',
          }
        );
      } catch (error) {
        if (error.response?.status !== 422) throw error;
        response = await tnAPI.get(
          store.tnStoreId,
          '/products',
          tnToken,
          { per_page: perPage, page }
        );
      }

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

async function checkTiendanubeTokenHealth(store) {
  const startTime = Date.now();
  const log = await SyncLog.create({
    storeId: store._id,
    type: 'tiendanube_token_check',
    status: 'running',
  });

  try {
    if (!store?.tnStoreId || !isCentralizedTiendanubeStore(store.tnStoreId)) {
      log.status = 'success';
      log.recordsFetched = 0;
      log.duration = Date.now() - startTime;
      await log.save();
      return { checked: false, reason: 'not_centralized' };
    }

    invalidateTiendanubeToken(store.tnStoreId);
    const info = await tnAPI.validateConnection(store.tnStoreId, null);

    log.status = 'success';
    log.recordsFetched = 1;
    log.duration = Date.now() - startTime;
    await log.save();

    logger.info(`TN token health OK for ${store.nombre}`);
    return {
      checked: true,
      ok: true,
      storeName: info?.name?.es || info?.name || info?.business_name || null,
    };
  } catch (error) {
    log.status = 'error';
    log.error = error.message;
    log.duration = Date.now() - startTime;
    await log.save();
    logger.error(`TN token health failed for ${store.nombre}: ${error.message}`);
    return {
      checked: true,
      ok: false,
      status: error.response?.status || null,
      message: error.message,
    };
  }
}

module.exports = { syncOrders, syncProducts, checkTiendanubeTokenHealth };
