const cuestionarioService = require('../services/cuestionario.service');

module.exports = {
  async generar(req, res) {
    res.status(201).json({ cuestionario: await cuestionarioService.generar(req.usuario.id, req.body) });
  },
  async listar(req, res) {
    res.json({ cuestionarios: await cuestionarioService.listar(req.usuario.id, req.query) });
  },
  async obtener(req, res) {
    res.json({ cuestionario: await cuestionarioService.obtener(req.usuario.id, req.params.id) });
  },
  async responder(req, res) {
    res.status(201).json(await cuestionarioService.responder(req.usuario.id, req.params.id, req.body));
  },
  async ultimaRevision(req, res) {
    res.json(await cuestionarioService.ultimaRevision(req.usuario.id, req.params.id));
  },
  async eliminar(req, res) {
    await cuestionarioService.eliminar(req.usuario.id, req.params.id);
    res.status(204).end();
  },
};
