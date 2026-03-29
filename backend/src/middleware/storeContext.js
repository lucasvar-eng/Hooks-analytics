const mongoose = require('mongoose');

const storeContext = (req, res, next) => {
  const { storeId } = req.params;

  if (!storeId) {
    return res.status(400).json({ error: 'storeId is required' });
  }

  if (!mongoose.Types.ObjectId.isValid(storeId)) {
    return res.status(400).json({ error: 'Invalid storeId' });
  }

  // Admin has access to all stores; others must have explicit access
  if (req.user.role !== 'admin') {
    const hasAccess = req.user.storeAccess.some(
      (id) => id.toString() === storeId
    );
    if (!hasAccess) {
      return res.status(403).json({ error: 'No access to this store' });
    }
  }

  req.storeId = storeId;
  next();
};

module.exports = storeContext;