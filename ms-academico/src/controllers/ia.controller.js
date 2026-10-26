const iaService = require('../services/ia.service');

module.exports = {
  async resumir(req, res) {
    res.json({ apunte: await iaService.resumirApunte(req.usuario.id, req.params.apunteId) });
  },
};
