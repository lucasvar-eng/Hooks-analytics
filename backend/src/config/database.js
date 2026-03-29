const mongoose = require('mongoose');
const { mongodbUri } = require('./environment');
const logger = require('../utils/logger');

const connectDB = async () => {
  if (!mongodbUri) {
    logger.error('MONGODB_URI is not defined in environment variables');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(mongodbUri);
    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;