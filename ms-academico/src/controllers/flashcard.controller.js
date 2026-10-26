const flashcardService = require('../services/flashcard.service');

module.exports = {
  async listar(req, res) {
    res.json({ tarjetas: await flashcardService.listar(req.usuario.id, req.query) });
  },
  async resumen(req, res) {
    res.json({ resumen: await flashcardService.resumen(req.usuario.id) });
  },
  async crear(req, res) {
    res.status(201).json({ tarjeta: await flashcardService.crear(req.usuario.id, req.body) });
  },
  async generar(req, res) {
    res.status(201).json({ tarjetas: await flashcardService.generar(req.usuario.id, req.body) });
  },
  async actualizar(req, res) {
    res.json({ tarjeta: await flashcardService.actualizar(req.usuario.id, req.params.id, req.body) });
  },
  async repasar(req, res) {
    res.json({ tarjeta: await flashcardService.repasar(req.usuario.id, req.params.id, req.body) });
  },
  async eliminar(req, res) {
    await flashcardService.eliminar(req.usuario.id, req.params.id);
    res.status(204).end();
  },
};
