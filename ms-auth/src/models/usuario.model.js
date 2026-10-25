/**
 * Capa de modelo: acceso a la tabla auth.usuarios.
 * Todas las consultas usan parámetros ($1, $2...) para evitar inyección SQL.
 */
const db = require('../config/db');

const COLUMNAS = 'id, email, nombre, foto_url, rol, activo, ultimo_acceso, creado_en';

/**
 * Registra al usuario la primera vez que entra con Google, o actualiza
 * sus datos y la fecha de último acceso si ya existía (RF01, HU01).
 */
async function upsertDesdeGoogle({ googleId, email, nombre, fotoUrl }) {
  const { rows } = await db.query(
    `INSERT INTO auth.usuarios (google_id, email, nombre, foto_url, ultimo_acceso)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (google_id) DO UPDATE
        SET email         = EXCLUDED.email,
            nombre        = EXCLUDED.nombre,
            foto_url      = EXCLUDED.foto_url,
            ultimo_acceso = NOW()
     RETURNING ${COLUMNAS}`,
    [googleId, email, nombre, fotoUrl]
  );
  return rows[0];
}

async function buscarPorId(id) {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS} FROM auth.usuarios WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

module.exports = { upsertDesdeGoogle, buscarPorId };
