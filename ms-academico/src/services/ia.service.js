const apunteModel = require('../models/apunte.model');
const ia = require('./ia/proveedores');
const prompts = require('./ia/prompts');
const AppError = require('../utils/AppError');
const { validarId } = require('../utils/validar');

/** RF07 / HU07: genera el resumen de un apunte y lo guarda. */
async function resumirApunte(usuarioId, apunteId) {
  const id = validarId(apunteId, 'apunteId');
  const apunte = await apunteModel.obtener(id, usuarioId);
  if (!apunte) throw new AppError('Apunte no encontrado', 404, 'APUNTE_NO_ENCONTRADO');

  const resumen = await ia.generarTexto({
    sistema: prompts.SISTEMA_RESUMEN,
    mensaje: prompts.mensajeResumen(apunte),
  });
  return apunteModel.guardarResumen(id, usuarioId, resumen);
}

module.exports = { resumirApunte };
