const User = require('../models/User');

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
