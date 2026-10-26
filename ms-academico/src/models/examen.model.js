const db = require('../config/db');
const { construirSet } = require('../utils/sql');

const SELECT_EXAMEN = `
  SELECT e.id, e.titulo, e.fecha, e.temas, e.notas,
         e.creado_en AS "creadoEn", e.actualizado_en AS "actualizadoEn",
         m.id AS "materiaId", m.nombre AS "materia", m.color AS "materiaColor",
         (SELECT COUNT(*)::int FROM academico.cuestionarios c
           WHERE c.examen_id = e.id) AS "cuestionarios",
         (SELECT MAX(i.puntaje)::float FROM academico.cuestionario_intentos i
            JOIN academico.cuestionarios c ON c.id = i.cuestionario_id
           WHERE c.examen_id = e.id) AS "mejorPuntaje",
         (SELECT p.id FROM academico.planes_estudio p
           WHERE p.examen_id = e.id ORDER BY p.creado_en DESC LIMIT 1) AS "planId"
    FROM academico.examenes e
    JOIN academico.materias m ON m.id = e.materia_id`;

const COLUMNAS = { materiaId: 'materia_id', titulo: 'titulo', fecha: 'fecha', temas: 'temas', notas: 'notas' };

async function listar(usuarioId, { materiaId, periodo } = {}) {
  const { rows } = await db.query(
    `${SELECT_EXAMEN}
      WHERE e.usuario_id = $1
        AND ($2::uuid IS NULL OR e.materia_id = $2)
        AND ($3::text IS NULL
             OR ($3 = 'proximos' AND e.fecha >= NOW())
             OR ($3 = 'pasados'  AND e.fecha <  NOW()))
      ORDER BY (e.fecha < NOW()), CASE WHEN e.fecha >= NOW() THEN e.fecha END ASC, e.fecha DESC`,
    [usuarioId, materiaId ?? null, periodo ?? null]
  );
  return rows;
}

async function obtener(id, usuarioId) {
  const { rows } = await db.query(`${SELECT_EXAMEN} WHERE e.id = $1 AND e.usuario_id = $2`, [id, usuarioId]);
  return rows[0] || null;
}

async function crear(usuarioId, d) {
  const { rows } = await db.query(
    `INSERT INTO academico.examenes (usuario_id, materia_id, titulo, fecha, temas, notas)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [usuarioId, d.materiaId, d.titulo, d.fecha, d.temas ?? null, d.notas ?? null]
  );
  return obtener(rows[0].id, usuarioId);
}

async function actualizar(id, usuarioId, datos) {
  const { set, valores } = construirSet(datos, COLUMNAS, 3);
  if (!set) return obtener(id, usuarioId);
  const { rowCount } = await db.query(
    `UPDATE academico.examenes SET ${set} WHERE id = $1 AND usuario_id = $2`,
    [id, usuarioId, ...valores]
  );
  return rowCount ? obtener(id, usuarioId) : null;
}

async function eliminar(id, usuarioId) {
  const { rowCount } = await db.query('DELETE FROM academico.examenes WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  return rowCount > 0;
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
