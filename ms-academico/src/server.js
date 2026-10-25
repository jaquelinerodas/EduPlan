const { config, validarConfig } = require('./config/env');

try {
  validarConfig();
} catch (err) {
  console.error(`[ms-academico] ${err.message}`);
  process.exit(1);
}

const app = require('./app');
const { pool } = require('./config/db');

const servidor = app.listen(config.puerto, () => {
  console.log(`[ms-academico] Escuchando en el puerto ${config.puerto} (${config.entorno}) · IA: ${config.ia.proveedor}/${config.ia.modelo}`);
});

function apagar(senal) {
  console.log(`[ms-academico] ${senal} recibido, cerrando...`);
  servidor.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));
