const db = require('../config/db');
const { construirSet } = require('../utils/sql');

/*
 * "porRepasar": el apunte tiene tarjetas que toca repasar hoy o el último
 * intento de algún cuestionario lo recomendó (preguntas falladas).
 */
const SELECT_APUNTE = `
  SELECT a.id, a.titulo, a.contenido,
         a.resumen_ia          AS "resumenIa",
         a.resumen_generado_en AS "resumenGeneradoEn",
         a.creado_en AS "creadoEn", a.actualizado_en AS "actualizadoEn",
         a.favorito, a.etiquetas,
         a.periodo_id AS "periodoId", pe.nombre AS "periodo", pe.tipo AS "periodoTipo",
         m.id AS "materiaId", m.nombre AS "materia", m.color AS "materiaColor",
         (SELECT COUNT(*)::int FROM academico.flashcards f
           WHERE f.apunte_id = a.id AND f.proximo_repaso <= CURRENT_DATE) AS "tarjetasPendientes",
         EXISTS (
           SELECT 1 FROM academico.cuestionarios c
            CROSS JOIN LATERAL (
              SELECT i.apuntes_recomendados FROM academico.cuestionario_intentos i
               WHERE i.cuestionario_id = c.id ORDER BY i.creado_en DESC LIMIT 1) u
            WHERE c.usuario_id = a.usuario_id AND a.id = ANY(u.apuntes_recomendados)
         ) AS "recomendado"
    FROM academico.apuntes a
    JOIN academico.materias m ON m.id = a.materia_id
    LEFT JOIN academico.periodos pe ON pe.id = a.periodo_id`;

const COLUMNAS = {
  materiaId: 'materia_id', titulo: 'titulo', contenido: 'contenido',
  periodoId: 'periodo_id', favorito: 'favorito', etiquetas: 'etiquetas',
};

const POR_REPASAR = `("tarjetasPendientes" > 0 OR "recomendado")`;

/**
 * Filtros: materiaId, periodoId (uuid o "ninguno"), buscar, etiqueta y vista
 * (todos | recientes | favoritos | repasar).
 */
async function listar(usuarioId, { materiaId, periodoId, buscar, etiqueta, vista } = {}) {
  const sinPeriodo = periodoId === 'ninguno';
  const { rows } = await db.query(
    `SELECT * FROM (${SELECT_APUNTE}
      WHERE a.usuario_id = $1
        AND ($2::uuid IS NULL OR a.materia_id = $2)
        AND ($3::uuid IS NULL OR a.periodo_id = $3)
        AND (NOT $4::boolean OR a.periodo_id IS NULL)
        AND ($5::text IS NULL OR a.titulo ILIKE '%' || $5 || '%' OR a.contenido ILIKE '%' || $5 || '%'
             OR EXISTS (SELECT 1 FROM unnest(a.etiquetas) e WHERE e ILIKE '%' || $5 || '%'))
        AND ($6::text IS NULL OR lower($6) = ANY(SELECT lower(e) FROM unnest(a.etiquetas) e))
        AND ($7::text <> 'favoritos' OR a.favorito)
    ) x
    WHERE ($7::text <> 'repasar' OR ${POR_REPASAR})
    ORDER BY "actualizadoEn" DESC
    LIMIT CASE WHEN $7::text = 'recientes' THEN 10 ELSE 500 END`,
    [usuarioId, materiaId ?? null, sinPeriodo ? null : periodoId ?? null, sinPeriodo,
      buscar ?? null, etiqueta ?? null, vista ?? 'todos']
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

/** Si no se elige periodo, se usa el de la materia. */
async function crear(usuarioId, d) {
  const { rows } = await db.query(
    `INSERT INTO academico.apuntes (usuario_id, materia_id, titulo, contenido, periodo_id, favorito, etiquetas)
     VALUES ($1, $2, $3, $4,
             CASE WHEN $8 THEN $5::uuid
                  ELSE (SELECT periodo_id FROM academico.materias WHERE id = $2 AND usuario_id = $1) END,
             COALESCE($6, FALSE), COALESCE($7::text[], '{}'))
     RETURNING id`,
    [usuarioId, d.materiaId, d.titulo, d.contenido, d.periodoId ?? null, d.favorito ?? null,
      d.etiquetas ?? null, d.periodoId !== undefined]
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

/** Etiquetas usadas por el estudiante, con cuántos apuntes tiene cada una. */
async function etiquetas(usuarioId) {
  const { rows } = await db.query(
    `SELECT e AS etiqueta, COUNT(*)::int AS total
       FROM academico.apuntes a CROSS JOIN LATERAL unnest(a.etiquetas) e
      WHERE a.usuario_id = $1
      GROUP BY e ORDER BY total DESC, e LIMIT 50`,
    [usuarioId]
  );
  return rows;
}

module.exports = { listar, obtener, crear, actualizar, eliminar, guardarResumen, etiquetas };
