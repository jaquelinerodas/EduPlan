const db = require('../config/db');
const { construirSet } = require('../utils/sql');

const SELECT_TARJETA = `
  SELECT f.id, f.frente, f.reverso, f.repeticiones, f.intervalo_dias AS "intervaloDias",
         f.facilidad::float AS facilidad,
         to_char(f.proximo_repaso, 'YYYY-MM-DD') AS "proximoRepaso",
         f.ultimo_repaso AS "ultimoRepaso", f.creado_en AS "creadoEn",
         (f.proximo_repaso <= CURRENT_DATE) AS "pendiente",
         f.materia_id AS "materiaId", m.nombre AS "materia", m.color AS "materiaColor",
         f.apunte_id AS "apunteId", a.titulo AS "apunte", f.cuestionario_id AS "cuestionarioId"
    FROM academico.flashcards f
    JOIN academico.materias m ON m.id = f.materia_id
    LEFT JOIN academico.apuntes a ON a.id = f.apunte_id`;

async function listar(usuarioId, { materiaId, apunteId, pendientes } = {}) {
  const { rows } = await db.query(
    `${SELECT_TARJETA}
      WHERE f.usuario_id = $1
        AND ($2::uuid IS NULL OR f.materia_id = $2)
        AND ($3::uuid IS NULL OR f.apunte_id = $3)
        AND ($4::boolean IS NULL OR (f.proximo_repaso <= CURRENT_DATE) = $4)
      ORDER BY f.proximo_repaso, f.creado_en
      LIMIT 300`,
    [usuarioId, materiaId ?? null, apunteId ?? null, pendientes ?? null]
  );
  return rows;
}

async function obtener(id, usuarioId) {
  const { rows } = await db.query(`${SELECT_TARJETA} WHERE f.id = $1 AND f.usuario_id = $2`, [id, usuarioId]);
  return rows[0] || null;
}

/** Inserta varias tarjetas en una transacción. */
async function crearVarias(usuarioId, materiaId, apunteId, tarjetas) {
  const ids = await db.transaccion(async (cliente) => {
    const creadas = [];
    for (const t of tarjetas) {
      const { rows } = await cliente.query(
        `INSERT INTO academico.flashcards (usuario_id, materia_id, apunte_id, frente, reverso, cuestionario_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [usuarioId, t.materiaId ?? materiaId, t.apunteId ?? apunteId ?? null, t.frente, t.reverso, t.cuestionarioId ?? null]
      );
      creadas.push(rows[0].id);
    }
    return creadas;
  });
  const { rows } = await db.query(`${SELECT_TARJETA} WHERE f.id = ANY($1::uuid[]) ORDER BY f.creado_en`, [ids]);
  return rows;
}

async function actualizar(id, usuarioId, datos) {
  const { set, valores } = construirSet(datos, { materiaId: 'materia_id', frente: 'frente', reverso: 'reverso' }, 3);
  if (!set) return obtener(id, usuarioId);
  const { rowCount } = await db.query(
    `UPDATE academico.flashcards SET ${set} WHERE id = $1 AND usuario_id = $2`,
    [id, usuarioId, ...valores]
  );
  return rowCount ? obtener(id, usuarioId) : null;
}

async function registrarRepaso(id, usuarioId, r) {
  const { rowCount } = await db.query(
    `UPDATE academico.flashcards
        SET repeticiones = $3, intervalo_dias = $4, facilidad = $5,
            proximo_repaso = CURRENT_DATE + $6::int, ultimo_repaso = NOW()
      WHERE id = $1 AND usuario_id = $2`,
    [id, usuarioId, r.repeticiones, r.intervaloDias, r.facilidad, r.intervaloDias]
  );
  return rowCount ? obtener(id, usuarioId) : null;
}

async function eliminar(id, usuarioId) {
  const { rowCount } = await db.query('DELETE FROM academico.flashcards WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  return rowCount > 0;
}

async function resumen(usuarioId) {
  const { rows } = await db.query(
    `SELECT m.id AS "materiaId", m.nombre AS materia, m.color AS "materiaColor",
            COUNT(f.id)::int AS total,
            COUNT(f.id) FILTER (WHERE f.proximo_repaso <= CURRENT_DATE)::int AS pendientes,
            COUNT(f.id) FILTER (WHERE f.repeticiones >= 3)::int AS dominadas
       FROM academico.flashcards f
       JOIN academico.materias m ON m.id = f.materia_id
      WHERE f.usuario_id = $1
      GROUP BY m.id ORDER BY lower(m.nombre)`,
    [usuarioId]
  );
  return rows;
}

module.exports = { listar, obtener, crearVarias, actualizar, registrarRepaso, eliminar, resumen };
