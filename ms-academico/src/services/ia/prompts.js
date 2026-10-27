/**
 * Instrucciones (prompts) que se envían al modelo de lenguaje.
 * Las funciones que guardan datos piden JSON con una estructura exacta,
 * que después se valida en el servicio antes de guardarse.
 */
const { config } = require('../../config/env');
const { nombreDia } = require('../../utils/fechas');

const formatoFecha = new Intl.DateTimeFormat('es-GT', {
  timeZone: config.zonaHoraria,
  weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
});

const BASE = 'Eres el asistente académico de EduPlan, una plataforma para estudiantes de Guatemala. Escribe en español claro, cercano y profesional.';

/* ---------- Resumen de un apunte (Markdown) ---------- */
const SISTEMA_RESUMEN = [
  BASE,
  'Resumes apuntes de estudiantes.',
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

/* ---------- Plan de estudio por días (JSON) ---------- */
const ESQUEMA_DIAS = `"dias": [
    { "fecha": "YYYY-MM-DD",
      "actividades": [
        { "inicio": "HH:MM", "fin": "HH:MM",
          "tipo": "estudio | tarea | repaso | practica | descanso",
          "titulo": "máximo 80 caracteres",
          "descripcion": "una oración con el objetivo concreto de la sesión",
          "tareaId": "id de la lista de tareas o null",
          "materiaId": "id de la lista de materias o null" } ] } ]`;

const SISTEMA_PLAN = [
  BASE,
  'Creas planes de estudio realistas, divididos por días y horarios.',
  'Devuelve un JSON con esta forma exacta:',
  `{ "titulo": "título corto del plan",
  "resumen": "2 o 3 oraciones que expliquen la estrategia del plan",
  ${ESQUEMA_DIAS},
  "consejos": ["3 consejos breves y específicos"] }`,
  'Reglas:',
  '- Usa solo fechas dentro del rango indicado y empieza cada día a la hora de inicio indicada o después.',
  '- El tiempo de estudio de cada día (sin contar descansos) no debe superar las horas por día indicadas.',
  '- Bloques de 25 a 60 minutos. Entre bloques agrega descansos de 5 a 15 minutos con tipo "descanso".',
  '- Prioriza lo vencido y lo de prioridad alta, y termina cada tarea antes de su fecha de entrega.',
  '- Usa "tarea" para avanzar una tarea concreta (con su tareaId), "estudio" para aprender un tema, "repaso" para repasar y "practica" para ejercicios o cuestionarios.',
  '- Si hay un examen, el último día antes del examen debe ser de repaso general, y los temas débiles reciben más tiempo.',
  '- Los ids (tareaId y materiaId) deben copiarse exactamente de las listas; si no aplica, usa null.',
  '- No inventes tareas ni temas que no estén en la información recibida. Puedes dejar días sin actividades si no hacen falta.',
].join('\n');

function lineaTarea(t) {
  const estado = t.vencida ? ' (VENCIDA)' : t.estado === 'en_progreso' ? ' (en progreso)' : '';
  const desc = t.descripcion ? ` — ${t.descripcion.slice(0, 200)}` : '';
  return `- id=${t.id} · [prioridad ${t.prioridad}] ${t.titulo} · materia: ${t.materia} (materiaId=${t.materiaId}) · entrega: ${formatoFecha.format(t.fechaLimite)}${estado}${desc}`;
}

function mensajePlan(c) {
  const partes = [
    `Hoy es ${nombreDia(c.desde)} (${c.desde}).`,
    `Rango del plan: del ${c.desde} al ${c.hasta}.`,
    `Hora de inicio diaria: ${c.horaInicio}. Máximo ${c.horasPorDia} horas de estudio por día.`,
    c.finesDeSemana ? 'Se puede estudiar sábado y domingo.' : 'NO programes actividades sábado ni domingo.',
    `Enfoque del plan: ${c.enfoque}`,
    c.intensidad ? `Intensidad elegida: ${c.intensidad}.` : '',
  ].filter(Boolean);
  if (c.temasPrioridad) {
    partes.push('', `Temas que el estudiante quiere PRIORIZAR (dales más tiempo y empieza por ellos): ${c.temasPrioridad}`);
  }
  if (c.materias.length) {
    partes.push('', 'Materias:', ...c.materias.map((m) => `- materiaId=${m.id} · ${m.nombre}`));
  }
  if (c.examen) {
    partes.push('', `Examen: "${c.examen.titulo}" de ${c.examen.materia} el ${formatoFecha.format(c.examen.fecha)}.`);
    if (c.examen.temas) partes.push(`Temas del examen:\n${c.examen.temas}`);
  }
  if (c.temasDebiles.length) {
    partes.push('', `Temas débiles según sus cuestionarios (dales más tiempo): ${c.temasDebiles.map((t) => t.tema).join(', ')}`);
  }
  if (c.examenesProximos?.length) {
    partes.push('', 'Exámenes próximos (ténlos en cuenta al repartir el tiempo):',
      ...c.examenesProximos.map((e) => `- "${e.titulo}" de ${e.materia} el ${formatoFecha.format(e.fecha)}`));
  }
  if (c.tarjetasPendientes?.total) {
    partes.push('', `Tiene ${c.tarjetasPendientes.total} tarjetas de memoria por repasar hoy${c.tarjetasPendientes.apuntes.length ? ` (de: ${c.tarjetasPendientes.apuntes.slice(0, 5).join(', ')})` : ''}. Incluye un bloque corto de "repaso" de tarjetas en los primeros días.`);
  }
  partes.push('', c.tareas.length ? 'Tareas pendientes:' : 'No hay tareas pendientes en este rango.', ...c.tareas.map(lineaTarea));
  if (c.apuntesTexto) {
    partes.push('', 'Apuntes del estudiante (temas a estudiar):', '"""', c.apuntesTexto, '"""');
  }
  return partes.join('\n');
}

/* ---------- Reorganizar un plan (JSON) ---------- */
const SISTEMA_REORGANIZAR = [
  BASE,
  'El estudiante no completó algunas actividades de su plan. Reorganízalas desde hoy.',
  'Devuelve un JSON con esta forma exacta:',
  `{ "resumen": "1 o 2 oraciones explicando qué cambiaste y por qué",
  ${ESQUEMA_DIAS} }`,
  'Reglas:',
  '- Incluye TODAS las actividades pendientes que siguen siendo útiles; puedes acortar o fusionar las que ya no alcanzan.',
  '- Respeta el rango de fechas, la hora de inicio y el máximo de horas por día. Agrega descansos entre bloques.',
  '- Da prioridad a lo que tiene fecha de entrega más cercana y a lo de prioridad alta.',
  '- No repitas actividades que ya están completadas. Copia los ids exactamente o usa null.',
].join('\n');

function mensajeReorganizar(c) {
  const act = (a) => `- ${a.fecha} ${a.inicio}-${a.fin} · ${a.tipo} · ${a.titulo}${a.descripcion ? ` — ${a.descripcion}` : ''} (tareaId=${a.tareaId || 'null'}, materiaId=${a.materiaId || 'null'})`;
  return [
    `Hoy es ${nombreDia(c.desde)} (${c.desde}).`,
    `Nuevo rango: del ${c.desde} al ${c.hasta}. Hora de inicio diaria: ${c.horaInicio}. Máximo ${c.horasPorDia} horas por día.`,
    `Plan: "${c.plan.titulo}".`,
    '',
    'Actividades pendientes (reprogramar):',
    ...c.pendientes.map(act),
    '',
    'Actividades ya completadas (no repetir):',
    ...(c.completadas.length ? c.completadas.map(act) : ['- ninguna']),
    '',
    c.tareas.length ? 'Tareas pendientes relacionadas:' : '',
    ...c.tareas.map(lineaTarea),
  ].join('\n');
}

/* ---------- Cuestionario (JSON) ---------- */
const DIFICULTAD = {
  facil: 'fácil: preguntas directas de definiciones y conceptos básicos',
  media: 'media: preguntas que piden comprender y relacionar conceptos',
  dificil: 'difícil: preguntas de aplicación, análisis y casos prácticos',
};

const SISTEMA_CUESTIONARIO = [
  BASE,
  'Creas cuestionarios de opción múltiple para preparar exámenes, basados SOLO en el material recibido.',
  'Devuelve un JSON con esta forma exacta:',
  `{ "titulo": "título corto del cuestionario",
  "preguntas": [
    { "pregunta": "texto de la pregunta",
      "opciones": ["opción A", "opción B", "opción C", "opción D"],
      "correcta": 0,
      "explicacion": "por qué la respuesta correcta es correcta y por qué las otras no (máximo 3 oraciones)",
      "tema": "tema corto al que pertenece la pregunta (2 a 4 palabras)",
      "apunteId": "id del apunte de donde sale la pregunta (aparece como [apunteId=...]) o null" } ] }`,
  'Reglas:',
  '- Exactamente 4 opciones por pregunta, todas plausibles y distintas; solo una correcta. "correcta" es el índice (0 a 3).',
  '- No uses opciones como "todas las anteriores" o "ninguna de las anteriores".',
  '- Cubre temas variados del material y no repitas preguntas.',
  '- Si el estudiante eligió temas, todas las preguntas deben ser de esos temas.',
  '- Copia el apunteId exactamente como aparece en el material; si la pregunta no sale de un apunte, usa null.',
].join('\n');

function mensajeCuestionario(c) {
  return [
    `Crea ${c.numPreguntas} preguntas de dificultad ${DIFICULTAD[c.dificultad]}.`,
    c.examen ? `Son para preparar el examen "${c.examen.titulo}" de ${c.examen.materia}.${c.examen.temas ? ` Temas del examen:\n${c.examen.temas}` : ''}` : '',
    c.temas?.length ? `Temas elegidos por el estudiante (pregunta SOLO de estos): ${c.temas.join('; ')}.` : '',
    c.temasDebiles?.length ? `Incluye más preguntas de estos temas débiles: ${c.temasDebiles.map((t) => t.tema).join(', ')}.` : '',
    '',
    'Material de estudio:',
    '"""',
    c.apuntesTexto || '(sin apuntes: usa solo los temas del examen)',
    '"""',
  ].join('\n');
}

/* ---------- Tarjetas de memoria (JSON) ---------- */
const SISTEMA_TARJETAS = [
  BASE,
  'Creas tarjetas de memoria (flashcards) para memorizar conceptos, basadas SOLO en el apunte recibido.',
  'Devuelve un JSON con esta forma exacta:',
  '{ "tarjetas": [ { "frente": "pregunta o concepto (máximo 150 caracteres)", "reverso": "respuesta clara y breve (máximo 300 caracteres)" } ] }',
  'Reglas: una idea por tarjeta, preguntas concretas, sin repetir conceptos.',
].join('\n');

function mensajeTarjetas(c) {
  return [
    `Crea ${c.cantidad} tarjetas.`,
    '',
    'Apunte:',
    '"""',
    c.apuntesTexto,
    '"""',
  ].join('\n');
}

module.exports = {
  SISTEMA_RESUMEN, mensajeResumen,
  SISTEMA_PLAN, mensajePlan,
  SISTEMA_REORGANIZAR, mensajeReorganizar,
  SISTEMA_CUESTIONARIO, mensajeCuestionario,
  SISTEMA_TARJETAS, mensajeTarjetas,
};
