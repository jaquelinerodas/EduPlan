/**
 * Configuración de la aplicación Express (sin levantar el servidor,
 * para poder probarla de forma aislada).
 */
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { config } = require('./config/env');
const authRoutes = require('./routes/auth.routes');
const { rutaNoEncontrada, manejadorErrores } = require('./middlewares/manejoErrores');

const app = express();

// Detrás de Nginx: confiar en X-Forwarded-For / X-Forwarded-Proto
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Encabezados de seguridad. La CSP la define Nginx para todo el sitio.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
if (config.entorno !== 'test') {
  app.use(morgan(config.esProduccion ? 'combined' : 'dev'));
}

app.use('/auth', authRoutes);

app.use(rutaNoEncontrada);
app.use(manejadorErrores);

module.exports = app;
