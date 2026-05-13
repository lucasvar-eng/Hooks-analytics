const mongoose = require('mongoose');

const syncLogSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    type: {
      type: String,
      required: true,
      enum: [
        'tiendanube_orders',
        'tiendanube_products',
        'tiendanube_token_check',
        'shopify_orders',
        'shopify_products',
        'meta_structure',
        'meta_insights',
        'meta_product_insights',
        'meta_token_refresh',
        'diagnostics',
        'cleanup',
      ],
    },
    status: {
      type: String,
      enum: ['success', 'error', 'running'],
      default: 'running',
    },
    recordsFetched: { type: Number, default: 0 },
    recordsCreated: { type: Number, default: 0 },
    recordsUpdated: { type: Number, default: 0 },
    error: { type: String },
    duration: { type: Number }, // ms
  },
  { timestamps: true }
);

// TTL: auto-delete after 30 days
syncLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
syncLogSchema.index({ storeId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('SyncLog', syncLogSchema);
