# Frontend · EduPlan

Aplicación de una sola página (SPA) en **HTML, CSS y JavaScript puro**, con módulos ES y sin frameworks ni dependencias externas. Nginx la sirve en `http://localhost` y todas las peticiones salen al mismo dominio (`/auth/*` y `/api/*`), así que no hace falta configurar CORS.

## Diseño

La interfaz toma como concepto **el cuaderno del estudiante**:

| Elemento | Uso |
|---|---|
| Papel cuadriculado | Fondo de la aplicación |
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
│   └── vistas.css          # Estilos propios de cada vista
├── js/
│   ├── app.js              # Arranque y enrutador por hash (#/panel, #/tareas...)
│   ├── sesion.js           # JWT: lectura del retorno de Google, expiración y cierre de sesión
│   ├── api.js              # Cliente de la API (agrega Authorization: Bearer <JWT>)
│   ├── datos.js            # Caché de materias
│   ├── ui.js               # Avisos, ventanas modales, confirmaciones y estados de carga
│   ├── markdown.js         # Convierte el texto de la IA a HTML seguro
│   ├── utilidades.js       # Escape de HTML, formato de fechas y textos
│   ├── iconos.js           # Iconos SVG y logotipo
│   └── vistas/             # entrar · panel · tareas · materias · apuntes · plan · estado
├── fuentes/                # Archivos .woff2 y sus licencias
└── img/favicon.svg
```

## Flujo de sesión

1. "Continuar con Google" lleva a `/auth/google`.
2. Al volver, ms-auth redirige a `http://localhost/#token=<JWT>`.
3. `sesion.js` guarda el token en `localStorage` y lo quita de la barra de direcciones.
4. Cada petición lleva `Authorization: Bearer <JWT>`.
5. Si el token expira o la API responde `401`, la sesión se cierra y se muestra el motivo.
6. "Cerrar sesión" elimina el token del navegador (RF11).

## Seguridad

- Todo el texto del usuario y de la IA se **escapa antes de insertarse** en la página (prevención de XSS). El Markdown de la IA se convierte a HTML solo después de escaparlo.
- Nginx aplica una **Content-Security-Policy** que solo permite scripts propios del sitio.
- Los colores de las materias se validan (`#RRGGBB`) antes de usarse en estilos.
