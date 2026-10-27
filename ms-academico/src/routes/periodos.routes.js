const { Router } = require('express');
const c = require('../controllers/periodo.controller');

const router = Router();

router.get('/', c.listar);
router.post('/', c.crear);
router.put('/:id', c.actualizar);
router.delete('/:id', c.eliminar);

module.exports = router;
