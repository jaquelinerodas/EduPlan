const { Router } = require('express');
const c = require('../controllers/ia.controller');
const limiteIa = require('../middlewares/limiteIa');

const router = Router();

router.post('/resumen/:apunteId', limiteIa, c.resumir);

module.exports = router;
