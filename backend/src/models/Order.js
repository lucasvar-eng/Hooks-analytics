const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    tnOrderId: { type: String, required: true },
    tnOrderNumber: { type: String },

    // Cliente
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String },
    customerEmail: { type: String },

    // Montos brutos
    totalOrden: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    descuento: { type: Number, default: 0 },

    // Costos y deducciones (Sprint 2 calcula, Sprint 1 deja en 0)
    comisionPago: { type: Number, default: 0 },
    comisionCuotas: { type: Number, default: 0 },
    impuestosIBB: { type: Number, default: 0 },
    feePlataforma: { type: Number, default: 0 },
    costoEnvio: { type: Number, default: 0 },
    costoProductos: { type: Number, default: 0 },

    // Derivados
    totalNeto: { type: Number, default: 0 },
    liquidable: { type: Number, default: 0 },

    // NC/RC (Sprint 2)
    esClienteNuevo: { type: Boolean },

    // Pago
    cantidadCuotas: { type: Number, default: 1 },
    gateway: { type: String },
    medioPago: { type: String },
    paymentStatus: { type: String },
    paidAt: { type: Date },

    // Status
    estado: { type: String },
    esDevolucion: { type: Boolean, default: false },
    canal: { type: String, default: 'tiendanube' },

    // Line items
    lineItems: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        tnProductId: String,
        nombre: String,
        cantidad: Number,
        precioUnitario: Number,
        costoUnitario: { type: Number, default: 0 },
        subtotal: Number,
      },
    ],

    // UTM
    utm_source: String,
    utm_medium: String,
    utm_campaign: String,
    utm_content: String,

    fechaCreacion: { type: Date },
  },
  { timestamps: true }
);

orderSchema.index({ storeId: 1, tnOrderId: 1 }, { unique: true });
orderSchema.index({ storeId: 1, fechaCreacion: -1 });

module.exports = mongoose.model('Order', orderSchema);
