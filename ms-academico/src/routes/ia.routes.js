const { Router } = require('express');
const c = require('../controllers/ia.controller');
const limiteIa = require('../middlewares/limiteIa');

const router = Router();

router.post('/resumen/:apunteId', limiteIa, c.resumir);
router.post('/plan-estudio', limiteIa, c.generarPlan);
router.get('/planes', c.listarPlanes);
router.get('/planes/:id', c.obtenerPlan);
router.delete('/planes/:id', c.eliminarPlan);

module.exports = router;
