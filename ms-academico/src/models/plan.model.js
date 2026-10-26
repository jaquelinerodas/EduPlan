const db = require('../config/db');

const SELECT_PLAN = `
  SELECT p.id, p.titulo, p.alcance,
         to_char(p.fecha_inicio, 'YYYY-MM-DD') AS "fechaInicio",
         to_char(p.fecha_fin, 'YYYY-MM-DD')    AS "fechaFin",
         p.contenido AS "resumen", p.consejos,
         p.horas_por_dia     AS "horasPorDia",
         p.tareas_incluidas  AS "tareasIncluidas",
         p.apuntes_incluidos AS "apuntesIncluidos",
         p.modelo_ia AS "modeloIa", p.creado_en AS "creadoEn", p.reorganizado_en AS "reorganizadoEn",
         p.materia_id AS "materiaId", m.nombre AS "materia", m.color AS "materiaColor",
         p.examen_id AS "examenId", e.titulo AS "examen", e.fecha AS "examenFecha",
         COUNT(a.id) FILTER (WHERE a.tipo <> 'descanso')::int                     AS "totalActividades",
         COUNT(a.id) FILTER (WHERE a.tipo <> 'descanso' AND a.completada)::int    AS "completadas",
         COUNT(a.id) FILTER (WHERE a.tipo <> 'descanso' AND NOT a.completada
                               AND a.fecha < CURRENT_DATE)::int                   AS "atrasadas"
    FROM academico.planes_estudio p
    LEFT JOIN academico.materias m ON m.id = p.materia_id
    LEFT JOIN academico.examenes e ON e.id = p.examen_id
    LEFT JOIN academico.plan_actividades a ON a.plan_id = p.id`;

const GROUP_PLAN = ' GROUP BY p.id, m.id, e.id';

const SELECT_ACTIVIDAD = `
  SELECT a.id, to_char(a.fecha, 'YYYY-MM-DD') AS fecha,
         to_char(a.hora_inicio, 'HH24:MI') AS inicio, to_char(a.hora_fin, 'HH24:MI') AS fin,
         a.tipo, a.titulo, a.descripcion, a.completada, a.completada_en AS "completadaEn",
         a.tarea_id AS "tareaId", t.titulo AS "tarea",
         a.materia_id AS "materiaId", m.nombre AS "materia", m.color AS "materiaColor"
    FROM academico.plan_actividades a
    LEFT JOIN academico.tareas t   ON t.id = a.tarea_id
    LEFT JOIN academico.materias m ON m.id = a.materia_id`;

async function insertarActividades(cliente, planId, usuarioId, actividades) {
  for (const a of actividades) {
    await cliente.query(
      `INSERT INTO academico.plan_actividades
         (plan_id, usuario_id, fecha, hora_inicio, hora_fin, tipo, titulo, descripcion, materia_id, tarea_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [planId, usuarioId, a.fecha, a.inicio, a.fin, a.tipo, a.titulo, a.descripcion ?? null, a.materiaId ?? null, a.tareaId ?? null]
    );
  }
}

/** Guarda el plan y todas sus actividades en una sola transacción. */
async function crear(usuarioId, p) {
  const id = await db.transaccion(async (cliente) => {
    const { rows } = await cliente.query(
      `INSERT INTO academico.planes_estudio
         (usuario_id, titulo, alcance, materia_id, examen_id, fecha_inicio, fecha_fin, contenido,
          consejos, horas_por_dia, tareas_incluidas, apuntes_incluidos, modelo_ia)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::uuid[], $12::uuid[], $13)
       RETURNING id`,
      [usuarioId, p.titulo, p.alcance, p.materiaId ?? null, p.examenId ?? null, p.fechaInicio, p.fechaFin,
        p.resumen, p.consejos, p.horasPorDia, p.tareaIds, p.apunteIds, p.modeloIa]
    );
    await insertarActividades(cliente, rows[0].id, usuarioId, p.actividades);
    return rows[0].id;
  });
  return obtener(id, usuarioId);
}

async function listar(usuarioId) {
  const { rows } = await db.query(
    `${SELECT_PLAN} WHERE p.usuario_id = $1 ${GROUP_PLAN} ORDER BY p.creado_en DESC LIMIT 30`,
    [usuarioId]
  );
  return rows;
}

async function obtener(id, usuarioId) {
  const { rows } = await db.query(`${SELECT_PLAN} WHERE p.id = $1 AND p.usuario_id = $2 ${GROUP_PLAN}`, [id, usuarioId]);
  if (!rows[0]) return null;
  return { ...rows[0], actividades: await actividades(id, usuarioId) };
}

async function actividades(planId, usuarioId) {
  const { rows } = await db.query(
    `${SELECT_ACTIVIDAD} WHERE a.plan_id = $1 AND a.usuario_id = $2 ORDER BY a.fecha, a.hora_inicio`,
    [planId, usuarioId]
  );
  return rows;
}

async function marcarActividad(planId, actividadId, usuarioId, completada) {
  const { rows } = await db.query(
    `UPDATE academico.plan_actividades
        SET completada = $4, completada_en = CASE WHEN $4 THEN NOW() END
      WHERE id = $1 AND plan_id = $2 AND usuario_id = $3
      RETURNING id`,
    [actividadId, planId, usuarioId, completada]
  );
  if (!rows[0]) return null;
  const { rows: act } = await db.query(`${SELECT_ACTIVIDAD} WHERE a.id = $1`, [actividadId]);
  return act[0];
}

/** Reorganización: borra lo no completado y guarda la nueva distribución. */
async function reemplazarPendientes(planId, usuarioId, nuevas, fechaFin) {
  await db.transaccion(async (cliente) => {
    await cliente.query(
      'DELETE FROM academico.plan_actividades WHERE plan_id = $1 AND usuario_id = $2 AND NOT completada',
      [planId, usuarioId]
    );
    await insertarActividades(cliente, planId, usuarioId, nuevas);
    await cliente.query(
      `UPDATE academico.planes_estudio
          SET reorganizado_en = NOW(), fecha_fin = GREATEST(fecha_fin, $3::date)
        WHERE id = $1 AND usuario_id = $2`,
      [planId, usuarioId, fechaFin]
    );
  });
  return obtener(planId, usuarioId);
}

async function eliminar(id, usuarioId) {
  const { rowCount } = await db.query('DELETE FROM academico.planes_estudio WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  return rowCount > 0;
}

module.exports = { crear, listar, obtener, actividades, marcarActividad, reemplazarPendientes, eliminar };
