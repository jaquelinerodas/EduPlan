const AppError = require('../utils/AppError');
const { traducirErrorPg } = require('../utils/erroresPg');

function rutaNoEncontrada(req, _res, next) {
  next(new AppError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404, 'RUTA_NO_ENCONTRADA'));
}

// Formato único de error: { error: { codigo, mensaje, detalles? } }
// eslint-disable-next-line no-unused-vars
function manejadorErrores(err, _req, res, _next) {
  let error = err instanceof AppError ? err : traducirErrorPg(err);

  if (!error && err.type === 'entity.parse.failed') {
    error = new AppError('El cuerpo de la petición no es un JSON válido', 400, 'JSON_INVALIDO');
  }
  if (!error) {
    console.error('[ms-academico] Error no controlado:', err);
    error = new AppError('Ocurrió un error interno', 500, 'ERROR_INTERNO');
  }

  res.status(error.estadoHttp).json({
    error: {
      codigo: error.codigo,
      mensaje: error.message,
      ...(error.detalles ? { detalles: error.detalles } : {}),
    },
  });
}

module.exports = { rutaNoEncontrada, manejadorErrores };
