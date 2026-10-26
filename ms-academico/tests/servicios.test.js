require('./setup');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { siguienteRepaso } = require('../src/services/flashcard.service');
const { normalizarPreguntas } = require('../src/services/cuestionario.service');
const { interpretarJson } = require('../src/services/ia/proveedores');

const nueva = { repeticiones: 0, intervaloDias: 0, facilidad: 2.5 };

test('repaso espaciado: "Fácil" aleja la tarjeta cada vez más', () => {
  const a = siguienteRepaso(nueva, 'facil');
  const b = siguienteRepaso(a, 'facil');
  const c = siguienteRepaso(b, 'facil');
  assert.deepEqual([a.intervaloDias, b.intervaloDias, c.intervaloDias], [2, 5, 14]);
  assert.ok(c.facilidad > nueva.facilidad);
});

test('repaso espaciado: "No lo recuerdo" la devuelve a hoy y baja la facilidad', () => {
  const r = siguienteRepaso({ repeticiones: 4, intervaloDias: 20, facilidad: 2.5 }, 'olvidado');
  assert.equal(r.intervaloDias, 0);
  assert.equal(r.repeticiones, 0);
  assert.equal(r.facilidad, 2.3);
});

test('repaso espaciado: la facilidad nunca baja de 1.3', () => {
  let t = { repeticiones: 0, intervaloDias: 0, facilidad: 1.35 };
  for (let i = 0; i < 5; i++) t = siguienteRepaso(t, 'dificil');
  assert.equal(t.facilidad, 1.3);
});

test('cuestionario: descarta preguntas mal formadas y mezcla las opciones', () => {
  const buena = { pregunta: '¿Qué es 3FN?', opciones: ['A', 'B', 'C', 'D'], correcta: 2, explicacion: 'x', tema: 'Normalización' };
  const preguntas = normalizarPreguntas([
    buena,
    { ...buena },                                    // repetida
    { ...buena, pregunta: 'Otra', opciones: ['A', 'B', 'C'] }, // 3 opciones
    { ...buena, pregunta: 'Otra 2', correcta: 7 },   // índice inválido
    { ...buena, pregunta: 'Otra 3', opciones: ['A', 'A', 'B', 'C'] }, // repetidas
  ], 10);
  assert.equal(preguntas.length, 1);
  assert.equal(preguntas[0].opciones[preguntas[0].correcta], 'C'); // la correcta sigue siendo la misma opción
});

test('interpretarJson acepta respuestas envueltas en ```json', () => {
  assert.deepEqual(interpretarJson('Claro:\n```json\n{"a": 1}\n```'), { a: 1 });
  assert.equal(interpretarJson('sin json'), null);
});
