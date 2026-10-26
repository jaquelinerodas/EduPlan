/** Fechas de calendario ('YYYY-MM-DD') en la zona horaria del sistema (Guatemala). */
const { config } = require('../config/env');

const formatoISO = new Intl.DateTimeFormat('en-CA', {
  timeZone: config.zonaHoraria, year: 'numeric', month: '2-digit', day: '2-digit',
});
const formatoDia = new Intl.DateTimeFormat('es-GT', {
  timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
});

/** Fecha de hoy en Guatemala, 'YYYY-MM-DD'. */
const hoy = () => formatoISO.format(new Date());

/** Fecha local de un instante (Date o ISO). */
const fechaLocal = (instante) => formatoISO.format(new Date(instante));

function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diferenciaDias(desde, hasta) {
  return Math.round((new Date(`${hasta}T00:00:00Z`) - new Date(`${desde}T00:00:00Z`)) / 86400000);
}

/** 0 = domingo ... 6 = sábado */
const diaDeSemana = (fecha) => new Date(`${fecha}T00:00:00Z`).getUTCDay();

const esFinDeSemana = (fecha) => [0, 6].includes(diaDeSemana(fecha));

/** "lunes, 26 de octubre" */
const nombreDia = (fecha) => formatoDia.format(new Date(`${fecha}T00:00:00Z`));

const REGEX_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Normaliza "8:00", "08:00" o "08:00:00" a "08:00"; devuelve null si no es válida. */
function normalizarHora(valor) {
  const m = String(valor || '').trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const hora = `${m[1].padStart(2, '0')}:${m[2]}`;
  return REGEX_HORA.test(hora) ? hora : null;
}

const aMinutos = (hora) => {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
};

const desdeMinutos = (minutos) =>
  `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;

module.exports = {
  hoy, fechaLocal, sumarDias, diferenciaDias, diaDeSemana, esFinDeSemana, nombreDia,
  normalizarHora, aMinutos, desdeMinutos, REGEX_HORA,
};
