const db = require('../config/db');
const { construirSet } = require('../utils/sql');

const SELECT_TAREA = `
  SELECT t.id, t.titulo, t.descripcion,
         t.fecha_limite  AS "fechaLimite",
         t.prioridad, t.estado,
         t.completada_en AS "completadaEn",
         (t.estado <> 'completada' AND t.fecha_limite < NOW()) AS "vencida",
         t.creado_en AS "creadoEn", t.actualizado_en AS "actualizadoEn",
         m.id AS "materiaId", m.nombre AS "materia", m.color AS "materiaColor"
    FROM academico.tareas t
    JOIN academico.materias m ON m.id = t.materia_id`;

const COLUMNAS = {
  materiaId: 'materia_id',
  titulo: 'titulo',
  descripcion: 'descripcion',
  fechaLimite: 'fecha_limite',
  prioridad: 'prioridad',
  estado: 'estado',
};

/**
 * RF06: filtros opcionales por materia, estado, prioridad y rango de fechas.
 * "hasta" incluye todo ese día (fecha_limite < hasta + 1 día).
 */
async function listar(usuarioId, f = {}) {
  const { rows } = await db.query(
    `${SELECT_TAREA}
      WHERE t.usuario_id = $1
        AND ($2::uuid IS NULL                     OR t.materia_id = $2)
        AND ($3::academico.estado_tarea IS NULL    OR t.estado     = $3)
        AND ($4::academico.prioridad_tarea IS NULL OR t.prioridad  = $4)
        AND ($5::date IS NULL OR t.fecha_limite >= $5::date)
        AND ($6::date IS NULL OR t.fecha_limite <  $6::date + 1)
        AND ($7::boolean IS NULL OR (t.estado <> 'completada' AND t.fecha_limite < NOW()) = $7)
      ORDER BY t.fecha_limite ASC,
               CASE t.prioridad WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END`,
    [
      usuarioId,
      f.materiaId ?? null,
      f.estado ?? null,
      f.prioridad ?? null,
      f.desde ?? null,
      f.hasta ?? null,
      f.vencidas ?? null,
    ]
  );
  return rows;
}

async function obtener(id, usuarioId) {
  const { rows } = await db.query(
    `${SELECT_TAREA} WHERE t.id = $1 AND t.usuario_id = $2`,
    [id, usuarioId]
  );
  return rows[0] || null;
}

async function crear(usuarioId, d) {
  const { rows } = await db.query(
    `INSERT INTO academico.tareas
       (usuario_id, materia_id, titulo, descripcion, fecha_limite, prioridad, estado)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6::academico.prioridad_tarea, 'media'),
             COALESCE($7::academico.estado_tarea, 'pendiente'))
     RETURNING id`,
    [usuarioId, d.materiaId, d.titulo, d.descripcion ?? null, d.fechaLimite, d.prioridad ?? null, d.estado ?? null]
  );
  return obtener(rows[0].id, usuarioId);
}

async function actualizar(id, usuarioId, datos) {
  const { set, valores } = construirSet(datos, COLUMNAS, 3);
  if (!set) return obtener(id, usuarioId);
  const { rowCount } = await db.query(
    `UPDATE academico.tareas SET ${set} WHERE id = $1 AND usuario_id = $2`,
    [id, usuarioId, ...valores]
  );
  return rowCount ? obtener(id, usuarioId) : null;
}

async function eliminar(id, usuarioId) {
  const { rowCount } = await db.query(
    'DELETE FROM academico.tareas WHERE id = $1 AND usuario_id = $2',
    [id, usuarioId]
  );
  return rowCount > 0;
}

/** RF08: tareas no completadas que vencen dentro de los próximos "dias" (incluye vencidas). */
async function pendientesParaPlan(usuarioId, dias, materiaId = null) {
  const { rows } = await db.query(
    `${SELECT_TAREA}
      WHERE t.usuario_id = $1
        AND t.estado <> 'completada'
        AND t.fecha_limite < CURRENT_DATE + $2::int + 1
        AND ($3::uuid IS NULL OR t.materia_id = $3)
      ORDER BY t.fecha_limite ASC,
               CASE t.prioridad WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END
      LIMIT 40`,
    [usuarioId, dias, materiaId]
  );
  return rows;
}

module.exports = { listar, obtener, crear, actualizar, eliminar, pendientesParaPlan };
