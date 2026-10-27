const materiaModel = require('../models/materia.model');
const AppError = require('../utils/AppError');
const { validar, validarId } = require('../utils/validar');

const ESQUEMA = {
  nombre: { tipo: 'texto', requerido: true, max: 120 },
  docente: { tipo: 'texto', max: 120 },
  descripcion: { tipo: 'texto', max: 2000 },
  color: { tipo: 'color' },
  periodoId: { tipo: 'uuid' },
};

const noEncontrada = () => new AppError('Materia no encontrada', 404, 'MATERIA_NO_ENCONTRADA');

const listar = (usuarioId) => materiaModel.listar(usuarioId);

async function obtener(usuarioId, id) {
  const materia = await materiaModel.obtener(validarId(id), usuarioId);
  if (!materia) throw noEncontrada();
  return materia;
}

function crear(usuarioId, cuerpo) {
  return materiaModel.crear(usuarioId, validar(cuerpo, ESQUEMA));
}

async function actualizar(usuarioId, id, cuerpo) {
  const datos = validar(cuerpo, ESQUEMA, { parcial: true });
  const materia = await materiaModel.actualizar(validarId(id), usuarioId, datos);
  if (!materia) throw noEncontrada();
  return materia;
}

async function eliminar(usuarioId, id) {
  const borrada = await materiaModel.eliminar(validarId(id), usuarioId);
  if (!borrada) throw noEncontrada();
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
