/**
 * GET /auth/health (HU10)
 * Informa si el servicio está vivo y si puede conectarse a PostgreSQL.
 * Lo usan el administrador, Docker (healthcheck) y Nginx.
 */
const db = require('../config/db');
const { version } = require('../../package.json');

async function estado(_req, res) {
  const inicio = Date.now();
  let baseDatos = 'ok';
  try {
    await db.query('SELECT 1');
  } catch (err) {
    baseDatos = 'error';
    console.error('[ms-auth] Health: sin conexión a la base de datos:', err.message);
  }

  const saludable = baseDatos === 'ok';
  res.status(saludable ? 200 : 503).json({
    servicio: 'ms-auth',
    estado: saludable ? 'ok' : 'degradado',
    version,
    baseDatos,
    latenciaBaseDatosMs: Date.now() - inicio,
    tiempoActivoSeg: Math.round(process.uptime()),
    fecha: new Date().toISOString(),
  });
}

module.exports = { estado };
