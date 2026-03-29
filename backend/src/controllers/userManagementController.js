const User = require('../models/User');
const bcrypt = require('bcryptjs');

exports.list = async (req, res) => {
  try {
    const users = await User.find()
      .select('email nombre role storeAccess createdAt')
      .populate('storeAccess', 'nombre')
      .sort({ nombre: 1 });
    res.json(users);
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

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      email,
      password: hashedPassword,
      nombre,
      role,
      storeAccess: storeAccess || [],
    });

    const result = await User.findById(user._id)
      .select('email nombre role storeAccess createdAt')
      .populate('storeAccess', 'nombre');

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
    if (storeAccess !== undefined) fields.storeAccess = storeAccess;

    if (password && password.trim() !== '') {
      fields.password = await bcrypt.hash(password.trim(), 12);
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: fields },
      { new: true, runValidators: true }
    )
      .select('email nombre role storeAccess createdAt')
      .populate('storeAccess', 'nombre');

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json(user);
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

    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
