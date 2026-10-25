# ms-auth · Microservicio de autenticación y usuarios

Node.js 22 + Express 5 · Puerto **3001** · Esquema de base de datos **`auth`**

Se encarga del inicio de sesión con **Google OAuth 2.0** (RF01), de registrar o buscar al usuario en `auth.usuarios` y de emitir el **JWT con expiración** (RF02) que el frontend envía después a ms-academico.

## Endpoints

| Método | Ruta | Protección | Descripción | Req. |
|---|---|---|---|---|
| GET | `/auth/google` | Pública | Redirige a la pantalla de consentimiento de Google | RF01 |
| GET | `/auth/google/callback` | Pública | Recibe `code` y `state`, registra al usuario y redirige al frontend con `#token=<JWT>` | RF01, RF02 |
| GET | `/auth/me` | JWT | Perfil del usuario dueño del token | RF02, RF09 |
| POST | `/auth/logout` | JWT | Confirma el cierre de sesión (el cliente elimina el token) | RF11 |
| GET | `/auth/health` | Pública | Estado del servicio y conexión a PostgreSQL | HU10 |
| GET | `/auth/docs` | Pública | Documentación Swagger UI | — |
| GET | `/auth/docs.json` | Pública | Especificación OpenAPI (importable en Postman) | — |
| GET | `/auth/prueba` | Solo desarrollo | Página para probar el flujo sin frontend | — |

## Flujo de inicio de sesión

```mermaid
sequenceDiagram
    participant N as Navegador
    participant A as ms-auth
    participant G as Google
    participant DB as PostgreSQL (auth)
    N->>A: GET /auth/google
    A-->>N: 302 a Google + cookie oauth_state
    N->>G: Inicia sesión y acepta permisos
    G-->>N: 302 a /auth/google/callback?code&state
    N->>A: GET /auth/google/callback
    A->>A: Compara state con la cookie (anti-CSRF)
    A->>G: Cambia code por access_token
    A->>G: Pide perfil (sub, email, nombre, foto)
    A->>DB: INSERT ... ON CONFLICT (google_id) DO UPDATE
    A->>A: Firma JWT (sub, email, nombre, rol, exp)
    A-->>N: 302 a FRONTEND_URL#token=JWT
```

El token viaja en el **fragmento** (`#`) de la URL: el navegador nunca lo envía a ningún servidor, así que no queda en los logs de Nginx.

## Contenido del JWT

```json
{
  "sub": "dbdd6b3e-aca7-48a1-8ff9-1d1bd324b761",
  "email": "estudiante@gmail.com",
  "nombre": "Estudiante",
  "rol": "estudiante",
  "iss": "eduplan-ms-auth",
  "aud": "eduplan",
  "iat": 1792900000,
  "exp": 1792907200
}
```

Firmado con HS256 y `JWT_SECRET`. ms-academico valida la firma, el emisor (`iss`), la audiencia (`aud`) y la expiración, y usa `sub` como `usuario_id` en todas sus consultas.

## Estructura por capas

```
ms-auth/
├── src/
│   ├── config/        env.js (variables de entorno) · db.js (pool de PostgreSQL)
│   ├── routes/        auth.routes.js — define las URLs
│   ├── controllers/   auth.controller.js · health.controller.js — HTTP de entrada y salida
│   ├── services/      google.service.js · token.service.js · auth.service.js — lógica de negocio
│   ├── models/        usuario.model.js — consultas SQL a auth.usuarios
│   ├── middlewares/   verificarToken.js · manejoErrores.js
│   ├── docs/          openapi.js — documentación Swagger
│   ├── public/        prueba.html — página de prueba (desarrollo)
│   ├── utils/         AppError.js
│   ├── app.js         configuración de Express
│   └── server.js      arranque del servidor
├── tests/             auth.test.js (13 pruebas, node --test)
├── Dockerfile
└── package.json
```

## Variables de entorno

| Variable | Ejemplo | Descripción |
|---|---|---|
| `DATABASE_URL` | `postgresql://ms_auth:***@postgres:5432/eduplan` | Conexión con el usuario `ms_auth` |
| `GOOGLE_CLIENT_ID` | `123-abc.apps.googleusercontent.com` | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` | Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | `http://localhost:3001/auth/google/callback` | Debe estar registrada en Google |
| `JWT_SECRET` | 32+ caracteres aleatorios | Clave para firmar los tokens |
| `JWT_EXPIRES_IN` | `2h` | Duración del token |
| `FRONTEND_URL` | `http://localhost:3001/auth/prueba` | A dónde vuelve el usuario con su token |
| `NODE_ENV` | `development` / `production` | En producción se oculta `/auth/prueba` |

## Errores

Todas las respuestas de error tienen el mismo formato:

```json
{ "error": { "codigo": "TOKEN_EXPIRADO", "mensaje": "El token expiró, inicia sesión de nuevo" } }
```

Códigos: `TOKEN_REQUERIDO`, `TOKEN_INVALIDO`, `TOKEN_EXPIRADO`, `USUARIO_NO_ENCONTRADO`, `USUARIO_INACTIVO`, `RUTA_NO_ENCONTRADA`, `ERROR_INTERNO`. En el callback, el error llega al frontend como `#error=<CODIGO>` (`ACCESO_CANCELADO`, `STATE_INVALIDO`, `EMAIL_NO_VERIFICADO`, `GOOGLE_CODIGO_INVALIDO`...).

## Ejecutar

```bash
# Con Docker (desde la raíz del proyecto)
docker compose up -d --build ms-auth

# Pruebas (desde ms-auth/)
npm install
npm test
```

## Seguridad

- **OAuth 2.0 con `state`** guardado en una cookie `HttpOnly` de 10 minutos, para evitar CSRF en el callback.
- Solo se aceptan correos **verificados** por Google.
- **No se guardan contraseñas ni tokens** en la base de datos.
- JWT con **expiración**, emisor y audiencia validados, y algoritmo fijo (HS256).
- El usuario de BD `ms_auth` **solo puede leer y escribir en el esquema `auth`**.
- Credenciales solo en variables de entorno. El contenedor corre como usuario `node`, no como root.
