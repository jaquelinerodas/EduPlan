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
const cuestionarioModel = require('../src/models/cuestionario.model');
const flashcardModel = require('../src/models/flashcard.model');
const contexto = require('../src/services/ia/contexto');
const fechas = require('../src/utils/fechas');
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
  t.mock.method(tareaModel, 'obtener', async () => ({ id: MATERIA_ID, estado: 'pendiente' }));
  const actualizar = t.mock.method(tareaModel, 'actualizar', async () => ({ id: 'x', estado: 'completada' }));
  const r = await pedir(`/api/tareas/${MATERIA_ID}/estado`, { metodo: 'PATCH', cuerpo: { estado: 'completada', titulo: 'ignorado' } });
  assert.equal(r.status, 200);
  assert.deepEqual(actualizar.mock.calls[0].arguments[2], { estado: 'completada' });
});

test('una tarea completada no se puede reabrir ni editar (409)', async (t) => {
  t.mock.method(tareaModel, 'obtener', async () => ({ id: MATERIA_ID, estado: 'completada' }));
  const actualizar = t.mock.method(tareaModel, 'actualizar', async () => ({}));
  const a = await pedir(`/api/tareas/${MATERIA_ID}/estado`, { metodo: 'PATCH', cuerpo: { estado: 'pendiente' } });
  const b = await pedir(`/api/tareas/${MATERIA_ID}`, { metodo: 'PUT', cuerpo: { titulo: 'otro' } });
  assert.equal(a.status, 409);
  assert.equal(b.status, 409);
  assert.equal((await a.json()).error.codigo, 'TAREA_COMPLETADA');
  assert.equal(actualizar.mock.callCount(), 0);
});

test('el trigger de la base (P0001) también se traduce a 409', async (t) => {
  t.mock.method(tareaModel, 'obtener', async () => ({ id: MATERIA_ID, estado: 'pendiente' }));
  t.mock.method(tareaModel, 'actualizar', async () => {
    throw Object.assign(new Error('TAREA_COMPLETADA'), { code: 'P0001' });
  });
  const r = await pedir(`/api/tareas/${MATERIA_ID}`, { metodo: 'PUT', cuerpo: { titulo: 'x' } });
  assert.equal(r.status, 409);
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

/** Exámenes, temas débiles y tarjetas: vacíos (no hay base de datos en las pruebas). */
function sinContextoExtra(t) {
  t.mock.method(contexto, 'examenesProximos', async () => []);
  t.mock.method(contexto, 'temasDebiles', async () => []);
  t.mock.method(contexto, 'tarjetasPendientes', async () => ({ total: 0, apuntes: [] }));
}

test('plan: sin tareas pendientes responde 422', async (t) => {
  t.mock.method(tareaModel, 'pendientesParaPlan', async () => []);
  const r = await pedir('/api/planes', { metodo: 'POST', cuerpo: {} });
  assert.equal(r.status, 422);
});

test('plan: pide JSON a Gemini, valida las actividades y guarda el plan', async (t) => {
  const TAREA = 'c0000000-0000-0000-0000-000000000001';
  const hoy = fechas.hoy();
  t.mock.method(tareaModel, 'pendientesParaPlan', async () => [
    { id: TAREA, titulo: 'Árbol AVL', materia: 'Programación', materiaId: MATERIA_ID, prioridad: 'alta', estado: 'pendiente', vencida: false, fechaLimite: new Date(Date.now() + 3 * 86400000) },
  ]);
  sinContextoExtra(t);
  const crear = t.mock.method(planModel, 'crear', async (_u, datos) => ({ id: 'p1', ...datos }));
  const respuestaIa = {
    titulo: 'Semana de AVL',
    resumen: 'Primero AVL.',
    dias: [
      { fecha: hoy, actividades: [
        { inicio: '18:00', fin: '18:50', tipo: 'tarea', titulo: 'Rotaciones', tareaId: TAREA, materiaId: null },
        { inicio: '18:50', fin: '19:00', tipo: 'descanso', titulo: 'Descanso' },
        { inicio: '19:00', fin: '18:00', tipo: 'estudio', titulo: 'Hora inválida' },
        { inicio: '19:00', fin: '19:40', tipo: 'inventado', titulo: 'Tipo desconocido', tareaId: 'id-inventado' },
      ] },
      { fecha: '1999-01-01', actividades: [{ inicio: '10:00', fin: '11:00', tipo: 'estudio', titulo: 'Fuera de rango' }] },
    ],
    consejos: ['Duerme bien'],
  };
  const llamadas = simularGemini(t, { candidates: [{ content: { parts: [{ text: JSON.stringify(respuestaIa) }] } }] });

  const r = await pedir('/api/planes', { metodo: 'POST', cuerpo: { dias: 5, horasPorDia: 2 } });
  assert.equal(r.status, 201);
  const cuerpo = JSON.parse(llamadas[0].opciones.body);
  assert.equal(cuerpo.generationConfig.responseMimeType, 'application/json');
  assert.match(cuerpo.contents[0].parts[0].text, /Árbol AVL/);

  const datos = crear.mock.calls[0].arguments[1];
  assert.equal(datos.titulo, 'Semana de AVL');
  assert.deepEqual(datos.tareaIds, [TAREA]);
  assert.equal(datos.actividades.length, 3);              // se descartan la hora inválida y la fecha fuera de rango
  assert.equal(datos.actividades[0].materiaId, MATERIA_ID); // se completa con la materia de la tarea
  assert.equal(datos.actividades[2].tipo, 'estudio');       // tipo desconocido -> estudio
  assert.equal(datos.actividades[2].tareaId, null);         // id inventado -> null
});

test('límite de IA: la solicitud 11 en un minuto responde 429', async (t) => {
  t.mock.method(tareaModel, 'pendientesParaPlan', async () => []);
  let ultimo;
  for (let i = 0; i < 11; i++) ultimo = await pedir('/api/planes', { metodo: 'POST' });
  assert.equal(ultimo.status, 429);
});

test('cuestionario: nunca envía la respuesta correcta antes de responder', async (t) => {
  t.mock.method(cuestionarioModel, 'obtener', async () => ({
    id: 'q1', titulo: 'Q', preguntas: [{ pregunta: '¿2+2?', opciones: ['3', '4', '5', '6'], correcta: 1, explicacion: 'Suma', tema: 'Suma' }],
  }));
  t.mock.method(cuestionarioModel, 'historialIntentos', async () => []);
  const r = await pedir(`/api/cuestionarios/${MATERIA_ID}`);
  const { cuestionario } = await r.json();
  assert.equal(cuestionario.preguntas[0].correcta, undefined);
  assert.equal(cuestionario.preguntas[0].explicacion, undefined);
});

test('cuestionario: califica en el servidor y devuelve los temas débiles', async (t) => {
  t.mock.method(cuestionarioModel, 'obtener', async () => ({
    id: 'q1', preguntas: [
      { pregunta: 'a', opciones: ['1', '2', '3', '4'], correcta: 1, explicacion: 'x', tema: 'Índices' },
      { pregunta: 'b', opciones: ['1', '2', '3', '4'], correcta: 2, explicacion: 'y', tema: '3FN' },
    ],
  }));
  const crear = t.mock.method(cuestionarioModel, 'crearIntento', async (_u, _id, i) => ({ ...i }));
  t.mock.method(cuestionarioModel, 'ultimoIntento', async () => ({ puntaje: 0, temasDebiles: ['Índices', '3FN'], creadoEn: new Date() }));
  t.mock.method(cuestionarioModel, 'apuntesBasicos', async () => []);
  t.mock.method(cuestionarioModel, 'tarjetasCreadas', async () => []);
  const r = await pedir(`/api/cuestionarios/${MATERIA_ID}/intentos`, { metodo: 'POST', cuerpo: { respuestas: [1, 0] } });
  assert.equal(r.status, 201);
  const intento = crear.mock.calls[0].arguments[2];
  assert.equal(intento.correctas, 1);
  assert.equal(intento.puntaje, 50);
  assert.deepEqual(intento.temasDebiles, ['3FN']);
  const { analisis } = await r.json();
  assert.deepEqual(analisis.comparacion.mejoraron, ['Índices']);   // falló Índices antes y ahora no
  assert.deepEqual(analisis.comparacion.siguenDebiles, ['3FN']);
  assert.equal(analisis.falladasSinTarjeta, 1);
});

const APUNTE_A = 'b0000000-0000-0000-0000-00000000000a';
const PREGUNTAS_FALLADAS = [
  { pregunta: '¿Qué es 2FN?', opciones: ['A', 'B', 'C', 'D'], correcta: 1, explicacion: 'Sin dependencias parciales.', tema: '2FN', apunteId: APUNTE_A },
  { pregunta: '¿Qué es un índice?', opciones: ['A', 'B', 'C', 'D'], correcta: 0, explicacion: 'Acelera búsquedas.', tema: 'Índices', apunteId: null },
  { pregunta: '¿Qué es 3FN?', opciones: ['A', 'B', 'C', 'D'], correcta: 2, explicacion: 'Sin transitivas.', tema: '3FN', apunteId: APUNTE_A },
];

test('cuestionario: crea tarjetas solo de las preguntas falladas y no repite las existentes', async (t) => {
  t.mock.method(cuestionarioModel, 'obtener', async () => ({ id: 'q1', materiaId: MATERIA_ID, preguntas: PREGUNTAS_FALLADAS }));
  t.mock.method(cuestionarioModel, 'ultimoIntento', async () => ({ respuestas: [0, 0, 0] })); // falla la 1 y la 3
  t.mock.method(cuestionarioModel, 'tarjetasCreadas', async () => ['¿qué es 3fn?']);
  t.mock.method(cuestionarioModel, 'apuntesBasicos', async () => [{ id: APUNTE_A, titulo: 'Normalización', materiaId: MATERIA_ID }]);
  const crear = t.mock.method(flashcardModel, 'crearVarias', async (_u, _m, _a, lista) => lista);

  const r = await pedir(`/api/cuestionarios/${MATERIA_ID}/tarjetas`, { metodo: 'POST' });
  assert.equal(r.status, 201);
  const cuerpo = await r.json();
  assert.equal(cuerpo.creadas, 1);
  assert.equal(cuerpo.omitidas, 1);
  const [tarjeta] = crear.mock.calls[0].arguments[3];
  assert.equal(tarjeta.frente, '¿Qué es 2FN?');
  assert.match(tarjeta.reverso, /^B\n\nSin dependencias parciales\.$/);
  assert.equal(tarjeta.apunteId, APUNTE_A);
  assert.equal(tarjeta.cuestionarioId, 'q1');
});

test('cuestionario: programa una sesión de repaso en el plan que cubre esa fecha', async (t) => {
  t.mock.method(cuestionarioModel, 'obtener', async () => ({ id: 'q1', titulo: 'Parcial', materiaId: MATERIA_ID, preguntas: PREGUNTAS_FALLADAS }));
  t.mock.method(cuestionarioModel, 'ultimoIntento', async () => ({ respuestas: [0, 0, 0], puntaje: 33.33 }));
  t.mock.method(cuestionarioModel, 'apuntesBasicos', async () => [{ id: APUNTE_A, titulo: 'Normalización', materiaId: MATERIA_ID }]);
  t.mock.method(planModel, 'planEnFecha', async () => ({ id: 'p9', titulo: 'Semana' }));
  const agregar = t.mock.method(planModel, 'agregarActividad', async (id) => ({ id }));
  const fecha = fechas.sumarDias(fechas.hoy(), 1);

  const r = await pedir(`/api/cuestionarios/${MATERIA_ID}/repaso`, { metodo: 'POST', cuerpo: { fecha, inicio: '19:00', duracion: 45 } });
  assert.equal(r.status, 201);
  assert.equal((await r.json()).nuevo, false);
  const act = agregar.mock.calls[0].arguments[2];
  assert.equal(act.tipo, 'repaso');
  assert.equal(act.fin, '19:45');
  assert.match(act.titulo, /2FN, 3FN/);
  assert.match(act.descripcion, /Normalización/);

  const pasada = await pedir(`/api/cuestionarios/${MATERIA_ID}/repaso`, { metodo: 'POST', cuerpo: { fecha: '2020-01-01', inicio: '19:00', duracion: 45 } });
  assert.equal(pasada.status, 400);
});

test('plan: la vista previa no guarda nada y la propuesta aprobada se valida sin llamar a la IA', async (t) => {
  const TAREA = 'c0000000-0000-0000-0000-000000000002';
  const hoy = fechas.hoy();
  t.mock.method(tareaModel, 'pendientesParaPlan', async () => [
    { id: TAREA, titulo: 'Informe', materia: 'Web', materiaId: MATERIA_ID, prioridad: 'media', estado: 'pendiente', vencida: false, fechaLimite: new Date(Date.now() + 2 * 86400000) },
  ]);
  sinContextoExtra(t);
  const crear = t.mock.method(planModel, 'crear', async (_u, datos) => ({ id: 'p2', ...datos }));
  const dias = [{ fecha: hoy, actividades: [{ inicio: '18:00', fin: '18:45', tipo: 'tarea', titulo: 'Informe', tareaId: TAREA }] }];
  const llamadas = simularGemini(t, { candidates: [{ content: { parts: [{ text: JSON.stringify({ titulo: 'Plan', resumen: 'R', dias }) }] } }] });

  const previa = await pedir('/api/planes/vista-previa', { metodo: 'POST', cuerpo: { dias: 3, prioridad: 'alta', temasPrioridad: 'Rotaciones' } });
  assert.equal(previa.status, 200);
  const { propuesta } = await previa.json();
  assert.equal(propuesta.dias[0].actividades[0].tareaId, TAREA);
  assert.equal(crear.mock.callCount(), 0);
  const mensaje = JSON.parse(llamadas[0].opciones.body).contents[0].parts[0].text;
  assert.match(mensaje, /PRIORIZAR.*Rotaciones/);
  assert.match(mensaje, /ritmo intenso/);

  // El estudiante edita el título, borra nada y agrega una actividad con un id ajeno
  propuesta.titulo = 'Mi plan editado';
  propuesta.dias[0].actividades.push({ inicio: '19:00', fin: '19:30', tipo: 'repaso', titulo: 'Extra', tareaId: 'c0000000-0000-0000-0000-0000000000ff' });
  const r = await pedir('/api/planes', { metodo: 'POST', cuerpo: { dias: 3, propuesta } });
  assert.equal(r.status, 201);
  assert.equal(llamadas.length, 1);                   // no se volvió a llamar a la IA
  const datos = crear.mock.calls[0].arguments[1];
  assert.equal(datos.titulo, 'Mi plan editado');
  assert.equal(datos.actividades.length, 2);
  assert.equal(datos.actividades[1].tareaId, null);   // id que no es del estudiante -> null
  assert.equal(datos.prioridad, 'media');
});

// ---------- General ----------

test('documentación Swagger disponible', async () => {
  const r = await pedir('/api/docs.json', { auth: null });
  assert.equal((await r.json()).info.title, 'EduPlan · ms-academico');
});
