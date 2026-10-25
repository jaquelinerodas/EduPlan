require('./setup');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validar, validarId } = require('../src/utils/validar');
const { construirSet } = require('../src/utils/sql');

const ESQUEMA = {
  titulo: { tipo: 'texto', requerido: true, max: 10 },
  prioridad: { tipo: 'enum', valores: ['baja', 'alta'] },
  fechaLimite: { tipo: 'fechaHora', requerido: true },
  color: { tipo: 'color' },
  dias: { tipo: 'entero', min: 1, max: 30 },
};

test('limpia espacios, normaliza color e ignora campos desconocidos', () => {
  const r = validar({ titulo: '  Hola ', fechaLimite: '2026-11-05', color: '#abcdef', hack: 'x' }, ESQUEMA);
  assert.deepEqual(r, { titulo: 'Hola', fechaLimite: '2026-11-05 23:59:00', color: '#ABCDEF' });
});

test('reúne todos los errores en una sola respuesta 400', () => {
  try {
    validar({ titulo: 'muy muy largo', prioridad: 'urgente', fechaLimite: '2026-02-30', dias: 0 }, ESQUEMA);
    assert.fail('debió lanzar error');
  } catch (err) {
    assert.equal(err.estadoHttp, 400);
    assert.equal(err.detalles.length, 4);
  }
});

test('en modo parcial los requeridos son opcionales', () => {
  assert.deepEqual(validar({ prioridad: 'alta' }, ESQUEMA, { parcial: true }), { prioridad: 'alta' });
});

test('acepta fechas ISO con hora y zona', () => {
  const r = validar({ titulo: 'x', fechaLimite: '2026-11-05T18:00:00-06:00' }, ESQUEMA);
  assert.equal(r.fechaLimite, '2026-11-05T18:00:00-06:00');
});

test('convierte enteros que llegan como texto (query string)', () => {
  assert.equal(validar({ dias: '7' }, { dias: ESQUEMA.dias }).dias, 7);
});

test('validarId rechaza ids que no son UUID', () => {
  assert.throws(() => validarId('123'), { codigo: 'ID_INVALIDO' });
  assert.equal(validarId('A0000000-0000-0000-0000-000000000001'), 'a0000000-0000-0000-0000-000000000001');
});

test('construirSet solo incluye los campos enviados y numera los parámetros', () => {
  const r = construirSet({ titulo: 'x', estado: 'completada' }, { titulo: 'titulo', descripcion: 'descripcion', estado: 'estado' }, 3);
  assert.equal(r.set, 'titulo = $3, estado = $4');
  assert.deepEqual(r.valores, ['x', 'completada']);
});
