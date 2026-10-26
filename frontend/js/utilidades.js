/** Funciones de apoyo: escape de HTML, fechas y textos. */

/** Escapa texto del usuario antes de insertarlo como HTML (evita XSS). */
export function esc(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Solo acepta colores #RRGGBB (se usan dentro de atributos style). */
export const colorSeguro = (c) => (/^#[0-9A-Fa-f]{6}$/.test(c || '') ? c : '#2340A0');

const ZONA = Intl.DateTimeFormat().resolvedOptions().timeZone;
const fmtDiaLargo = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtFechaCorta = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
const fmtFechaHora = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const fmtHora = new Intl.DateTimeFormat('es', { hour: 'numeric', minute: '2-digit' });
const fmtDiaSemana = new Intl.DateTimeFormat('es', { weekday: 'short' });
const fmtFechaCompleta = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' });

const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

export const formato = {
  diaLargo: (d) => fmtDiaLargo.format(new Date(d)),
  diaLargoTitulo: (d) => mayuscula(fmtDiaLargo.format(new Date(d))),
  fechaCorta: (d) => fmtFechaCorta.format(new Date(d)),
  fechaHora: (d) => fmtFechaHora.format(new Date(d)),
  hora: (d) => fmtHora.format(new Date(d)),
  diaSemana: (d) => mayuscula(fmtDiaSemana.format(new Date(d)).replace('.', '')),
  fechaCompleta: (d) => fmtFechaCompleta.format(new Date(d)),
};

/** Inicio del día local (00:00) de una fecha. */
export function inicioDelDia(fecha = new Date()) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Diferencia en días de calendario entre hoy y la fecha (0 = hoy, 1 = mañana, -1 = ayer). */
export function diasHasta(fecha) {
  const ms = inicioDelDia(fecha) - inicioDelDia();
  return Math.round(ms / 86400000);
}

/**
 * Describe una fecha de entrega en lenguaje natural y devuelve la clase visual:
 * vencida (rojo), urgente (marcatextos: hoy o mañana) o normal.
 */
export function describirEntrega(tarea) {
  const fecha = new Date(tarea.fechaLimite);
  const dias = diasHasta(fecha);
  const hora = formato.hora(fecha);

  if (tarea.estado === 'completada') {
    return { texto: `Entregada · ${formato.fechaCorta(fecha)}`, clase: 'fecha--hecha' };
  }
  if (fecha < new Date()) {
    const texto = dias === 0 ? `Venció hoy a las ${hora}` : dias === -1 ? 'Venció ayer' : `Venció hace ${-dias} días`;
    return { texto, clase: 'fecha--vencida' };
  }
  if (dias === 0) return { texto: `Hoy, ${hora}`, clase: 'fecha--urgente' };
  if (dias === 1) return { texto: `Mañana, ${hora}`, clase: 'fecha--urgente' };
  if (dias < 7) return { texto: `${formato.diaLargo(fecha)}, ${hora}`, clase: '' };
  return { texto: formato.fechaHora(fecha), clase: '' };
}

/** Valor para <input type="datetime-local"> en la hora local del navegador. */
export function aEntradaFechaHora(fecha) {
  const d = new Date(fecha);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convierte el valor del datetime-local a ISO con la zona del navegador. */
export const desdeEntradaFechaHora = (valor) => (valor ? new Date(valor).toISOString() : undefined);

export function saludo() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export const primerNombre = (nombre) => String(nombre || '').trim().split(/\s+/)[0] || 'estudiante';

export const iniciales = (nombre) =>
  String(nombre || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const ESTADOS = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
};

export const PRIORIDADES = { alta: 'Alta', media: 'Media', baja: 'Baja' };

export const COLORES_MATERIA = ['#2563EB', '#7C3AED', '#DB2777', '#DC2626', '#EA580C', '#CA8A04', '#16A34A', '#0D9488', '#0891B2', '#475569'];

export { ZONA };
