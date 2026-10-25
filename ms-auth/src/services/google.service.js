/**
 * Servicio de Google OAuth 2.0 (flujo "Authorization Code").
 *
 *  1. construirUrlAutorizacion(): URL de la pantalla de consentimiento de Google.
 *  2. obtenerPerfil(code): cambia el código por un access_token y con él
 *     consulta el perfil del usuario (id, correo, nombre y foto).
 */
const { config } = require('../config/env');
const AppError = require('../utils/AppError');

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

function construirUrlAutorizacion(state) {
  const parametros = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    state, // protege contra ataques CSRF
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_URL}?${parametros.toString()}`;
}

async function intercambiarCodigo(code) {
  const respuesta = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: config.google.callbackUrl,
      grant_type: 'authorization_code',
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    console.error('[ms-auth] Google rechazó el código:', detalle);
    throw new AppError('No se pudo validar el inicio de sesión con Google', 401, 'GOOGLE_CODIGO_INVALIDO');
  }
  return respuesta.json(); // { access_token, id_token, expires_in, ... }
}

async function obtenerPerfil(code) {
  const { access_token: accessToken } = await intercambiarCodigo(code);

  const respuesta = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!respuesta.ok) {
    throw new AppError('No se pudo obtener el perfil de Google', 502, 'GOOGLE_PERFIL_ERROR');
  }

  const perfil = await respuesta.json();
  return {
    googleId: perfil.sub,
    email: perfil.email,
    emailVerificado: perfil.email_verified === true,
    nombre: perfil.name || perfil.email,
    fotoUrl: perfil.picture || null,
  };
}

module.exports = { construirUrlAutorizacion, obtenerPerfil };
