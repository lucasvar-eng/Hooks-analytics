const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: '7d',

  // TiendaNube (Sprint 1)
  tn: {
    appId: process.env.TN_APP_ID,
    appSecret: process.env.TN_APP_SECRET,
    callbackUrl: process.env.TN_CALLBACK_URL,
  },

  // Meta (Sprint 3)
  meta: {
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    callbackUrl: process.env.META_CALLBACK_URL,
  },

  // AI (Sprint 9)
  ai: {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    modelAnalysis: process.env.AI_MODEL_ANALYSIS || 'claude-sonnet-4-6',
    modelChat: process.env.AI_MODEL_CHAT || 'claude-sonnet-4-6',
    modelReports: process.env.AI_MODEL_REPORTS || 'claude-opus-4-6',
  },
};