/**
 * Instrucciones (prompts) que se envían al modelo de lenguaje.
 * Mantenerlas aquí permite ajustarlas sin tocar la lógica.
 */
const { config } = require('../../config/env');

const formatoFecha = new Intl.DateTimeFormat('es-GT', {
  timeZone: config.zonaHoraria,
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});
const formatoDia = new Intl.DateTimeFormat('es-GT', {
  timeZone: config.zonaHoraria, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

const SISTEMA_RESUMEN = [
  'Eres el asistente académico de EduPlan. Resumes apuntes de estudiantes.',
  'Responde siempre en español, con lenguaje claro.',
  'Formato: una oración introductoria y luego entre 3 y 7 viñetas con los conceptos clave.',
  'Máximo 200 palabras. No inventes información que no esté en el apunte.',
  'Usa Markdown simple (viñetas y **negritas**), sin encabezados.',
].join('\n');

function mensajeResumen(apunte) {
  return [
    `Materia: ${apunte.materia}`,
    `Título del apunte: ${apunte.titulo}`,
    '',
    'Contenido del apunte:',
    '"""',
    apunte.contenido.slice(0, 20000),
    '"""',
  ].join('\n');
}

const SISTEMA_PLAN = [
  'Eres el asistente académico de EduPlan. Creas planes de estudio realistas.',
  'Responde siempre en español.',
  'Organiza el plan día por día desde hoy, con la fecha de cada día como subtítulo en Markdown (###).',
  'Atiende primero lo vencido y lo de prioridad alta, y reparte el trabajo antes de cada fecha de entrega.',
  'Respeta el máximo de horas por día indicado e incluye descansos cortos.',
  'Al final agrega 2 o 3 consejos breves. No inventes tareas que no estén en la lista.',
].join('\n');

function mensajePlan(tareas, { dias, horasPorDia }) {
  const ahora = new Date();
  const lineas = tareas.map((t) => {
    const estado = t.vencida ? ' (VENCIDA)' : t.estado === 'en_progreso' ? ' (en progreso)' : '';
    const desc = t.descripcion ? ` — ${t.descripcion.slice(0, 200)}` : '';
    return `- [prioridad ${t.prioridad}] ${t.titulo} · ${t.materia} · entrega: ${formatoFecha.format(t.fechaLimite)}${estado}${desc}`;
  });
  return [
    `Hoy es ${formatoDia.format(ahora)}.`,
    `Crea un plan para los próximos ${dias} días con un máximo de ${horasPorDia} horas de estudio por día.`,
    '',
    'Tareas pendientes:',
    ...lineas,
  ].join('\n');
}

module.exports = { SISTEMA_RESUMEN, mensajeResumen, SISTEMA_PLAN, mensajePlan };
