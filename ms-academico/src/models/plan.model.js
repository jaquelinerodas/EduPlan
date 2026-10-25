const db = require('../config/db');

const SELECT_PLAN = `
  SELECT id,
         to_char(fecha_inicio, 'YYYY-MM-DD') AS "fechaInicio",
         to_char(fecha_fin, 'YYYY-MM-DD')    AS "fechaFin",
         contenido,
         tareas_incluidas AS "tareasIncluidas",
         modelo_ia        AS "modeloIa",
         creado_en        AS "creadoEn"
    FROM academico.planes_estudio`;

async function crear(usuarioId, { dias, contenido, tareasIncluidas, modeloIa }) {
  const { rows } = await db.query(
    `INSERT INTO academico.planes_estudio
       (usuario_id, fecha_inicio, fecha_fin, contenido, tareas_incluidas, modelo_ia)
     VALUES ($1, CURRENT_DATE, CURRENT_DATE + $2::int, $3, $4::uuid[], $5)
     RETURNING id`,
    [usuarioId, dias, contenido, tareasIncluidas, modeloIa]
  );
  return obtener(rows[0].id, usuarioId);
}

async function listar(usuarioId) {
  const { rows } = await db.query(
    `${SELECT_PLAN} WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT 20`,
    [usuarioId]
  );
  return rows;
}

async function obtener(id, usuarioId) {
  const { rows } = await db.query(
    `${SELECT_PLAN} WHERE id = $1 AND usuario_id = $2`,
    [id, usuarioId]
  );
  return rows[0] || null;
}

async function eliminar(id, usuarioId) {
  const { rowCount } = await db.query(
    'DELETE FROM academico.planes_estudio WHERE id = $1 AND usuario_id = $2',
    [id, usuarioId]
  );
  return rowCount > 0;
}

module.exports = { crear, listar, obtener, eliminar };
