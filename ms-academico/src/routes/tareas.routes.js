const { Router } = require('express');
const c = require('../controllers/tarea.controller');

const router = Router();

router.get('/', c.listar);
router.post('/', c.crear);
router.get('/:id', c.obtener);
router.put('/:id', c.actualizar);
router.patch('/:id/estado', c.cambiarEstado);
router.delete('/:id', c.eliminar);

module.exports = router;
