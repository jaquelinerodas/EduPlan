/**
 * Rutas del microservicio. Todas cuelgan de /auth para que Nginx
 * pueda enviar "location /auth/" directamente a este servicio (RF10).
 */
const { Router } = require('express');
const swaggerUi = require('swagger-ui-express');
const { config } = require('../config/env');
const authController = require('../controllers/auth.controller');
const healthController = require('../controllers/health.controller');
const verificarToken = require('../middlewares/verificarToken');
const limiteIntentos = require('../middlewares/limiteIntentos');
const openapi = require('../docs/openapi');

const router = Router();

// OAuth 2.0 con Google
router.get('/google', authController.redirigirAGoogle);
router.get('/google/callback', authController.callbackGoogle);

// Correo y contraseña
router.post('/registro', authController.registro);
router.post('/login', limiteIntentos, authController.login);

// Rutas protegidas con JWT
router.get('/me', verificarToken, authController.perfil);
router.post('/logout', verificarToken, authController.cerrarSesion);

// Estado del servicio
router.get('/health', healthController.estado);

// Documentación de la API (Swagger)
router.get('/docs.json', (_req, res) => res.json(openapi));
router.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, {
  customSiteTitle: 'EduPlan · ms-auth API',
}));

// Página de prueba del flujo OAuth (no existe en producción)
if (!config.esProduccion) {
  router.get('/prueba', authController.paginaPrueba);
}

module.exports = router;
