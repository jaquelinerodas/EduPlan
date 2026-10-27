const apunteModel = require('../models/apunte.model');
const AppError = require('../utils/AppError');
const { validar, validarId } = require('../utils/validar');

const ESQUEMA = {
  materiaId: { tipo: 'uuid', requerido: true },
  titulo: { tipo: 'texto', requerido: true, max: 200 },
  contenido: { tipo: 'texto', requerido: true, max: 50000 },
  periodoId: { tipo: 'uuid' },
  favorito: { tipo: 'booleano' },
  etiquetas: { tipo: 'listaTexto', max: 10, maxLargo: 30 },
};

const ESQUEMA_FILTROS = {
  materiaId: { tipo: 'uuid' },
  buscar: { tipo: 'texto', max: 100 },
  etiqueta: { tipo: 'texto', max: 30 },
  vista: { tipo: 'enum', valores: ['todos', 'recientes', 'favoritos', 'repasar'] },
};

const noEncontrado = () => new AppError('Apunte no encontrado', 404, 'APUNTE_NO_ENCONTRADO');

function listar(usuarioId, query = {}) {
  const { periodoId, ...resto } = query;
  const filtros = validar(resto, ESQUEMA_FILTROS);
  // "ninguno" = apuntes sin semestre ni bloque
  if (periodoId === 'ninguno') filtros.periodoId = 'ninguno';
  else if (periodoId) Object.assign(filtros, validar({ periodoId }, { periodoId: { tipo: 'uuid' } }));
  return apunteModel.listar(usuarioId, filtros);
}

const etiquetas = (usuarioId) => apunteModel.etiquetas(usuarioId);

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

module.exports = { listar, obtener, crear, actualizar, eliminar, etiquetas };
