const examenModel = require('../models/examen.model');
const AppError = require('../utils/AppError');
const { validar, validarId } = require('../utils/validar');

const ESQUEMA = {
  materiaId: { tipo: 'uuid', requerido: true },
  titulo: { tipo: 'texto', requerido: true, max: 200 },
  fecha: { tipo: 'fechaHora', requerido: true },
  temas: { tipo: 'texto', max: 5000 },
  notas: { tipo: 'texto', max: 5000 },
};

const noEncontrado = () => new AppError('Examen no encontrado', 404, 'EXAMEN_NO_ENCONTRADO');

function listar(usuarioId, query) {
  return examenModel.listar(usuarioId, validar(query, {
    materiaId: { tipo: 'uuid' },
    periodo: { tipo: 'enum', valores: ['proximos', 'pasados'] },
  }));
}

async function obtener(usuarioId, id) {
  const examen = await examenModel.obtener(validarId(id), usuarioId);
  if (!examen) throw noEncontrado();
  return examen;
}

const crear = (usuarioId, cuerpo) => examenModel.crear(usuarioId, validar(cuerpo, ESQUEMA));

async function actualizar(usuarioId, id, cuerpo) {
  const examen = await examenModel.actualizar(validarId(id), usuarioId, validar(cuerpo, ESQUEMA, { parcial: true }));
  if (!examen) throw noEncontrado();
  return examen;
}

async function eliminar(usuarioId, id) {
  if (!(await examenModel.eliminar(validarId(id), usuarioId))) throw noEncontrado();
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
