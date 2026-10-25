/**
 * Pruebas de la API con los modelos simulados (no necesitan PostgreSQL)
 * y con fetch simulado para la API de IA (no necesitan clave real).
 */
const { USUARIO_ID, token } = require('./setup');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const app = require('../src/app');
const { pool } = require('../src/config/db');
const materiaModel = require('../src/models/materia.model');
const tareaModel = require('../src/models/tarea.model');
const apunteModel = require('../src/models/apunte.model');
const planModel = require('../src/models/plan.model');
const limiteIa = require('../src/middlewares/limiteIa');

let servidor;
let base;
const TOKEN = token();
const MATERIA_ID = 'a0000000-0000-0000-0000-000000000001';
const APUNTE = { id: 'b0000000-0000-0000-0000-000000000001', titulo: 'JWT', contenido: 'Header, payload y firma', materia: 'Web' };
const fetchOriginal = global.fetch;

before(async () => {
  servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});
after(async () => {
  servidor.close();
  await pool.end();
});
beforeEach(() => limiteIa.reiniciar());

function pedir(ruta, { metodo = 'GET', cuerpo, auth = TOKEN } = {}) {
  return fetchOriginal(base + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
}

/** Simula la API de Gemini sin afectar las peticiones locales de la prueba. */
function simularGemini(t, respuesta, estado = 200) {
  const llamadas = [];
  t.mock.method(global, 'fetch', async (url, opciones) => {
    if (String(url).startsWith(base)) return fetchOriginal(url, opciones);
    llamadas.push({ url: String(url), opciones });
    return new Response(JSON.stringify(respuesta), { status: estado, headers: { 'Content-Type': 'application/json' } });
  });
  return llamadas;
}

// ---------- Autenticación (RF02) ----------

test('sin token responde 401 TOKEN_REQUERIDO', async () => {
  const r = await pedir('/api/materias', { auth: null });
  assert.equal(r.status, 401);
  assert.equal((await r.json()).error.codigo, 'TOKEN_REQUERIDO');
});

test('token expirado responde 401 TOKEN_EXPIRADO', async () => {
  const r = await pedir('/api/materias', { auth: token(USUARIO_ID, { expiresIn: -10 }) });
  assert.equal((await r.json()).error.codigo, 'TOKEN_EXPIRADO');
});

test('token de otro emisor responde 401 TOKEN_INVALIDO', async () => {
  const r = await pedir('/api/materias', { auth: token(USUARIO_ID, { issuer: 'otro' }) });
  assert.equal((await r.json()).error.codigo, 'TOKEN_INVALIDO');
});

// ---------- RF09: el usuario del token se usa en las consultas ----------

test('las consultas usan el id del token, no uno enviado por el cliente', async (t) => {
  const listar = t.mock.method(tareaModel, 'listar', async () => []);
  await pedir(`/api/tareas?usuarioId=22222222-2222-2222-2222-222222222222&estado=pendiente`);
  assert.equal(listar.mock.calls[0].arguments[0], USUARIO_ID);
  assert.deepEqual(listar.mock.calls[0].arguments[1], { estado: 'pendiente' });
});

test('una materia de otro usuario responde 404', async (t) => {
  t.mock.method(materiaModel, 'obtener', async () => null);
  const r = await pedir(`/api/materias/${MATERIA_ID}`);
  assert.equal(r.status, 404);
});

// ---------- Validaciones y errores de base de datos ----------

test('crear tarea sin datos responde 400 con detalles', async () => {
  const r = await pedir('/api/tareas', { metodo: 'POST', cuerpo: {} });
  const { error } = await r.json();
  assert.equal(r.status, 400);
  assert.ok(error.detalles.includes('titulo es obligatorio'));
});

test('filtro con rango de fechas invertido responde 400', async () => {
  const r = await pedir('/api/tareas?desde=2026-12-01&hasta=2026-11-01');
  assert.equal(r.status, 400);
});

test('nombre de materia repetido se traduce a 409 MATERIA_DUPLICADA', async (t) => {
  t.mock.method(materiaModel, 'crear', async () => {
    throw Object.assign(new Error('duplicate'), { code: '23505', constraint: 'uq_materias_usuario_nombre' });
  });
  const r = await pedir('/api/materias', { metodo: 'POST', cuerpo: { nombre: 'Web' } });
  assert.equal(r.status, 409);
  assert.equal((await r.json()).error.codigo, 'MATERIA_DUPLICADA');
});

test('materia ajena en una tarea (FK compuesta) se traduce a 404', async (t) => {
  t.mock.method(tareaModel, 'crear', async () => {
    throw Object.assign(new Error('fk'), { code: '23503', constraint: 'fk_tareas_materia_usuario' });
  });
  const r = await pedir('/api/tareas', { metodo: 'POST', cuerpo: { materiaId: MATERIA_ID, titulo: 'x', fechaLimite: '2026-11-01' } });
  assert.equal(r.status, 404);
  assert.equal((await r.json()).error.codigo, 'MATERIA_NO_ENCONTRADA');
});

test('marcar tarea como completada envía solo el estado', async (t) => {
  const actualizar = t.mock.method(tareaModel, 'actualizar', async () => ({ id: 'x', estado: 'completada' }));
  const r = await pedir(`/api/tareas/${MATERIA_ID}/estado`, { metodo: 'PATCH', cuerpo: { estado: 'completada', titulo: 'ignorado' } });
  assert.equal(r.status, 200);
  assert.deepEqual(actualizar.mock.calls[0].arguments[2], { estado: 'completada' });
});

// ---------- Asistente de IA (RF07, RF08) ----------

test('resumen: envía el apunte a Gemini y guarda la respuesta', async (t) => {
  t.mock.method(apunteModel, 'obtener', async () => APUNTE);
  const guardar = t.mock.method(apunteModel, 'guardarResumen', async (_id, _u, resumen) => ({ ...APUNTE, resumenIa: resumen }));
  const llamadas = simularGemini(t, { candidates: [{ content: { parts: [{ text: '- Resumen del JWT' }] } }] });

  const r = await pedir(`/api/ia/resumen/${APUNTE.id}`, { metodo: 'POST' });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).apunte.resumenIa, '- Resumen del JWT');
  assert.equal(guardar.mock.callCount(), 1);

  const { url, opciones } = llamadas[0];
  assert.match(url, /models\/modelo-prueba:generateContent$/);
  assert.equal(opciones.headers['x-goog-api-key'], 'clave-ia-prueba');
  assert.match(JSON.parse(opciones.body).contents[0].parts[0].text, /Header, payload y firma/);
});

test('resumen: si Gemini rechaza la clave responde 502 IA_CLAVE_INVALIDA', async (t) => {
  t.mock.method(apunteModel, 'obtener', async () => APUNTE);
  simularGemini(t, { error: 'bad key' }, 403);
  const r = await pedir(`/api/ia/resumen/${APUNTE.id}`, { metodo: 'POST' });
  assert.equal(r.status, 502);
  assert.equal((await r.json()).error.codigo, 'IA_CLAVE_INVALIDA');
});

test('plan: sin tareas pendientes responde 422', async (t) => {
  t.mock.method(tareaModel, 'pendientesParaPlan', async () => []);
  const r = await pedir('/api/ia/plan-estudio', { metodo: 'POST', cuerpo: {} });
  assert.equal(r.status, 422);
});

test('plan: incluye las tareas en el prompt y guarda el plan', async (t) => {
  t.mock.method(tareaModel, 'pendientesParaPlan', async () => [
    { id: 't1', titulo: 'Árbol AVL', materia: 'Programación', prioridad: 'alta', estado: 'pendiente', vencida: false, fechaLimite: new Date('2026-11-02T05:59:00Z') },
  ]);
  const crear = t.mock.method(planModel, 'crear', async (_u, datos) => ({ id: 'p1', ...datos }));
  const llamadas = simularGemini(t, { candidates: [{ content: { parts: [{ text: '### Lunes\n- Estudiar AVL' }] } }] });

  const r = await pedir('/api/ia/plan-estudio', { metodo: 'POST', cuerpo: { dias: 5, horasPorDia: 2 } });
  assert.equal(r.status, 201);
  assert.match(JSON.parse(llamadas[0].opciones.body).contents[0].parts[0].text, /Árbol AVL · Programación/);
  const datos = crear.mock.calls[0].arguments[1];
  assert.deepEqual(datos.tareasIncluidas, ['t1']);
  assert.equal(datos.dias, 5);
  assert.equal(datos.modeloIa, 'gemini:modelo-prueba');
});

test('límite de IA: la solicitud 11 en un minuto responde 429', async (t) => {
  t.mock.method(tareaModel, 'pendientesParaPlan', async () => []);
  let ultimo;
  for (let i = 0; i < 11; i++) ultimo = await pedir('/api/ia/plan-estudio', { metodo: 'POST' });
  assert.equal(ultimo.status, 429);
});

// ---------- General ----------

test('documentación Swagger disponible', async () => {
  const r = await pedir('/api/docs.json', { auth: null });
  assert.equal((await r.json()).info.title, 'EduPlan · ms-academico');
});
