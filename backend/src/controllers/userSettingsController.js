const User = require('../models/User');
const StoreConnection = require('../models/StoreConnection');
const { encrypt, decrypt } = require('../utils/encryption');
const { verifyApiKey } = require('../services/emailService');
const metaAPI = require('../services/metaAPI');
const logger = require('../utils/logger');

function sanitizeMetaAccounts(accounts = []) {
  return accounts
    .map((account) => ({
      id: account.id,
      accountId: account.account_id,
      name: account.name,
      status: account.account_status,
      currency: account.currency,
      isActive: account.account_status === 1,
    }))
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
}

async function loadUserMetaToken(userId) {
  const user = await User.findById(userId)
    .select('+metaUserTokenEncrypted +metaUserTokenIV +metaUserTokenAuthTag metaUserTokenExpiresAt');
  if (!user?.metaUserTokenEncrypted) return null;
  try {
    return decrypt(user.metaUserTokenEncrypted, user.metaUserTokenIV, user.metaUserTokenAuthTag);
  } catch (err) {
    logger.error(`No se pudo descifrar metaUserToken para user ${userId}: ${err.message}`);
    return null;
  }
}

exports.getNotifications = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select(
      'email notificationEmail notificationPreferences'
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      notificationEmail: user.notificationEmail || '',
      fallbackEmail: user.email,
      preferences: user.notificationPreferences || {},
    });
  } catch (error) {
    next(error);
  }
};

exports.updateNotifications = async (req, res, next) => {
  try {
    const { notificationEmail, preferences } = req.body;
    const update = {};

    if (notificationEmail !== undefined) {
      const trimmed = String(notificationEmail || '').trim();
      if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return res.status(400).json({ error: 'Email de notificaciones inválido' });
      }
      update.notificationEmail = trimmed;
    }

    if (preferences && typeof preferences === 'object') {
      if (preferences.alerts) update['notificationPreferences.alerts'] = preferences.alerts;
      if (preferences.digests) update['notificationPreferences.digests'] = preferences.digests;
      if (preferences.reports) update['notificationPreferences.reports'] = preferences.reports;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'Nada para actualizar' });
    }

    const user = await User.findByIdAndUpdate(req.user._id, { $set: update }, { new: true })
      .select('email notificationEmail notificationPreferences');

    res.json({
      notificationEmail: user.notificationEmail || '',
      fallbackEmail: user.email,
      preferences: user.notificationPreferences || {},
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/user/resend-config — devuelve estado (sin la key en sí).
 */
exports.getResendConfig = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('+resendApiKeyEncrypted email resendFromEmail');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      configured: !!user.resendApiKeyEncrypted,
      fromEmail: user.resendFromEmail || '',
      ownerEmail: user.email,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/user/resend-config — guarda API key (encrypted) y/o fromEmail.
 * Body: { apiKey?, fromEmail? }
 */
exports.updateResendConfig = async (req, res, next) => {
  try {
    const { apiKey, fromEmail } = req.body;
    const update = {};

    if (apiKey !== undefined) {
      const trimmed = String(apiKey || '').trim();
      if (trimmed === '') {
        update.resendApiKeyEncrypted = '';
        update.resendApiKeyIV = '';
        update.resendApiKeyAuthTag = '';
      } else {
        if (!trimmed.startsWith('re_')) {
          return res.status(400).json({ error: 'La API key debe empezar con "re_"' });
        }
        const { encrypted, iv, authTag } = encrypt(trimmed);
        update.resendApiKeyEncrypted = encrypted;
        update.resendApiKeyIV = iv;
        update.resendApiKeyAuthTag = authTag;
      }
    }

    if (fromEmail !== undefined) {
      const trimmed = String(fromEmail || '').trim();
      if (trimmed && !/<.+@.+\..+>|^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return res.status(400).json({ error: 'fromEmail inválido. Usá email@dominio.com o "Nombre <email@dominio.com>"' });
      }
      update.resendFromEmail = trimmed;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'Nada para actualizar' });
    }

    await User.findByIdAndUpdate(req.user._id, { $set: update });
    logger.info(`Resend config updated for user ${req.user.email}`);

    const fresh = await User.findById(req.user._id)
      .select('+resendApiKeyEncrypted email resendFromEmail');
    res.json({
      configured: !!fresh.resendApiKeyEncrypted,
      fromEmail: fresh.resendFromEmail || '',
      ownerEmail: fresh.email,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/user/resend-config/test — manda un mail de prueba al user.
 * Si body.apiKey viene, usa esa (para pre-validar antes de guardar).
 * Si no, usa la guardada.
 */
exports.testResendConfig = async (req, res, next) => {
  try {
    const bodyKey = String(req.body?.apiKey || '').trim();
    let apiKey = bodyKey;

    if (!apiKey) {
      const user = await User.findById(req.user._id)
        .select('+resendApiKeyEncrypted +resendApiKeyIV +resendApiKeyAuthTag email');
      if (!user?.resendApiKeyEncrypted) {
        return res.status(400).json({ error: 'No hay API key configurada. Pegá una en el body o guardala antes.' });
      }
      try {
        const { decrypt } = require('../utils/encryption');
        apiKey = decrypt(user.resendApiKeyEncrypted, user.resendApiKeyIV, user.resendApiKeyAuthTag);
      } catch (err) {
        return res.status(500).json({ error: 'No se pudo descifrar la API key guardada' });
      }
    }

    // Resend free + sin dominio verificado: solo deja mandar a la cuenta de signup.
    // Permitimos que el user pase `testTo` en el body si su email de Resend difiere
    // del de login (caso típico: Hooks con corporativo, Resend con personal).
    const testTo = (req.body?.testTo && String(req.body.testTo).trim())
      || req.user.notificationEmail
      || req.user.email;
    const result = await verifyApiKey(apiKey, testTo);

    if (result.ok) {
      logger.info(`Resend test email sent to ${testTo} (resend id: ${result.id})`);
      return res.json({ ok: true, sentTo: testTo, id: result.id });
    }
    return res.status(400).json({
      ok: false,
      error: result.error,
      sentTo: testTo,
      hint: (result.error || '').toLowerCase().includes('only send testing emails')
        ? 'Sin dominio verificado, Resend solo te deja mandar a la cuenta con la que te registraste. Pasá ese email como "testTo" o configuralo como notificationEmail.'
        : null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/user/meta-token — estado del long-lived access token de Meta del user.
 */
exports.getMetaToken = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('+metaUserTokenEncrypted metaUserTokenExpiresAt metaUserTokenUpdatedAt');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const expiresAt = user.metaUserTokenExpiresAt || null;
    const daysLeft = expiresAt
      ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
      : null;

    res.json({
      configured: !!user.metaUserTokenEncrypted,
      expiresAt,
      daysLeft,
      updatedAt: user.metaUserTokenUpdatedAt || null,
      health: !user.metaUserTokenEncrypted
        ? 'missing'
        : daysLeft !== null && daysLeft <= 0
          ? 'expired'
          : daysLeft !== null && daysLeft <= 14
            ? 'expiring_soon'
            : 'ok',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/user/meta-token — guarda el token (validado contra Meta) y lo
 * propaga a todas las StoreConnection de Meta del user que tengan el token
 * anterior (para no romper syncs activos).
 *
 * Body: { accessToken, expiresAt? }
 */
exports.updateMetaToken = async (req, res, next) => {
  try {
    const accessToken = String(req.body?.accessToken || '').trim();
    const expiresAtInput = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;

    if (!accessToken) {
      return res.status(400).json({ error: 'Se requiere accessToken' });
    }

    // Validar contra Meta antes de guardar
    let accounts;
    try {
      accounts = await metaAPI.getAdAccounts(accessToken);
    } catch (err) {
      const status = err.response?.status;
      return res.status(400).json({
        error:
          status === 401 || status === 403
            ? 'El access token no es válido o no tiene permisos suficientes (ads_read).'
            : 'No se pudieron validar las cuentas publicitarias con ese token.',
      });
    }

    // Cargar token anterior (si existe) para propagar
    const prevUser = await User.findById(req.user._id)
      .select('+metaUserTokenEncrypted +metaUserTokenIV +metaUserTokenAuthTag');
    const prevToken = prevUser?.metaUserTokenEncrypted
      ? (() => {
          try {
            return decrypt(prevUser.metaUserTokenEncrypted, prevUser.metaUserTokenIV, prevUser.metaUserTokenAuthTag);
          } catch (err) {
            return null;
          }
        })()
      : null;

    // Cifrar y guardar nuevo
    const enc = encrypt(accessToken);
    const expiresAt =
      expiresAtInput && !Number.isNaN(expiresAtInput.getTime())
        ? expiresAtInput
        : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // default 60 días (long-lived)

    await User.findByIdAndUpdate(req.user._id, {
      $set: {
        metaUserTokenEncrypted: enc.encrypted,
        metaUserTokenIV: enc.iv,
        metaUserTokenAuthTag: enc.authTag,
        metaUserTokenExpiresAt: expiresAt,
        metaUserTokenUpdatedAt: new Date(),
      },
    });

    // Propagar a StoreConnections de Meta donde este user es el connectedByUser
    let propagated = 0;
    if (prevToken && prevToken !== accessToken) {
      const myConnections = await StoreConnection.find({
        connectedByUser: req.user._id,
        provider: 'meta',
        status: { $ne: 'revoked' },
      }).select('+accessTokenEncrypted +accessTokenIV +accessTokenAuthTag');

      for (const conn of myConnections) {
        try {
          const currentTokenOfConn = decrypt(conn.accessTokenEncrypted, conn.accessTokenIV, conn.accessTokenAuthTag);
          if (currentTokenOfConn === prevToken) {
            const reEnc = encrypt(accessToken);
            conn.accessTokenEncrypted = reEnc.encrypted;
            conn.accessTokenIV = reEnc.iv;
            conn.accessTokenAuthTag = reEnc.authTag;
            conn.expiresAt = expiresAt;
            conn.lastError = '';
            await conn.save();
            propagated += 1;
          }
        } catch (err) {
          logger.warn(`No se pudo propagar token a StoreConnection ${conn._id}: ${err.message}`);
        }
      }
    }

    logger.info(`Meta user token updated for ${req.user.email} (propagated to ${propagated} stores)`);

    res.json({
      success: true,
      configured: true,
      expiresAt,
      adAccountsCount: accounts.length,
      propagatedToStores: propagated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/user/meta-token — borra el token guardado. No toca las
 * StoreConnections existentes (siguen funcionando con su token actual).
 */
exports.deleteMetaToken = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $unset: {
        metaUserTokenEncrypted: '',
        metaUserTokenIV: '',
        metaUserTokenAuthTag: '',
        metaUserTokenExpiresAt: '',
        metaUserTokenUpdatedAt: '',
      },
    });
    res.json({ success: true, configured: false });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/user/meta-token/ad-accounts — lista las ad accounts disponibles
 * con el token guardado.
 */
exports.getMetaAdAccounts = async (req, res, next) => {
  try {
    const token = await loadUserMetaToken(req.user._id);
    if (!token) {
      return res.status(404).json({ error: 'No hay token de Meta guardado. Guardalo primero en /profile.' });
    }
    try {
      const accounts = await metaAPI.getAdAccounts(token);
      res.json({ success: true, accounts: sanitizeMetaAccounts(accounts) });
    } catch (err) {
      const status = err.response?.status;
      res.status(400).json({
        error:
          status === 401 || status === 403
            ? 'El token guardado dejó de ser válido. Regeneralo en Meta y actualizalo en /profile.'
            : 'No se pudieron obtener las cuentas publicitarias.',
      });
    }
  } catch (error) {
    next(error);
  }
};

exports.loadUserMetaToken = loadUserMetaToken;
