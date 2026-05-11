const axios = require('axios');
const Store = require('../models/Store');
const { tn } = require('../config/environment');
const logger = require('../utils/logger');

/**
 * Redirect user to TiendaNube OAuth authorization.
 */
exports.connect = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const store = await Store.findById(storeId);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const authUrl =
      `https://www.tiendanube.com/apps/${tn.appId}/authorize` +
      `?response_type=code` +
      `&state=${storeId}`;

    res.json({ authUrl });
  } catch (error) {
    next(error);
  }
};

/**
 * OAuth callback from TiendaNube.
 * Exchange code for access token.
 */
exports.callback = async (req, res, next) => {
  try {
    const { code, state: storeId } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code missing' });
    }

    // Exchange code for token
    const tokenResponse = await axios.post(
      'https://www.tiendanube.com/apps/authorize/token',
      {
        client_id: tn.appId,
        client_secret: tn.appSecret,
        grant_type: 'authorization_code',
        code,
      }
    );

    const { access_token, user_id } = tokenResponse.data;

    // Update store with token
    const store = await Store.findById(storeId);
    if (!store) {
      return res.redirect('/?error=store_not_found');
    }

    store.tnAccessToken = access_token;
    store.tnStoreId = String(user_id);
    store.integrationStatus.tiendanube.connected = true;
    await store.save();

    logger.info(`TN OAuth complete for store ${store.nombre} (${user_id})`);

    // Redirect a Settings así el usuario ve la confirmación inmediata + puede continuar la config.
    res.redirect(`/store/${storeId}/settings?tn_connected=true`);
  } catch (error) {
    logger.error(`TN OAuth callback error: ${error.message}`);
    const storeId = req.query.state;
    const target = storeId ? `/store/${storeId}/settings?error=tn_oauth_failed` : '/?error=tn_oauth_failed';
    res.redirect(target);
  }
};
