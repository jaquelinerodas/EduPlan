/**
 * Lógica de negocio de autenticación.
 * Une Google (identidad), el modelo de usuarios (registro) y el JWT (sesión).
 */
const googleService = require('./google.service');
const tokenService = require('./token.service');
const usuarioModel = require('../models/usuario.model');
const AppError = require('../utils/AppError');

/** Formato público del usuario (nunca se expone google_id). */
function aRespuesta(usuario) {
  return {
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    fotoUrl: usuario.foto_url,
    rol: usuario.rol,
    ultimoAcceso: usuario.ultimo_acceso,
    creadoEn: usuario.creado_en,
  };
}

/**
 * Completa el inicio de sesión: código de Google -> perfil -> registro/búsqueda
 * del usuario -> JWT (RF01, RF02).
 */
async function iniciarSesionConGoogle(code) {
  const perfil = await googleService.obtenerPerfil(code);

  if (!perfil.emailVerificado) {
    throw new AppError('El correo de Google no está verificado', 403, 'EMAIL_NO_VERIFICADO');
  }

  const usuario = await usuarioModel.upsertDesdeGoogle(perfil);

  if (!usuario.activo) {
    throw new AppError('El usuario está desactivado', 403, 'USUARIO_INACTIVO');
  }

  return {
    token: tokenService.generarToken(usuario),
    usuario: aRespuesta(usuario),
  };
}

async function obtenerPerfil(usuarioId) {
  const usuario = await usuarioModel.buscarPorId(usuarioId);
  if (!usuario) {
    throw new AppError('Usuario no encontrado', 404, 'USUARIO_NO_ENCONTRADO');
  }
  if (!usuario.activo) {
    throw new AppError('El usuario está desactivado', 403, 'USUARIO_INACTIVO');
  }
  return aRespuesta(usuario);
}

module.exports = { iniciarSesionConGoogle, obtenerPerfil };
