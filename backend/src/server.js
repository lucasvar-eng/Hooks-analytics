const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');
const { port, nodeEnv } = require('./config/environment');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const storeRoutes = require('./routes/storeRoutes');
const tnRoutes = require('./routes/tnRoutes');
const metaRoutes = require('./routes/metaRoutes');
const cashflowRoutes = require('./routes/cashflowRoutes');
const costosRoutes = require('./routes/costosRoutes');
const productRoutes = require('./routes/productRoutes');
const { startCronJobs } = require('./services/cronJobs');
const logger = require('./utils/logger');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: nodeEnv, timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/tn', tnRoutes);
app.use('/api', metaRoutes);
app.use('/api', cashflowRoutes);
app.use('/api', costosRoutes);
app.use('/api', productRoutes);

// Serve frontend in production
if (nodeEnv === 'production') {
  const publicPath = path.resolve(__dirname, '../public');
  app.use(express.static(publicPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Error handler (must be last)
app.use(errorHandler);

app.listen(port, () => {
  logger.info(`Server running on port ${port} (${nodeEnv})`);
  startCronJobs();
});

module.exports = app;