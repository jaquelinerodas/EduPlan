# Frontend · EduPlan

Aplicación de una sola página (SPA) en **HTML, CSS y JavaScript puro**, con módulos ES y sin frameworks ni dependencias externas. Nginx la sirve en `https://localhost` y todas las peticiones salen al mismo dominio (`/auth/*` y `/api/*`), así que no hace falta configurar CORS.

## Vistas

| Ruta | Vista |
|---|---|
| `#/entrar` | Acceso: correo y contraseña, crear cuenta o continuar con Google |
| `#/panel` | Hoy en tu plan, próximos exámenes, tarjetas por repasar, atrasadas, semana y avance por materia |
| `#/calendario` | Mes, semana o día con tareas, exámenes y sesiones de estudio |
| `#/tareas` | Filtros (RF06) y completar con confirmación; una tarea completada queda bloqueada |
| `#/examenes` | Exámenes con cuenta regresiva, temas, plan de preparación y práctica |
| `#/materias` | Agrupadas por semestre o bloque: pendientes, completadas, vencidas, avance, próximo examen, apuntes y tarjetas |
| `#/apuntes` · `#/apuntes?id=<id>` | Panel de organización (semestre → materia, vistas Recientes/Favoritos/Por repasar, búsqueda, etiquetas), lectura con formato y bloques de código, edición, resumen de IA |
| `#/plan` | Asistente de 3 pasos con vista previa editable, planes por día, avance, reorganización e historial |
| `#/cuestionarios` · `#/cuestionarios/<id>` | Generar eligiendo temas, resolver y revisar; después: temas fallados, apuntes recomendados, tarjetas de falladas, sesión de repaso y comparación |
| `#/tarjetas` · `#/tarjetas?repaso=1` | Mazos por materia, nueva tarjeta (a mano o desde un apunte) y repaso con Atrás/Siguiente (teclas: espacio, 1, 2, 3, ← →) |
| `#/estado` | Estado de los servicios (solo administradores) |

La campana muestra las **alertas** (`/api/alertas`). Con permiso del usuario también se envían notificaciones del navegador para los avisos importantes cuando EduPlan está en otra pestaña.

## Diseño

La interfaz toma como concepto **el cuaderno del estudiante**:

| Elemento | Uso |
|---|---|
| Papel cuadriculado | Fondo de la aplicación |
| Azul de marca `#4A63E7` / `#8FA3F7` | Logo de EduPlan (birrete sobre una lista de tareas) |
| Tinta azul `#2340A0` | Color principal: botones, enlaces, día actual |
| Rojo de corrección `#C22F3B` | Tareas vencidas y acciones de eliminar |
| Verde de "visto bueno" `#23784C` | Tareas completadas y avance |
| Marcatextos amarillo | Solo para entregas de hoy y mañana |
| Lomo de color | Cada materia lleva su color en el borde izquierdo de sus tareas y cuadernos |

- **Tipografía**: *Bricolage Grotesque* para títulos y *Atkinson Hyperlegible* para el texto (diseñada para leerse con facilidad). Están alojadas en `fuentes/` con licencia SIL Open Font License, y la aplicación no depende de servicios externos.
- **Responsiva**: barra lateral en computadora y navegación inferior en teléfono.
- **Modo oscuro** automático según la configuración del sistema.
- **Accesibilidad**: foco visible con teclado, etiquetas para lectores de pantalla, ventanas `<dialog>` nativas y respeto a "reducir movimiento".

## Estructura

```
frontend/
├── index.html              # Punto de entrada
├── css/
│   ├── base.css            # Tokens de diseño (colores, tipografía, espaciado), modo oscuro y reset
│   ├── layout.css          # Pantalla de inicio de sesión y marco de la app (lateral, barra móvil)
│   ├── componentes.css     # Botones, formularios, etiquetas, renglones, modales, avisos
│   ├── vistas.css          # Panel, materias, apuntes, estado
│   ├── estudio.css         # Acceso, alertas, calendario, exámenes, plan por días, cuestionarios y tarjetas
│   └── organizacion.css    # Apuntes organizados, selector de temas, asistente de planes y acciones de cuestionarios
├── js/
│   ├── app.js              # Arranque, navegación agrupada y enrutador por hash (#/panel, #/cuestionarios/<id>...)
│   ├── alertas.js          # Campana de avisos y notificaciones del navegador
│   ├── sesion.js           # JWT: lectura del retorno de Google, expiración y cierre de sesión
│   ├── api.js              # Cliente de la API (agrega Authorization: Bearer <JWT>)
│   ├── datos.js            # Caché de materias
│   ├── ui.js               # Avisos, ventanas modales, confirmaciones y estados de carga
│   ├── markdown.js         # Convierte el texto de la IA y de los apuntes a HTML seguro (con bloques de código)
│   ├── seleccion.js        # Selector de temas por semestre y resumen de lo que usará la IA
│   ├── utilidades.js       # Escape de HTML, formato de fechas y textos
│   ├── iconos.js           # Iconos SVG y logotipo
│   └── vistas/             # entrar · panel · calendario · tareas · examenes · materias · apuntes
│                           # plan · cuestionarios · tarjetas · estado
├── fuentes/                # Archivos .woff2 y sus licencias
└── img/favicon.svg
```

## Flujo de sesión

1. Con correo y contraseña, el formulario llama a `/auth/login` o `/auth/registro` y recibe el JWT directamente.
   Con "Continuar con Google" se va a `/auth/google`.
2. Al volver, ms-auth redirige a `https://localhost/#token=<JWT>`.
3. `sesion.js` guarda el token en `localStorage` y lo quita de la barra de direcciones.
4. Cada petición lleva `Authorization: Bearer <JWT>`.
5. Si el token expira o la API responde `401`, la sesión se cierra y se muestra el motivo.
6. "Cerrar sesión" elimina el token del navegador (RF11).

## Seguridad

- Todo el texto del usuario y de la IA se **escapa antes de insertarse** en la página (prevención de XSS). El Markdown de la IA se convierte a HTML solo después de escaparlo.
- Nginx aplica una **Content-Security-Policy** que solo permite scripts propios del sitio.
- Los colores de las materias se validan (`#RRGGBB`) antes de usarse en estilos.
