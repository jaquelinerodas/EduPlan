/** Consultas que combinan varias tablas: alertas y calendario. */
const db = require('../config/db');

async function datosAlertas(usuarioId) {
  const [vencidas, proximas, examenes, atrasadas, sesionesHoy, tarjetas] = await Promise.all([
    db.query(
      `SELECT COUNT(*)::int AS total FROM academico.tareas
        WHERE usuario_id = $1 AND estado <> 'completada' AND fecha_limite < NOW()`,
      [usuarioId]
    ),
    db.query(
      `SELECT t.id, t.titulo, t.fecha_limite AS "fechaLimite", t.prioridad, m.id AS "materiaId", m.nombre AS materia,
              (t.fecha_limite < CURRENT_DATE + 1) AS hoy
         FROM academico.tareas t JOIN academico.materias m ON m.id = t.materia_id
        WHERE t.usuario_id = $1 AND t.estado <> 'completada'
          AND t.fecha_limite >= NOW() AND t.fecha_limite < CURRENT_DATE + 2
        ORDER BY t.fecha_limite LIMIT 10`,
      [usuarioId]
    ),
    db.query(
      `SELECT e.id, e.titulo, e.fecha, m.nombre AS materia, (e.fecha::date - CURRENT_DATE) AS dias
         FROM academico.examenes e JOIN academico.materias m ON m.id = e.materia_id
        WHERE e.usuario_id = $1 AND e.fecha >= NOW() AND e.fecha < CURRENT_DATE + 4
        ORDER BY e.fecha`,
      [usuarioId]
    ),
    db.query(
      `SELECT p.id, COALESCE(p.titulo, 'tu plan de estudio') AS titulo, COUNT(a.id)::int AS total
         FROM academico.plan_actividades a JOIN academico.planes_estudio p ON p.id = a.plan_id
        WHERE a.usuario_id = $1 AND NOT a.completada AND a.tipo <> 'descanso'
          AND a.fecha < CURRENT_DATE AND a.fecha >= CURRENT_DATE - 7
        GROUP BY p.id ORDER BY total DESC`,
      [usuarioId]
    ),
    db.query(
      `SELECT p.id, COALESCE(p.titulo, 'tu plan de estudio') AS titulo, COUNT(a.id)::int AS total,
              to_char(MIN(a.hora_inicio), 'HH24:MI') AS desde
         FROM academico.plan_actividades a JOIN academico.planes_estudio p ON p.id = a.plan_id
        WHERE a.usuario_id = $1 AND NOT a.completada AND a.tipo <> 'descanso' AND a.fecha = CURRENT_DATE
        GROUP BY p.id ORDER BY desde`,
      [usuarioId]
    ),
    db.query(
      `SELECT COUNT(*)::int AS total FROM academico.flashcards
        WHERE usuario_id = $1 AND proximo_repaso <= CURRENT_DATE`,
      [usuarioId]
    ),
  ]);

  return {
    vencidas: vencidas.rows[0].total,
    proximas: proximas.rows,
    examenes: examenes.rows,
    atrasadas: atrasadas.rows,
    sesionesHoy: sesionesHoy.rows,
    tarjetas: tarjetas.rows[0].total,
  };
}

/** Tareas, exámenes y sesiones de estudio entre dos fechas (inclusive). */
async function eventos(usuarioId, desde, hasta) {
  const { rows } = await db.query(
    `SELECT 'tarea' AS tipo, t.id, t.titulo, t.fecha_limite AS inicio, NULL::timestamptz AS fin,
            (t.estado = 'completada') AS completado, t.prioridad::text AS prioridad, t.estado::text AS estado,
            m.id AS "materiaId", m.nombre AS materia, m.color, NULL::uuid AS "planId"
       FROM academico.tareas t JOIN academico.materias m ON m.id = t.materia_id
      WHERE t.usuario_id = $1 AND t.fecha_limite >= $2::date AND t.fecha_limite < $3::date + 1
     UNION ALL
     SELECT 'examen', e.id, e.titulo, e.fecha, NULL, (e.fecha < NOW()), NULL, NULL,
            m.id, m.nombre, m.color, NULL
       FROM academico.examenes e JOIN academico.materias m ON m.id = e.materia_id
      WHERE e.usuario_id = $1 AND e.fecha >= $2::date AND e.fecha < $3::date + 1
     UNION ALL
     SELECT 'sesion', a.id, a.titulo, (a.fecha + a.hora_inicio)::timestamptz, (a.fecha + a.hora_fin)::timestamptz,
            a.completada, NULL, a.tipo::text,
            m.id, m.nombre, m.color, a.plan_id
       FROM academico.plan_actividades a LEFT JOIN academico.materias m ON m.id = a.materia_id
      WHERE a.usuario_id = $1 AND a.tipo <> 'descanso' AND a.fecha BETWEEN $2::date AND $3::date
      ORDER BY inicio`,
    [usuarioId, desde, hasta]
  );
  return rows;
}

module.exports = { datosAlertas, eventos };
