const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    tnProductId: { type: String, required: true },

    nombre: { type: String },
    precio: { type: Number, default: 0 },

    // Stock
    stock: { type: Number, default: 0 },
    stockMinimo: { type: Number },
    stockAlerta: { type: Boolean, default: false },

    // Variantes
    variantes: [
      {
        tnVariantId: String,
        nombre: String,
        precio: Number,
        stock: Number,
      },
    ],

    // Costo
    costoUnitario: { type: Number, default: 0 },
    costoEmpaque: { type: Number, default: 0 },

    // Márgenes (calculados)
    margenBruto: { type: Number },
    margenBrutoPct: { type: Number },
    margenNeto: { type: Number },

    // Ventas
    ventas30dias: { type: Number, default: 0 },
    velocity: { type: Number, default: 0 },
    diasDeStock: { type: Number },
    ultimaVenta: { type: Date },

    // Categoría
    categoria: { type: String },

    // Imagen
    imagenUrl: { type: String },
  },
  { timestamps: true }
);

productSchema.index({ storeId: 1, tnProductId: 1 }, { unique: true });

module.exports = mongoose.model('Product', productSchema);
