/**
 * Wrapper para async route handlers que NO usan try/catch.
 * Cualquier throw / promise rejection se propaga a next(error) y termina
 * en el middleware errorHandler global (que ya sabe responder 400 para
 * ValidationError, 409 para duplicates, 400 para CastError, 500 por default).
 *
 * Uso típico en una ruta:
 *   router.post('/foo', auth, asyncHandler(controller.create));
 */
module.exports = function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
