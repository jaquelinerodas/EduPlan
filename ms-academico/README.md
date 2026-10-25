# ms-academico · Materias, tareas, apuntes y asistente de IA

Node.js 22 + Express 5 · Puerto **3002** · Esquema de base de datos **`academico`**

Gestiona la información académica del estudiante (RF03–RF06) y el asistente de IA que resume apuntes y sugiere planes de estudio (RF07, RF08). Valida en cada petición el **JWT emitido por ms-auth** y usa su `sub` como `usuario_id` en todas las consultas, por lo que cada usuario solo puede ver y modificar su propia información (RF09).

## Endpoints

Todas las rutas, excepto `health` y `docs`, requieren `Authorization: Bearer <JWT>`.

### Materias — RF03, HU02
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/materias` | Lista con conteo de tareas por estado y próxima entrega |
| POST | `/api/materias` | Crear (`nombre`, `docente`, `descripcion`, `color`) |
| GET | `/api/materias/:id` | Obtener una |
| PUT | `/api/materias/:id` | Editar (solo los campos enviados) |
| DELETE | `/api/materias/:id` | Eliminar (borra también sus tareas y apuntes) |

### Tareas — RF04, RF06, HU03, HU04, HU05
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/tareas` | Lista con filtros: `materiaId`, `estado`, `prioridad`, `desde`, `hasta`, `vencidas` |
| POST | `/api/tareas` | Crear (`materiaId`, `titulo`, `descripcion`, `fechaLimite`, `prioridad`, `estado`) |
| GET | `/api/tareas/:id` | Obtener una |
| PUT | `/api/tareas/:id` | Editar (solo los campos enviados) |
| PATCH | `/api/tareas/:id/estado` | Marcar como completada o cambiar estado |
| DELETE | `/api/tareas/:id` | Eliminar |

Ejemplo de filtro: `GET /api/tareas?materiaId=<uuid>&estado=pendiente&desde=2026-11-01&hasta=2026-11-30`

### Apuntes — RF05, HU06
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/apuntes` | Lista con filtros `materiaId` y `buscar` (título o contenido) |
| POST | `/api/apuntes` | Crear (`materiaId`, `titulo`, `contenido`) |
| GET | `/api/apuntes/:id` | Obtener uno |
| PUT | `/api/apuntes/:id` | Editar. Si cambia el contenido, se borra el resumen anterior |
| DELETE | `/api/apuntes/:id` | Eliminar |

### Asistente de IA — RF07, RF08, HU07, HU08
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/ia/resumen/:apunteId` | Resume el apunte con IA y guarda el resultado en `resumenIa` |
| POST | `/api/ia/plan-estudio` | Plan de estudio con las tareas pendientes. Cuerpo opcional: `{ "dias": 7, "horasPorDia": 3 }` |
| GET | `/api/ia/planes` | Historial de planes (últimos 20) |
| GET | `/api/ia/planes/:id` | Obtener un plan |
| DELETE | `/api/ia/planes/:id` | Eliminar un plan |

### General
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/resumen` | Totales para el panel: materias, apuntes, tareas por estado, vencidas, próximas 7 días |
| GET | `/api/health` | Estado del servicio, base de datos y configuración de IA (HU10) |
| GET | `/api/docs` | Swagger UI · `/api/docs.json` para importar en Postman |

## Asistente de IA

```mermaid
sequenceDiagram
    participant F as Frontend
    participant A as ms-academico
    participant DB as PostgreSQL
    participant IA as API de IA (Gemini)
    F->>A: POST /api/ia/plan-estudio (Bearer JWT)
    A->>A: Valida JWT y límite de uso
    A->>DB: Tareas no completadas del usuario (próximos N días)
    A->>IA: Instrucciones + lista de tareas (HTTPS + API key)
    IA-->>A: Plan en Markdown
    A->>DB: INSERT en planes_estudio
    A-->>F: 201 { plan }
```

- El proveedor se elige con `AI_PROVIDER`: `gemini` (por defecto), `claude`, `openai` o `simulado`. El modo `simulado` no usa internet ni clave y sirve para pruebas y demostraciones.
- Las instrucciones que se envían al modelo están en `src/services/ia/prompts.js`.
- Límite de **10 solicitudes por minuto por usuario** (`AI_RATE_LIMIT`) para no agotar la cuota de la API.
- Timeout de 30 segundos (`AI_TIMEOUT_MS`).

## Estructura por capas

```
ms-academico/
├── src/
│   ├── config/        env.js · db.js
│   ├── routes/        index.js · materias · tareas · apuntes · ia
│   ├── controllers/   materia · tarea · apunte · ia · general (health y resumen)
│   ├── services/      materia · tarea · apunte · ia
│   │   └── ia/        proveedores.js (Gemini, Claude, OpenAI, simulado) · prompts.js
│   ├── models/        materia · tarea · apunte · plan · resumen (SQL parametrizado)
│   ├── middlewares/   verificarToken · limiteIa · manejoErrores
│   ├── utils/         AppError · validar (validación de datos) · sql · erroresPg
│   ├── docs/          openapi.js (Swagger)
│   ├── app.js
│   └── server.js
├── tests/             23 pruebas (node --test), sin base de datos ni clave de IA
├── Dockerfile
└── package.json
```

## Variables de entorno

| Variable | Ejemplo | Descripción |
|---|---|---|
| `DATABASE_URL` | `postgresql://ms_academico:***@postgres:5432/eduplan` | Conexión con el usuario `ms_academico` |
| `JWT_SECRET` | igual que en ms-auth | Para validar los tokens |
| `AI_PROVIDER` | `gemini` | `gemini`, `claude`, `openai` o `simulado` |
| `AI_API_KEY` | `AIza...` | Clave de la API de IA |
| `AI_MODEL` | `gemini-3.5-flash-lite` | Opcional, modelo a usar |
| `AI_RATE_LIMIT` | `10` | Opcional, solicitudes de IA por minuto por usuario |

## Errores

Formato único:

```json
{ "error": { "codigo": "VALIDACION", "mensaje": "Datos inválidos", "detalles": ["titulo es obligatorio"] } }
```

| Código HTTP | Códigos de error |
|---|---|
| 400 | `VALIDACION`, `ID_INVALIDO`, `JSON_INVALIDO` |
| 401 | `TOKEN_REQUERIDO`, `TOKEN_INVALIDO`, `TOKEN_EXPIRADO` |
| 404 | `MATERIA_NO_ENCONTRADA`, `TAREA_NO_ENCONTRADA`, `APUNTE_NO_ENCONTRADO`, `PLAN_NO_ENCONTRADO` |
| 409 | `MATERIA_DUPLICADA` |
| 422 | `SIN_TAREAS_PENDIENTES` |
| 429 | `LIMITE_IA`, `IA_LIMITE` |
| 502 / 503 / 504 | `IA_ERROR`, `IA_CLAVE_INVALIDA`, `IA_MODELO_INVALIDO`, `IA_NO_CONFIGURADA`, `IA_TIMEOUT` |

Un recurso de otro usuario responde **404** (no 403), para no revelar que existe.

## Ejecutar

```bash
# Con Docker (desde la raíz del proyecto)
docker compose up -d --build ms-academico

# Pruebas (desde ms-academico/)
npm install
npm test
```
