/**
 * Cliente de la API. Todas las peticiones pasan por Nginx:
 *   /auth/* -> ms-auth      /api/* -> ms-academico
 * y llevan el encabezado Authorization: Bearer <JWT>.
 */
import { obtenerToken, cerrarSesion } from './sesion.js';

export class ErrorApi extends Error {
  constructor(mensaje, estado, codigo, detalles) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles || [];
  }
}

async function peticion(metodo, ruta, cuerpo) {
  const opciones = {
    method: metodo,
    headers: { Accept: 'application/json' },
  };
  const token = obtenerToken();
  if (token) opciones.headers.Authorization = `Bearer ${token}`;
  if (cuerpo !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(cuerpo);
  }

  let respuesta;
  try {
    respuesta = await fetch(ruta, opciones);
  } catch {
    throw new ErrorApi('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.', 0, 'SIN_CONEXION');
  }

  if (respuesta.status === 204) return null;

  let datos = null;
  try { datos = await respuesta.json(); } catch { /* respuesta sin JSON */ }

  if (!respuesta.ok) {
    const error = datos?.error || {};
    if (respuesta.status === 401 && ['TOKEN_EXPIRADO', 'TOKEN_INVALIDO', 'TOKEN_REQUERIDO', 'USUARIO_NO_EXISTE'].includes(error.codigo)) {
      cerrarSesion(error.codigo === 'TOKEN_EXPIRADO' ? 'expirada' : 'invalida');
    }
    throw new ErrorApi(
      error.mensaje || `El servidor respondió con un error (${respuesta.status}).`,
      respuesta.status,
      error.codigo || 'ERROR',
      error.detalles
    );
  }
  return datos;
}

const conFiltros = (ruta, filtros = {}) => {
  const parametros = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== '') parametros.set(clave, valor);
  }
  const texto = parametros.toString();
  return texto ? `${ruta}?${texto}` : ruta;
};

export const api = {
  // ms-auth
  perfil: () => peticion('GET', '/auth/me'),
  login: (datos) => peticion('POST', '/auth/login', datos),
  registro: (datos) => peticion('POST', '/auth/registro', datos),
  saludAuth: () => peticion('GET', '/auth/health'),

  // ms-academico
  resumen: () => peticion('GET', '/api/resumen'),
  saludAcademico: () => peticion('GET', '/api/health'),

  materias: () => peticion('GET', '/api/materias'),
  crearMateria: (datos) => peticion('POST', '/api/materias', datos),
  editarMateria: (id, datos) => peticion('PUT', `/api/materias/${id}`, datos),
  borrarMateria: (id) => peticion('DELETE', `/api/materias/${id}`),

  tareas: (filtros) => peticion('GET', conFiltros('/api/tareas', filtros)),
  crearTarea: (datos) => peticion('POST', '/api/tareas', datos),
  editarTarea: (id, datos) => peticion('PUT', `/api/tareas/${id}`, datos),
  cambiarEstado: (id, estado) => peticion('PATCH', `/api/tareas/${id}/estado`, { estado }),
  borrarTarea: (id) => peticion('DELETE', `/api/tareas/${id}`),

  apuntes: (filtros) => peticion('GET', conFiltros('/api/apuntes', filtros)),
  apunte: (id) => peticion('GET', `/api/apuntes/${id}`),
  crearApunte: (datos) => peticion('POST', '/api/apuntes', datos),
  editarApunte: (id, datos) => peticion('PUT', `/api/apuntes/${id}`, datos),
  borrarApunte: (id) => peticion('DELETE', `/api/apuntes/${id}`),

  resumirApunte: (id) => peticion('POST', `/api/ia/resumen/${id}`),

  alertas: () => peticion('GET', '/api/alertas'),
  calendario: (desde, hasta) => peticion('GET', conFiltros('/api/calendario', { desde, hasta })),

  examenes: (filtros) => peticion('GET', conFiltros('/api/examenes', filtros)),
  crearExamen: (datos) => peticion('POST', '/api/examenes', datos),
  editarExamen: (id, datos) => peticion('PUT', `/api/examenes/${id}`, datos),
  borrarExamen: (id) => peticion('DELETE', `/api/examenes/${id}`),

  planes: () => peticion('GET', '/api/planes'),
  plan: (id) => peticion('GET', `/api/planes/${id}`),
  generarPlan: (opciones) => peticion('POST', '/api/planes', opciones),
  borrarPlan: (id) => peticion('DELETE', `/api/planes/${id}`),
  marcarActividad: (planId, actividadId, completada) => peticion('PATCH', `/api/planes/${planId}/actividades/${actividadId}`, { completada }),
  proponerReorganizacion: (planId) => peticion('POST', `/api/planes/${planId}/reorganizar`),
  aplicarReorganizacion: (planId, dias) => peticion('POST', `/api/planes/${planId}/aplicar`, { dias }),

  cuestionarios: (filtros) => peticion('GET', conFiltros('/api/cuestionarios', filtros)),
  cuestionario: (id) => peticion('GET', `/api/cuestionarios/${id}`),
  generarCuestionario: (opciones) => peticion('POST', '/api/cuestionarios', opciones),
  responderCuestionario: (id, respuestas) => peticion('POST', `/api/cuestionarios/${id}/intentos`, { respuestas }),
  revisionCuestionario: (id) => peticion('GET', `/api/cuestionarios/${id}/revision`),
  borrarCuestionario: (id) => peticion('DELETE', `/api/cuestionarios/${id}`),

  tarjetas: (filtros) => peticion('GET', conFiltros('/api/flashcards', filtros)),
  resumenTarjetas: () => peticion('GET', '/api/flashcards/resumen'),
  crearTarjeta: (datos) => peticion('POST', '/api/flashcards', datos),
  generarTarjetas: (datos) => peticion('POST', '/api/flashcards/generar', datos),
  editarTarjeta: (id, datos) => peticion('PUT', `/api/flashcards/${id}`, datos),
  repasarTarjeta: (id, calificacion) => peticion('POST', `/api/flashcards/${id}/repaso`, { calificacion }),
  borrarTarjeta: (id) => peticion('DELETE', `/api/flashcards/${id}`),
};
