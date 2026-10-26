const examenService = require('../services/examen.service');

module.exports = {
  async listar(req, res) {
    res.json({ examenes: await examenService.listar(req.usuario.id, req.query) });
  },
  async obtener(req, res) {
    res.json({ examen: await examenService.obtener(req.usuario.id, req.params.id) });
  },
  async crear(req, res) {
    res.status(201).json({ examen: await examenService.crear(req.usuario.id, req.body) });
  },
  async actualizar(req, res) {
    res.json({ examen: await examenService.actualizar(req.usuario.id, req.params.id, req.body) });
  },
  async eliminar(req, res) {
    await examenService.eliminar(req.usuario.id, req.params.id);
    res.status(204).end();
  },
};
