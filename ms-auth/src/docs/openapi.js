/**
 * Documentación OpenAPI 3 de ms-auth. Se publica en /auth/docs (Swagger UI)
 * y en /auth/docs.json (se puede importar en Postman).
 */
const { version } = require('../../package.json');

const errorSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        codigo: { type: 'string', example: 'TOKEN_INVALIDO' },
        mensaje: { type: 'string', example: 'Token inválido' },
      },
    },
  },
};

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'EduPlan · ms-auth',
    version,
    description:
      'Microservicio de autenticación y usuarios. Inicio de sesión con Google (OAuth 2.0) ' +
      'y emisión de JSON Web Tokens con expiración.\n\n' +
      '**Cómo obtener un token:** abre `/auth/google` en el navegador, inicia sesión con Google ' +
      'y copia el token que aparece al final del flujo. Luego usa el botón **Authorize**.',
  },
  servers: [{ url: '/', description: 'Servidor actual' }],
  tags: [
    { name: 'OAuth 2.0', description: 'Flujo de inicio de sesión con Google' },
    { name: 'Sesión', description: 'Rutas protegidas con JWT' },
    { name: 'Monitoreo', description: 'Estado del servicio' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: errorSchema,
      Usuario: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          nombre: { type: 'string' },
          fotoUrl: { type: 'string', nullable: true },
          rol: { type: 'string', enum: ['estudiante', 'administrador'] },
          ultimoAcceso: { type: 'string', format: 'date-time' },
          creadoEn: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/auth/google': {
      get: {
        tags: ['OAuth 2.0'],
        summary: 'Inicia el inicio de sesión con Google (RF01)',
        description: 'Redirige a la pantalla de consentimiento de Google. Abrir en el navegador, no desde Swagger.',
        responses: { 302: { description: 'Redirección a accounts.google.com' } },
      },
    },
    '/auth/google/callback': {
      get: {
        tags: ['OAuth 2.0'],
        summary: 'Callback de Google (RF01, RF02)',
        description:
          'Google redirige aquí con `code` y `state`. Si todo es correcto, redirige al frontend con ' +
          '`#token=<JWT>`; si falla, con `#error=<CODIGO>`.',
        parameters: [
          { name: 'code', in: 'query', schema: { type: 'string' } },
          { name: 'state', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 302: { description: 'Redirección al frontend con el token o el error' } },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Sesión'],
        summary: 'Perfil del usuario autenticado (RF02)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Perfil',
            content: { 'application/json': { schema: { type: 'object', properties: { usuario: { $ref: '#/components/schemas/Usuario' } } } } },
          },
          401: { description: 'Token faltante, inválido o expirado', content: { 'application/json': { schema: errorSchema } } },
          403: { description: 'Usuario desactivado', content: { 'application/json': { schema: errorSchema } } },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Sesión'],
        summary: 'Cerrar sesión (RF11)',
        description: 'El token no se guarda en el servidor: el cliente debe eliminarlo.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Sesión cerrada' },
          401: { description: 'Token faltante, inválido o expirado', content: { 'application/json': { schema: errorSchema } } },
        },
      },
    },
    '/auth/health': {
      get: {
        tags: ['Monitoreo'],
        summary: 'Estado del servicio y de la base de datos (HU10)',
        responses: {
          200: { description: 'Servicio y base de datos funcionando' },
          503: { description: 'Sin conexión a la base de datos' },
        },
      },
    },
  },
};
