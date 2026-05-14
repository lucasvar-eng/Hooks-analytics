const User = require('../models/User');
const Store = require('../models/Store');
const StoreAccess = require('../models/StoreAccess');
const permissions = require('../services/permissions');
const bcrypt = require('bcryptjs');

async function attachStoreAccesses(users) {
  const userIds = users.map((u) => u._id);
  const accesses = await StoreAccess.find({ userId: { $in: userIds } })
    .populate('storeId', 'nombre')
    .lean();
  const byUser = new Map();
  for (const a of accesses) {
    const key = String(a.userId);
    if (!byUser.has(key)) byUser.set(key, []);
    byUser.get(key).push({
      _id: a.storeId?._id,
      nombre: a.storeId?.nombre,
      role: a.role,
      permissions: a.permissions || [],
    });
  }
  return users.map((u) => ({
    ...u,
    storeAccess: byUser.get(String(u._id)) || [],
  }));
}

async function syncUserStoreAccesses(userId, desired, invitedBy) {
  /**
   * desired puede ser:
   *  - [storeId, storeId, ...]                       → todos como 'admin'
   *  - [{ storeId, role, permissions? }, ...]        → granular
   */
  const normalized = (desired || [])
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === 'string') return { storeId: entry, role: 'admin', permissions: [] };
      if (typeof entry === 'object') {
        return {
          storeId: String(entry.storeId || entry._id || ''),
          role: entry.role || 'admin',
          permissions: Array.isArray(entry.permissions) ? entry.permissions : [],
        };
      }
      return null;
    })
    .filter((e) => e && e.storeId);

  const current = await StoreAccess.find({ userId }).lean();
  const desiredIds = new Set(normalized.map((e) => e.storeId));

  // Remover accesos que ya no están
  const toRemove = current.filter((c) => !desiredIds.has(String(c.storeId)));
  for (const access of toRemove) {
    if (access.role === 'owner') continue; // protegido — no se quita ownership por edit masivo
    await permissions.revokeAccess(userId, access.storeId);
  }

  // Upsert los pedidos
  for (const entry of normalized) {
    const existing = current.find((c) => String(c.storeId) === entry.storeId);
    if (existing?.role === 'owner') continue; // no degradar owner por edit masivo
    await permissions.grantAccess({
      userId,
      storeId: entry.storeId,
      role: entry.role,
      permissions: entry.permissions,
      invitedBy,
    });
  }
}

exports.list = async (req, res) => {
  try {
    const users = await User.find()
      .select('email nombre role createdAt isActive')
      .sort({ nombre: 1 })
      .lean();
    const enriched = await attachStoreAccesses(users);
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { email, password, nombre, role, storeAccess } = req.body;

    const existing = await User.findOne({ email: email?.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
    }

    const user = await User.create({ email, password, nombre, role });
    await syncUserStoreAccesses(user._id, storeAccess, req.user._id);

    const lean = await User.findById(user._id).select('email nombre role createdAt isActive').lean();
    const [result] = await attachStoreAccesses([lean]);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { userId } = req.params;
    const { email, password, nombre, role, storeAccess } = req.body;

    const fields = {};
    if (email !== undefined) fields.email = email;
    if (nombre !== undefined) fields.nombre = nombre;
    if (role !== undefined) fields.role = role;

    if (password && password.trim() !== '') {
      fields.password = await bcrypt.hash(password.trim(), 12);
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: fields },
      { new: true, runValidators: true }
    ).select('email nombre role createdAt isActive').lean();

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (storeAccess !== undefined) {
      await syncUserStoreAccesses(userId, storeAccess, req.user._id);
    }

    const [result] = await attachStoreAccesses([user]);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user._id.toString() === userId) {
      return res.status(400).json({ error: 'No podés eliminarte a vos mismo' });
    }

    const user = await User.findByIdAndDelete(userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    await StoreAccess.deleteMany({ userId });

    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
