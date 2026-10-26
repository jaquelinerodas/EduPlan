const { Pool } = require('pg');
const { config } = require('./env');

// Se conecta con el usuario ms_academico (solo tiene permisos en el esquema academico).
// La zona horaria hace que las fechas 'YYYY-MM-DD' se interpreten en hora de Guatemala.
const pool = new Pool({
  connectionString: config.databaseUrl,
  options: `-c timezone=${config.zonaHoraria}`,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[ms-academico] Error en el pool de PostgreSQL:', err.message);
});

/** Ejecuta varias consultas como una sola operación: o se guardan todas o ninguna. */
async function transaccion(trabajo) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await trabajo(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
}

module.exports = {
  pool,
  query: (texto, parametros) => pool.query(texto, parametros),
  transaccion,
};
