# ms-academico · Gestión académica y asistente de IA

Node.js 22 + Express 5 · Puerto **3002** · Esquema de base de datos **`academico`**

Gestiona la información académica del estudiante: materias, tareas, apuntes y exámenes (RF03 a RF06). También contiene el asistente de IA, que resume apuntes y genera planes de estudio por día, cuestionarios y tarjetas de memoria (RF07, RF08), además de las alertas y el calendario. En cada petición valida el **JWT emitido por ms-auth** y usa su `sub` como `usuario_id` en todas las consultas, así que cada usuario solo ve y modifica su propia información (RF09).

## Endpoints

Todas las rutas, excepto `health` y `docs`, requieren `Authorization: Bearer <JWT>`. La documentación completa está en **`/api/docs`** (Swagger) y en `/api/docs.json`, que se puede importar en Postman.

### Materias — RF03, HU02
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/materias` | Lista con pendientes, completadas, vencidas, próxima entrega, próximo examen, apuntes y tarjetas |
| POST | `/api/materias` | Crear (`nombre`, `docente`, `descripcion`, `color`) |
| GET · PUT · DELETE | `/api/materias/:id` | Ver, editar (solo los campos enviados) o eliminar (en cascada) |

### Tareas — RF04, RF06, HU03, HU04, HU05
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/tareas` | Filtros: `materiaId`, `estado`, `prioridad`, `desde`, `hasta`, `vencidas` |
| POST | `/api/tareas` | Crear (`materiaId`, `titulo`, `descripcion`, `fechaLimite`, `prioridad`) |
| GET · PUT · DELETE | `/api/tareas/:id` | Ver, editar o eliminar |
| PATCH | `/api/tareas/:id/estado` | Cambiar a `pendiente`, `en_progreso` o `completada` |

**Una tarea completada queda bloqueada**: cualquier cambio posterior responde `409 TAREA_COMPLETADA`. La regla se aplica en el servicio y también en la base de datos con un trigger (defensa en profundidad). Sí se puede eliminar.

### Apuntes — RF05, RF07, HU06, HU07
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/apuntes` | Filtros `materiaId`, `periodoId` (o `ninguno`), `buscar` (título, contenido y etiquetas), `etiqueta` y `vista` (`todos`, `recientes`, `favoritos`, `repasar`). Cada apunte trae `periodo`, `favorito`, `etiquetas`, `tarjetasPendientes` y `recomendado` |
| POST · GET · PUT · DELETE | `/api/apuntes` · `/api/apuntes/:id` | CRUD (`periodoId`, `favorito`, `etiquetas` hasta 10). Si no se envía semestre, toma el de la materia. Si cambia el contenido, se borra el resumen anterior |
| GET | `/api/apuntes/etiquetas` | Etiquetas usadas con su conteo |
| POST | `/api/ia/resumen/:apunteId` | Resume el apunte con IA y guarda el resultado |

### Semestres, bloques y carpetas
| Método | Ruta | Descripción |
|---|---|---|
| GET · POST | `/api/periodos` | Lista con conteo de materias y apuntes · Crear (`nombre`, `tipo`: `semestre`, `bloque` o `carpeta`) |
| PUT · DELETE | `/api/periodos/:id` | Renombrar · Eliminar (materias y apuntes quedan sin semestre, no se borran) |

Las materias también aceptan `periodoId`.

### Contexto de estudio
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/contexto?materiaId=` o `?examenId=` | Apuntes con su semestre, temas del examen, tareas pendientes, exámenes próximos, temas débiles y tarjetas por repasar. El frontend lo muestra como "EduPlan tomará en cuenta" |

### Exámenes
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/examenes` | Filtros `materiaId` y `periodo` (`proximos` / `pasados`); incluye cuestionarios, mejor puntaje y plan de preparación |
| POST · GET · PUT · DELETE | `/api/examenes` · `/api/examenes/:id` | CRUD (`materiaId`, `titulo`, `fecha`, `temas`, `notas`) |

### Planes de estudio por día — RF08, HU08
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/planes/vista-previa` | La IA propone el plan y **no se guarda**. Mismas opciones que abajo |
| POST | `/api/planes` | Guarda un plan. `alcance`: `general`, `materia`, `apuntes` o `examen`; `dias`, `horasPorDia`, `horaInicio`, `finesDeSemana`; con materia o examen también `periodoId`, `apunteIds`, `temas`, `temasPrioridad` y `prioridad` (`baja`, `media`, `alta`). Si incluye `propuesta` (la vista previa aprobada y editada), se valida otra vez y se guarda **sin llamar a la IA** |
| GET | `/api/planes` | Historial con avance (`completadas`, `totalActividades`, `atrasadas`) |
| GET · DELETE | `/api/planes/:id` | Plan con sus actividades día por día |
| PATCH | `/api/planes/:id/actividades/:actividadId` | Marcar una actividad como hecha o pendiente |
| POST | `/api/planes/:id/reorganizar` | La IA **propone** una nueva distribución de lo no completado. No guarda nada |
| POST | `/api/planes/:id/aplicar` | Guarda la propuesta que el estudiante aprobó. Las actividades completadas se conservan |

### Cuestionarios
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/cuestionarios` | Genera preguntas de opción múltiple. `fuente`: `apuntes` (con `apunteIds`), `materia` o `examen`; con materia o examen se pueden elegir `apunteIds`, `periodoId` y `temas`; `numPreguntas` (3 a 20); `dificultad`. Cada pregunta guarda de qué apunte salió |
| GET | `/api/cuestionarios` | Lista con intentos y mejor puntaje |
| GET · DELETE | `/api/cuestionarios/:id` | Preguntas **sin la respuesta correcta** e historial de intentos |
| POST | `/api/cuestionarios/:id/intentos` | Califica en el servidor y devuelve la revisión y un `analisis`: temas con fallos, **apuntes recomendados**, **comparación con el intento anterior** y preguntas falladas sin tarjeta |
| GET | `/api/cuestionarios/:id/revision` | Revisión y análisis del último intento |
| POST | `/api/cuestionarios/:id/tarjetas` | Crea tarjetas con las preguntas falladas (respuesta correcta + explicación). No duplica |
| GET · POST | `/api/cuestionarios/:id/repaso` | Propone un horario libre para repasar · Lo agrega al plan de ese día o crea un plan de repaso |

### Tarjetas de memoria
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/flashcards` | Filtros `materiaId`, `apunteId`, `pendientes` (las que toca repasar hoy) |
| GET | `/api/flashcards/resumen` | Totales por materia: tarjetas, pendientes hoy y dominadas |
| POST | `/api/flashcards` | Crear a mano |
| POST | `/api/flashcards/generar` | Generar con IA desde un apunte (`apunteId`, `cantidad`) |
| PUT · DELETE | `/api/flashcards/:id` | Editar o eliminar |
| POST | `/api/flashcards/:id/repaso` | `calificacion`: `olvidado`, `dificil` o `facil`. Calcula el próximo repaso |

### Agenda y monitoreo
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/alertas` | Tareas vencidas o que vencen hoy/mañana, exámenes en 3 días, actividades atrasadas, sesiones de hoy y tarjetas pendientes |
| GET | `/api/calendario?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` | Tareas, exámenes y sesiones de estudio (máximo 93 días) |
| GET | `/api/resumen` | Totales para el panel |
| GET | `/api/health` | Estado del servicio, la base de datos y la configuración de IA (HU10) |

## Cómo trabaja el asistente de IA

```mermaid
sequenceDiagram
    participant F as Frontend
    participant A as ms-academico
    participant DB as PostgreSQL
    participant IA as API de IA (Gemini)
    F->>A: POST /api/planes { alcance: "examen", examenId } (Bearer JWT)
    A->>A: Valida JWT, datos y límite de uso
    A->>DB: Examen, apuntes de la materia, tareas y temas débiles de cuestionarios
    A->>IA: Instrucciones + contexto, pidiendo JSON con una estructura exacta
    IA-->>A: { titulo, resumen, dias: [{ fecha, actividades }], consejos }
    A->>A: Valida fechas, horas, tipos e ids (descarta lo inválido)
    A->>DB: Plan + actividades en una transacción
    A-->>F: 201 { plan }
```

- **Respuestas estructuradas**: para planes, cuestionarios y tarjetas se pide **JSON** al modelo (`responseMimeType: application/json` en Gemini) y **todo se valida antes de guardarse**: fechas dentro del rango, horas válidas, ids que pertenecen al estudiante y 4 opciones distintas por pregunta. La IA nunca escribe directamente en la base.
- **Opciones mezcladas**: en los cuestionarios, el servidor mezcla las opciones para que la correcta no quede siempre en la misma posición.
- **Repaso espaciado (SM-2 simplificado)**: "Fácil" programa el siguiente repaso en 2, 5 y luego intervalo × facilidad días; "Difícil" lo acorta; "No lo recuerdo" lo devuelve a hoy y baja la facilidad (mínimo 1.3).
- **Temas débiles**: los temas de las preguntas falladas se guardan en cada intento y reciben más tiempo en el plan de preparación del examen.
- **Secciones conectadas**: para un plan de una materia o examen, la IA recibe los apuntes elegidos, las tareas pendientes, los exámenes próximos, los temas débiles, las tarjetas por repasar y los temas que el estudiante quiere priorizar.
- **Proveedores**: `AI_PROVIDER` = `gemini` (por defecto), `claude`, `openai` o `simulado`. El modo `simulado` no necesita internet ni clave y genera datos de ejemplo para pruebas y demostraciones.
- **Límites**: 10 solicitudes de IA por minuto por usuario (`AI_RATE_LIMIT`) y 90 segundos de espera máxima (`AI_TIMEOUT_MS`).
- Las instrucciones que se envían al modelo están en `src/services/ia/prompts.js`.

## Estructura por capas

```
ms-academico/
├── src/
│   ├── config/        env.js · db.js (pool y transacciones)
│   ├── routes/        index · materias · tareas · apuntes · periodos · ia · estudio (exámenes, planes, cuestionarios, tarjetas)
│   ├── controllers/   materia · tarea · apunte · periodo · examen · plan · cuestionario · flashcard · ia · general
│   ├── services/      materia · tarea · apunte · periodo · contexto · examen · plan · cuestionario · flashcard · agenda · ia
│   │   └── ia/        proveedores.js (Gemini, Claude, OpenAI, simulado) · prompts.js · contexto.js
│   ├── models/        materia · tarea · apunte · periodo · examen · plan · cuestionario · flashcard · agenda · resumen
│   ├── middlewares/   verificarToken · limiteIa · manejoErrores
│   ├── utils/         AppError · validar · fechas · sql · erroresPg
│   ├── docs/          openapi.js (Swagger)
│   ├── app.js
│   └── server.js
├── tests/             38 pruebas (node --test) sin base de datos ni clave de IA
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
| `AI_TIMEOUT_MS` | `90000` | Opcional, tiempo máximo de espera de la IA |

## Errores

Todas las respuestas de error tienen el mismo formato:

```json
{ "error": { "codigo": "VALIDACION", "mensaje": "Datos inválidos", "detalles": ["titulo es obligatorio"] } }
```

| Código HTTP | Códigos de error |
|---|---|
| 400 | `VALIDACION`, `ID_INVALIDO`, `JSON_INVALIDO` |
| 401 | `TOKEN_REQUERIDO`, `TOKEN_INVALIDO`, `TOKEN_EXPIRADO`, `USUARIO_NO_EXISTE` |
| 404 | `PERIODO_NO_ENCONTRADO`, `MATERIA_NO_ENCONTRADA`, `TAREA_NO_ENCONTRADA`, `APUNTE_NO_ENCONTRADO`, `EXAMEN_NO_ENCONTRADO`, `PLAN_NO_ENCONTRADO`, `CUESTIONARIO_NO_ENCONTRADO`, `TARJETA_NO_ENCONTRADA` |
| 409 | `MATERIA_DUPLICADA`, `PERIODO_DUPLICADO`, `TAREA_COMPLETADA` |
| 422 | `SIN_TAREAS_PENDIENTES`, `SIN_CONTENIDO`, `SIN_APUNTES`, `EXAMEN_PASADO`, `NADA_QUE_REORGANIZAR`, `SIN_INTENTOS`, `SIN_FALLADAS` |
| 429 | `LIMITE_IA`, `IA_LIMITE` |
| 502 · 503 · 504 | `IA_ERROR`, `IA_CLAVE_INVALIDA`, `IA_MODELO_INVALIDO`, `IA_RESPUESTA_INVALIDA`, `IA_NO_CONFIGURADA`, `IA_TIMEOUT` |

Un recurso de otro usuario responde **404** (no 403), para no revelar que existe.

## Ejecutar

```bash
# Con Docker (desde la raíz del proyecto)
docker compose up -d --build ms-academico

# Pruebas (desde ms-academico/)
npm install
npm test
```
