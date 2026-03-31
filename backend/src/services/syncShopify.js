const shopifyAPI = require('./shopifyAPI');
const Order = require('../models/Order');
const Product = require('../models/Product');
const SyncLog = require('../models/SyncLog');
const { recalculateDailyMetric } = require('./metricCalculator');
const { calculateOrderFinancials, classifyCustomer } = require('./orderFinancials');
const { generateCashflowEntries } = require('./cashflow');
const { rebuildCustomersFromOrders, calculateRFM } = require('./customerService');
const { refreshProductDerivedMetrics } = require('./productService');
const logger = require('../utils/logger');

function mapShopifyProductToSchema(shopifyProduct) {
  const variants = (shopifyProduct.variants?.edges || []).map(({ node }) => ({
    tnVariantId: String(node.id),
    nombre: node.title === 'Default Title' ? '' : node.title,
    sku: node.sku || '',
    precio: parseFloat(node.price || 0),
    stock: node.inventoryQuantity || 0,
  }));

  return {
    tnProductId: String(shopifyProduct.id),
    sku: variants[0]?.sku || '',
    handle: shopifyProduct.handle || '',
    productUrl: shopifyProduct.onlineStorePreviewUrl || null,
    activo: shopifyProduct.status ? shopifyProduct.status === 'ACTIVE' : true,
    estadoPublicacion: shopifyProduct.status ? String(shopifyProduct.status).toLowerCase() : 'activo',
    nombre: shopifyProduct.title,
    precio: parseFloat(variants[0]?.precio || 0),
    stock: Number(shopifyProduct.totalInventory || 0),
    variantes: variants,
    categoria: shopifyProduct.productType || '',
    subcategoria: '',
    imagenUrl: shopifyProduct.featuredImage?.url || null,
  };
}

function mapShopifyOrderToSchema(shopifyOrder) {
  const lineItems = (shopifyOrder.lineItems?.edges || []).map(({ node }) => {
    const price = parseFloat(node.originalUnitPriceSet?.shopMoney?.amount || 0);
    return {
      tnProductId: node.product?.id ? String(node.product.id) : undefined,
      nombre: node.title,
      cantidad: Number(node.quantity || 0),
      precioUnitario: price,
      subtotal: price * Number(node.quantity || 0),
    };
  });

  const customerName = [shopifyOrder.customer?.firstName, shopifyOrder.customer?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    tnOrderNumber: shopifyOrder.name,
    externalCustomerId: shopifyOrder.customer?.id ? String(shopifyOrder.customer.id) : undefined,
    customerName: customerName || undefined,
    customerEmail: shopifyOrder.customer?.email?.toLowerCase(),
    totalOrden: parseFloat(shopifyOrder.totalPriceSet?.shopMoney?.amount || 0),
    subtotal: parseFloat(
      shopifyOrder.currentSubtotalPriceSet?.shopMoney?.amount ||
      shopifyOrder.subtotalPriceSet?.shopMoney?.amount ||
      0
    ),
    descuento: parseFloat(shopifyOrder.totalDiscountsSet?.shopMoney?.amount || 0),
    costoEnvio: parseFloat(shopifyOrder.totalShippingPriceSet?.shopMoney?.amount || 0),
    gateway: shopifyOrder.paymentGatewayNames?.[0] || 'shopify',
    medioPago: shopifyOrder.paymentGatewayNames?.[0] || 'shopify',
    cantidadCuotas: 1,
    paymentStatus: shopifyOrder.displayFinancialStatus,
    paidAt: shopifyOrder.processedAt ? new Date(shopifyOrder.processedAt) : null,
    estado: shopifyOrder.cancelledAt ? 'cancelled' : String(shopifyOrder.displayFulfillmentStatus || 'open').toLowerCase(),
    canal: 'shopify',
    fechaCreacion: new Date(shopifyOrder.createdAt),
    lineItems,
  };
}

async function syncShopifyProducts(store) {
  const startTime = Date.now();
  let totalRecords = 0;

  const log = await SyncLog.create({
    storeId: store._id,
    type: 'shopify_products',
    status: 'running',
  });

  try {
    const products = await shopifyAPI.listProducts(store.shopifyShopDomain, store.shopifyAccessToken);

    for (const product of products) {
      await Product.findOneAndUpdate(
        { storeId: store._id, tnProductId: String(product.id) },
        mapShopifyProductToSchema(product),
        { upsert: true, new: true }
      );
    }

    totalRecords = products.length;
    store.integrationStatus.shopify.lastSync = new Date();
    store.integrationStatus.shopify.connected = true;
    await store.save();

    log.status = 'success';
    log.recordsFetched = totalRecords;
    log.duration = Date.now() - startTime;
    await log.save();
  } catch (error) {
    log.status = 'error';
    log.error = error.message;
    log.duration = Date.now() - startTime;
    await log.save();
    throw error;
  }
}

async function syncShopifyOrders(store) {
  const startTime = Date.now();
  const lastSync = store.integrationStatus?.shopify?.lastSync || new Date(0);
  const affectedDates = new Set();
  let totalRecords = 0;

  const log = await SyncLog.create({
    storeId: store._id,
    type: 'shopify_orders',
    status: 'running',
  });

  try {
    const orders = await shopifyAPI.listOrders(store.shopifyShopDomain, store.shopifyAccessToken, {
      updatedAtMin: lastSync,
    });

    for (const shopifyOrder of orders) {
      const order = await Order.findOneAndUpdate(
        { storeId: store._id, tnOrderId: String(shopifyOrder.id) },
        { ...mapShopifyOrderToSchema(shopifyOrder) },
        { upsert: true, new: true }
      );

      if (order.estado !== 'cancelled') {
        await calculateOrderFinancials(order, store);
        await classifyCustomer(order, store);
        await generateCashflowEntries(order);
      }

      const dateStr = new Date(shopifyOrder.createdAt).toISOString().split('T')[0];
      affectedDates.add(dateStr);
    }

    totalRecords = orders.length;
    store.integrationStatus.shopify.lastSync = new Date();
    store.integrationStatus.shopify.connected = true;
    await store.save();

    for (const dateStr of affectedDates) {
      await recalculateDailyMetric(store._id, new Date(dateStr));
    }

    await rebuildCustomersFromOrders(store._id);
    await calculateRFM(store._id);
    await refreshProductDerivedMetrics(store._id);

    log.status = 'success';
    log.recordsFetched = totalRecords;
    log.duration = Date.now() - startTime;
    await log.save();

    logger.info(`Sync Shopify orders complete for ${store.nombre}: ${totalRecords} orders in ${log.duration}ms`);
  } catch (error) {
    log.status = 'error';
    log.error = error.message;
    log.duration = Date.now() - startTime;
    await log.save();
    logger.error(`Sync Shopify orders failed for ${store.nombre}: ${error.message}`);
    throw error;
  }
}

module.exports = {
  syncShopifyProducts,
  syncShopifyOrders,
};
