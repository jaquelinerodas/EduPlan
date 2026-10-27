const db = require('../config/db');

const SELECT_CUESTIONARIO = `
  SELECT c.id, c.titulo, c.dificultad, c.preguntas, c.apuntes_incluidos AS "apuntesIncluidos", c.temas,
         c.modelo_ia AS "modeloIa", c.creado_en AS "creadoEn",
         jsonb_array_length(c.preguntas)::int AS "totalPreguntas",
         c.materia_id AS "materiaId", m.nombre AS "materia", m.color AS "materiaColor",
         c.examen_id AS "examenId", e.titulo AS "examen",
         (SELECT COUNT(*)::int FROM academico.cuestionario_intentos i WHERE i.cuestionario_id = c.id) AS "intentos",
         (SELECT MAX(i.puntaje)::float FROM academico.cuestionario_intentos i WHERE i.cuestionario_id = c.id) AS "mejorPuntaje",
         (SELECT i.puntaje::float FROM academico.cuestionario_intentos i WHERE i.cuestionario_id = c.id
           ORDER BY i.creado_en DESC LIMIT 1) AS "ultimoPuntaje"
    FROM academico.cuestionarios c
    LEFT JOIN academico.materias m ON m.id = c.materia_id
    LEFT JOIN academico.examenes e ON e.id = c.examen_id`;

async function crear(usuarioId, c) {
  const { rows } = await db.query(
    `INSERT INTO academico.cuestionarios
       (usuario_id, materia_id, examen_id, titulo, dificultad, apuntes_incluidos, preguntas, modelo_ia, temas)
     VALUES ($1, $2, $3, $4, $5, $6::uuid[], $7::jsonb, $8, $9::text[]) RETURNING id`,
    [usuarioId, c.materiaId ?? null, c.examenId ?? null, c.titulo, c.dificultad, c.apunteIds, JSON.stringify(c.preguntas), c.modeloIa, c.temas ?? []]
  );
  return obtener(rows[0].id, usuarioId);
}

async function listar(usuarioId, { materiaId, examenId } = {}) {
  const { rows } = await db.query(
    `${SELECT_CUESTIONARIO}
      WHERE c.usuario_id = $1
        AND ($2::uuid IS NULL OR c.materia_id = $2)
        AND ($3::uuid IS NULL OR c.examen_id = $3)
      ORDER BY c.creado_en DESC LIMIT 50`,
    [usuarioId, materiaId ?? null, examenId ?? null]
  );
  return rows;
}

/** Incluye las respuestas correctas: el servicio decide qué se envía al cliente. */
async function obtener(id, usuarioId) {
  const { rows } = await db.query(`${SELECT_CUESTIONARIO} WHERE c.id = $1 AND c.usuario_id = $2`, [id, usuarioId]);
  return rows[0] || null;
}

async function eliminar(id, usuarioId) {
  const { rowCount } = await db.query('DELETE FROM academico.cuestionarios WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  return rowCount > 0;
}

async function crearIntento(usuarioId, cuestionarioId, i) {
  const { rows } = await db.query(
    `INSERT INTO academico.cuestionario_intentos
       (cuestionario_id, usuario_id, respuestas, correctas, total, puntaje, temas_debiles, apuntes_recomendados)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7::text[], $8::uuid[])
     RETURNING id, correctas, total, puntaje::float AS puntaje, temas_debiles AS "temasDebiles", creado_en AS "creadoEn"`,
    [cuestionarioId, usuarioId, JSON.stringify(i.respuestas), i.correctas, i.total, i.puntaje, i.temasDebiles, i.apuntesRecomendados ?? []]
  );
  return rows[0];
}

/** Los dos últimos intentos (el actual y el anterior, para comparar). */
async function ultimosIntentos(cuestionarioId, usuarioId) {
  const { rows } = await db.query(
    `SELECT id, respuestas, correctas, total, puntaje::float AS puntaje, temas_debiles AS "temasDebiles", creado_en AS "creadoEn"
       FROM academico.cuestionario_intentos
      WHERE cuestionario_id = $1 AND usuario_id = $2
      ORDER BY creado_en DESC LIMIT 2`,
    [cuestionarioId, usuarioId]
  );
  return rows;
}

async function ultimoIntento(cuestionarioId, usuarioId) {
  return (await ultimosIntentos(cuestionarioId, usuarioId))[0] || null;
}

/** Título y materia de apuntes del usuario (ignora los que ya no existen). */
async function apuntesBasicos(usuarioId, ids) {
  if (!ids.length) return [];
  const { rows } = await db.query(
    `SELECT a.id, a.titulo, a.materia_id AS "materiaId", m.nombre AS materia, m.color AS "materiaColor"
       FROM academico.apuntes a JOIN academico.materias m ON m.id = a.materia_id
      WHERE a.usuario_id = $1 AND a.id = ANY($2::uuid[])`,
    [usuarioId, ids]
  );
  return rows;
}

/** Frentes de las tarjetas ya creadas desde este cuestionario (para no duplicar). */
async function tarjetasCreadas(cuestionarioId, usuarioId) {
  const { rows } = await db.query(
    'SELECT frente FROM academico.flashcards WHERE cuestionario_id = $1 AND usuario_id = $2',
    [cuestionarioId, usuarioId]
  );
  return rows.map((r) => r.frente);
}

async function historialIntentos(cuestionarioId, usuarioId) {
  const { rows } = await db.query(
    `SELECT id, correctas, total, puntaje::float AS puntaje, creado_en AS "creadoEn"
       FROM academico.cuestionario_intentos
      WHERE cuestionario_id = $1 AND usuario_id = $2
      ORDER BY creado_en DESC LIMIT 20`,
    [cuestionarioId, usuarioId]
  );
  return rows;
}

module.exports = {
  crear, listar, obtener, eliminar, crearIntento, ultimoIntento, ultimosIntentos, historialIntentos,
  apuntesBasicos, tarjetasCreadas,
};
