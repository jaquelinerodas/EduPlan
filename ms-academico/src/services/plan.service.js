/**
 * Planes de estudio por días (RF08, HU08).
 *  - generar: la IA crea actividades día por día según el alcance elegido
 *    (todas las tareas, una materia, temas de apuntes o un examen).
 *  - reorganizar: la IA propone una nueva distribución de lo no completado;
 *    el estudiante la revisa y la aplica (nada se guarda sin su aprobación).
 */
const planModel = require('../models/plan.model');
const tareaModel = require('../models/tarea.model');
const ia = require('./ia/proveedores');
const prompts = require('./ia/prompts');
const contexto = require('./ia/contexto');
const AppError = require('../utils/AppError');
const { validar, validarId } = require('../utils/validar');
const f = require('../utils/fechas');

const ALCANCES = ['general', 'materia', 'apuntes', 'examen'];
const TIPOS = ['estudio', 'tarea', 'repaso', 'practica', 'descanso'];
const MAX_ACTIVIDADES_DIA = 16;

const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Valida y limpia las actividades devueltas por la IA (o enviadas al aplicar
 * una reorganización). Descarta fechas fuera de rango, horas inválidas e ids
 * que no pertenecen al estudiante.
 */
function normalizarActividades(dias, { desde, hasta, finesDeSemana = true, tareaIds, materiaIds, materiaPorTarea, materiaFija }) {
  if (!Array.isArray(dias)) return [];
  const resultado = [];

  for (const dia of dias) {
    const fecha = typeof dia?.fecha === 'string' ? dia.fecha.slice(0, 10) : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha < desde || fecha > hasta) continue;
    if (!finesDeSemana && f.esFinDeSemana(fecha)) continue;

    const delDia = (Array.isArray(dia.actividades) ? dia.actividades : [])
      .map((a) => {
        const inicio = f.normalizarHora(a?.inicio);
        const fin = f.normalizarHora(a?.fin);
        const titulo = texto(a?.titulo, 200);
        if (!inicio || !fin || f.aMinutos(fin) <= f.aMinutos(inicio) || !titulo) return null;
        const tipo = TIPOS.includes(a.tipo) ? a.tipo : 'estudio';
        const tareaId = tareaIds.has(a.tareaId) ? a.tareaId : null;
        let materiaId = materiaIds.has(a.materiaId) ? a.materiaId : null;
        if (!materiaId && tareaId) materiaId = materiaPorTarea.get(tareaId) || null;
        if (!materiaId && materiaFija && tipo !== 'descanso') materiaId = materiaFija;
        return {
          fecha, inicio, fin, tipo, titulo,
          descripcion: texto(a.descripcion, 1000) || null,
          tareaId: tipo === 'descanso' ? null : tareaId,
          materiaId: tipo === 'descanso' ? null : materiaId,
        };
      })
      .filter(Boolean)
      .sort((x, y) => x.inicio.localeCompare(y.inicio))
      .slice(0, MAX_ACTIVIDADES_DIA);

    resultado.push(...delDia);
  }
  // Un día sin estudio real (solo descansos) no aporta nada
  const diasConEstudio = new Set(resultado.filter((a) => a.tipo !== 'descanso').map((a) => a.fecha));
  return resultado
    .filter((a) => diasConEstudio.has(a.fecha))
    .sort((x, y) => (x.fecha + x.inicio).localeCompare(y.fecha + y.inicio));
}

const agruparPorDia = (actividades) => {
  const mapa = new Map();
  for (const a of actividades) {
    if (!mapa.has(a.fecha)) mapa.set(a.fecha, []);
    mapa.get(a.fecha).push(a);
  }
  return [...mapa].map(([fecha, acts]) => ({ fecha, actividades: acts }));
};

/** Plan de ejemplo para AI_PROVIDER=simulado (pruebas sin clave de API). */
function distribuirSimulado(elementos, { desde, hasta, horaInicio, horasPorDia, finesDeSemana, repetir = true }) {
  const dias = [];
  let i = 0;
  const limite = repetir ? elementos.length * 2 : elementos.length;
  for (let fecha = desde; fecha <= hasta && i < limite; fecha = f.sumarDias(fecha, 1)) {
    if (!finesDeSemana && f.esFinDeSemana(fecha)) continue;
    const actividades = [];
    let minuto = f.aMinutos(horaInicio);
    let estudiado = 0;
    while (i < limite && estudiado + 50 <= horasPorDia * 60 && minuto + 50 < 24 * 60) {
      const e = elementos[i % elementos.length];
      actividades.push({ ...e, inicio: f.desdeMinutos(minuto), fin: f.desdeMinutos(minuto + 50) });
      minuto += 50;
      estudiado += 50;
      i += 1;
      if (i < limite && estudiado + 50 <= horasPorDia * 60 && minuto + 10 < 24 * 60) {
        actividades.push({ tipo: 'descanso', titulo: 'Descanso', inicio: f.desdeMinutos(minuto), fin: f.desdeMinutos(minuto + 10) });
        minuto += 10;
      }
    }
    dias.push({ fecha, actividades });
  }
  return dias;
}

function planSimulado(c) {
  const prioridad = (c.temasPrioridad || '').split(/[,;\n]/).map((t) => t.trim()).filter(Boolean);
  const elementos = [
    ...prioridad.map((t) => ({ tipo: 'estudio', titulo: `Prioridad: ${t}`.slice(0, 200), descripcion: 'Tema que pediste priorizar.', materiaId: c.materias[0]?.id })),
    ...c.tareas.map((t) => ({ tipo: 'tarea', titulo: `Avanzar: ${t.titulo}`, descripcion: `Trabajar en la entrega de ${t.materia}.`, tareaId: t.id, materiaId: t.materiaId })),
    ...c.apuntes.map((a) => ({ tipo: 'estudio', titulo: `Estudiar: ${a.titulo}`, descripcion: 'Leer el apunte y anotar dudas.', materiaId: a.materiaId })),
    ...c.temasDebiles.map((t) => ({ tipo: 'repaso', titulo: `Reforzar: ${t.tema}`, descripcion: 'Tema con errores en tus cuestionarios.', materiaId: c.materias[0]?.id })),
  ];
  return {
    titulo: c.tituloPorDefecto,
    resumen: 'Plan de ejemplo generado sin IA (AI_PROVIDER=simulado). Reparte tus pendientes en bloques de 50 minutos con descansos.',
    dias: distribuirSimulado(elementos, c),
    consejos: ['Empieza por lo más urgente.', 'Respeta los descansos.', 'Marca cada actividad al terminarla.'],
  };
}

/* ======================================================================== */

const INTENSIDAD = {
  baja: 'ritmo ligero: menos temas por día, más repaso de lo básico',
  media: 'ritmo equilibrado entre estudio, práctica y repaso',
  alta: 'ritmo intenso: aprovecha todas las horas disponibles, con más práctica y cuestionarios',
};

/**
 * Valida las opciones y reúne todo lo que EduPlan sabe del objetivo elegido:
 * apuntes (los elegidos o los del semestre/bloque), tareas pendientes,
 * exámenes próximos, temas débiles de cuestionarios y tarjetas por repasar.
 */
async function preparar(usuarioId, cuerpo) {
  const op = {
    alcance: 'general', dias: 7, horasPorDia: 3, horaInicio: '18:00', finesDeSemana: true,
    apunteIds: [], temas: [], prioridad: 'media',
    ...validar(cuerpo, {
      alcance: { tipo: 'enum', valores: ALCANCES },
      materiaId: { tipo: 'uuid' },
      examenId: { tipo: 'uuid' },
      periodoId: { tipo: 'uuid' },
      apunteIds: { tipo: 'listaUuid', max: 15 },
      temas: { tipo: 'listaTexto', max: 20, maxLargo: 150 },
      temasPrioridad: { tipo: 'texto', max: 500 },
      prioridad: { tipo: 'enum', valores: ['baja', 'media', 'alta'] },
      dias: { tipo: 'entero', min: 1, max: 30 },
      horasPorDia: { tipo: 'entero', min: 1, max: 8 },
      horaInicio: { tipo: 'hora' },
      finesDeSemana: { tipo: 'booleano' },
    }),
  };

  const desde = f.hoy();
  let hasta = f.sumarDias(desde, op.dias - 1);
  let tareas = [];
  let apuntes = [];
  let materias = [];
  let examen = null;
  let temasDebiles = [];
  let examenes = [];
  let tarjetas = { total: 0, apuntes: [] };
  let enfoque;
  let tituloPorDefecto;
  const seleccion = { apunteIds: op.apunteIds, periodoId: op.periodoId ?? null };

  switch (op.alcance) {
    case 'general':
      tareas = await tareaModel.pendientesParaPlan(usuarioId, op.dias);
      if (!tareas.length) {
        throw new AppError(`No tienes tareas pendientes en los próximos ${op.dias} días`, 422, 'SIN_TAREAS_PENDIENTES');
      }
      [examenes, temasDebiles, tarjetas] = await Promise.all([
        contexto.examenesProximos(usuarioId), contexto.temasDebiles(usuarioId), contexto.tarjetasPendientes(usuarioId),
      ]);
      enfoque = 'organizar todas las tareas pendientes del estudiante.';
      tituloPorDefecto = `Plan de ${op.dias} días`;
      break;

    case 'materia': {
      if (!op.materiaId) throw new AppError('Elige una materia', 400, 'VALIDACION', ['materiaId es obligatorio']);
      const m = await contexto.materia(usuarioId, op.materiaId);
      materias = [m];
      [tareas, apuntes, temasDebiles, examenes, tarjetas] = await Promise.all([
        tareaModel.pendientesParaPlan(usuarioId, op.dias, m.id),
        contexto.apuntesElegidos(usuarioId, m.id, seleccion),
        contexto.temasDebiles(usuarioId, m.id),
        contexto.examenesProximos(usuarioId, m.id),
        contexto.tarjetasPendientes(usuarioId, m.id),
      ]);
      if (!tareas.length && !apuntes.length && !op.temasPrioridad) {
        throw new AppError(`${m.nombre} no tiene tareas pendientes ni apuntes para planificar`, 422, 'SIN_CONTENIDO');
      }
      enfoque = `estudiar la materia ${m.nombre}: sus tareas pendientes y los temas de sus apuntes.`;
      tituloPorDefecto = `Plan de ${m.nombre}`;
      break;
    }

    case 'apuntes':
      if (!op.apunteIds.length) throw new AppError('Elige al menos un apunte', 400, 'VALIDACION', ['apunteIds es obligatorio']);
      apuntes = await contexto.apuntesPorId(usuarioId, op.apunteIds);
      enfoque = 'estudiar y dominar los temas de los apuntes seleccionados (sesiones de estudio, repaso y práctica).';
      tituloPorDefecto = apuntes.length === 1 ? `Estudiar: ${apuntes[0].titulo}` : `Plan de ${apuntes.length} temas`;
      break;

    case 'examen': {
      if (!op.examenId) throw new AppError('Elige un examen', 400, 'VALIDACION', ['examenId es obligatorio']);
      examen = await contexto.examen(usuarioId, op.examenId);
      if (new Date(examen.fecha) <= new Date()) {
        throw new AppError('Ese examen ya pasó', 422, 'EXAMEN_PASADO');
      }
      if (op.temas.length) examen = { ...examen, temas: op.temas.join('\n') };
      const diaExamen = f.fechaLocal(examen.fecha);
      const ultimo = diaExamen > desde ? f.sumarDias(diaExamen, -1) : desde;
      if (ultimo < hasta) hasta = ultimo;
      const m = await contexto.materia(usuarioId, examen.materiaId);
      materias = [m];
      [apuntes, tareas, temasDebiles, tarjetas] = await Promise.all([
        contexto.apuntesElegidos(usuarioId, m.id, seleccion),
        tareaModel.pendientesParaPlan(usuarioId, f.diferenciaDias(desde, hasta) + 1, m.id),
        contexto.temasDebiles(usuarioId, m.id),
        contexto.tarjetasPendientes(usuarioId, m.id),
      ]);
      enfoque = `preparar el examen "${examen.titulo}" de ${m.nombre} con una ruta de estudio, práctica y repaso.`;
      tituloPorDefecto = `Preparación: ${examen.titulo}`;
      break;
    }
    default:
      break;
  }

  // Materias que la IA puede referenciar
  const mapaMaterias = new Map(materias.map((m) => [m.id, m.nombre]));
  for (const t of tareas) mapaMaterias.set(t.materiaId, t.materia);
  for (const a of apuntes) mapaMaterias.set(a.materiaId, a.materia);
  materias = [...mapaMaterias].map(([id, nombre]) => ({ id, nombre }));

  const c = {
    desde, hasta, horaInicio: op.horaInicio, horasPorDia: op.horasPorDia, finesDeSemana: op.finesDeSemana,
    enfoque, tareas, apuntes, materias, examen, temasDebiles, tituloPorDefecto,
    examenesProximos: examenes.filter((e) => e.id !== examen?.id),
    tarjetasPendientes: tarjetas,
    temasPrioridad: op.temasPrioridad ?? null,
    intensidad: INTENSIDAD[op.prioridad],
    apuntesTexto: contexto.textoApuntes(apuntes, 16000),
  };
  const reglas = {
    desde, hasta, finesDeSemana: op.finesDeSemana,
    tareaIds: new Set(tareas.map((t) => t.id)),
    materiaIds: new Set(materias.map((m) => m.id)),
    materiaPorTarea: new Map(tareas.map((t) => [t.id, t.materiaId])),
    materiaFija: ['materia', 'examen'].includes(op.alcance) ? materias[0]?.id : null,
  };
  return { op, c, reglas, examen, tareas, apuntes };
}

/** Pide el plan a la IA y lo valida (no guarda nada). */
async function proponer(p) {
  const datos = await ia.generarJson({
    sistema: prompts.SISTEMA_PLAN,
    mensaje: prompts.mensajePlan(p.c),
    simulado: () => planSimulado(p.c),
  });
  const actividades = normalizarActividades(datos.dias, p.reglas);
  if (!actividades.filter((a) => a.tipo !== 'descanso').length) {
    throw new AppError('La IA no generó actividades válidas, intenta de nuevo', 502, 'IA_RESPUESTA_INVALIDA');
  }
  return {
    titulo: texto(datos.titulo, 200) || p.c.tituloPorDefecto,
    resumen: texto(datos.resumen, 2000) || 'Plan generado por el asistente de EduPlan.',
    consejos: (Array.isArray(datos.consejos) ? datos.consejos : []).map((x) => texto(x, 300)).filter(Boolean).slice(0, 5),
    actividades,
  };
}

async function guardar(usuarioId, p, propuesta) {
  const { op, examen, tareas, apuntes } = p;
  const { actividades } = propuesta;
  return planModel.crear(usuarioId, {
    titulo: propuesta.titulo,
    alcance: op.alcance,
    materiaId: op.alcance === 'materia' ? op.materiaId : examen?.materiaId ?? null,
    examenId: examen?.id ?? null,
    periodoId: op.periodoId ?? null,
    temasPrioridad: op.temasPrioridad ?? (op.temas.length ? op.temas.join('; ').slice(0, 500) : null),
    prioridad: op.prioridad,
    fechaInicio: actividades[0].fecha < p.c.desde ? actividades[0].fecha : p.c.desde,
    fechaFin: actividades[actividades.length - 1].fecha,
    resumen: propuesta.resumen,
    consejos: propuesta.consejos,
    horasPorDia: op.horasPorDia,
    tareaIds: tareas.map((t) => t.id),
    apunteIds: apuntes.map((a) => a.id),
    modeloIa: ia.nombreModelo(),
    actividades,
  });
}

/** POST /api/planes/vista-previa: el estudiante revisa y edita antes de guardar. */
async function vistaPrevia(usuarioId, cuerpo) {
  const p = await preparar(usuarioId, cuerpo);
  const propuesta = await proponer(p);
  return {
    titulo: propuesta.titulo,
    resumen: propuesta.resumen,
    consejos: propuesta.consejos,
    desde: p.c.desde,
    hasta: p.c.hasta,
    dias: agruparPorDia(propuesta.actividades),
  };
}

/**
 * POST /api/planes. Con "propuesta" guarda la vista previa aprobada (y
 * editada) por el estudiante, validándola otra vez; sin ella, genera y guarda.
 */
async function generar(usuarioId, cuerpo) {
  const p = await preparar(usuarioId, cuerpo);
  const enviada = cuerpo?.propuesta;
  if (!enviada) return guardar(usuarioId, p, await proponer(p));

  if (typeof enviada !== 'object' || !Array.isArray(enviada.dias)) {
    throw new AppError('Datos inválidos', 400, 'VALIDACION', ['propuesta.dias debe ser una lista']);
  }
  const actividades = normalizarActividades(enviada.dias, p.reglas);
  if (!actividades.filter((a) => a.tipo !== 'descanso').length) {
    throw new AppError('Datos inválidos', 400, 'VALIDACION', ['La propuesta no tiene actividades válidas']);
  }
  return guardar(usuarioId, p, {
    titulo: texto(enviada.titulo, 200) || p.c.tituloPorDefecto,
    resumen: texto(enviada.resumen, 2000) || 'Plan generado por el asistente de EduPlan.',
    consejos: (Array.isArray(enviada.consejos) ? enviada.consejos : []).map((x) => texto(x, 300)).filter(Boolean).slice(0, 5),
    actividades,
  });
}

const listar = (usuarioId) => planModel.listar(usuarioId);

async function obtener(usuarioId, id) {
  const plan = await planModel.obtener(validarId(id), usuarioId);
  if (!plan) throw new AppError('Plan no encontrado', 404, 'PLAN_NO_ENCONTRADO');
  return plan;
}

async function eliminar(usuarioId, id) {
  if (!(await planModel.eliminar(validarId(id), usuarioId))) {
    throw new AppError('Plan no encontrado', 404, 'PLAN_NO_ENCONTRADO');
  }
}

async function marcarActividad(usuarioId, planId, actividadId, cuerpo) {
  const { completada } = validar(cuerpo, { completada: { tipo: 'booleano', requerido: true } });
  const actividad = await planModel.marcarActividad(validarId(planId), validarId(actividadId, 'actividadId'), usuarioId, completada);
  if (!actividad) throw new AppError('Actividad no encontrada', 404, 'ACTIVIDAD_NO_ENCONTRADA');
  return actividad;
}

/** Datos comunes para proponer y aplicar una reorganización. */
async function prepararReorganizacion(usuarioId, planId) {
  const plan = await obtener(usuarioId, planId);
  const pendientes = plan.actividades.filter((a) => !a.completada && a.tipo !== 'descanso');
  if (!pendientes.length) {
    throw new AppError('Este plan no tiene actividades pendientes que reorganizar', 422, 'NADA_QUE_REORGANIZAR');
  }
  const desde = f.hoy();
  const horasPorDia = plan.horasPorDia || 3;
  const minutosPendientes = pendientes.reduce((s, a) => s + f.aMinutos(a.fin) - f.aMinutos(a.inicio), 0);
  const diasNecesarios = Math.ceil(minutosPendientes / (horasPorDia * 60)) + 1;
  let hasta = plan.fechaFin >= desde ? plan.fechaFin : desde;
  if (f.diferenciaDias(desde, hasta) + 1 < diasNecesarios) hasta = f.sumarDias(desde, Math.min(diasNecesarios, 21) - 1);
  if (plan.examenFecha) {
    const limite = f.sumarDias(f.fechaLocal(plan.examenFecha), -1);
    if (limite >= desde && limite < hasta) hasta = limite;
  }

  // Hora de inicio más usada en el plan
  const conteo = {};
  for (const a of plan.actividades) conteo[a.inicio] = (conteo[a.inicio] || 0) + 1;
  const horaInicio = Object.entries(conteo).sort((x, y) => y[1] - x[1])[0]?.[0] || '18:00';

  const tareasPlan = new Set([...plan.tareasIncluidas, ...plan.actividades.map((a) => a.tareaId).filter(Boolean)]);
  const tareas = (await tareaModel.pendientesParaPlan(usuarioId, 60, plan.materiaId)).filter((t) => tareasPlan.has(t.id));
  const materiaIds = new Set([plan.materiaId, ...plan.actividades.map((a) => a.materiaId), ...tareas.map((t) => t.materiaId)].filter(Boolean));

  return {
    plan, pendientes, desde, hasta, horaInicio, horasPorDia, tareas,
    reglas: {
      desde, hasta,
      tareaIds: new Set(tareas.map((t) => t.id)),
      materiaIds,
      materiaPorTarea: new Map(tareas.map((t) => [t.id, t.materiaId])),
      materiaFija: plan.materiaId,
    },
  };
}

/** Propone una nueva distribución. NO guarda nada. */
async function proponerReorganizacion(usuarioId, planId) {
  const r = await prepararReorganizacion(usuarioId, planId);
  const c = {
    desde: r.desde, hasta: r.hasta, horaInicio: r.horaInicio, horasPorDia: r.horasPorDia,
    plan: r.plan, pendientes: r.pendientes, tareas: r.tareas,
    completadas: r.plan.actividades.filter((a) => a.completada),
  };

  const datos = await ia.generarJson({
    sistema: prompts.SISTEMA_REORGANIZAR,
    mensaje: prompts.mensajeReorganizar(c),
    simulado: () => ({
      resumen: 'Propuesta de ejemplo (AI_PROVIDER=simulado): las actividades pendientes se movieron a partir de hoy.',
      dias: distribuirSimulado(r.pendientes.map((a) => ({ tipo: a.tipo, titulo: a.titulo, descripcion: a.descripcion, tareaId: a.tareaId, materiaId: a.materiaId })),
        { desde: r.desde, hasta: r.hasta, horaInicio: r.horaInicio, horasPorDia: r.horasPorDia, finesDeSemana: true, repetir: false }),
    }),
  });

  const actividades = normalizarActividades(datos.dias, r.reglas);
  if (!actividades.length) {
    throw new AppError('La IA no generó una propuesta válida, intenta de nuevo', 502, 'IA_RESPUESTA_INVALIDA');
  }
  return {
    planId: r.plan.id,
    resumen: texto(datos.resumen, 1000) || 'Propuesta de reorganización.',
    desde: r.desde,
    hasta: r.hasta,
    pendientesAntes: r.pendientes.length,
    dias: agruparPorDia(actividades),
  };
}

/** Guarda la propuesta que el estudiante aprobó. */
async function aplicarReorganizacion(usuarioId, planId, cuerpo) {
  const r = await prepararReorganizacion(usuarioId, planId);
  const dias = Array.isArray(cuerpo?.dias) ? cuerpo.dias : null;
  if (!dias) throw new AppError('Envía la propuesta a aplicar', 400, 'VALIDACION', ['dias es obligatorio']);

  // Se permite un margen extra por si el estudiante aplica la propuesta otro día
  const actividades = normalizarActividades(dias, { ...r.reglas, hasta: f.sumarDias(r.desde, 30) });
  if (!actividades.filter((a) => a.tipo !== 'descanso').length) {
    throw new AppError('La propuesta no tiene actividades válidas', 400, 'VALIDACION');
  }
  return planModel.reemplazarPendientes(r.plan.id, usuarioId, actividades, actividades[actividades.length - 1].fecha);
}

module.exports = {
  generar, vistaPrevia, listar, obtener, eliminar, marcarActividad, proponerReorganizacion, aplicarReorganizacion,
  normalizarActividades,
};
