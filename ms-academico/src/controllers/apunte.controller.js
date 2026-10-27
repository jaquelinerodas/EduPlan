const apunteService = require('../services/apunte.service');

module.exports = {
  async listar(req, res) {
    res.json({ apuntes: await apunteService.listar(req.usuario.id, req.query) });
  },
  async etiquetas(req, res) {
    res.json({ etiquetas: await apunteService.etiquetas(req.usuario.id) });
  },
  async obtener(req, res) {
    res.json({ apunte: await apunteService.obtener(req.usuario.id, req.params.id) });
  },
  async crear(req, res) {
    res.status(201).json({ apunte: await apunteService.crear(req.usuario.id, req.body) });
  },
  async actualizar(req, res) {
    res.json({ apunte: await apunteService.actualizar(req.usuario.id, req.params.id, req.body) });
  },
  async eliminar(req, res) {
    await apunteService.eliminar(req.usuario.id, req.params.id);
    res.status(204).end();
  },
};
