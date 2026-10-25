const iaService = require('../services/ia.service');

module.exports = {
  async resumir(req, res) {
    res.json({ apunte: await iaService.resumirApunte(req.usuario.id, req.params.apunteId) });
  },
  async generarPlan(req, res) {
    res.status(201).json({ plan: await iaService.generarPlan(req.usuario.id, req.body) });
  },
  async listarPlanes(req, res) {
    res.json({ planes: await iaService.listarPlanes(req.usuario.id) });
  },
  async obtenerPlan(req, res) {
    res.json({ plan: await iaService.obtenerPlan(req.usuario.id, req.params.id) });
  },
  async eliminarPlan(req, res) {
    await iaService.eliminarPlan(req.usuario.id, req.params.id);
    res.status(204).end();
  },
};
