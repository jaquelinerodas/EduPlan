/**
 * Arma el contexto (apuntes, tareas, exámenes) que se envía a la IA.
 * Limita el tamaño total para no exceder lo que el modelo puede leer.
 */
const db = require('../../config/db');
const AppError = require('../../utils/AppError');
const { validarId } = require('../../utils/validar');

const LIMITE_CARACTERES = 24000;

/** Apuntes del usuario por id (verifica que todos sean suyos). */
async function apuntesPorId(usuarioId, ids) {
  const limpios = [...new Set(ids.map((id) => validarId(id, 'apunteIds')))];
  const { rows } = await db.query(
    `SELECT a.id, a.titulo, a.contenido, a.materia_id AS "materiaId", m.nombre AS materia
       FROM academico.apuntes a JOIN academico.materias m ON m.id = a.materia_id
      WHERE a.usuario_id = $1 AND a.id = ANY($2::uuid[])
      ORDER BY a.actualizado_en DESC`,
    [usuarioId, limpios]
  );
  if (rows.length !== limpios.length) {
    throw new AppError('Alguno de los apuntes no existe', 404, 'APUNTE_NO_ENCONTRADO');
  }
  return rows;
}

async function apuntesDeMateria(usuarioId, materiaId, periodoId = null) {
  const { rows } = await db.query(
    `SELECT a.id, a.titulo, a.contenido, a.materia_id AS "materiaId", m.nombre AS materia
       FROM academico.apuntes a JOIN academico.materias m ON m.id = a.materia_id
      WHERE a.usuario_id = $1 AND a.materia_id = $2
        AND ($3::uuid IS NULL OR a.periodo_id = $3)
      ORDER BY a.actualizado_en DESC LIMIT 15`,
    [usuarioId, materiaId, periodoId]
  );
  return rows;
}

/**
 * Apuntes elegidos por el estudiante para una materia. Si no eligió ninguno,
 * se usan los de la materia (filtrados por semestre o bloque si lo indicó).
 */
async function apuntesElegidos(usuarioId, materiaId, { apunteIds = [], periodoId = null } = {}) {
  if (!apunteIds.length) return apuntesDeMateria(usuarioId, materiaId, periodoId);
  const apuntes = await apuntesPorId(usuarioId, apunteIds);
  if (apuntes.some((a) => a.materiaId !== materiaId)) {
    throw new AppError('Datos inválidos', 400, 'VALIDACION', ['Los apuntes elegidos deben ser de la misma materia']);
  }
  return apuntes;
}

/** Temas de un examen: uno por línea o separados por punto y coma. */
const temasDeTexto = (textoTemas) => (textoTemas || '')
  .split(/\n|;/)
  .map((t) => t.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, '').trim())
  .filter(Boolean)
  .slice(0, 30);

/** Exámenes próximos de una materia (o de todas). */
async function examenesProximos(usuarioId, materiaId = null) {
  const { rows } = await db.query(
    `SELECT e.id, e.titulo, e.fecha, e.temas, m.nombre AS materia, e.materia_id AS "materiaId"
       FROM academico.examenes e JOIN academico.materias m ON m.id = e.materia_id
      WHERE e.usuario_id = $1 AND e.fecha >= NOW() AND ($2::uuid IS NULL OR e.materia_id = $2)
      ORDER BY e.fecha LIMIT 5`,
    [usuarioId, materiaId]
  );
  return rows;
}

/** Tarjetas de memoria que toca repasar hoy (por materia o en total). */
async function tarjetasPendientes(usuarioId, materiaId = null) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total,
            COALESCE(array_agg(DISTINCT a.titulo) FILTER (WHERE a.titulo IS NOT NULL), '{}') AS apuntes
       FROM academico.flashcards f LEFT JOIN academico.apuntes a ON a.id = f.apunte_id
      WHERE f.usuario_id = $1 AND f.proximo_repaso <= CURRENT_DATE
        AND ($2::uuid IS NULL OR f.materia_id = $2)`,
    [usuarioId, materiaId]
  );
  return rows[0];
}

async function materia(usuarioId, materiaId) {
  const { rows } = await db.query(
    'SELECT id, nombre, color FROM academico.materias WHERE id = $1 AND usuario_id = $2',
    [validarId(materiaId, 'materiaId'), usuarioId]
  );
  if (!rows[0]) throw new AppError('La materia no existe', 404, 'MATERIA_NO_ENCONTRADA');
  return rows[0];
}

async function examen(usuarioId, examenId) {
  const { rows } = await db.query(
    `SELECT e.id, e.titulo, e.fecha, e.temas, e.notas, e.materia_id AS "materiaId", m.nombre AS materia
       FROM academico.examenes e JOIN academico.materias m ON m.id = e.materia_id
      WHERE e.id = $1 AND e.usuario_id = $2`,
    [validarId(examenId, 'examenId'), usuarioId]
  );
  if (!rows[0]) throw new AppError('El examen no existe', 404, 'EXAMEN_NO_ENCONTRADO');
  return rows[0];
}

/** Temas que el estudiante ha fallado en cuestionarios (más frecuentes primero). */
async function temasDebiles(usuarioId, materiaId) {
  const { rows } = await db.query(
    `SELECT tema, COUNT(*)::int AS veces
       FROM academico.cuestionario_intentos i
       JOIN academico.cuestionarios c ON c.id = i.cuestionario_id
       CROSS JOIN LATERAL unnest(i.temas_debiles) AS tema
      WHERE i.usuario_id = $1 AND ($2::uuid IS NULL OR c.materia_id = $2)
      GROUP BY tema ORDER BY veces DESC, tema LIMIT 8`,
    [usuarioId, materiaId ?? null]
  );
  return rows;
}

/** Texto de los apuntes repartiendo el límite de caracteres entre todos. */
function textoApuntes(apuntes, limite = LIMITE_CARACTERES) {
  if (!apuntes.length) return '';
  const porApunte = Math.max(800, Math.floor(limite / apuntes.length));
  return apuntes
    .map((a) => `### ${a.titulo} (${a.materia}) [apunteId=${a.id}]\n${a.contenido.slice(0, porApunte)}`)
    .join('\n\n');
}

module.exports = {
  apuntesPorId, apuntesDeMateria, apuntesElegidos, materia, examen, temasDeTexto,
  examenesProximos, tarjetasPendientes, temasDebiles, textoApuntes,
};
