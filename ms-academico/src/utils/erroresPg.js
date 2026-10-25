/**
 * Convierte errores de PostgreSQL en respuestas claras para el cliente.
 * Las restricciones de la base (UNIQUE, FK compuestas, CHECK) son la última
 * línea de defensa de RF09 y de la integridad de los datos.
 */
const AppError = require('./AppError');

function traducirErrorPg(err) {
  if (!err || typeof err.code !== 'string') return null;

  switch (err.code) {
    case '23505':
      if (err.constraint === 'uq_materias_usuario_nombre') {
        return new AppError('Ya tienes una materia con ese nombre', 409, 'MATERIA_DUPLICADA');
      }
      return new AppError('El registro ya existe', 409, 'DUPLICADO');
    case '23503':
      if ((err.constraint || '').endsWith('_materia_usuario')) {
        return new AppError('La materia no existe', 404, 'MATERIA_NO_ENCONTRADA');
      }
      if ((err.constraint || '').endsWith('_usuario')) {
        return new AppError('El usuario del token ya no existe', 401, 'USUARIO_NO_EXISTE');
      }
      return new AppError('Referencia inválida', 400, 'REFERENCIA_INVALIDA');
    case '23514':
    case '22P02':
    case '22007':
    case '22008':
      return new AppError('Datos inválidos', 400, 'VALIDACION', [err.message]);
    default:
      return null;
  }
}

module.exports = { traducirErrorPg };
