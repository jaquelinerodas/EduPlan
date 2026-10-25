/**
 * Middleware: exige un JWT válido en el header
 *   Authorization: Bearer <token>
 * y deja los datos del usuario en req.usuario (RF02).
 */
const tokenService = require('../services/token.service');
const AppError = require('../utils/AppError');

function verificarToken(req, _res, next) {
  const encabezado = req.headers.authorization || '';
  const [esquema, token] = encabezado.split(' ');

  if (esquema !== 'Bearer' || !token) {
    return next(new AppError('Token no proporcionado', 401, 'TOKEN_REQUERIDO'));
  }

  try {
    const payload = tokenService.verificarToken(token);
    req.usuario = {
      id: payload.sub,
      email: payload.email,
      nombre: payload.nombre,
      rol: payload.rol,
    };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('El token expiró, inicia sesión de nuevo', 401, 'TOKEN_EXPIRADO'));
    }
    return next(new AppError('Token inválido', 401, 'TOKEN_INVALIDO'));
  }
}

module.exports = verificarToken;
