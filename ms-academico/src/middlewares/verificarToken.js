/**
 * Valida el JWT emitido por ms-auth (mismo secreto, emisor y audiencia).
 * req.usuario.id (claim "sub") se usa en TODAS las consultas (RF09).
 */
const jwt = require('jsonwebtoken');
const { config } = require('../config/env');
const AppError = require('../utils/AppError');

function verificarToken(req, _res, next) {
  const [esquema, token] = (req.headers.authorization || '').split(' ');
  if (esquema !== 'Bearer' || !token) {
    return next(new AppError('Token no proporcionado', 401, 'TOKEN_REQUERIDO'));
  }

  try {
    const payload = jwt.verify(token, config.jwt.secreto, {
      algorithms: ['HS256'],
      issuer: config.jwt.emisor,
      audience: config.jwt.audiencia,
    });
    req.usuario = { id: payload.sub, email: payload.email, nombre: payload.nombre, rol: payload.rol };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('El token expiró, inicia sesión de nuevo', 401, 'TOKEN_EXPIRADO'));
    }
    return next(new AppError('Token inválido', 401, 'TOKEN_INVALIDO'));
  }
}

module.exports = verificarToken;
