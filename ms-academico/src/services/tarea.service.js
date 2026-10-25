const tareaModel = require('../models/tarea.model');
const AppError = require('../utils/AppError');
const { validar, validarId } = require('../utils/validar');

const PRIORIDADES = ['baja', 'media', 'alta'];
const ESTADOS = ['pendiente', 'en_progreso', 'completada'];

const ESQUEMA = {
  materiaId: { tipo: 'uuid', requerido: true },
  titulo: { tipo: 'texto', requerido: true, max: 200 },
  descripcion: { tipo: 'texto', max: 5000 },
  fechaLimite: { tipo: 'fechaHora', requerido: true },
  prioridad: { tipo: 'enum', valores: PRIORIDADES },
  estado: { tipo: 'enum', valores: ESTADOS },
};

const ESQUEMA_FILTROS = {
  materiaId: { tipo: 'uuid' },
  estado: { tipo: 'enum', valores: ESTADOS },
  prioridad: { tipo: 'enum', valores: PRIORIDADES },
  desde: { tipo: 'fecha' },
  hasta: { tipo: 'fecha' },
  vencidas: { tipo: 'enum', valores: ['true', 'false'] },
};

const noEncontrada = () => new AppError('Tarea no encontrada', 404, 'TAREA_NO_ENCONTRADA');

/** RF06: GET /api/tareas?materiaId=&estado=&prioridad=&desde=&hasta=&vencidas= */
function listar(usuarioId, query) {
  const filtros = validar(query, ESQUEMA_FILTROS);
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
    throw new AppError('Datos inválidos', 400, 'VALIDACION', ['desde no puede ser mayor que hasta']);
  }
  if (filtros.vencidas !== undefined) filtros.vencidas = filtros.vencidas === 'true';
  return tareaModel.listar(usuarioId, filtros);
}

async function obtener(usuarioId, id) {
  const tarea = await tareaModel.obtener(validarId(id), usuarioId);
  if (!tarea) throw noEncontrada();
  return tarea;
}

function crear(usuarioId, cuerpo) {
  return tareaModel.crear(usuarioId, validar(cuerpo, ESQUEMA));
}

async function actualizar(usuarioId, id, cuerpo) {
  const datos = validar(cuerpo, ESQUEMA, { parcial: true });
  const tarea = await tareaModel.actualizar(validarId(id), usuarioId, datos);
  if (!tarea) throw noEncontrada();
  return tarea;
}

/** HU04: marcar como completada (o regresarla a pendiente/en progreso). */
function cambiarEstado(usuarioId, id, cuerpo) {
  const { estado } = validar(cuerpo, { estado: { tipo: 'enum', valores: ESTADOS, requerido: true } });
  return actualizar(usuarioId, id, { estado });
}

async function eliminar(usuarioId, id) {
  const borrada = await tareaModel.eliminar(validarId(id), usuarioId);
  if (!borrada) throw noEncontrada();
}

module.exports = { listar, obtener, crear, actualizar, cambiarEstado, eliminar };
