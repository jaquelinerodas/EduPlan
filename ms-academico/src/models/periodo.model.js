const db = require('../config/db');
const { construirSet } = require('../utils/sql');

const SELECT_PERIODO = `
  SELECT p.id, p.nombre, p.tipo, p.orden, p.creado_en AS "creadoEn",
         (SELECT COUNT(*)::int FROM academico.materias m WHERE m.periodo_id = p.id) AS "totalMaterias",
         (SELECT COUNT(*)::int FROM academico.apuntes a  WHERE a.periodo_id = p.id) AS "totalApuntes"
    FROM academico.periodos p`;

const COLUMNAS = { nombre: 'nombre', tipo: 'tipo', orden: 'orden' };

async function listar(usuarioId) {
  const { rows } = await db.query(
    `${SELECT_PERIODO} WHERE p.usuario_id = $1 ORDER BY p.orden, p.creado_en`,
    [usuarioId]
  );
  return rows;
}

async function obtener(id, usuarioId) {
  const { rows } = await db.query(`${SELECT_PERIODO} WHERE p.id = $1 AND p.usuario_id = $2`, [id, usuarioId]);
  return rows[0] || null;
}

async function crear(usuarioId, d) {
  const { rows } = await db.query(
    `INSERT INTO academico.periodos (usuario_id, nombre, tipo, orden)
     VALUES ($1, $2, COALESCE($3, 'semestre'),
             COALESCE($4, (SELECT COALESCE(MAX(orden), 0) + 1 FROM academico.periodos WHERE usuario_id = $1)))
     RETURNING id`,
    [usuarioId, d.nombre, d.tipo ?? null, d.orden ?? null]
  );
  return obtener(rows[0].id, usuarioId);
}

async function actualizar(id, usuarioId, datos) {
  const { set, valores } = construirSet(datos, COLUMNAS, 3);
  if (!set) return obtener(id, usuarioId);
  const { rowCount } = await db.query(
    `UPDATE academico.periodos SET ${set} WHERE id = $1 AND usuario_id = $2`,
    [id, usuarioId, ...valores]
  );
  return rowCount ? obtener(id, usuarioId) : null;
}

/** Al eliminar, las materias y apuntes quedan "sin semestre" (no se borran). */
async function eliminar(id, usuarioId) {
  const { rowCount } = await db.query('DELETE FROM academico.periodos WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  return rowCount > 0;
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
