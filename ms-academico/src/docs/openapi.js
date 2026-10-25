/**
 * Documentación OpenAPI 3 de ms-academico.
 * Swagger UI: /api/docs   ·   JSON (importable en Postman): /api/docs.json
 */
const { version } = require('../../package.json');

const ref = (nombre) => ({ $ref: `#/components/schemas/${nombre}` });
const json = (schema) => ({ content: { 'application/json': { schema } } });
const idParam = (nombre = 'id') => ({ name: nombre, in: 'path', required: true, schema: { type: 'string', format: 'uuid' } });
const seguro = [{ bearerAuth: [] }];

const err = (descripcion) => ({ description: descripcion, ...json(ref('Error')) });
const ERRORES = {
  400: err('Datos inválidos (ver detalles)'),
  401: err('Token faltante, inválido o expirado'),
  404: err('No encontrado (o pertenece a otro usuario)'),
};

const crud = ({ tag, ruta, singular, plural, esquema, entrada, filtros = [], extra = {} }) => ({
  [ruta]: {
    get: {
      tags: [tag], summary: `Listar ${plural}`, security: seguro, parameters: filtros,
      responses: { 200: { description: 'Lista', ...json({ type: 'object', properties: { [plural]: { type: 'array', items: ref(esquema) } } }) }, 400: ERRORES[400], 401: ERRORES[401] },
    },
    post: {
      tags: [tag], summary: `Crear ${singular}`, security: seguro,
      requestBody: { required: true, ...json(ref(entrada)) },
      responses: { 201: { description: 'Creado', ...json({ type: 'object', properties: { [singular]: ref(esquema) } }) }, ...ERRORES },
    },
  },
  [`${ruta}/{id}`]: {
    parameters: [idParam()],
    get: { tags: [tag], summary: `Obtener ${singular}`, security: seguro, responses: { 200: { description: 'OK', ...json({ type: 'object', properties: { [singular]: ref(esquema) } }) }, ...ERRORES } },
    put: {
      tags: [tag], summary: `Editar ${singular} (solo los campos enviados)`, security: seguro,
      requestBody: { required: true, ...json(ref(entrada)) },
      responses: { 200: { description: 'Actualizado', ...json({ type: 'object', properties: { [singular]: ref(esquema) } }) }, ...ERRORES },
    },
    delete: { tags: [tag], summary: `Eliminar ${singular}`, security: seguro, responses: { 204: { description: 'Eliminado' }, ...ERRORES } },
  },
  ...extra,
});

const query = (name, schema, description) => ({ name, in: 'query', schema, description });

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'EduPlan · ms-academico',
    version,
    description:
      'Microservicio de materias, tareas, apuntes y asistente de IA.\n\n' +
      'Todas las rutas (excepto `/api/health`) requieren el JWT emitido por ms-auth. ' +
      'Obtén uno en `/auth/prueba`, presiona **Authorize** y pégalo. ' +
      'Cada usuario solo ve y modifica su propia información (RF09).',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Materias', description: 'RF03 · HU02' },
    { name: 'Tareas', description: 'RF04, RF06 · HU03, HU04, HU05' },
    { name: 'Apuntes', description: 'RF05 · HU06' },
    { name: 'Asistente IA', description: 'RF07, RF08 · HU07, HU08' },
    { name: 'General', description: 'Panel y monitoreo (HU10)' },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              codigo: { type: 'string', example: 'VALIDACION' },
              mensaje: { type: 'string', example: 'Datos inválidos' },
              detalles: { type: 'array', items: { type: 'string' }, example: ['titulo es obligatorio'] },
            },
          },
        },
      },
      MateriaEntrada: {
        type: 'object', required: ['nombre'],
        properties: {
          nombre: { type: 'string', maxLength: 120, example: 'Desarrollo Web I' },
          docente: { type: 'string', example: 'Ing. Guillermo Pisqui' },
          descripcion: { type: 'string', example: 'Microservicios y Docker' },
          color: { type: 'string', example: '#2563EB' },
        },
      },
      Materia: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }, nombre: { type: 'string' }, docente: { type: 'string', nullable: true },
          descripcion: { type: 'string', nullable: true }, color: { type: 'string' },
          totalTareas: { type: 'integer' }, pendientes: { type: 'integer' }, enProgreso: { type: 'integer' },
          completadas: { type: 'integer' }, vencidas: { type: 'integer' },
          proximaEntrega: { type: 'string', format: 'date-time', nullable: true },
          creadoEn: { type: 'string', format: 'date-time' }, actualizadoEn: { type: 'string', format: 'date-time' },
        },
      },
      TareaEntrada: {
        type: 'object', required: ['materiaId', 'titulo', 'fechaLimite'],
        properties: {
          materiaId: { type: 'string', format: 'uuid' },
          titulo: { type: 'string', maxLength: 200, example: 'Entregar modelo relacional' },
          descripcion: { type: 'string', example: 'Subir scripts y diagrama ER' },
          fechaLimite: { type: 'string', example: '2026-11-05T18:00:00-06:00', description: 'ISO 8601, o YYYY-MM-DD (se toma 23:59 hora de Guatemala)' },
          prioridad: { type: 'string', enum: ['baja', 'media', 'alta'], default: 'media' },
          estado: { type: 'string', enum: ['pendiente', 'en_progreso', 'completada'], default: 'pendiente' },
        },
      },
      Tarea: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }, titulo: { type: 'string' }, descripcion: { type: 'string', nullable: true },
          fechaLimite: { type: 'string', format: 'date-time' },
          prioridad: { type: 'string', enum: ['baja', 'media', 'alta'] },
          estado: { type: 'string', enum: ['pendiente', 'en_progreso', 'completada'] },
          completadaEn: { type: 'string', format: 'date-time', nullable: true },
          vencida: { type: 'boolean' },
          materiaId: { type: 'string', format: 'uuid' }, materia: { type: 'string' }, materiaColor: { type: 'string' },
          creadoEn: { type: 'string', format: 'date-time' }, actualizadoEn: { type: 'string', format: 'date-time' },
        },
      },
      ApunteEntrada: {
        type: 'object', required: ['materiaId', 'titulo', 'contenido'],
        properties: {
          materiaId: { type: 'string', format: 'uuid' },
          titulo: { type: 'string', maxLength: 200, example: 'Qué es un proxy inverso' },
          contenido: { type: 'string', example: 'Nginx recibe las peticiones y las reenvía al servicio interno según la ruta...' },
        },
      },
      Apunte: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }, titulo: { type: 'string' }, contenido: { type: 'string' },
          resumenIa: { type: 'string', nullable: true }, resumenGeneradoEn: { type: 'string', format: 'date-time', nullable: true },
          materiaId: { type: 'string', format: 'uuid' }, materia: { type: 'string' }, materiaColor: { type: 'string' },
          creadoEn: { type: 'string', format: 'date-time' }, actualizadoEn: { type: 'string', format: 'date-time' },
        },
      },
      Plan: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          fechaInicio: { type: 'string', format: 'date' }, fechaFin: { type: 'string', format: 'date' },
          contenido: { type: 'string', description: 'Plan en Markdown generado por la IA' },
          tareasIncluidas: { type: 'array', items: { type: 'string', format: 'uuid' } },
          modeloIa: { type: 'string', example: 'gemini:gemini-3.5-flash-lite' },
          creadoEn: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['General'], summary: 'Estado del servicio, base de datos e IA (HU10)',
        responses: { 200: { description: 'Funcionando' }, 503: { description: 'Sin conexión a la base de datos' } },
      },
    },
    '/api/resumen': {
      get: {
        tags: ['General'], summary: 'Totales para el panel principal', security: seguro,
        responses: { 200: { description: 'Conteo de materias, apuntes y tareas por estado' }, 401: ERRORES[401] },
      },
    },
    ...crud({ tag: 'Materias', ruta: '/api/materias', singular: 'materia', plural: 'materias', esquema: 'Materia', entrada: 'MateriaEntrada' }),
    ...crud({
      tag: 'Tareas', ruta: '/api/tareas', singular: 'tarea', plural: 'tareas', esquema: 'Tarea', entrada: 'TareaEntrada',
      filtros: [
        query('materiaId', { type: 'string', format: 'uuid' }, 'Filtrar por materia'),
        query('estado', { type: 'string', enum: ['pendiente', 'en_progreso', 'completada'] }, 'Filtrar por estado'),
        query('prioridad', { type: 'string', enum: ['baja', 'media', 'alta'] }, 'Filtrar por prioridad'),
        query('desde', { type: 'string', format: 'date' }, 'Fecha límite desde (YYYY-MM-DD)'),
        query('hasta', { type: 'string', format: 'date' }, 'Fecha límite hasta, inclusive (YYYY-MM-DD)'),
        query('vencidas', { type: 'string', enum: ['true', 'false'] }, 'Solo vencidas / solo no vencidas'),
      ],
      extra: {
        '/api/tareas/{id}/estado': {
          patch: {
            tags: ['Tareas'], summary: 'Cambiar estado / marcar como completada (HU04)', security: seguro,
            parameters: [idParam()],
            requestBody: { required: true, ...json({ type: 'object', required: ['estado'], properties: { estado: { type: 'string', enum: ['pendiente', 'en_progreso', 'completada'], example: 'completada' } } }) },
            responses: { 200: { description: 'Tarea actualizada', ...json({ type: 'object', properties: { tarea: ref('Tarea') } }) }, ...ERRORES },
          },
        },
      },
    }),
    ...crud({
      tag: 'Apuntes', ruta: '/api/apuntes', singular: 'apunte', plural: 'apuntes', esquema: 'Apunte', entrada: 'ApunteEntrada',
      filtros: [
        query('materiaId', { type: 'string', format: 'uuid' }, 'Filtrar por materia'),
        query('buscar', { type: 'string' }, 'Buscar en título y contenido'),
      ],
    }),
    '/api/ia/resumen/{apunteId}': {
      post: {
        tags: ['Asistente IA'], summary: 'Resumir un apunte con IA (RF07)', security: seguro,
        parameters: [idParam('apunteId')],
        responses: {
          200: { description: 'Apunte con resumenIa', ...json({ type: 'object', properties: { apunte: ref('Apunte') } }) },
          ...ERRORES,
          429: err('Límite de solicitudes a la IA'), 502: err('Error de la API de IA'), 503: err('IA no configurada'),
        },
      },
    },
    '/api/ia/plan-estudio': {
      post: {
        tags: ['Asistente IA'], summary: 'Generar plan de estudio con las tareas pendientes (RF08)', security: seguro,
        requestBody: {
          required: false,
          ...json({ type: 'object', properties: { dias: { type: 'integer', minimum: 1, maximum: 30, default: 7 }, horasPorDia: { type: 'integer', minimum: 1, maximum: 12, default: 3 } } }),
        },
        responses: {
          201: { description: 'Plan generado y guardado', ...json({ type: 'object', properties: { plan: ref('Plan') } }) },
          400: ERRORES[400], 401: ERRORES[401],
          422: err('No hay tareas pendientes en ese rango'),
          429: err('Límite de solicitudes a la IA'), 502: err('Error de la API de IA'), 503: err('IA no configurada'),
        },
      },
    },
    '/api/ia/planes': {
      get: {
        tags: ['Asistente IA'], summary: 'Historial de planes (últimos 20)', security: seguro,
        responses: { 200: { description: 'Lista', ...json({ type: 'object', properties: { planes: { type: 'array', items: ref('Plan') } } }) }, 401: ERRORES[401] },
      },
    },
    '/api/ia/planes/{id}': {
      parameters: [idParam()],
      get: { tags: ['Asistente IA'], summary: 'Obtener un plan', security: seguro, responses: { 200: { description: 'OK', ...json({ type: 'object', properties: { plan: ref('Plan') } }) }, ...ERRORES } },
      delete: { tags: ['Asistente IA'], summary: 'Eliminar un plan', security: seguro, responses: { 204: { description: 'Eliminado' }, ...ERRORES } },
    },
  },
};
