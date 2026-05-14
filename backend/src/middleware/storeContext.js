const mongoose = require('mongoose');
const { hasAnyAccess, isGlobalAdmin } = require('../services/permissions');

/**
 * storeContext — verifica que el usuario tenga AL MENOS un StoreAccess
 * para la tienda referenciada en la ruta. Para checkear permisos
 * específicos, usar requirePermission(...) además de este middleware.
 */
const storeContext = async (req, res, next) => {
  try {
    const storeId = req.params.storeId || req.params.id;

    if (!storeId) {
      return res.status(400).json({ error: 'storeId is required' });
    }
    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ error: 'Invalid storeId' });
    }

    if (!isGlobalAdmin(req.user)) {
      const ok = await hasAnyAccess(req.user._id, storeId);
      if (!ok) {
        return res.status(403).json({ error: 'No access to this store' });
      }
    }

    req.storeId = storeId;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = storeContext;
