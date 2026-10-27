const periodoService = require('../services/periodo.service');

module.exports = {
  async listar(req, res) {
    res.json({ periodos: await periodoService.listar(req.usuario.id) });
  },
  async crear(req, res) {
    res.status(201).json({ periodo: await periodoService.crear(req.usuario.id, req.body) });
  },
  async actualizar(req, res) {
    res.json({ periodo: await periodoService.actualizar(req.usuario.id, req.params.id, req.body) });
  },
  async eliminar(req, res) {
    await periodoService.eliminar(req.usuario.id, req.params.id);
    res.status(204).end();
  },
};
