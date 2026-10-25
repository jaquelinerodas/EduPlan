const db = require('../config/db');

/** Números para el panel principal del frontend. */
async function estadisticas(usuarioId) {
  const { rows } = await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM academico.materias WHERE usuario_id = $1) AS "materias",
       (SELECT COUNT(*)::int FROM academico.apuntes  WHERE usuario_id = $1) AS "apuntes",
       COUNT(*)::int                                                         AS "tareas",
       COUNT(*) FILTER (WHERE estado = 'pendiente')::int                     AS "pendientes",
       COUNT(*) FILTER (WHERE estado = 'en_progreso')::int                   AS "enProgreso",
       COUNT(*) FILTER (WHERE estado = 'completada')::int                    AS "completadas",
       COUNT(*) FILTER (WHERE estado <> 'completada' AND fecha_limite < NOW())::int AS "vencidas",
       COUNT(*) FILTER (WHERE estado <> 'completada'
                          AND fecha_limite >= NOW()
                          AND fecha_limite < NOW() + INTERVAL '7 days')::int AS "proximos7Dias"
     FROM academico.tareas
     WHERE usuario_id = $1`,
    [usuarioId]
  );
  return rows[0];
}

module.exports = { estadisticas };
