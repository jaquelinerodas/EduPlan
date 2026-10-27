/**
 * Contexto de estudio: reúne en una sola respuesta lo que EduPlan sabe de una
 * materia o examen (apuntes, tareas, exámenes, temas débiles y tarjetas).
 * El frontend lo usa para que el estudiante elija temas y vea qué información
 * tomará en cuenta la IA antes de generar un plan o un cuestionario.
 */
const contexto = require('./ia/contexto');
const apunteModel = require('../models/apunte.model');
const tareaModel = require('../models/tarea.model');
const { validar } = require('../utils/validar');

async function obtener(usuarioId, query) {
  const op = validar(query, {
    materiaId: { tipo: 'uuid' },
    examenId: { tipo: 'uuid' },
    dias: { tipo: 'entero', min: 1, max: 60 },
  });

  let examen = null;
  let materiaId = op.materiaId ?? null;
  if (op.examenId) {
    const e = await contexto.examen(usuarioId, op.examenId);
    examen = { id: e.id, titulo: e.titulo, fecha: e.fecha, materiaId: e.materiaId, materia: e.materia, temas: contexto.temasDeTexto(e.temas) };
    materiaId = e.materiaId;
  }
  const materia = materiaId ? await contexto.materia(usuarioId, materiaId) : null;

  const [apuntes, tareas, examenes, temasDebiles, tarjetas] = await Promise.all([
    materiaId ? apunteModel.listar(usuarioId, { materiaId }) : [],
    tareaModel.pendientesParaPlan(usuarioId, op.dias ?? 14, materiaId),
    contexto.examenesProximos(usuarioId, materiaId),
    contexto.temasDebiles(usuarioId, materiaId),
    contexto.tarjetasPendientes(usuarioId, materiaId),
  ]);

  const periodos = new Map();
  for (const a of apuntes) if (a.periodoId) periodos.set(a.periodoId, a.periodo);

  return {
    materia,
    examen,
    apuntes: apuntes.map((a) => ({
      id: a.id, titulo: a.titulo, periodoId: a.periodoId, periodo: a.periodo,
      actualizadoEn: a.actualizadoEn, recomendado: a.recomendado, tarjetasPendientes: a.tarjetasPendientes,
    })),
    periodos: [...periodos].map(([id, nombre]) => ({ id, nombre })),
    tareasPendientes: tareas.map((t) => ({
      id: t.id, titulo: t.titulo, fechaLimite: t.fechaLimite, prioridad: t.prioridad, vencida: t.vencida, materia: t.materia,
    })),
    examenesProximos: examenes.map((e) => ({ id: e.id, titulo: e.titulo, fecha: e.fecha, materia: e.materia })),
    temasDebiles,
    tarjetasPendientes: tarjetas.total,
  };
}

module.exports = { obtener };
