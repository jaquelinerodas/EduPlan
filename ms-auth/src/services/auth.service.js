/**
 * Lógica de negocio de autenticación.
 * Dos formas de entrar: Google (OAuth 2.0) o correo y contraseña.
 * Ambas terminan igual: se emite un JWT con expiración (RF02).
 */
const googleService = require('./google.service');
const tokenService = require('./token.service');
const usuarioModel = require('../models/usuario.model');
const password = require('../utils/password');
const AppError = require('../utils/AppError');

const REGEX_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Formato público del usuario (nunca se exponen google_id ni el hash). */
function aRespuesta(usuario) {
  return {
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    fotoUrl: usuario.foto_url,
    rol: usuario.rol,
    metodos: [usuario.tiene_google && 'google', usuario.tiene_password && 'password'].filter(Boolean),
    ultimoAcceso: usuario.ultimo_acceso,
    creadoEn: usuario.creado_en,
  };
}

function sesion(usuario) {
  if (!usuario.activo) {
    throw new AppError('El usuario está desactivado', 403, 'USUARIO_INACTIVO');
  }
  return { token: tokenService.generarToken(usuario), usuario: aRespuesta(usuario) };
}

/** Código de Google -> perfil -> registro/búsqueda del usuario -> JWT (RF01, RF02). */
async function iniciarSesionConGoogle(code) {
  const perfil = await googleService.obtenerPerfil(code);
  if (!perfil.emailVerificado) {
    throw new AppError('El correo de Google no está verificado', 403, 'EMAIL_NO_VERIFICADO');
  }
  const usuario = await usuarioModel.upsertDesdeGoogle(perfil);
  return sesion(usuario);
}

function validarRegistro({ nombre, email, password: clave } = {}) {
  const errores = [];
  const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
  const emailLimpio = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (nombreLimpio.length < 2) errores.push('Escribe tu nombre (mínimo 2 caracteres)');
  if (nombreLimpio.length > 150) errores.push('El nombre admite máximo 150 caracteres');
  if (!REGEX_EMAIL.test(emailLimpio) || emailLimpio.length > 254) errores.push('Escribe un correo válido');
  const problemaClave = password.validarFortaleza(clave);
  if (problemaClave) errores.push(problemaClave);

  if (errores.length) throw new AppError('Revisa los datos del registro', 400, 'VALIDACION', errores);
  return { nombre: nombreLimpio, email: emailLimpio, clave };
}

/** Crea una cuenta con correo y contraseña e inicia la sesión. */
async function registrar(datos) {
  const { nombre, email, clave } = validarRegistro(datos);

  const existente = await usuarioModel.buscarPorEmail(email);
  if (existente) {
    if (existente.tiene_google && !existente.tiene_password) {
      throw new AppError('Este correo ya está registrado con Google. Usa "Continuar con Google".', 409, 'CUENTA_GOOGLE');
    }
    throw new AppError('Ya existe una cuenta con este correo. Inicia sesión.', 409, 'EMAIL_REGISTRADO');
  }

  try {
    const usuario = await usuarioModel.crearConPassword({ email, nombre, passwordHash: await password.generarHash(clave) });
    return sesion(usuario);
  } catch (err) {
    if (err.code === '23505') {
      throw new AppError('Ya existe una cuenta con este correo. Inicia sesión.', 409, 'EMAIL_REGISTRADO');
    }
    throw err;
  }
}

/** Inicio de sesión con correo y contraseña. El mensaje de error es el mismo para no revelar qué correos existen. */
async function iniciarSesionConCorreo({ email, password: clave } = {}) {
  const emailLimpio = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!emailLimpio || typeof clave !== 'string' || !clave) {
    throw new AppError('Escribe tu correo y tu contraseña', 400, 'VALIDACION');
  }

  const usuario = await usuarioModel.buscarCredenciales(emailLimpio);
  const valida = usuario?.password_hash ? await password.verificar(clave, usuario.password_hash) : false;

  if (!valida) {
    throw new AppError('Correo o contraseña incorrectos', 401, 'CREDENCIALES_INVALIDAS');
  }
  await usuarioModel.registrarAcceso(usuario.id);
  return sesion(usuario);
}

async function obtenerPerfil(usuarioId) {
  const usuario = await usuarioModel.buscarPorId(usuarioId);
  if (!usuario) throw new AppError('Usuario no encontrado', 404, 'USUARIO_NO_ENCONTRADO');
  if (!usuario.activo) throw new AppError('El usuario está desactivado', 403, 'USUARIO_INACTIVO');
  return aRespuesta(usuario);
}

module.exports = { iniciarSesionConGoogle, registrar, iniciarSesionConCorreo, obtenerPerfil };
