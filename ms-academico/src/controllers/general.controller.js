const db = require('../config/db');
const resumenModel = require('../models/resumen.model');
const { config } = require('../config/env');
const { version } = require('../../package.json');

/** GET /api/health (HU10): estado del servicio, la base de datos y la IA. */
async function health(_req, res) {
  const inicio = Date.now();
  let baseDatos = 'ok';
  try {
    await db.query('SELECT 1');
  } catch (err) {
    baseDatos = 'error';
    console.error('[ms-academico] Health: sin conexión a la base de datos:', err.message);
  }

  const saludable = baseDatos === 'ok';
  res.status(saludable ? 200 : 503).json({
    servicio: 'ms-academico',
    estado: saludable ? 'ok' : 'degradado',
    version,
    baseDatos,
    latenciaBaseDatosMs: Date.now() - inicio,
    ia: {
      proveedor: config.ia.proveedor,
      modelo: config.ia.modelo,
      configurada: config.ia.proveedor === 'simulado' || Boolean(config.ia.apiKey),
    },
    tiempoActivoSeg: Math.round(process.uptime()),
    fecha: new Date().toISOString(),
  });
}

/** GET /api/resumen: números para el panel principal. */
async function resumen(req, res) {
  res.json({ resumen: await resumenModel.estadisticas(req.usuario.id) });
}

module.exports = { health, resumen };
