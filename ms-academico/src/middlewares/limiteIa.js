/**
 * Límite de peticiones a la IA por usuario (ventana de 1 minuto, en memoria).
 * Evita gastar la cuota de la API si alguien presiona el botón muchas veces.
 */
const { config } = require('../config/env');
const AppError = require('../utils/AppError');

const VENTANA_MS = 60 * 1000;
const usos = new Map(); // usuarioId -> [marcas de tiempo]

function limiteIa(req, _res, next) {
  const ahora = Date.now();
  const recientes = (usos.get(req.usuario.id) || []).filter((t) => ahora - t < VENTANA_MS);

  if (recientes.length >= config.ia.limitePorMinuto) {
    usos.set(req.usuario.id, recientes);
    return next(new AppError('Demasiadas solicitudes a la IA, espera un minuto', 429, 'LIMITE_IA'));
  }
  recientes.push(ahora);
  usos.set(req.usuario.id, recientes);
  return next();
}

limiteIa.reiniciar = () => usos.clear();

module.exports = limiteIa;
