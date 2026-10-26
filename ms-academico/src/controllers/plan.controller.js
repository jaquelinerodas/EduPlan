const planService = require('../services/plan.service');

module.exports = {
  async generar(req, res) {
    res.status(201).json({ plan: await planService.generar(req.usuario.id, req.body) });
  },
  async listar(req, res) {
    res.json({ planes: await planService.listar(req.usuario.id) });
  },
  async obtener(req, res) {
    res.json({ plan: await planService.obtener(req.usuario.id, req.params.id) });
  },
  async eliminar(req, res) {
    await planService.eliminar(req.usuario.id, req.params.id);
    res.status(204).end();
  },
  async marcarActividad(req, res) {
    res.json({ actividad: await planService.marcarActividad(req.usuario.id, req.params.id, req.params.actividadId, req.body) });
  },
  async reorganizar(req, res) {
    res.json({ propuesta: await planService.proponerReorganizacion(req.usuario.id, req.params.id) });
  },
  async aplicar(req, res) {
    res.json({ plan: await planService.aplicarReorganizacion(req.usuario.id, req.params.id, req.body) });
  },
};
