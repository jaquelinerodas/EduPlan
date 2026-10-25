/**
 * Pruebas de ms-auth con el runner nativo de Node (node --test).
 * No necesitan Google ni PostgreSQL: esas dependencias se simulan.
 *   Ejecutar:  npm test
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://prueba:prueba@localhost:5432/prueba';
process.env.GOOGLE_CLIENT_ID = 'cliente-prueba.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'secreto-prueba';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3001/auth/google/callback';
process.env.JWT_SECRET = 'clave-de-prueba-con-mas-de-treinta-y-dos-caracteres';
process.env.JWT_EXPIRES_IN = '1h';
process.env.FRONTEND_URL = 'http://localhost:3001/auth/prueba';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const tokenService = require('../src/services/token.service');
const googleService = require('../src/services/google.service');
const usuarioModel = require('../src/models/usuario.model');
const { pool } = require('../src/config/db');

const USUARIO = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'ana.lopez@ejemplo.com',
  nombre: 'Ana López',
  foto_url: null,
  rol: 'estudiante',
  activo: true,
  ultimo_acceso: new Date(),
  creado_en: new Date(),
};

let servidor;
let base;

before(async () => {
  servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
  servidor.close();
  await pool.end();
});

const pedir = (ruta, opciones = {}) => fetch(base + ruta, { redirect: 'manual', ...opciones });

test('el JWT incluye sub, rol, emisor, audiencia y expiración', () => {
  const token = tokenService.generarToken(USUARIO);
  const payload = tokenService.verificarToken(token);
  assert.equal(payload.sub, USUARIO.id);
  assert.equal(payload.rol, 'estudiante');
  assert.equal(payload.iss, 'eduplan-ms-auth');
  assert.equal(payload.aud, 'eduplan');
  assert.ok(payload.exp > payload.iat);
});

test('GET /auth/google redirige a Google con state y guarda la cookie', async () => {
  const r = await pedir('/auth/google');
  assert.equal(r.status, 302);
  const destino = new URL(r.headers.get('location'));
  assert.equal(destino.host, 'accounts.google.com');
  assert.equal(destino.searchParams.get('client_id'), process.env.GOOGLE_CLIENT_ID);
  assert.equal(destino.searchParams.get('redirect_uri'), process.env.GOOGLE_CALLBACK_URL);
  assert.equal(destino.searchParams.get('scope'), 'openid email profile');
  const state = destino.searchParams.get('state');
  assert.match(r.headers.get('set-cookie'), new RegExp(`oauth_state=${state}`));
  assert.match(r.headers.get('set-cookie'), /HttpOnly/);
});

test('callback rechaza un state que no coincide (CSRF)', async () => {
  const r = await pedir('/auth/google/callback?code=abc&state=falso', {
    headers: { Cookie: 'oauth_state=otro' },
  });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), `${process.env.FRONTEND_URL}#error=STATE_INVALIDO`);
});

test('callback informa cuando el usuario cancela en Google', async () => {
  const r = await pedir('/auth/google/callback?error=access_denied&state=x', {
    headers: { Cookie: 'oauth_state=x' },
  });
  assert.equal(r.headers.get('location'), `${process.env.FRONTEND_URL}#error=ACCESO_CANCELADO`);
});

test('callback válido registra al usuario y entrega un JWT', async (t) => {
  t.mock.method(googleService, 'obtenerPerfil', async () => ({
    googleId: 'google-123', email: USUARIO.email, emailVerificado: true, nombre: USUARIO.nombre, fotoUrl: null,
  }));
  const upsert = t.mock.method(usuarioModel, 'upsertDesdeGoogle', async () => USUARIO);

  const r = await pedir('/auth/google/callback?code=codigo-valido&state=s1', {
    headers: { Cookie: 'oauth_state=s1' },
  });
  assert.equal(r.status, 302);
  assert.equal(upsert.mock.callCount(), 1);
  const token = new URLSearchParams(new URL(r.headers.get('location')).hash.slice(1)).get('token');
  assert.equal(tokenService.verificarToken(token).sub, USUARIO.id);
});

test('callback rechaza correos de Google no verificados', async (t) => {
  t.mock.method(googleService, 'obtenerPerfil', async () => ({
    googleId: 'g', email: 'x@ejemplo.com', emailVerificado: false, nombre: 'X', fotoUrl: null,
  }));
  const r = await pedir('/auth/google/callback?code=c&state=s2', { headers: { Cookie: 'oauth_state=s2' } });
  assert.match(r.headers.get('location'), /#error=EMAIL_NO_VERIFICADO$/);
});

test('GET /auth/me sin token responde 401 TOKEN_REQUERIDO', async () => {
  const r = await pedir('/auth/me');
  assert.equal(r.status, 401);
  assert.equal((await r.json()).error.codigo, 'TOKEN_REQUERIDO');
});

test('GET /auth/me con token alterado responde 401 TOKEN_INVALIDO', async () => {
  const token = tokenService.generarToken(USUARIO) + 'x';
  const r = await pedir('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(r.status, 401);
  assert.equal((await r.json()).error.codigo, 'TOKEN_INVALIDO');
});

test('GET /auth/me con token expirado responde 401 TOKEN_EXPIRADO', async () => {
  const token = jwt.sign({ rol: 'estudiante' }, process.env.JWT_SECRET, {
    subject: USUARIO.id, issuer: 'eduplan-ms-auth', audience: 'eduplan', expiresIn: -10,
  });
  const r = await pedir('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal((await r.json()).error.codigo, 'TOKEN_EXPIRADO');
});

test('GET /auth/me con token válido devuelve el perfil sin google_id', async (t) => {
  t.mock.method(usuarioModel, 'buscarPorId', async () => USUARIO);
  const token = tokenService.generarToken(USUARIO);
  const r = await pedir('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(r.status, 200);
  const { usuario } = await r.json();
  assert.equal(usuario.email, USUARIO.email);
  assert.equal(usuario.google_id, undefined);
});

test('POST /auth/logout confirma el cierre de sesión', async () => {
  const token = tokenService.generarToken(USUARIO);
  const r = await pedir('/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  assert.equal(r.status, 200);
});

test('la documentación Swagger está disponible', async () => {
  const r = await pedir('/auth/docs.json');
  assert.equal(r.status, 200);
  assert.equal((await r.json()).info.title, 'EduPlan · ms-auth');
});

test('una ruta inexistente responde 404 con formato de error', async () => {
  const r = await pedir('/auth/no-existe');
  assert.equal(r.status, 404);
  assert.equal((await r.json()).error.codigo, 'RUTA_NO_ENCONTRADA');
});
