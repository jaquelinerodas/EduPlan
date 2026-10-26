// Iconos SVG de trazo (24x24). Se insertan como texto en las plantillas.
const trazo = (contenido) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${contenido}</svg>`;

export const iconos = {
  panel: trazo('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>'),
  tareas: trazo('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="m8 12 2.5 2.5L16 9"/><path d="M8 2v4M16 2v4"/>'),
  materias: trazo('<path d="M4 19.5V5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2Zm0 0A2 2 0 0 0 6 22h13"/><path d="M8 7h7"/>'),
  apuntes: trazo('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>'),
  plan: trazo('<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><path d="m5.6 5.6 2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/>'),
  estado: trazo('<path d="M3 12h4l3-8 4 16 3-8h4"/>'),
  salir: trazo('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>'),
  mas: trazo('<path d="M12 5v14M5 12h14"/>'),
  editar: trazo('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  borrar: trazo('<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>'),
  cerrar: trazo('<path d="M18 6 6 18M6 6l12 12"/>'),
  buscar: trazo('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  chispa: trazo('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z"/>'),
  lapiz: trazo('<path d="M17 3a2.8 2.8 0 0 1 4 4L8 20l-5 1 1-5Z"/><path d="m15 5 4 4"/>'),
  ok: trazo('<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'),
  alerta: trazo('<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>'),
  atras: trazo('<path d="m15 18-6-6 6-6"/>'),
  guardar: trazo('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>'),
  calendario: trazo('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  examen: trazo('<path d="M22 9 12 4 2 9l10 5 10-5Z"/><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/><path d="M22 9v6"/>'),
  cuestionario: trazo('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4"/><path d="M12 17.5h.01"/>'),
  tarjetas: trazo('<rect x="6" y="3" width="15" height="13" rx="2"/><path d="M3 7v11a3 3 0 0 0 3 3h11"/>'),
  campana: trazo('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
  menu: trazo('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  ojo: trazo('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
  ojoTachado: trazo('<path d="M9.9 4.2A10 10 0 0 1 12 4c6.4 0 10 8 10 8a17 17 0 0 1-2.2 3.2M6.6 6.6C3.9 8.4 2 12 2 12s3.6 8 10 8c1.8 0 3.4-.5 4.8-1.3"/><path d="M14.1 14.1a3 3 0 0 1-4.2-4.2M2 2l20 20"/>'),
  adelante: trazo('<path d="m9 18 6-6-6-6"/>'),
  reorganizar: trazo('<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 16H3v5"/>'),
  reloj: trazo('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  jugar: trazo('<path d="m7 4 13 8-13 8V4Z"/>'),
  voltear: trazo('<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>'),
};

// Logotipo de EduPlan: birrete sobre una tarjeta de tareas (diseño de la autora del proyecto)
export const logotipoMarca = `
<svg viewBox="0 0 64 56" aria-hidden="true">
  <rect x="17" y="21" width="43" height="31" rx="7" fill="none" stroke="var(--marca)" stroke-width="4.5"/>
  <path d="m24 32 3.4 3.4 6-6.6" fill="none" stroke="var(--marca)" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="m24 42 3.4 3.4 6-6.6" fill="none" stroke="var(--marca)" stroke-opacity=".5" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M38.5 32.5h14" stroke="var(--marca)" stroke-width="3.6" stroke-linecap="round"/>
  <path d="M38.5 42.5h14" stroke="var(--marca)" stroke-opacity=".5" stroke-width="3.6" stroke-linecap="round"/>
  <path d="M2.5 13.5 27 3.5l24.5 10L27 23.5Z" fill="var(--marca)" stroke="var(--superficie)" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M7 15.5v14" stroke="var(--marca)" stroke-width="3" stroke-linecap="round"/>
  <circle cx="7" cy="31.5" r="3.4" fill="var(--marca)"/>
</svg>`;

export const logotipo = `${logotipoMarca}<span class="marca__texto">Edu<span>Plan</span></span>`;

// Logotipo de Google (colores oficiales, requerido en el botón de inicio de sesión)
export const logoGoogle = `
<svg viewBox="0 0 48 48" aria-hidden="true">
  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
  <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"/>
</svg>`;
