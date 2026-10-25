/**
 * Punto de entrada: valida la configuración y levanta el servidor HTTP.
 */
const { config, validarConfig } = require('./config/env');

try {
  validarConfig();
} catch (err) {
  console.error(`[ms-auth] ${err.message}`);
  process.exit(1);
}

const app = require('./app');
const { pool } = require('./config/db');

const servidor = app.listen(config.puerto, () => {
  console.log(`[ms-auth] Escuchando en el puerto ${config.puerto} (${config.entorno})`);
});

// Apagado ordenado cuando Docker detiene el contenedor
function apagar(senal) {
  console.log(`[ms-auth] ${senal} recibido, cerrando...`);
  servidor.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));
