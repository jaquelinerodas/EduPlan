const db = require('../config/db');
const { construirSet } = require('../utils/sql');

// Todas las consultas filtran por usuario_id (RF09)
const SELECT_MATERIA = `
  SELECT m.id, m.nombre, m.docente, m.descripcion, m.color,
         m.periodo_id AS "periodoId", pe.nombre AS "periodo",
         m.creado_en AS "creadoEn", m.actualizado_en AS "actualizadoEn",
         r.total_tareas::int AS "totalTareas",
         r.pendientes::int   AS "pendientes",
         r.en_progreso::int  AS "enProgreso",
         r.completadas::int  AS "completadas",
         r.vencidas::int     AS "vencidas",
         r.proxima_entrega   AS "proximaEntrega",
         (SELECT COUNT(*)::int FROM academico.apuntes a WHERE a.materia_id = m.id)    AS "totalApuntes",
         (SELECT COUNT(*)::int FROM academico.flashcards f WHERE f.materia_id = m.id) AS "totalTarjetas",
         (SELECT json_build_object('id', e.id, 'titulo', e.titulo, 'fecha', e.fecha)
            FROM academico.examenes e
           WHERE e.materia_id = m.id AND e.fecha >= NOW()
           ORDER BY e.fecha LIMIT 1)                                                   AS "proximoExamen"
    FROM academico.materias m
    JOIN academico.v_resumen_materias r ON r.materia_id = m.id
    LEFT JOIN academico.periodos pe ON pe.id = m.periodo_id`;

const COLUMNAS = { nombre: 'nombre', docente: 'docente', descripcion: 'descripcion', color: 'color', periodoId: 'periodo_id' };

async function listar(usuarioId) {
  const { rows } = await db.query(
    `${SELECT_MATERIA} WHERE m.usuario_id = $1 ORDER BY lower(m.nombre)`,
    [usuarioId]
  );
  return rows;
}

async function obtener(id, usuarioId) {
  const { rows } = await db.query(
    `${SELECT_MATERIA} WHERE m.id = $1 AND m.usuario_id = $2`,
    [id, usuarioId]
  );
  return rows[0] || null;
}

async function crear(usuarioId, datos) {
  const { rows } = await db.query(
    `INSERT INTO academico.materias (usuario_id, nombre, docente, descripcion, color, periodo_id)
     VALUES ($1, $2, $3, $4, COALESCE($5, '#3B82F6'), $6)
     RETURNING id`,
    [usuarioId, datos.nombre, datos.docente ?? null, datos.descripcion ?? null, datos.color ?? null, datos.periodoId ?? null]
  );
  return obtener(rows[0].id, usuarioId);
}

async function actualizar(id, usuarioId, datos) {
  const { set, valores } = construirSet(datos, COLUMNAS, 3);
  if (!set) return obtener(id, usuarioId);
  const { rowCount } = await db.query(
    `UPDATE academico.materias SET ${set} WHERE id = $1 AND usuario_id = $2`,
    [id, usuarioId, ...valores]
  );
  return rowCount ? obtener(id, usuarioId) : null;
}

async function eliminar(id, usuarioId) {
  const { rowCount } = await db.query(
    'DELETE FROM academico.materias WHERE id = $1 AND usuario_id = $2',
    [id, usuarioId]
  );
  return rowCount > 0;
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
