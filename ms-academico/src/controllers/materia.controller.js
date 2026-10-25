const materiaService = require('../services/materia.service');

module.exports = {
  async listar(req, res) {
    res.json({ materias: await materiaService.listar(req.usuario.id) });
  },
  async obtener(req, res) {
    res.json({ materia: await materiaService.obtener(req.usuario.id, req.params.id) });
  },
  async crear(req, res) {
    res.status(201).json({ materia: await materiaService.crear(req.usuario.id, req.body) });
  },
  async actualizar(req, res) {
    res.json({ materia: await materiaService.actualizar(req.usuario.id, req.params.id, req.body) });
  },
  async eliminar(req, res) {
    await materiaService.eliminar(req.usuario.id, req.params.id);
    res.status(204).end();
  },
};
