/**
 * Pool de conexiones a PostgreSQL.
 * Se conecta con el usuario ms_auth, que solo tiene permisos sobre el esquema auth.
 */
const { Pool } = require('pg');
const { config } = require('./env');

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[ms-auth] Error inesperado en el pool de PostgreSQL:', err.message);
});

module.exports = {
  pool,
  query: (texto, parametros) => pool.query(texto, parametros),
};
