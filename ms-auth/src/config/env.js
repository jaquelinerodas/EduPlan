/**
 * Configuración del microservicio leída de variables de entorno.
 * Ninguna clave o credencial se escribe en el código (requerimiento de seguridad).
 */
const config = {
  entorno: process.env.NODE_ENV || 'development',
  puerto: Number(process.env.PORT) || 3001,

  databaseUrl: process.env.DATABASE_URL,

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
  },

  jwt: {
    secreto: process.env.JWT_SECRET,
    expiraEn: process.env.JWT_EXPIRES_IN || '2h',
    emisor: 'eduplan-ms-auth',
    audiencia: 'eduplan',
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost',
};

config.esProduccion = config.entorno === 'production';
// La cookie temporal de OAuth solo viaja por HTTPS cuando el callback es HTTPS
config.cookieSegura = (config.google.callbackUrl || '').startsWith('https://');

/** Detiene el arranque si falta alguna variable obligatoria. */
function validarConfig() {
  const faltantes = [
    ['DATABASE_URL', config.databaseUrl],
    ['GOOGLE_CLIENT_ID', config.google.clientId],
    ['GOOGLE_CLIENT_SECRET', config.google.clientSecret],
    ['GOOGLE_CALLBACK_URL', config.google.callbackUrl],
    ['JWT_SECRET', config.jwt.secreto],
  ]
    .filter(([, valor]) => !valor)
    .map(([nombre]) => nombre);

  if (faltantes.length > 0) {
    throw new Error(`Faltan variables de entorno: ${faltantes.join(', ')}`);
  }
  if (config.jwt.secreto.length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
  }
}

module.exports = { config, validarConfig };
