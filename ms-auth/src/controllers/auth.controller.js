/**
 * Controladores de autenticación: reciben la petición HTTP, llaman a los
 * servicios y arman la respuesta. No contienen lógica de negocio.
 */
const crypto = require('node:crypto');
const path = require('node:path');
const { config } = require('../config/env');
const googleService = require('../services/google.service');
const authService = require('../services/auth.service');
const AppError = require('../utils/AppError');

const COOKIE_STATE = 'oauth_state';

/** Lleva al usuario al frontend con el resultado en el fragmento (#) de la URL. */
function redirigirAlFrontend(res, datos) {
  const fragmento = new URLSearchParams(datos).toString();
  res.redirect(`${config.frontendUrl}#${fragmento}`);
}

/**
 * GET /auth/google
 * Genera un "state" aleatorio, lo guarda en una cookie temporal y redirige
 * a la pantalla de consentimiento de Google (RF01).
 */
function redirigirAGoogle(_req, res) {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(COOKIE_STATE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSegura,
    maxAge: 10 * 60 * 1000, // 10 minutos para completar el inicio de sesión
    path: '/auth',
  });
  res.redirect(googleService.construirUrlAutorizacion(state));
}

/**
 * GET /auth/google/callback?code=...&state=...
 * Google regresa aquí. Se valida el state, se obtiene el perfil, se registra
 * o busca al usuario y se emite el JWT (RF01, RF02).
 */
async function callbackGoogle(req, res) {
  const { code, state, error } = req.query;
  const stateGuardado = req.cookies[COOKIE_STATE];
  res.clearCookie(COOKIE_STATE, { path: '/auth' });

  if (error) {
    return redirigirAlFrontend(res, { error: 'ACCESO_CANCELADO' });
  }
  if (!state || !stateGuardado || state !== stateGuardado) {
    return redirigirAlFrontend(res, { error: 'STATE_INVALIDO' });
  }
  if (!code) {
    return redirigirAlFrontend(res, { error: 'CODIGO_FALTANTE' });
  }

  try {
    const { token } = await authService.iniciarSesionConGoogle(code);
    return redirigirAlFrontend(res, { token });
  } catch (err) {
    const codigo = err instanceof AppError ? err.codigo : 'ERROR_INTERNO';
    if (!(err instanceof AppError)) console.error('[ms-auth] Error en callback:', err);
    return redirigirAlFrontend(res, { error: codigo });
  }
}

/** GET /auth/me — perfil del usuario dueño del token. */
async function perfil(req, res) {
  const usuario = await authService.obtenerPerfil(req.usuario.id);
  res.json({ usuario });
}

/**
 * POST /auth/logout (RF11)
 * El JWT no se guarda en el servidor, así que cerrar sesión consiste en que
 * el cliente elimine el token. Este endpoint confirma la acción.
 */
function cerrarSesion(_req, res) {
  res.json({ mensaje: 'Sesión cerrada. El cliente debe eliminar el token.' });
}

/** GET /auth/prueba — página sencilla para probar el flujo (solo desarrollo). */
function paginaPrueba(_req, res) {
  res.sendFile(path.join(__dirname, '..', 'public', 'prueba.html'));
}

module.exports = { redirigirAGoogle, callbackGoogle, perfil, cerrarSesion, paginaPrueba };
