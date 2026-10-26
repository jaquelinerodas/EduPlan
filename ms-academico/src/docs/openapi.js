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
    { name: 'Exámenes', description: 'Exámenes y parciales' },
    { name: 'Asistente IA', description: 'Resumen de apuntes (RF07, HU07)' },
    { name: 'Plan de estudio', description: 'Planes por día con IA y reorganización (RF08, HU08)' },
    { name: 'Cuestionarios', description: 'Preguntas de opción múltiple generadas con IA' },
    { name: 'Tarjetas de memoria', description: 'Flashcards con repaso espaciado' },
    { name: 'General', description: 'Panel, alertas, calendario y monitoreo (HU10)' },
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
          docente: { type: 'string', example: 'Ing. Andrea Morales' },
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
      ExamenEntrada: {
        type: 'object', required: ['materiaId', 'titulo', 'fecha'],
        properties: {
          materiaId: { type: 'string', format: 'uuid' },
          titulo: { type: 'string', example: 'Segundo parcial' },
          fecha: { type: 'string', example: '2026-11-10T09:00:00-06:00' },
          temas: { type: 'string', example: 'Normalización\nÍndices\nTransacciones' },
          notas: { type: 'string' },
        },
      },
      Examen: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }, titulo: { type: 'string' }, fecha: { type: 'string', format: 'date-time' },
          temas: { type: 'string', nullable: true }, notas: { type: 'string', nullable: true },
          materiaId: { type: 'string', format: 'uuid' }, materia: { type: 'string' }, materiaColor: { type: 'string' },
          cuestionarios: { type: 'integer' }, mejorPuntaje: { type: 'number', nullable: true }, planId: { type: 'string', nullable: true },
        },
      },
      PlanEntrada: {
        type: 'object',
        properties: {
          alcance: { type: 'string', enum: ['general', 'materia', 'apuntes', 'examen'], default: 'general' },
          materiaId: { type: 'string', format: 'uuid' },
          apunteIds: { type: 'array', items: { type: 'string', format: 'uuid' }, maxItems: 10 },
          examenId: { type: 'string', format: 'uuid' },
          dias: { type: 'integer', minimum: 1, maximum: 30, default: 7 },
          horasPorDia: { type: 'integer', minimum: 1, maximum: 8, default: 3 },
          horaInicio: { type: 'string', example: '18:00', default: '18:00' },
          finesDeSemana: { type: 'boolean', default: true },
        },
      },
      Actividad: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }, fecha: { type: 'string', format: 'date' },
          inicio: { type: 'string', example: '18:00' }, fin: { type: 'string', example: '18:50' },
          tipo: { type: 'string', enum: ['estudio', 'tarea', 'repaso', 'practica', 'descanso'] },
          titulo: { type: 'string' }, descripcion: { type: 'string', nullable: true },
          completada: { type: 'boolean' }, tareaId: { type: 'string', nullable: true }, materiaId: { type: 'string', nullable: true },
        },
      },
      Dia: {
        type: 'object',
        properties: { fecha: { type: 'string', format: 'date' }, actividades: { type: 'array', items: { $ref: '#/components/schemas/Actividad' } } },
      },
      Propuesta: {
        type: 'object',
        properties: {
          planId: { type: 'string', format: 'uuid' }, resumen: { type: 'string' },
          desde: { type: 'string', format: 'date' }, hasta: { type: 'string', format: 'date' },
          pendientesAntes: { type: 'integer' }, dias: { type: 'array', items: { $ref: '#/components/schemas/Dia' } },
        },
      },
      CuestionarioEntrada: {
        type: 'object', required: ['fuente'],
        properties: {
          fuente: { type: 'string', enum: ['apuntes', 'materia', 'examen'] },
          apunteIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
          materiaId: { type: 'string', format: 'uuid' },
          examenId: { type: 'string', format: 'uuid' },
          numPreguntas: { type: 'integer', minimum: 3, maximum: 20, default: 10 },
          dificultad: { type: 'string', enum: ['facil', 'media', 'dificil'], default: 'media' },
        },
      },
      Cuestionario: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }, titulo: { type: 'string' }, dificultad: { type: 'string' },
          totalPreguntas: { type: 'integer' }, mejorPuntaje: { type: 'number', nullable: true },
          preguntas: { type: 'array', items: { type: 'object', properties: { pregunta: { type: 'string' }, opciones: { type: 'array', items: { type: 'string' } }, tema: { type: 'string' } } } },
        },
      },
      Resultado: {
        type: 'object',
        properties: {
          intento: { type: 'object', properties: { correctas: { type: 'integer' }, total: { type: 'integer' }, puntaje: { type: 'number' }, temasDebiles: { type: 'array', items: { type: 'string' } } } },
          revision: { type: 'array', items: { type: 'object', properties: { pregunta: { type: 'string' }, elegida: { type: 'integer', nullable: true }, correcta: { type: 'integer' }, esCorrecta: { type: 'boolean' }, explicacion: { type: 'string' } } } },
        },
      },
      Tarjeta: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }, frente: { type: 'string' }, reverso: { type: 'string' },
          proximoRepaso: { type: 'string', format: 'date' }, pendiente: { type: 'boolean' },
          intervaloDias: { type: 'integer' }, repeticiones: { type: 'integer' },
          proximosIntervalos: { type: 'object', properties: { olvidado: { type: 'integer' }, dificil: { type: 'integer' }, facil: { type: 'integer' } } },
        },
      },
      Alerta: {
        type: 'object',
        properties: {
          id: { type: 'string' }, tipo: { type: 'string', enum: ['tarea', 'examen', 'plan', 'tarjetas'] },
          nivel: { type: 'string', enum: ['urgente', 'aviso', 'info'] },
          titulo: { type: 'string' }, mensaje: { type: 'string' }, enlace: { type: 'string', example: '#/tareas?vencidas=true' },
        },
      },
      Plan: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }, titulo: { type: 'string' },
          alcance: { type: 'string', enum: ['general', 'materia', 'apuntes', 'examen'] },
          fechaInicio: { type: 'string', format: 'date' }, fechaFin: { type: 'string', format: 'date' },
          resumen: { type: 'string' }, consejos: { type: 'array', items: { type: 'string' } },
          totalActividades: { type: 'integer' }, completadas: { type: 'integer' }, atrasadas: { type: 'integer' },
          actividades: { type: 'array', items: { $ref: '#/components/schemas/Actividad' } },
          modeloIa: { type: 'string', example: 'gemini:gemini-3.5-flash-lite' },
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
    // ---------- Exámenes ----------
    ...crud({ tag: 'Exámenes', ruta: '/api/examenes', singular: 'examen', plural: 'examenes', esquema: 'Examen', entrada: 'ExamenEntrada',
      filtros: [
        query('materiaId', { type: 'string', format: 'uuid' }, 'Filtrar por materia'),
        query('periodo', { type: 'string', enum: ['proximos', 'pasados'] }, 'Próximos o pasados'),
      ] }),

    // ---------- Planes de estudio ----------
    '/api/planes': {
      get: {
        tags: ['Plan de estudio'], summary: 'Historial de planes con su avance', security: seguro,
        responses: { 200: { description: 'Lista', ...json({ type: 'object', properties: { planes: { type: 'array', items: ref('Plan') } } }) }, 401: ERRORES[401] },
      },
      post: {
        tags: ['Plan de estudio'], summary: 'Generar un plan por días con IA (RF08)', security: seguro,
        description: 'Alcance: `general` (todas las tareas), `materia` (requiere materiaId), `apuntes` (requiere apunteIds) o `examen` (requiere examenId; termina el día antes del examen).',
        requestBody: { required: false, ...json(ref('PlanEntrada')) },
        responses: {
          201: { description: 'Plan generado y guardado', ...json({ type: 'object', properties: { plan: ref('Plan') } }) },
          400: ERRORES[400], 401: ERRORES[401], 404: ERRORES[404],
          422: err('No hay contenido que planificar (SIN_TAREAS_PENDIENTES, SIN_CONTENIDO, EXAMEN_PASADO)'),
          429: err('Límite de solicitudes a la IA'), 502: err('Error de la API de IA'), 503: err('IA no configurada'),
        },
      },
    },
    '/api/planes/{id}': {
      parameters: [idParam()],
      get: { tags: ['Plan de estudio'], summary: 'Obtener un plan con sus actividades', security: seguro, responses: { 200: { description: 'OK', ...json({ type: 'object', properties: { plan: ref('Plan') } }) }, ...ERRORES } },
      delete: { tags: ['Plan de estudio'], summary: 'Eliminar un plan', security: seguro, responses: { 204: { description: 'Eliminado' }, ...ERRORES } },
    },
    '/api/planes/{id}/actividades/{actividadId}': {
      parameters: [idParam(), idParam('actividadId')],
      patch: {
        tags: ['Plan de estudio'], summary: 'Marcar una actividad como hecha o pendiente', security: seguro,
        requestBody: { required: true, ...json({ type: 'object', required: ['completada'], properties: { completada: { type: 'boolean' } } }) },
        responses: { 200: { description: 'Actividad actualizada', ...json({ type: 'object', properties: { actividad: ref('Actividad') } }) }, ...ERRORES },
      },
    },
    '/api/planes/{id}/reorganizar': {
      parameters: [idParam()],
      post: {
        tags: ['Plan de estudio'], summary: 'Proponer una reorganización de lo no completado (no guarda nada)', security: seguro,
        responses: {
          200: { description: 'Propuesta para revisar', ...json({ type: 'object', properties: { propuesta: ref('Propuesta') } }) },
          ...ERRORES, 422: err('No hay actividades pendientes (NADA_QUE_REORGANIZAR)'),
        },
      },
    },
    '/api/planes/{id}/aplicar': {
      parameters: [idParam()],
      post: {
        tags: ['Plan de estudio'], summary: 'Aplicar la propuesta aprobada por el estudiante', security: seguro,
        description: 'Reemplaza las actividades no completadas. Las completadas se conservan.',
        requestBody: { required: true, ...json({ type: 'object', required: ['dias'], properties: { dias: { type: 'array', items: ref('Dia') } } }) },
        responses: { 200: { description: 'Plan actualizado', ...json({ type: 'object', properties: { plan: ref('Plan') } }) }, ...ERRORES },
      },
    },

    // ---------- Cuestionarios ----------
    '/api/cuestionarios': {
      get: {
        tags: ['Cuestionarios'], summary: 'Listar cuestionarios con su mejor puntaje', security: seguro,
        parameters: [query('materiaId', { type: 'string', format: 'uuid' }), query('examenId', { type: 'string', format: 'uuid' })],
        responses: { 200: { description: 'Lista' }, 401: ERRORES[401] },
      },
      post: {
        tags: ['Cuestionarios'], summary: 'Generar un cuestionario de opción múltiple con IA', security: seguro,
        description: 'La respuesta NO incluye la opción correcta ni la explicación; se revelan al responder.',
        requestBody: { required: true, ...json(ref('CuestionarioEntrada')) },
        responses: {
          201: { description: 'Cuestionario creado', ...json({ type: 'object', properties: { cuestionario: ref('Cuestionario') } }) },
          ...ERRORES, 422: err('No hay apuntes (SIN_APUNTES)'), 429: err('Límite de IA'), 502: err('Error de la API de IA'),
        },
      },
    },
    '/api/cuestionarios/{id}': {
      parameters: [idParam()],
      get: { tags: ['Cuestionarios'], summary: 'Obtener preguntas (sin respuestas) e historial de intentos', security: seguro, responses: { 200: { description: 'OK', ...json({ type: 'object', properties: { cuestionario: ref('Cuestionario') } }) }, ...ERRORES } },
      delete: { tags: ['Cuestionarios'], summary: 'Eliminar cuestionario', security: seguro, responses: { 204: { description: 'Eliminado' }, ...ERRORES } },
    },
    '/api/cuestionarios/{id}/intentos': {
      parameters: [idParam()],
      post: {
        tags: ['Cuestionarios'], summary: 'Responder y calificar', security: seguro,
        requestBody: { required: true, ...json({ type: 'object', required: ['respuestas'], properties: { respuestas: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 3, nullable: true }, example: [1, 0, 3, 2, 1] } } }) },
        responses: { 201: { description: 'Calificación y revisión de cada pregunta', ...json(ref('Resultado')) }, ...ERRORES },
      },
    },
    '/api/cuestionarios/{id}/revision': {
      parameters: [idParam()],
      get: { tags: ['Cuestionarios'], summary: 'Revisión del último intento', security: seguro, responses: { 200: { description: 'OK', ...json(ref('Resultado')) }, ...ERRORES } },
    },

    // ---------- Tarjetas de memoria ----------
    '/api/flashcards': {
      get: {
        tags: ['Tarjetas de memoria'], summary: 'Listar tarjetas', security: seguro,
        parameters: [
          query('materiaId', { type: 'string', format: 'uuid' }),
          query('apunteId', { type: 'string', format: 'uuid' }),
          query('pendientes', { type: 'string', enum: ['true', 'false'] }, 'Solo las que toca repasar hoy'),
        ],
        responses: { 200: { description: 'Lista', ...json({ type: 'object', properties: { tarjetas: { type: 'array', items: ref('Tarjeta') } } }) }, 401: ERRORES[401] },
      },
      post: {
        tags: ['Tarjetas de memoria'], summary: 'Crear una tarjeta a mano', security: seguro,
        requestBody: { required: true, ...json({ type: 'object', required: ['materiaId', 'frente', 'reverso'], properties: { materiaId: { type: 'string', format: 'uuid' }, frente: { type: 'string' }, reverso: { type: 'string' } } }) },
        responses: { 201: { description: 'Creada', ...json({ type: 'object', properties: { tarjeta: ref('Tarjeta') } }) }, ...ERRORES },
      },
    },
    '/api/flashcards/generar': {
      post: {
        tags: ['Tarjetas de memoria'], summary: 'Generar tarjetas con IA desde un apunte', security: seguro,
        requestBody: { required: true, ...json({ type: 'object', required: ['apunteId'], properties: { apunteId: { type: 'string', format: 'uuid' }, cantidad: { type: 'integer', minimum: 3, maximum: 25, default: 10 } } }) },
        responses: { 201: { description: 'Tarjetas creadas' }, ...ERRORES, 429: err('Límite de IA'), 502: err('Error de la API de IA') },
      },
    },
    '/api/flashcards/resumen': {
      get: { tags: ['Tarjetas de memoria'], summary: 'Totales por materia: tarjetas, pendientes hoy y dominadas', security: seguro, responses: { 200: { description: 'OK' }, 401: ERRORES[401] } },
    },
    '/api/flashcards/{id}': {
      parameters: [idParam()],
      put: { tags: ['Tarjetas de memoria'], summary: 'Editar tarjeta', security: seguro, responses: { 200: { description: 'OK' }, ...ERRORES } },
      delete: { tags: ['Tarjetas de memoria'], summary: 'Eliminar tarjeta', security: seguro, responses: { 204: { description: 'Eliminada' }, ...ERRORES } },
    },
    '/api/flashcards/{id}/repaso': {
      parameters: [idParam()],
      post: {
        tags: ['Tarjetas de memoria'], summary: 'Registrar un repaso (repaso espaciado SM-2)', security: seguro,
        description: '`olvidado` → vuelve hoy · `dificil` → intervalo corto · `facil` → el intervalo crece (2, 5, ×facilidad días).',
        requestBody: { required: true, ...json({ type: 'object', required: ['calificacion'], properties: { calificacion: { type: 'string', enum: ['olvidado', 'dificil', 'facil'] } } }) },
        responses: { 200: { description: 'Tarjeta con su próximo repaso', ...json({ type: 'object', properties: { tarjeta: ref('Tarjeta') } }) }, ...ERRORES },
      },
    },

    // ---------- Agenda ----------
    '/api/alertas': {
      get: { tags: ['General'], summary: 'Alertas y recordatorios (vencimientos, exámenes, plan, tarjetas)', security: seguro, responses: { 200: { description: 'Lista ordenada por urgencia', ...json({ type: 'object', properties: { alertas: { type: 'array', items: ref('Alerta') } } }) }, 401: ERRORES[401] } },
    },
    '/api/calendario': {
      get: {
        tags: ['General'], summary: 'Eventos del calendario: tareas, exámenes y sesiones de estudio', security: seguro,
        parameters: [
          { name: 'desde', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          { name: 'hasta', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'Eventos ordenados por fecha' }, 400: ERRORES[400], 401: ERRORES[401] },
      },
    },
  },
};
