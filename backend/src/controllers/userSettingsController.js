const User = require('../models/User');
const { encrypt } = require('../utils/encryption');
const { verifyApiKey } = require('../services/emailService');
const logger = require('../utils/logger');

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
