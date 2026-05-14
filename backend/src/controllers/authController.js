const jwt = require('jsonwebtoken');
const User = require('../models/User');
const permissions = require('../services/permissions');
const { jwtSecret, jwtExpiresIn } = require('../config/environment');

const signToken = (id) => jwt.sign({ id }, jwtSecret, { expiresIn: jwtExpiresIn });

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    const token = signToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        nombre: user.nombre,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.register = async (req, res, next) => {
  try {
    const { email, password, nombre, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = await User.create({
      email,
      password,
      nombre,
      role: role || 'viewer',
    });

    const token = signToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        nombre: user.nombre,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.me = async (req, res, next) => {
  try {
    const accesses = await permissions.getUserStoreAccesses(req.user._id);
    res.json({
      user: {
        id: req.user._id,
        email: req.user.email,
        nombre: req.user.nombre,
        role: req.user.role,
        storeAccess: accesses.map((a) => a.storeId),
        storeAccessDetailed: accesses.map((a) => ({
          storeId: a.storeId,
          role: a.role,
          permissions: a.permissions,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};