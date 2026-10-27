/**
 * Validador sencillo basado en un esquema. Devuelve solo los campos conocidos
 * (ya limpios) o lanza un AppError 400 con la lista de problemas encontrados.
 *
 *   validar(req.body, { titulo: { tipo: 'texto', requerido: true, max: 200 } })
 *   validar(req.body, esquema, { parcial: true })   // para ediciones
 */
const AppError = require('./AppError');

const REGEX = {
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  fecha: /^\d{4}-\d{2}-\d{2}$/,
  color: /^#[0-9A-Fa-f]{6}$/,
};

function esFechaValida(texto) {
  if (!REGEX.fecha.test(texto)) return false;
  const [a, m, d] = texto.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

function validarCampo(nombre, valor, regla) {
  switch (regla.tipo) {
    case 'texto': {
      if (typeof valor !== 'string') return { error: `${nombre} debe ser texto` };
      const limpio = valor.trim();
      if (limpio === '') {
        return regla.requerido ? { error: `${nombre} no puede estar vacío` } : { valor: null };
      }
      if (regla.max && limpio.length > regla.max) return { error: `${nombre} admite máximo ${regla.max} caracteres` };
      return { valor: limpio };
    }
    case 'uuid':
      return typeof valor === 'string' && REGEX.uuid.test(valor)
        ? { valor: valor.toLowerCase() }
        : { error: `${nombre} debe ser un UUID válido` };
    case 'enum':
      return regla.valores.includes(valor)
        ? { valor }
        : { error: `${nombre} debe ser uno de: ${regla.valores.join(', ')}` };
    case 'color':
      return typeof valor === 'string' && REGEX.color.test(valor)
        ? { valor: valor.toUpperCase() }
        : { error: `${nombre} debe tener formato #RRGGBB` };
    case 'fecha':
      return typeof valor === 'string' && esFechaValida(valor)
        ? { valor }
        : { error: `${nombre} debe tener formato YYYY-MM-DD` };
    case 'fechaHora': {
      if (typeof valor !== 'string') return { error: `${nombre} debe ser una fecha` };
      // Solo fecha => se entrega al final del día (hora local de Guatemala)
      if (REGEX.fecha.test(valor)) {
        return esFechaValida(valor) ? { valor: `${valor} 23:59:00` } : { error: `${nombre} no es una fecha válida` };
      }
      return Number.isNaN(Date.parse(valor))
        ? { error: `${nombre} debe tener formato ISO 8601 (ej. 2026-11-05T18:00:00-06:00)` }
        : { valor };
    }
    case 'entero': {
      const n = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
      if (!Number.isInteger(n)) return { error: `${nombre} debe ser un número entero` };
      if (regla.min !== undefined && n < regla.min) return { error: `${nombre} debe ser mayor o igual a ${regla.min}` };
      if (regla.max !== undefined && n > regla.max) return { error: `${nombre} debe ser menor o igual a ${regla.max}` };
      return { valor: n };
    }
    case 'hora': {
      const m = typeof valor === 'string' && valor.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
      return m ? { valor: `${m[1].padStart(2, '0')}:${m[2]}` } : { error: `${nombre} debe tener formato HH:MM` };
    }
    case 'booleano':
      if (typeof valor === 'boolean') return { valor };
      if (valor === 'true' || valor === 'false') return { valor: valor === 'true' };
      return { error: `${nombre} debe ser verdadero o falso` };
    case 'listaUuid': {
      if (!Array.isArray(valor)) return { error: `${nombre} debe ser una lista` };
      if (regla.min && valor.length < regla.min) return { error: `${nombre} debe tener al menos ${regla.min} elemento(s)` };
      if (regla.max && valor.length > regla.max) return { error: `${nombre} admite máximo ${regla.max} elementos` };
      if (!valor.every((v) => typeof v === 'string' && REGEX.uuid.test(v))) return { error: `${nombre} contiene ids inválidos` };
      return { valor: [...new Set(valor.map((v) => v.toLowerCase()))] };
    }
    case 'listaTexto': {
      if (!Array.isArray(valor)) return { error: `${nombre} debe ser una lista` };
      if (!valor.every((v) => typeof v === 'string')) return { error: `${nombre} solo admite textos` };
      const limpios = [...new Set(valor.map((v) => v.trim()).filter(Boolean))];
      if (regla.max && limpios.length > regla.max) return { error: `${nombre} admite máximo ${regla.max} elementos` };
      if (regla.maxLargo && limpios.some((v) => v.length > regla.maxLargo)) {
        return { error: `cada elemento de ${nombre} admite máximo ${regla.maxLargo} caracteres` };
      }
      return { valor: limpios };
    }
    default:
      throw new Error(`Tipo de regla desconocido: ${regla.tipo}`);
  }
}

function validar(datos, esquema, { parcial = false } = {}) {
  const entrada = datos && typeof datos === 'object' ? datos : {};
  const resultado = {};
  const errores = [];

  for (const [nombre, regla] of Object.entries(esquema)) {
    const valor = entrada[nombre];
    const ausente = valor === undefined || (valor === '' && regla.tipo !== 'texto');

    if (ausente) {
      if (regla.requerido && !parcial) errores.push(`${nombre} es obligatorio`);
      continue;
    }
    if (valor === null) {
      if (regla.requerido) errores.push(`${nombre} no puede ser nulo`);
      else resultado[nombre] = null;
      continue;
    }

    const r = validarCampo(nombre, valor, regla);
    if (r.error) errores.push(r.error);
    else resultado[nombre] = r.valor;
  }

  if (errores.length) {
    throw new AppError('Datos inválidos', 400, 'VALIDACION', errores);
  }
  return resultado;
}

function validarId(id, nombre = 'id') {
  if (!REGEX.uuid.test(id || '')) {
    throw new AppError(`${nombre} no es un UUID válido`, 400, 'ID_INVALIDO');
  }
  return id.toLowerCase();
}

module.exports = { validar, validarId };
