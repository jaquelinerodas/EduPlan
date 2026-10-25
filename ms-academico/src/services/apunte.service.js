const apunteModel = require('../models/apunte.model');
const AppError = require('../utils/AppError');
const { validar, validarId } = require('../utils/validar');

const ESQUEMA = {
  materiaId: { tipo: 'uuid', requerido: true },
  titulo: { tipo: 'texto', requerido: true, max: 200 },
  contenido: { tipo: 'texto', requerido: true, max: 50000 },
};

const ESQUEMA_FILTROS = {
  materiaId: { tipo: 'uuid' },
  buscar: { tipo: 'texto', max: 100 },
};

const noEncontrado = () => new AppError('Apunte no encontrado', 404, 'APUNTE_NO_ENCONTRADO');

function listar(usuarioId, query) {
  return apunteModel.listar(usuarioId, validar(query, ESQUEMA_FILTROS));
}

async function obtener(usuarioId, id) {
  const apunte = await apunteModel.obtener(validarId(id), usuarioId);
  if (!apunte) throw noEncontrado();
  return apunte;
}

function crear(usuarioId, cuerpo) {
  return apunteModel.crear(usuarioId, validar(cuerpo, ESQUEMA));
}

async function actualizar(usuarioId, id, cuerpo) {
  const datos = validar(cuerpo, ESQUEMA, { parcial: true });
  const apunte = await apunteModel.actualizar(validarId(id), usuarioId, datos);
  if (!apunte) throw noEncontrado();
  return apunte;
}

async function eliminar(usuarioId, id) {
  const borrado = await apunteModel.eliminar(validarId(id), usuarioId);
  if (!borrado) throw noEncontrado();
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
