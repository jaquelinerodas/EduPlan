const tareaService = require('../services/tarea.service');

module.exports = {
  async listar(req, res) {
    res.json({ tareas: await tareaService.listar(req.usuario.id, req.query) });
  },
  async obtener(req, res) {
    res.json({ tarea: await tareaService.obtener(req.usuario.id, req.params.id) });
  },
  async crear(req, res) {
    res.status(201).json({ tarea: await tareaService.crear(req.usuario.id, req.body) });
  },
  async actualizar(req, res) {
    res.json({ tarea: await tareaService.actualizar(req.usuario.id, req.params.id, req.body) });
  },
  async cambiarEstado(req, res) {
    res.json({ tarea: await tareaService.cambiarEstado(req.usuario.id, req.params.id, req.body) });
  },
  async eliminar(req, res) {
    await tareaService.eliminar(req.usuario.id, req.params.id);
    res.status(204).end();
  },
};
