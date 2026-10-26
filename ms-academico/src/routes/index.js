/**
 * Todas las rutas cuelgan de /api para que Nginx envíe "location /api/"
 * a este microservicio (RF10).
 */
const { Router } = require('express');
const swaggerUi = require('swagger-ui-express');
const verificarToken = require('../middlewares/verificarToken');
const general = require('../controllers/general.controller');
const openapi = require('../docs/openapi');
const estudio = require('./estudio.routes');

const router = Router();

// Rutas públicas
router.get('/health', general.health);
router.get('/docs.json', (_req, res) => res.json(openapi));
router.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, {
  customSiteTitle: 'EduPlan · ms-academico API',
  swaggerOptions: { persistAuthorization: true },
}));

// A partir de aquí todo exige JWT (RF02)
router.use(verificarToken);
router.get('/resumen', general.resumen);
router.get('/alertas', general.alertas);
router.get('/calendario', general.calendario);
router.use('/materias', require('./materias.routes'));
router.use('/tareas', require('./tareas.routes'));
router.use('/apuntes', require('./apuntes.routes'));
router.use('/ia', require('./ia.routes'));
router.use('/examenes', estudio.examenes);
router.use('/planes', estudio.planes);
router.use('/cuestionarios', estudio.cuestionarios);
router.use('/flashcards', estudio.tarjetas);

module.exports = router;
