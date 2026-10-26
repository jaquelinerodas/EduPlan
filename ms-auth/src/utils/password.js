/**
 * Hash de contraseñas con scrypt (incluido en Node.js, sin dependencias).
 * Formato guardado: scrypt$N$r$p$<sal base64>$<hash base64>
 * Nunca se guarda ni se registra la contraseña en texto plano.
 */
const crypto = require('node:crypto');

const N = 16384; // costo de CPU/memoria
const R = 8;
const P = 1;
const LARGO = 64;

function scrypt(password, sal, n, r, p) {
  return new Promise((resolver, rechazar) => {
    crypto.scrypt(password, sal, LARGO, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, clave) =>
      err ? rechazar(err) : resolver(clave)
    );
  });
}

async function generarHash(password) {
  const sal = crypto.randomBytes(16);
  const clave = await scrypt(password, sal, N, R, P);
  return `scrypt$${N}$${R}$${P}$${sal.toString('base64')}$${clave.toString('base64')}`;
}

async function verificar(password, guardado) {
  const partes = String(guardado || '').split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, n, r, p, salB64, hashB64] = partes;
  const esperado = Buffer.from(hashB64, 'base64');
  const clave = await scrypt(password, Buffer.from(salB64, 'base64'), Number(n), Number(r), Number(p));
  // Comparación en tiempo constante para no filtrar información por tiempos de respuesta
  return esperado.length === clave.length && crypto.timingSafeEqual(esperado, clave);
}

/** Reglas: 8 a 72 caracteres, al menos una letra y un número. */
function validarFortaleza(password) {
  if (typeof password !== 'string' || password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (password.length > 72) return 'La contraseña admite máximo 72 caracteres';
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(password) || !/\d/.test(password)) {
    return 'La contraseña debe incluir al menos una letra y un número';
  }
  return null;
}

module.exports = { generarHash, verificar, validarFortaleza };
