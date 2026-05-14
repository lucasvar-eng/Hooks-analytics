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
    croServiceApiUrl: process.env.CRO_SERVICE_API_URL || 'https://app.ecomclub.com.ar/api/service/stores',
    croServiceApiKey: process.env.CRO_SERVICE_API_KEY || '',
  },

  // Meta (Sprint 3)
  meta: {
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    callbackUrl: process.env.META_CALLBACK_URL,
  },

  encryptionKey: process.env.ENCRYPTION_KEY,

  // AI (Sprint 9)
  ai: {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    modelAnalysis: process.env.AI_MODEL_ANALYSIS || 'claude-sonnet-4-20250514',
    modelChat: process.env.AI_MODEL_CHAT || 'claude-3-5-haiku-latest',
    modelReports: process.env.AI_MODEL_REPORTS || 'claude-opus-4-1-20250805',
  },

  google: {
    sheetsClientEmail: process.env.GOOGLE_SHEETS_CLIENT_EMAIL || '',
    sheetsPrivateKey: process.env.GOOGLE_SHEETS_PRIVATE_KEY || '',
  },

  mcp: {
    defaultAuthorEmail: process.env.MCP_DEFAULT_AUTHOR_EMAIL || 'lucas@hooks.com.ar',
  },

  email: {
    resendApiKey: process.env.RESEND_API_KEY || '',
    from: process.env.EMAIL_FROM || 'Hooks Analytics <onboarding@resend.dev>',
    replyTo: process.env.EMAIL_REPLY_TO || '',
    appUrl: process.env.APP_PUBLIC_URL || 'http://localhost:5173',
  },

  observability: {
    sentryDsn: process.env.SENTRY_DSN || '',
    appVersion: process.env.APP_VERSION || '',
  },
};
