const db = require('../config/db');
const { construirSet } = require('../utils/sql');

const SELECT_APUNTE = `
  SELECT a.id, a.titulo, a.contenido,
         a.resumen_ia          AS "resumenIa",
         a.resumen_generado_en AS "resumenGeneradoEn",
         a.creado_en AS "creadoEn", a.actualizado_en AS "actualizadoEn",
         m.id AS "materiaId", m.nombre AS "materia", m.color AS "materiaColor"
    FROM academico.apuntes a
    JOIN academico.materias m ON m.id = a.materia_id`;

const COLUMNAS = { materiaId: 'materia_id', titulo: 'titulo', contenido: 'contenido' };

async function listar(usuarioId, { materiaId, buscar } = {}) {
  const { rows } = await db.query(
    `${SELECT_APUNTE}
      WHERE a.usuario_id = $1
        AND ($2::uuid IS NULL OR a.materia_id = $2)
        AND ($3::text IS NULL OR a.titulo ILIKE '%' || $3 || '%' OR a.contenido ILIKE '%' || $3 || '%')
      ORDER BY a.actualizado_en DESC`,
    [usuarioId, materiaId ?? null, buscar ?? null]
  );
  return rows;
}

async function obtener(id, usuarioId) {
  const { rows } = await db.query(
    `${SELECT_APUNTE} WHERE a.id = $1 AND a.usuario_id = $2`,
    [id, usuarioId]
  );
  return rows[0] || null;
}

async function crear(usuarioId, d) {
  const { rows } = await db.query(
    `INSERT INTO academico.apuntes (usuario_id, materia_id, titulo, contenido)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [usuarioId, d.materiaId, d.titulo, d.contenido]
  );
  return obtener(rows[0].id, usuarioId);
}

async function actualizar(id, usuarioId, datos) {
  const { set, valores } = construirSet(datos, COLUMNAS, 3);
  if (!set) return obtener(id, usuarioId);
  // Si cambia el contenido, el resumen anterior ya no corresponde y se borra
  const limpiarResumen = datos.contenido !== undefined
    ? ', resumen_ia = NULL, resumen_generado_en = NULL'
    : '';
  const { rowCount } = await db.query(
    `UPDATE academico.apuntes SET ${set}${limpiarResumen} WHERE id = $1 AND usuario_id = $2`,
    [id, usuarioId, ...valores]
  );
  return rowCount ? obtener(id, usuarioId) : null;
}

async function eliminar(id, usuarioId) {
  const { rowCount } = await db.query(
    'DELETE FROM academico.apuntes WHERE id = $1 AND usuario_id = $2',
    [id, usuarioId]
  );
  return rowCount > 0;
}

async function guardarResumen(id, usuarioId, resumen) {
  await db.query(
    `UPDATE academico.apuntes SET resumen_ia = $3, resumen_generado_en = NOW()
      WHERE id = $1 AND usuario_id = $2`,
    [id, usuarioId, resumen]
  );
  return obtener(id, usuarioId);
}

module.exports = { listar, obtener, crear, actualizar, eliminar, guardarResumen };
