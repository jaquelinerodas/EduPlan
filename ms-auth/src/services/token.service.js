/**
 * Servicio de JSON Web Tokens (RF02).
 * El token se firma con JWT_SECRET (HS256) y tiene expiración (JWT_EXPIRES_IN).
 * ms-academico valida el mismo token con el mismo secreto, emisor y audiencia.
 */
const jwt = require('jsonwebtoken');
const { config } = require('../config/env');

function generarToken(usuario) {
  const payload = {
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol,
  };
  return jwt.sign(payload, config.jwt.secreto, {
    subject: usuario.id, // claim "sub" = id del usuario en auth.usuarios
    expiresIn: config.jwt.expiraEn,
    issuer: config.jwt.emisor,
    audience: config.jwt.audiencia,
    algorithm: 'HS256',
  });
}

/** Devuelve el payload si el token es válido; lanza error si no lo es o expiró. */
function verificarToken(token) {
  return jwt.verify(token, config.jwt.secreto, {
    algorithms: ['HS256'],
    issuer: config.jwt.emisor,
    audience: config.jwt.audiencia,
  });
}

module.exports = { generarToken, verificarToken };
