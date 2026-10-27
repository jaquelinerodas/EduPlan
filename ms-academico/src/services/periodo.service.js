/**
 * Semestres, bloques o carpetas con los que el estudiante organiza sus
 * materias y apuntes.
 */
const periodoModel = require('../models/periodo.model');
const AppError = require('../utils/AppError');
const { validar, validarId } = require('../utils/validar');

const ESQUEMA = {
  nombre: { tipo: 'texto', requerido: true, max: 80 },
  tipo: { tipo: 'enum', valores: ['semestre', 'bloque', 'carpeta'] },
  orden: { tipo: 'entero', min: 0, max: 999 },
};

const noEncontrado = () => new AppError('Semestre o bloque no encontrado', 404, 'PERIODO_NO_ENCONTRADO');

const listar = (usuarioId) => periodoModel.listar(usuarioId);

function crear(usuarioId, cuerpo) {
  return periodoModel.crear(usuarioId, validar(cuerpo, ESQUEMA));
}

async function actualizar(usuarioId, id, cuerpo) {
  const p = await periodoModel.actualizar(validarId(id), usuarioId, validar(cuerpo, ESQUEMA, { parcial: true }));
  if (!p) throw noEncontrado();
  return p;
}

async function eliminar(usuarioId, id) {
  if (!(await periodoModel.eliminar(validarId(id), usuarioId))) throw noEncontrado();
}

module.exports = { listar, crear, actualizar, eliminar };
