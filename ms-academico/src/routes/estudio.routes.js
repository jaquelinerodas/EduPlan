/**
 * Rutas de exámenes, planes de estudio, cuestionarios y tarjetas de memoria.
 * Las que llaman a la IA pasan por el límite de solicitudes por minuto.
 */
const { Router } = require('express');
const limiteIa = require('../middlewares/limiteIa');
const examen = require('../controllers/examen.controller');
const plan = require('../controllers/plan.controller');
const cuestionario = require('../controllers/cuestionario.controller');
const tarjeta = require('../controllers/flashcard.controller');

const examenes = Router();
examenes.get('/', examen.listar);
examenes.post('/', examen.crear);
examenes.get('/:id', examen.obtener);
examenes.put('/:id', examen.actualizar);
examenes.delete('/:id', examen.eliminar);

const planes = Router();
planes.get('/', plan.listar);
planes.post('/', limiteIa, plan.generar);
planes.get('/:id', plan.obtener);
planes.delete('/:id', plan.eliminar);
planes.patch('/:id/actividades/:actividadId', plan.marcarActividad);
planes.post('/:id/reorganizar', limiteIa, plan.reorganizar);
planes.post('/:id/aplicar', plan.aplicar);

const cuestionarios = Router();
cuestionarios.get('/', cuestionario.listar);
cuestionarios.post('/', limiteIa, cuestionario.generar);
cuestionarios.get('/:id', cuestionario.obtener);
cuestionarios.delete('/:id', cuestionario.eliminar);
cuestionarios.post('/:id/intentos', cuestionario.responder);
cuestionarios.get('/:id/revision', cuestionario.ultimaRevision);

const tarjetas = Router();
tarjetas.get('/', tarjeta.listar);
tarjetas.get('/resumen', tarjeta.resumen);
tarjetas.post('/', tarjeta.crear);
tarjetas.post('/generar', limiteIa, tarjeta.generar);
tarjetas.put('/:id', tarjeta.actualizar);
tarjetas.post('/:id/repaso', tarjeta.repasar);
tarjetas.delete('/:id', tarjeta.eliminar);

module.exports = { examenes, planes, cuestionarios, tarjetas };
