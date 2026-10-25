// Variables de entorno de prueba (se cargan antes que la aplicación)
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://prueba:prueba@localhost:5432/prueba';
process.env.JWT_SECRET = 'clave-de-prueba-con-mas-de-treinta-y-dos-caracteres';
process.env.AI_PROVIDER = 'gemini';
process.env.AI_MODEL = 'modelo-prueba';
process.env.AI_API_KEY = 'clave-ia-prueba';
process.env.TZ = 'America/Guatemala';

const jwt = require('jsonwebtoken');

const USUARIO_ID = '11111111-1111-1111-1111-111111111111';

function token(sub = USUARIO_ID, opciones = {}) {
  return jwt.sign({ rol: 'estudiante' }, process.env.JWT_SECRET, {
    subject: sub, issuer: 'eduplan-ms-auth', audience: 'eduplan', expiresIn: '1h', ...opciones,
  });
}

module.exports = { USUARIO_ID, token };
