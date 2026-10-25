/**
 * Middlewares finales: ruta no encontrada (404) y manejador central de errores.
 * Responde siempre con el mismo formato JSON:
 *   { "error": { "codigo": "...", "mensaje": "..." } }
 */
const AppError = require('../utils/AppError');

function rutaNoEncontrada(req, _res, next) {
  next(new AppError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404, 'RUTA_NO_ENCONTRADA'));
}

// eslint-disable-next-line no-unused-vars
function manejadorErrores(err, _req, res, _next) {
  const esControlado = err instanceof AppError;
  if (!esControlado) {
    console.error('[ms-auth] Error no controlado:', err);
  }
  const estado = esControlado ? err.estadoHttp : 500;
  res.status(estado).json({
    error: {
      codigo: esControlado ? err.codigo : 'ERROR_INTERNO',
      mensaje: esControlado ? err.message : 'Ocurrió un error interno',
    },
  });
}

module.exports = { rutaNoEncontrada, manejadorErrores };
