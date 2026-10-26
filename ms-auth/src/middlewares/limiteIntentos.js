/**
 * Protección contra ataques de fuerza bruta en el inicio de sesión con contraseña:
 * máximo 5 intentos fallidos por correo + IP cada 15 minutos (en memoria).
 */
const AppError = require('../utils/AppError');

const VENTANA_MS = 15 * 60 * 1000;
const MAXIMO = 5;
const fallos = new Map(); // clave -> [marcas de tiempo]

const clave = (req) => `${req.ip}|${String(req.body?.email || '').trim().toLowerCase()}`;

function recientes(k) {
  const ahora = Date.now();
  const lista = (fallos.get(k) || []).filter((t) => ahora - t < VENTANA_MS);
  if (lista.length) fallos.set(k, lista); else fallos.delete(k);
  return lista;
}

function limiteIntentos(req, _res, next) {
  if (recientes(clave(req)).length >= MAXIMO) {
    return next(new AppError('Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.', 429, 'DEMASIADOS_INTENTOS'));
  }
  return next();
}

limiteIntentos.registrarFallo = (req) => {
  const k = clave(req);
  fallos.set(k, [...recientes(k), Date.now()]);
};
limiteIntentos.limpiar = (req) => fallos.delete(clave(req));
limiteIntentos.reiniciar = () => fallos.clear();

module.exports = limiteIntentos;
