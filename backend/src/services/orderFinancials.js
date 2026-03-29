const Product = require('../models/Product');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const logger = require('../utils/logger');

/**
 * Map TN gateway names to our medioPago keys.
 */
function mapGatewayToMedioPago(gateway) {
  if (!gateway) return 'otro';
  const g = gateway.toLowerCase();
  if (g.includes('mercado') || g.includes('mp')) return 'mercadopago';
  if (g.includes('visa')) return 'visa';
  if (g.includes('master')) return 'mastercard';
  if (g.includes('amex')) return 'amex';
  if (g.includes('debit') || g.includes('débito')) return 'debito';
  if (g.includes('transfer')) return 'transferencia';
  if (g.includes('efectivo') || g.includes('cash')) return 'efectivo';
  return 'otro';
}

/**
 * Calculate all financial deductions for an order.
 * 6 deduction lines → totalNeto, liquidable.
 */
async function calculateOrderFinancials(order, store) {
  const medioPago = mapGatewayToMedioPago(order.gateway);

  // 1. Comisión de pago — buscar config exacta (medioPago + cuotas)
  const comisionConfig = store.comisionPagoConfig?.find(
    (c) => c.medioPago === medioPago && c.cuotas === order.cantidadCuotas
  );
  // Fallback: misma medio, cuotas=1
  const fallback = store.comisionPagoConfig?.find(
    (c) => c.medioPago === medioPago && c.cuotas === 1
  );
  const config = comisionConfig || fallback;

  order.comisionPago = config
    ? order.totalOrden * (config.comisionBase / 100)
    : 0;

  // 2. Comisión de cuotas (adicional si cuotas > 1)
  order.comisionCuotas =
    config && order.cantidadCuotas > 1
      ? order.totalOrden * ((config.comisionCuotas || 0) / 100)
      : 0;

  // 3. Impuestos IBB
  order.impuestosIBB = order.totalOrden * ((store.tasaIBB || 0) / 100);

  // 4. Fee plataforma (TiendaNube)
  order.feePlataforma = order.totalOrden * ((store.feePlataformaPct || 0) / 100);

  // 5. Costo de productos — lookup por tnProductId
  order.costoProductos = 0;
  for (const item of order.lineItems) {
    if (!item.tnProductId) continue;
    const product = await Product.findOne({
      storeId: store._id,
      tnProductId: item.tnProductId,
    }).lean();
    if (product && product.costoUnitario > 0) {
      const costo = product.costoUnitario * (item.cantidad || 1);
      item.costoUnitario = product.costoUnitario;
      order.costoProductos += costo;
    }
  }

  // 6. costoEnvio — ya viene del mapeo de TN

  // 7. TOTAL NETO
  order.totalNeto =
    order.totalOrden -
    order.comisionPago -
    order.comisionCuotas -
    order.impuestosIBB -
    order.feePlataforma -
    order.costoEnvio -
    order.costoProductos;

  // 8. Liquidable — lo que se acredita (sin COGS ni envío)
  order.liquidable =
    order.totalOrden -
    order.comisionPago -
    order.comisionCuotas -
    order.feePlataforma;

  await order.save();
}

/**
 * Classify order as NC (new customer) or RC (returning).
 * Upsert Customer document.
 */
async function classifyCustomer(order, store) {
  if (!order.customerEmail) {
    order.esClienteNuevo = null;
    await order.save();
    return;
  }

  // Count previous orders from same email
  const previousOrders = await Order.countDocuments({
    storeId: store._id,
    customerEmail: order.customerEmail,
    fechaCreacion: { $lt: order.fechaCreacion },
    estado: { $nin: ['cancelled'] },
  });

  order.esClienteNuevo = previousOrders === 0;
  await order.save();

  // Upsert Customer doc
  const cohortMonth = order.fechaCreacion
    ? `${order.fechaCreacion.getFullYear()}-${String(order.fechaCreacion.getMonth() + 1).padStart(2, '0')}`
    : null;

  await Customer.findOneAndUpdate(
    { storeId: store._id, email: order.customerEmail },
    {
      $set: {
        name: order.customerName,
        lastOrderDate: order.fechaCreacion,
      },
      $inc: { totalOrders: 1, totalSpent: order.totalOrden },
      $setOnInsert: {
        firstPurchase: order.fechaCreacion,
        cohortMonth,
      },
    },
    { upsert: true }
  );
}

/**
 * Run financials + NC/RC for all orders of a store that haven't been calculated yet.
 * Used after sync or when financial config changes.
 */
async function recalculateAllOrders(store) {
  const orders = await Order.find({
    storeId: store._id,
    estado: { $nin: ['cancelled'] },
  });

  let processed = 0;
  for (const order of orders) {
    await calculateOrderFinancials(order, store);
    await classifyCustomer(order, store);
    processed++;
  }

  logger.info(`Recalculated financials for ${processed} orders in ${store.nombre}`);
  return processed;
}

module.exports = {
  calculateOrderFinancials,
  classifyCustomer,
  recalculateAllOrders,
  mapGatewayToMedioPago,
};
