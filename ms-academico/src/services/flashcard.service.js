/**
 * Tarjetas de memoria con repaso espaciado (algoritmo SM-2 simplificado).
 * Según la respuesta del estudiante ("No lo recuerdo", "Difícil", "Fácil")
 * se calcula cuántos días faltan para volver a mostrar la tarjeta.
 */
const flashcardModel = require('../models/flashcard.model');
const ia = require('./ia/proveedores');
const prompts = require('./ia/prompts');
const contexto = require('./ia/contexto');
const AppError = require('../utils/AppError');
const { validar, validarId } = require('../utils/validar');

const CALIFICACIONES = ['olvidado', 'dificil', 'facil'];
const INTERVALO_MAXIMO = 180;

/** Calcula el siguiente estado de la tarjeta para una calificación. */
function siguienteRepaso({ repeticiones, intervaloDias, facilidad }, calificacion) {
  if (calificacion === 'olvidado') {
    return { repeticiones: 0, intervaloDias: 0, facilidad: Math.max(1.3, +(facilidad - 0.2).toFixed(2)) };
  }
  const rep = repeticiones + 1;
  if (calificacion === 'dificil') {
    const intervalo = rep === 1 ? 1 : Math.max(intervaloDias + 1, Math.round(intervaloDias * 1.2));
    return { repeticiones: rep, intervaloDias: Math.min(INTERVALO_MAXIMO, intervalo), facilidad: Math.max(1.3, +(facilidad - 0.15).toFixed(2)) };
  }
  const intervalo = rep === 1 ? 2 : rep === 2 ? 5 : Math.round(intervaloDias * facilidad);
  return { repeticiones: rep, intervaloDias: Math.min(INTERVALO_MAXIMO, intervalo), facilidad: Math.min(3.5, +(facilidad + 0.1).toFixed(2)) };
}

/** Agrega a cada tarjeta cuántos días faltarían según cada respuesta (para los botones). */
const conVistaPrevia = (t) => ({
  ...t,
  proximosIntervalos: Object.fromEntries(CALIFICACIONES.map((c) => [c, siguienteRepaso(t, c).intervaloDias])),
});

const ESQUEMA = {
  materiaId: { tipo: 'uuid', requerido: true },
  frente: { tipo: 'texto', requerido: true, max: 500 },
  reverso: { tipo: 'texto', requerido: true, max: 1500 },
};

const noEncontrada = () => new AppError('Tarjeta no encontrada', 404, 'TARJETA_NO_ENCONTRADA');

async function listar(usuarioId, query) {
  const filtros = validar(query, {
    materiaId: { tipo: 'uuid' },
    apunteId: { tipo: 'uuid' },
    pendientes: { tipo: 'booleano' },
  });
  return (await flashcardModel.listar(usuarioId, filtros)).map(conVistaPrevia);
}

async function resumen(usuarioId) {
  const porMateria = await flashcardModel.resumen(usuarioId);
  return {
    total: porMateria.reduce((s, m) => s + m.total, 0),
    pendientes: porMateria.reduce((s, m) => s + m.pendientes, 0),
    dominadas: porMateria.reduce((s, m) => s + m.dominadas, 0),
    porMateria,
  };
}

async function crear(usuarioId, cuerpo) {
  const d = validar(cuerpo, { ...ESQUEMA, apunteId: { tipo: 'uuid' } });
  await contexto.materia(usuarioId, d.materiaId);
  const [tarjeta] = await flashcardModel.crearVarias(usuarioId, d.materiaId, d.apunteId, [d]);
  return conVistaPrevia(tarjeta);
}

async function actualizar(usuarioId, id, cuerpo) {
  const t = await flashcardModel.actualizar(validarId(id), usuarioId, validar(cuerpo, ESQUEMA, { parcial: true }));
  if (!t) throw noEncontrada();
  return conVistaPrevia(t);
}

async function eliminar(usuarioId, id) {
  if (!(await flashcardModel.eliminar(validarId(id), usuarioId))) throw noEncontrada();
}

async function repasar(usuarioId, id, cuerpo) {
  const { calificacion } = validar(cuerpo, { calificacion: { tipo: 'enum', valores: CALIFICACIONES, requerido: true } });
  const actual = await flashcardModel.obtener(validarId(id), usuarioId);
  if (!actual) throw noEncontrada();
  const t = await flashcardModel.registrarRepaso(actual.id, usuarioId, siguienteRepaso(actual, calificacion));
  return conVistaPrevia(t);
}

/** Genera tarjetas con IA a partir de un apunte. */
async function generar(usuarioId, cuerpo) {
  const op = { cantidad: 10, ...validar(cuerpo, {
    apunteId: { tipo: 'uuid', requerido: true },
    cantidad: { tipo: 'entero', min: 3, max: 25 },
  }) };
  const [apunte] = await contexto.apuntesPorId(usuarioId, [op.apunteId]);

  const datos = await ia.generarJson({
    sistema: prompts.SISTEMA_TARJETAS,
    mensaje: prompts.mensajeTarjetas({ cantidad: op.cantidad, apuntesTexto: contexto.textoApuntes([apunte]) }),
    simulado: () => ({
      tarjetas: Array.from({ length: op.cantidad }, (_, i) => ({
        frente: `Concepto ${i + 1} de «${apunte.titulo}» (simulado)`,
        reverso: apunte.contenido.slice(i * 60, i * 60 + 120) || 'Respuesta de ejemplo',
      })),
    }),
  });

  const vistas = new Set();
  const tarjetas = (Array.isArray(datos.tarjetas) ? datos.tarjetas : [])
    .map((t) => ({
      frente: typeof t?.frente === 'string' ? t.frente.trim().slice(0, 500) : '',
      reverso: typeof t?.reverso === 'string' ? t.reverso.trim().slice(0, 1500) : '',
    }))
    .filter((t) => t.frente && t.reverso && !vistas.has(t.frente.toLowerCase()) && vistas.add(t.frente.toLowerCase()))
    .slice(0, op.cantidad);

  if (!tarjetas.length) {
    throw new AppError('La IA no generó tarjetas válidas, intenta de nuevo', 502, 'IA_RESPUESTA_INVALIDA');
  }
  return (await flashcardModel.crearVarias(usuarioId, apunte.materiaId, apunte.id, tarjetas)).map(conVistaPrevia);
}

module.exports = { listar, resumen, crear, actualizar, eliminar, repasar, generar, siguienteRepaso };
