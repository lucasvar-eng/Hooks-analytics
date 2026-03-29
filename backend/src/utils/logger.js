const prefix = '[ecom-analytics]';

const logger = {
  info: (...args) => console.log(prefix, ...args),
  warn: (...args) => console.warn(prefix, '⚠', ...args),
  error: (...args) => console.error(prefix, '✖', ...args),
  debug: (...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(prefix, '🔍', ...args);
    }
  },
};

module.exports = logger;