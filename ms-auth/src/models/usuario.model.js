/**
 * Capa de modelo: acceso a la tabla auth.usuarios.
 * Todas las consultas usan parámetros ($1, $2...) para evitar inyección SQL.
 */
const db = require('../config/db');

const COLUMNAS = 'id, email, nombre, foto_url, rol, activo, ultimo_acceso, creado_en, google_id IS NOT NULL AS tiene_google, password_hash IS NOT NULL AS tiene_password';

/**
 * Registra o actualiza al usuario que entra con Google (RF01, HU01).
 *  1. Si ya existe con ese google_id, actualiza sus datos.
 *  2. Si existe una cuenta con el mismo correo (creada con contraseña),
 *     la vincula a Google: Google ya verificó que el correo le pertenece.
 *  3. Si no existe, la crea.
 */
async function upsertDesdeGoogle({ googleId, email, nombre, fotoUrl }) {
  const { rows } = await db.query(
    `WITH vinculada AS (
       UPDATE auth.usuarios
          SET google_id = $1, foto_url = COALESCE($4, foto_url), ultimo_acceso = NOW()
        WHERE email = $2 AND google_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM auth.usuarios WHERE google_id = $1)
       RETURNING id
     )
     INSERT INTO auth.usuarios (google_id, email, nombre, foto_url, ultimo_acceso)
     SELECT $1, $2, $3, $4, NOW()
      WHERE NOT EXISTS (SELECT 1 FROM vinculada)
     ON CONFLICT (google_id) DO UPDATE
        SET email         = EXCLUDED.email,
            nombre        = EXCLUDED.nombre,
            foto_url      = EXCLUDED.foto_url,
            ultimo_acceso = NOW()
     RETURNING id`,
    [googleId, email, nombre, fotoUrl]
  );
  // Si se vinculó una cuenta existente, el INSERT no devuelve filas
  if (rows[0]) return buscarPorId(rows[0].id);
  return buscarPorEmail(email);
}

async function buscarPorId(id) {
  const { rows } = await db.query(`SELECT ${COLUMNAS} FROM auth.usuarios WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function buscarPorEmail(email) {
  const { rows } = await db.query(`SELECT ${COLUMNAS} FROM auth.usuarios WHERE email = $1`, [email]);
  return rows[0] || null;
}

/** Solo para el inicio de sesión con contraseña: incluye el hash. */
async function buscarCredenciales(email) {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS}, password_hash FROM auth.usuarios WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
}

async function crearConPassword({ email, nombre, passwordHash }) {
  const { rows } = await db.query(
    `INSERT INTO auth.usuarios (email, nombre, password_hash, ultimo_acceso)
     VALUES ($1, $2, $3, NOW())
     RETURNING ${COLUMNAS}`,
    [email, nombre, passwordHash]
  );
  return rows[0];
}

async function registrarAcceso(id) {
  await db.query('UPDATE auth.usuarios SET ultimo_acceso = NOW() WHERE id = $1', [id]);
}

module.exports = { upsertDesdeGoogle, buscarPorId, buscarPorEmail, buscarCredenciales, crearConPassword, registrarAcceso };
