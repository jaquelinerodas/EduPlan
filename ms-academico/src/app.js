const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const { config } = require('./config/env');
const rutas = require('./routes');
const { rutaNoEncontrada, manejadorErrores } = require('./middlewares/manejoErrores');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '200kb' }));
if (config.entorno !== 'test') {
  app.use(morgan(config.esProduccion ? 'combined' : 'dev'));
}

app.use('/api', rutas);

app.use(rutaNoEncontrada);
app.use(manejadorErrores);

module.exports = app;
