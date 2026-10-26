const MODELOS_POR_DEFECTO = {
  gemini: 'gemini-3.5-flash-lite',
  claude: 'claude-haiku-5-5',
  openai: 'gpt-5-mini',
  simulado: 'simulado',
};

const proveedor = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

const config = {
  entorno: process.env.NODE_ENV || 'development',
  puerto: Number(process.env.PORT) || 3002,
  databaseUrl: process.env.DATABASE_URL,
  zonaHoraria: process.env.TZ || 'America/Guatemala',

  jwt: {
    secreto: process.env.JWT_SECRET,
    emisor: 'eduplan-ms-auth',
    audiencia: 'eduplan',
  },

  ia: {
    proveedor,
    modelo: process.env.AI_MODEL || MODELOS_POR_DEFECTO[proveedor],
    apiKey: process.env.AI_API_KEY,
    timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 90000,
    limitePorMinuto: Number(process.env.AI_RATE_LIMIT) || 10,
  },
};

config.esProduccion = config.entorno === 'production';

function validarConfig() {
  const faltantes = [
    ['DATABASE_URL', config.databaseUrl],
    ['JWT_SECRET', config.jwt.secreto],
  ].filter(([, v]) => !v).map(([n]) => n);

  if (faltantes.length) {
    throw new Error(`Faltan variables de entorno: ${faltantes.join(', ')}`);
  }
  if (!MODELOS_POR_DEFECTO[config.ia.proveedor]) {
    throw new Error(`AI_PROVIDER no válido: ${config.ia.proveedor} (usa gemini, claude, openai o simulado)`);
  }
  // Sin clave, el servicio arranca igual; solo fallan las rutas de IA (503)
  if (config.ia.proveedor !== 'simulado' && !config.ia.apiKey) {
    console.warn('[ms-academico] AI_API_KEY vacía: las rutas /api/ia responderán 503');
  }
}

module.exports = { config, validarConfig };
