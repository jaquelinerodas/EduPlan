const apunteModel = require('../models/apunte.model');
const tareaModel = require('../models/tarea.model');
const planModel = require('../models/plan.model');
const ia = require('./ia/proveedores');
const prompts = require('./ia/prompts');
const AppError = require('../utils/AppError');
const { validar, validarId } = require('../utils/validar');

/** RF07 / HU07: genera el resumen de un apunte y lo guarda. */
async function resumirApunte(usuarioId, apunteId) {
  const id = validarId(apunteId, 'apunteId');
  const apunte = await apunteModel.obtener(id, usuarioId);
  if (!apunte) throw new AppError('Apunte no encontrado', 404, 'APUNTE_NO_ENCONTRADO');

  const resumen = await ia.generarTexto({
    sistema: prompts.SISTEMA_RESUMEN,
    mensaje: prompts.mensajeResumen(apunte),
  });
  return apunteModel.guardarResumen(id, usuarioId, resumen);
}

/** RF08 / HU08: sugiere un plan de estudio con las tareas pendientes. */
async function generarPlan(usuarioId, cuerpo) {
  const opciones = {
    dias: 7,
    horasPorDia: 3,
    ...validar(cuerpo, {
      dias: { tipo: 'entero', min: 1, max: 30 },
      horasPorDia: { tipo: 'entero', min: 1, max: 12 },
    }),
  };

  const tareas = await tareaModel.pendientesParaPlan(usuarioId, opciones.dias);
  if (tareas.length === 0) {
    throw new AppError(
      `No tienes tareas pendientes en los próximos ${opciones.dias} días`,
      422,
      'SIN_TAREAS_PENDIENTES'
    );
  }

  const contenido = await ia.generarTexto({
    sistema: prompts.SISTEMA_PLAN,
    mensaje: prompts.mensajePlan(tareas, opciones),
  });

  return planModel.crear(usuarioId, {
    dias: opciones.dias,
    contenido,
    tareasIncluidas: tareas.map((t) => t.id),
    modeloIa: ia.nombreModelo(),
  });
}

const listarPlanes = (usuarioId) => planModel.listar(usuarioId);

async function obtenerPlan(usuarioId, id) {
  const plan = await planModel.obtener(validarId(id), usuarioId);
  if (!plan) throw new AppError('Plan no encontrado', 404, 'PLAN_NO_ENCONTRADO');
  return plan;
}

async function eliminarPlan(usuarioId, id) {
  const borrado = await planModel.eliminar(validarId(id), usuarioId);
  if (!borrado) throw new AppError('Plan no encontrado', 404, 'PLAN_NO_ENCONTRADO');
}

module.exports = { resumirApunte, generarPlan, listarPlanes, obtenerPlan, eliminarPlan };
