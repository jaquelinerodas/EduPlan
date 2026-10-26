/**
 * Cuestionarios de opción múltiple generados con IA a partir de los apuntes.
 * La respuesta correcta y la explicación nunca se envían al cliente antes de
 * que responda: la calificación se hace en el servidor.
 */
const crypto = require('node:crypto');
const cuestionarioModel = require('../models/cuestionario.model');
const ia = require('./ia/proveedores');
const prompts = require('./ia/prompts');
const contexto = require('./ia/contexto');
const AppError = require('../utils/AppError');
const { validar, validarId } = require('../utils/validar');

const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Mezcla las opciones para que la correcta no quede siempre en la misma posición. */
function mezclarOpciones(p) {
  const orden = [0, 1, 2, 3];
  for (let i = orden.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [orden[i], orden[j]] = [orden[j], orden[i]];
  }
  return { ...p, opciones: orden.map((k) => p.opciones[k]), correcta: orden.indexOf(p.correcta) };
}

function normalizarPreguntas(lista, maximo) {
  if (!Array.isArray(lista)) return [];
  const vistas = new Set();
  return lista
    .map((p) => {
      const pregunta = texto(p?.pregunta, 600);
      const opciones = Array.isArray(p?.opciones) ? p.opciones.map((o) => texto(String(o ?? ''), 300)) : [];
      const correcta = Number(p?.correcta);
      if (!pregunta || vistas.has(pregunta.toLowerCase())) return null;
      if (opciones.length !== 4 || opciones.some((o) => !o) || new Set(opciones.map((o) => o.toLowerCase())).size !== 4) return null;
      if (!Number.isInteger(correcta) || correcta < 0 || correcta > 3) return null;
      vistas.add(pregunta.toLowerCase());
      return mezclarOpciones({
        pregunta, opciones, correcta,
        explicacion: texto(p.explicacion, 800) || 'Sin explicación.',
        tema: texto(p.tema, 60) || 'General',
      });
    })
    .filter(Boolean)
    .slice(0, maximo);
}

/** Versión para el cliente: sin respuesta correcta ni explicación. */
const sinRespuestas = (c) => ({
  ...c,
  preguntas: c.preguntas.map(({ pregunta, opciones, tema }) => ({ pregunta, opciones, tema })),
});

function simulado(c) {
  const fuentes = c.apuntes.length ? c.apuntes : [{ titulo: c.examen?.titulo || 'Tema', contenido: c.examen?.temas || '' }];
  return {
    titulo: `Práctica: ${fuentes[0].titulo}`,
    preguntas: Array.from({ length: c.numPreguntas }, (_, i) => {
      const a = fuentes[i % fuentes.length];
      return {
        pregunta: `Pregunta de ejemplo ${i + 1} sobre «${a.titulo}» (AI_PROVIDER=simulado)`,
        opciones: ['Respuesta correcta', 'Opción incorrecta 1', 'Opción incorrecta 2', 'Opción incorrecta 3'],
        correcta: 0,
        explicacion: 'Explicación de ejemplo.',
        tema: a.titulo.slice(0, 40),
      };
    }),
  };
}

async function generar(usuarioId, cuerpo) {
  const op = {
    numPreguntas: 10, dificultad: 'media', apunteIds: [],
    ...validar(cuerpo, {
      fuente: { tipo: 'enum', valores: ['apuntes', 'materia', 'examen'], requerido: true },
      apunteIds: { tipo: 'listaUuid', max: 10 },
      materiaId: { tipo: 'uuid' },
      examenId: { tipo: 'uuid' },
      numPreguntas: { tipo: 'entero', min: 3, max: 20 },
      dificultad: { tipo: 'enum', valores: ['facil', 'media', 'dificil'] },
    }),
  };

  let apuntes = [];
  let examen = null;
  let materiaId = null;

  if (op.fuente === 'apuntes') {
    if (!op.apunteIds.length) throw new AppError('Elige al menos un apunte', 400, 'VALIDACION', ['apunteIds es obligatorio']);
    apuntes = await contexto.apuntesPorId(usuarioId, op.apunteIds);
    const materias = new Set(apuntes.map((a) => a.materiaId));
    materiaId = materias.size === 1 ? [...materias][0] : null;
  } else if (op.fuente === 'materia') {
    if (!op.materiaId) throw new AppError('Elige una materia', 400, 'VALIDACION', ['materiaId es obligatorio']);
    materiaId = (await contexto.materia(usuarioId, op.materiaId)).id;
    apuntes = await contexto.apuntesDeMateria(usuarioId, materiaId);
  } else {
    if (!op.examenId) throw new AppError('Elige un examen', 400, 'VALIDACION', ['examenId es obligatorio']);
    examen = await contexto.examen(usuarioId, op.examenId);
    materiaId = examen.materiaId;
    apuntes = await contexto.apuntesDeMateria(usuarioId, materiaId);
  }

  if (!apuntes.length && !examen?.temas) {
    throw new AppError('No hay apuntes de donde sacar preguntas. Escribe algunos apuntes primero.', 422, 'SIN_APUNTES');
  }

  const c = {
    numPreguntas: op.numPreguntas,
    dificultad: op.dificultad,
    examen,
    apuntes,
    temasDebiles: examen ? await contexto.temasDebiles(usuarioId, materiaId) : [],
    apuntesTexto: contexto.textoApuntes(apuntes),
  };

  const datos = await ia.generarJson({
    sistema: prompts.SISTEMA_CUESTIONARIO,
    mensaje: prompts.mensajeCuestionario(c),
    simulado: () => simulado(c),
  });

  const preguntas = normalizarPreguntas(datos.preguntas, op.numPreguntas);
  if (preguntas.length < 3) {
    throw new AppError('La IA no generó suficientes preguntas válidas, intenta de nuevo', 502, 'IA_RESPUESTA_INVALIDA');
  }

  const creado = await cuestionarioModel.crear(usuarioId, {
    titulo: texto(datos.titulo, 200) || (examen ? `Práctica: ${examen.titulo}` : `Cuestionario de ${apuntes[0].titulo}`),
    dificultad: op.dificultad,
    materiaId,
    examenId: examen?.id ?? null,
    apunteIds: apuntes.map((a) => a.id),
    preguntas,
    modeloIa: ia.nombreModelo(),
  });
  return sinRespuestas(creado);
}

async function listar(usuarioId, query) {
  const lista = await cuestionarioModel.listar(usuarioId, validar(query, {
    materiaId: { tipo: 'uuid' },
    examenId: { tipo: 'uuid' },
  }));
  return lista.map(({ preguntas, ...resto }) => resto);
}

async function cargar(usuarioId, id) {
  const c = await cuestionarioModel.obtener(validarId(id), usuarioId);
  if (!c) throw new AppError('Cuestionario no encontrado', 404, 'CUESTIONARIO_NO_ENCONTRADO');
  return c;
}

async function obtener(usuarioId, id) {
  const c = await cargar(usuarioId, id);
  return { ...sinRespuestas(c), historial: await cuestionarioModel.historialIntentos(c.id, usuarioId) };
}

/** Revisión detallada de cada pregunta (solo después de responder). */
function revisar(preguntas, respuestas) {
  return preguntas.map((p, i) => ({
    pregunta: p.pregunta,
    opciones: p.opciones,
    tema: p.tema,
    elegida: respuestas[i],
    correcta: p.correcta,
    esCorrecta: respuestas[i] === p.correcta,
    explicacion: p.explicacion,
  }));
}

async function responder(usuarioId, id, cuerpo) {
  const c = await cargar(usuarioId, id);
  const respuestas = cuerpo?.respuestas;
  if (!Array.isArray(respuestas) || respuestas.length !== c.preguntas.length) {
    throw new AppError('Datos inválidos', 400, 'VALIDACION', [`respuestas debe tener ${c.preguntas.length} elementos`]);
  }
  const limpias = respuestas.map((r) => (Number.isInteger(r) && r >= 0 && r <= 3 ? r : null));

  const revision = revisar(c.preguntas, limpias);
  const correctas = revision.filter((r) => r.esCorrecta).length;
  const temasDebiles = [...new Set(revision.filter((r) => !r.esCorrecta).map((r) => r.tema))];

  const intento = await cuestionarioModel.crearIntento(usuarioId, c.id, {
    respuestas: limpias,
    correctas,
    total: c.preguntas.length,
    puntaje: Math.round((correctas / c.preguntas.length) * 10000) / 100,
    temasDebiles,
  });
  return { intento, revision };
}

/** Vuelve a mostrar la revisión del último intento. */
async function ultimaRevision(usuarioId, id) {
  const c = await cargar(usuarioId, id);
  const intento = await cuestionarioModel.ultimoIntento(c.id, usuarioId);
  if (!intento) throw new AppError('Aún no has respondido este cuestionario', 404, 'SIN_INTENTOS');
  const { respuestas, ...datos } = intento;
  return { intento: datos, revision: revisar(c.preguntas, respuestas) };
}

async function eliminar(usuarioId, id) {
  if (!(await cuestionarioModel.eliminar(validarId(id), usuarioId))) {
    throw new AppError('Cuestionario no encontrado', 404, 'CUESTIONARIO_NO_ENCONTRADO');
  }
}

module.exports = { generar, listar, obtener, responder, ultimaRevision, eliminar, normalizarPreguntas };
