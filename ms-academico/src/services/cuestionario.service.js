/**
 * Cuestionarios de opción múltiple generados con IA a partir de los apuntes.
 * La respuesta correcta y la explicación nunca se envían al cliente antes de
 * que responda: la calificación se hace en el servidor.
 */
const crypto = require('node:crypto');
const cuestionarioModel = require('../models/cuestionario.model');
const flashcardModel = require('../models/flashcard.model');
const planModel = require('../models/plan.model');
const f = require('../utils/fechas');
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

function normalizarPreguntas(lista, maximo, apunteIds = []) {
  if (!Array.isArray(lista)) return [];
  const validos = new Set(apunteIds);
  const unico = apunteIds.length === 1 ? apunteIds[0] : null;
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
        apunteId: validos.has(p.apunteId) ? p.apunteId : unico,
      });
    })
    .filter(Boolean)
    .slice(0, maximo);
}

/** Versión para el cliente: sin respuesta correcta ni explicación. */
const sinRespuestas = (c) => ({
  ...c,
  preguntas: c.preguntas.map(({ pregunta, opciones, tema, apunteId }) => ({ pregunta, opciones, tema, apunteId })),
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
        tema: c.temas?.length ? c.temas[i % c.temas.length].slice(0, 40) : a.titulo.slice(0, 40),
        apunteId: a.id ?? null,
      };
    }),
  };
}

async function generar(usuarioId, cuerpo) {
  const op = {
    numPreguntas: 10, dificultad: 'media', apunteIds: [], temas: [],
    ...validar(cuerpo, {
      fuente: { tipo: 'enum', valores: ['apuntes', 'materia', 'examen'], requerido: true },
      apunteIds: { tipo: 'listaUuid', max: 15 },
      materiaId: { tipo: 'uuid' },
      examenId: { tipo: 'uuid' },
      periodoId: { tipo: 'uuid' },
      temas: { tipo: 'listaTexto', max: 20, maxLargo: 150 },
      numPreguntas: { tipo: 'entero', min: 3, max: 20 },
      dificultad: { tipo: 'enum', valores: ['facil', 'media', 'dificil'] },
    }),
  };

  let apuntes = [];
  let examen = null;
  let materiaId = null;
  const seleccion = { apunteIds: op.apunteIds, periodoId: op.periodoId ?? null };

  if (op.fuente === 'apuntes') {
    if (!op.apunteIds.length) throw new AppError('Elige al menos un apunte', 400, 'VALIDACION', ['apunteIds es obligatorio']);
    apuntes = await contexto.apuntesPorId(usuarioId, op.apunteIds);
    const materias = new Set(apuntes.map((a) => a.materiaId));
    materiaId = materias.size === 1 ? [...materias][0] : null;
  } else if (op.fuente === 'materia') {
    if (!op.materiaId) throw new AppError('Elige una materia', 400, 'VALIDACION', ['materiaId es obligatorio']);
    materiaId = (await contexto.materia(usuarioId, op.materiaId)).id;
    apuntes = await contexto.apuntesElegidos(usuarioId, materiaId, seleccion);
  } else {
    if (!op.examenId) throw new AppError('Elige un examen', 400, 'VALIDACION', ['examenId es obligatorio']);
    examen = await contexto.examen(usuarioId, op.examenId);
    materiaId = examen.materiaId;
    apuntes = await contexto.apuntesElegidos(usuarioId, materiaId, seleccion);
    // Si eligió temas, el examen solo se describe con esos temas
    if (op.temas.length) examen = { ...examen, temas: op.temas.join('\n') };
  }

  if (!apuntes.length && !examen?.temas && !op.temas.length) {
    throw new AppError('No hay apuntes de donde sacar preguntas. Escribe algunos apuntes primero.', 422, 'SIN_APUNTES');
  }

  const c = {
    numPreguntas: op.numPreguntas,
    dificultad: op.dificultad,
    examen,
    apuntes,
    temas: op.temas,
    temasDebiles: examen ? await contexto.temasDebiles(usuarioId, materiaId) : [],
    apuntesTexto: contexto.textoApuntes(apuntes),
  };

  const datos = await ia.generarJson({
    sistema: prompts.SISTEMA_CUESTIONARIO,
    mensaje: prompts.mensajeCuestionario(c),
    simulado: () => simulado(c),
  });

  const preguntas = normalizarPreguntas(datos.preguntas, op.numPreguntas, apuntes.map((a) => a.id));
  if (preguntas.length < 3) {
    throw new AppError('La IA no generó suficientes preguntas válidas, intenta de nuevo', 502, 'IA_RESPUESTA_INVALIDA');
  }

  const porDefecto = examen ? `Práctica: ${examen.titulo}` : apuntes.length ? `Cuestionario de ${apuntes[0].titulo}` : 'Cuestionario';
  const creado = await cuestionarioModel.crear(usuarioId, {
    titulo: texto(datos.titulo, 200) || porDefecto,
    dificultad: op.dificultad,
    materiaId,
    examenId: examen?.id ?? null,
    apunteIds: apuntes.map((a) => a.id),
    temas: op.temas,
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
    apunteId: p.apunteId ?? null,
    elegida: respuestas[i],
    correcta: p.correcta,
    esCorrecta: respuestas[i] === p.correcta,
    explicacion: p.explicacion,
  }));
}

/** Temas con cuántas preguntas se fallaron de cada uno. */
function temasConFallos(revision) {
  const mapa = new Map();
  for (const r of revision) {
    const t = mapa.get(r.tema) || { tema: r.tema, fallos: 0, total: 0 };
    t.total += 1;
    if (!r.esCorrecta) t.fallos += 1;
    mapa.set(r.tema, t);
  }
  return [...mapa.values()].sort((a, b) => b.fallos - a.fallos || a.tema.localeCompare(b.tema));
}

/**
 * Lo que el estudiante puede hacer después de responder: temas débiles,
 * apuntes que conviene volver a estudiar, comparación con el intento anterior
 * y cuántas preguntas falladas aún no tienen tarjeta.
 */
async function analizar(usuarioId, c, revision, anterior) {
  const falladas = revision.filter((r) => !r.esCorrecta);
  const temas = temasConFallos(revision);
  const debiles = temas.filter((t) => t.fallos > 0);

  const fallosPorApunte = new Map();
  for (const r of falladas) {
    if (!r.apunteId) continue;
    const a = fallosPorApunte.get(r.apunteId) || { fallos: 0, temas: new Set() };
    a.fallos += 1;
    a.temas.add(r.tema);
    fallosPorApunte.set(r.apunteId, a);
  }
  const apuntes = await cuestionarioModel.apuntesBasicos(usuarioId, [...fallosPorApunte.keys()]);
  const recomendaciones = apuntes
    .map((a) => ({ ...a, fallos: fallosPorApunte.get(a.id).fallos, temas: [...fallosPorApunte.get(a.id).temas] }))
    .sort((x, y) => y.fallos - x.fallos);

  const creadas = new Set((await cuestionarioModel.tarjetasCreadas(c.id, usuarioId)).map((x) => x.toLowerCase()));
  const sinTarjeta = falladas.filter((r) => !creadas.has(r.pregunta.toLowerCase())).length;

  let comparacion = null;
  if (anterior) {
    const antes = new Set(anterior.temasDebiles);
    const ahora = new Set(debiles.map((t) => t.tema));
    comparacion = {
      puntajeAnterior: anterior.puntaje,
      fechaAnterior: anterior.creadoEn,
      mejoraron: [...antes].filter((t) => !ahora.has(t)),
      siguenDebiles: [...antes].filter((t) => ahora.has(t)),
      nuevosDebiles: [...ahora].filter((t) => !antes.has(t)),
    };
  }

  return { temas, recomendaciones, comparacion, falladas: falladas.length, falladasSinTarjeta: sinTarjeta };
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
  const falladas = revision.filter((r) => !r.esCorrecta);
  const anterior = await cuestionarioModel.ultimoIntento(c.id, usuarioId);

  const intento = await cuestionarioModel.crearIntento(usuarioId, c.id, {
    respuestas: limpias,
    correctas,
    total: c.preguntas.length,
    puntaje: Math.round((correctas / c.preguntas.length) * 10000) / 100,
    temasDebiles: [...new Set(falladas.map((r) => r.tema))],
    apuntesRecomendados: [...new Set(falladas.map((r) => r.apunteId).filter(Boolean))],
  });
  return { intento, revision, analisis: await analizar(usuarioId, c, revision, anterior) };
}

/** Vuelve a mostrar la revisión del último intento. */
async function ultimaRevision(usuarioId, id) {
  const c = await cargar(usuarioId, id);
  const [ultimo, anterior] = await cuestionarioModel.ultimosIntentos(c.id, usuarioId);
  if (!ultimo) throw new AppError('Aún no has respondido este cuestionario', 404, 'SIN_INTENTOS');
  const { respuestas, ...datos } = ultimo;
  const revision = revisar(c.preguntas, respuestas);
  return { intento: datos, revision, analisis: await analizar(usuarioId, c, revision, anterior) };
}

/** Tarjetas de memoria con las preguntas falladas en el último intento. */
async function crearTarjetasFalladas(usuarioId, id) {
  const c = await cargar(usuarioId, id);
  const ultimo = await cuestionarioModel.ultimoIntento(c.id, usuarioId);
  if (!ultimo) throw new AppError('Primero responde el cuestionario', 422, 'SIN_INTENTOS');

  const revision = revisar(c.preguntas, ultimo.respuestas).filter((r) => !r.esCorrecta);
  if (!revision.length) throw new AppError('No fallaste ninguna pregunta en tu último intento', 422, 'SIN_FALLADAS');

  const creadas = new Set((await cuestionarioModel.tarjetasCreadas(c.id, usuarioId)).map((x) => x.toLowerCase()));
  const apuntes = new Map((await cuestionarioModel.apuntesBasicos(usuarioId, [...new Set(revision.map((r) => r.apunteId).filter(Boolean))]))
    .map((a) => [a.id, a]));

  const nuevas = [];
  let omitidas = 0;
  for (const r of revision) {
    const apunte = apuntes.get(r.apunteId);
    const materiaId = apunte?.materiaId ?? c.materiaId;
    if (creadas.has(r.pregunta.toLowerCase()) || !materiaId) { omitidas += 1; continue; }
    nuevas.push({
      frente: r.pregunta.slice(0, 500),
      reverso: `${r.opciones[r.correcta]}\n\n${r.explicacion}`.slice(0, 1500),
      materiaId,
      apunteId: apunte?.id ?? null,
      cuestionarioId: c.id,
    });
  }
  const tarjetas = nuevas.length ? await flashcardModel.crearVarias(usuarioId, c.materiaId, null, nuevas) : [];
  return { creadas: tarjetas.length, omitidas, tarjetas };
}

/** Datos de la sesión de repaso a partir del último intento. */
async function datosRepaso(usuarioId, c) {
  const ultimo = await cuestionarioModel.ultimoIntento(c.id, usuarioId);
  if (!ultimo) throw new AppError('Primero responde el cuestionario', 422, 'SIN_INTENTOS');
  const revision = revisar(c.preguntas, ultimo.respuestas);
  const temas = temasConFallos(revision).filter((t) => t.fallos > 0).map((t) => t.tema);
  const apuntes = await cuestionarioModel.apuntesBasicos(usuarioId, [...new Set(revision.filter((r) => !r.esCorrecta).map((r) => r.apunteId).filter(Boolean))]);
  const lista = temas.length ? temas.slice(0, 4).join(', ') : 'temas del cuestionario';
  return {
    temas,
    apuntes: apuntes.map((a) => ({ id: a.id, titulo: a.titulo })),
    titulo: `Repaso: ${lista}`.slice(0, 200),
    descripcion: [
      apuntes.length ? `Vuelve a estudiar: ${apuntes.map((a) => a.titulo).join(', ')}.` : 'Vuelve a leer tus apuntes de estos temas.',
      `Después repite el cuestionario «${c.titulo}» (último resultado: ${Math.round(ultimo.puntaje)}%).`,
    ].join(' '),
  };
}

/** Propone fecha y hora para repasar (no guarda nada). */
async function sugerirRepaso(usuarioId, id) {
  const c = await cargar(usuarioId, id);
  const d = await datosRepaso(usuarioId, c);
  const duracion = Math.min(90, Math.max(30, d.temas.length * 15));
  let fecha = f.sumarDias(f.hoy(), 1);
  let inicio = '18:00';
  for (let i = 0; i < 7; i++) {
    const fin = await planModel.finDelDia(usuarioId, fecha);
    const desde = fin && f.aMinutos(fin) + 10 > f.aMinutos('18:00') ? f.aMinutos(fin) + 10 : f.aMinutos('18:00');
    if (desde + duracion <= f.aMinutos('22:30')) { inicio = f.desdeMinutos(desde); break; }
    fecha = f.sumarDias(fecha, 1);
  }
  const plan = await planModel.planEnFecha(usuarioId, fecha);
  return { ...d, fecha, inicio, duracion, plan };
}

/** Agrega la sesión al plan que cubre esa fecha o crea un plan de repaso. */
async function programarRepaso(usuarioId, id, cuerpo) {
  const c = await cargar(usuarioId, id);
  const op = validar(cuerpo, {
    fecha: { tipo: 'fecha', requerido: true },
    inicio: { tipo: 'hora', requerido: true },
    duracion: { tipo: 'entero', min: 15, max: 180, requerido: true },
  });
  if (op.fecha < f.hoy()) throw new AppError('Datos inválidos', 400, 'VALIDACION', ['La fecha no puede ser anterior a hoy']);
  if (f.aMinutos(op.inicio) + op.duracion > 24 * 60 - 1) {
    throw new AppError('Datos inválidos', 400, 'VALIDACION', ['La sesión debe terminar el mismo día']);
  }
  const d = await datosRepaso(usuarioId, c);
  const actividad = {
    fecha: op.fecha,
    inicio: op.inicio,
    fin: f.desdeMinutos(f.aMinutos(op.inicio) + op.duracion),
    tipo: 'repaso',
    titulo: d.titulo,
    descripcion: d.descripcion,
    materiaId: c.materiaId,
    tareaId: null,
  };

  const existente = await planModel.planEnFecha(usuarioId, op.fecha);
  if (existente) return { plan: await planModel.agregarActividad(existente.id, usuarioId, actividad), nuevo: false };

  const plan = await planModel.crear(usuarioId, {
    titulo: `Repaso de ${c.titulo}`.slice(0, 200),
    alcance: 'cuestionario',
    materiaId: c.materiaId,
    examenId: c.examenId,
    cuestionarioId: c.id,
    fechaInicio: op.fecha,
    fechaFin: op.fecha,
    resumen: `Sesión para reforzar los temas que fallaste en «${c.titulo}».`,
    consejos: ['Lee primero la explicación de cada pregunta fallada.', 'Repite el cuestionario al terminar para medir tu avance.'],
    horasPorDia: Math.ceil(op.duracion / 60),
    tareaIds: [],
    apunteIds: d.apuntes.map((a) => a.id),
    modeloIa: null,
    actividades: [actividad],
  });
  return { plan, nuevo: true };
}

async function eliminar(usuarioId, id) {
  if (!(await cuestionarioModel.eliminar(validarId(id), usuarioId))) {
    throw new AppError('Cuestionario no encontrado', 404, 'CUESTIONARIO_NO_ENCONTRADO');
  }
}

module.exports = {
  generar, listar, obtener, responder, ultimaRevision, eliminar, normalizarPreguntas,
  crearTarjetasFalladas, sugerirRepaso, programarRepaso,
};
