/**
 * Alertas y recordatorios inteligentes, y eventos del calendario académico.
 * Las alertas se calculan en cada consulta (no se guardan): siempre reflejan
 * el estado actual de tareas, exámenes, planes y tarjetas.
 */
const agendaModel = require('../models/agenda.model');
const AppError = require('../utils/AppError');
const { validar } = require('../utils/validar');
const { hoy, diferenciaDias } = require('../utils/fechas');
const { config } = require('../config/env');

const hora = new Intl.DateTimeFormat('es-GT', { timeZone: config.zonaHoraria, hour: 'numeric', minute: '2-digit' });
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

async function alertas(usuarioId) {
  const d = await agendaModel.datosAlertas(usuarioId);
  const dia = hoy();
  const lista = [];

  if (d.vencidas) {
    lista.push({
      id: `vencidas-${dia}-${d.vencidas}`, tipo: 'tarea', nivel: 'urgente',
      titulo: `Tienes ${plural(d.vencidas, 'tarea vencida', 'tareas vencidas')}`,
      mensaje: 'Revísalas y decide si todavía puedes entregarlas.',
      enlace: '#/tareas?vencidas=true',
    });
  }
  for (const t of d.proximas) {
    lista.push({
      id: `tarea-${t.id}-${dia}`, tipo: 'tarea', nivel: t.hoy ? 'urgente' : 'aviso',
      titulo: `«${t.titulo}» vence ${t.hoy ? 'hoy' : 'mañana'} a las ${hora.format(t.fechaLimite)}`,
      mensaje: `${t.materia} · prioridad ${t.prioridad}`,
      enlace: `#/tareas?materiaId=${t.materiaId}`,
    });
  }
  for (const e of d.examenes) {
    const cuando = e.dias === 0 ? 'hoy' : e.dias === 1 ? 'mañana' : `en ${e.dias} días`;
    lista.push({
      id: `examen-${e.id}-${dia}`, tipo: 'examen', nivel: e.dias <= 1 ? 'urgente' : 'aviso',
      titulo: `Examen de ${e.materia} ${cuando}`,
      mensaje: `${e.titulo} · ${hora.format(e.fecha)}`,
      enlace: '#/examenes',
    });
  }
  for (const p of d.atrasadas) {
    lista.push({
      id: `atrasadas-${p.id}-${dia}-${p.total}`, tipo: 'plan', nivel: 'aviso',
      titulo: `No completaste ${plural(p.total, 'actividad', 'actividades')} de tu plan`,
      mensaje: `${p.titulo}. Puedes reorganizar tu semana con el asistente.`,
      enlace: `#/plan?id=${p.id}`,
      accion: 'reorganizar',
    });
  }
  if (d.sesionesHoy.length) {
    const total = d.sesionesHoy.reduce((suma, s) => suma + s.total, 0);
    const primera = d.sesionesHoy[0]; // ordenadas por hora de inicio
    lista.push({
      id: `sesiones-${dia}-${total}`, tipo: 'plan', nivel: 'info',
      titulo: `Hoy tienes ${plural(total, 'sesión', 'sesiones')} de estudio desde las ${primera.desde}`,
      mensaje: d.sesionesHoy.length === 1 ? primera.titulo : `En ${d.sesionesHoy.length} planes de estudio`,
      enlace: `#/plan?id=${primera.id}`,
    });
  }
  if (d.tarjetas) {
    lista.push({
      id: `tarjetas-${dia}`, tipo: 'tarjetas', nivel: 'info',
      titulo: `${plural(d.tarjetas, 'tarjeta', 'tarjetas')} para repasar hoy`,
      mensaje: 'Un repaso corto ayuda a no olvidar lo aprendido.',
      enlace: '#/tarjetas',
    });
  }

  const orden = { urgente: 0, aviso: 1, info: 2 };
  return lista.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
}

async function calendario(usuarioId, query) {
  const { desde, hasta } = validar(query, {
    desde: { tipo: 'fecha', requerido: true },
    hasta: { tipo: 'fecha', requerido: true },
  });
  if (hasta < desde || diferenciaDias(desde, hasta) > 92) {
    throw new AppError('Rango de fechas inválido (máximo 93 días)', 400, 'VALIDACION');
  }
  return agendaModel.eventos(usuarioId, desde, hasta);
}

module.exports = { alertas, calendario };
