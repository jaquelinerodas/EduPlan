
import { api } from './api.js';
import { iconos } from './iconos.js';
import { esc } from './utilidades.js';

const CLAVE_LEIDAS = 'eduplan_alertas_leidas';
const CLAVE_NOTIFICADAS = 'eduplan_alertas_notificadas';
const CLAVE_PREFERENCIA = 'eduplan_notificaciones';

let alertas = [];
let panel = null;
let intervalo = null;

const leer = (clave) => {
  try { return JSON.parse(localStorage.getItem(clave) || '[]'); } catch { return []; }
};
const guardar = (clave, lista) => {
  try { localStorage.setItem(clave, JSON.stringify(lista.slice(-200))); } catch { /* sin almacenamiento */ }
};
const preferencia = () => {
  try { return localStorage.getItem(CLAVE_PREFERENCIA) === '1'; } catch { return false; }
};

const soportaNotificaciones = () => 'Notification' in window;
const notificacionesActivas = () => soportaNotificaciones() && Notification.permission === 'granted' && preferencia();

function noLeidas() {
  const leidas = new Set(leer(CLAVE_LEIDAS));
  return alertas.filter((a) => !leidas.has(a.id));
}

function pintarContadores() {
  const n = noLeidas().length;
  document.querySelectorAll('[data-campana]').forEach((boton) => {
    boton.querySelector('.campana__contador')?.remove();
    boton.setAttribute('aria-label', n ? `Avisos: ${n} sin leer` : 'Avisos');
    if (n) boton.insertAdjacentHTML('beforeend', `<span class="campana__contador" aria-hidden="true">${n > 9 ? '9+' : n}</span>`);
  });
}

/** Muestra en el sistema operativo los avisos importantes que aún no se notificaron. */
function enviarNotificaciones() {
  if (!notificacionesActivas() || document.visibilityState === 'visible') return;
  const enviadas = leer(CLAVE_NOTIFICADAS);
  const nuevas = alertas.filter((a) => a.nivel !== 'info' && !enviadas.includes(a.id));
  for (const a of nuevas.slice(0, 3)) {
    const n = new Notification(`EduPlan · ${a.titulo}`, { body: a.mensaje, icon: 'img/favicon.svg', tag: a.id });
    n.onclick = () => { window.focus(); location.hash = a.enlace; n.close(); };
  }
  guardar(CLAVE_NOTIFICADAS, [...enviadas, ...nuevas.map((a) => a.id)]);
}

export async function actualizarAlertas() {
  try {
    ({ alertas } = await api.alertas());
  } catch {
    return;
  }
  pintarContadores();
  enviarNotificaciones();
  if (panel) pintarPanel();
}

function pintarPanel() {
  const leidas = new Set(leer(CLAVE_LEIDAS));
  const permiso = soportaNotificaciones() ? Notification.permission : 'no-soportado';
  const pie = permiso === 'no-soportado'
    ? 'Este navegador no admite notificaciones.'
    : permiso === 'denied'
      ? 'Bloqueaste las notificaciones en este navegador.'
      : notificacionesActivas()
        ? '<span>Notificaciones del navegador activas</span><button type="button" class="boton boton--fantasma" data-notif="no">Desactivar</button>'
        : '<span>Recibe estos avisos aunque EduPlan esté en otra pestaña.</span><button type="button" class="boton boton--secundario" data-notif="si">Activar</button>';

  panel.innerHTML = `
    <div class="avisos-panel__cabeza">
      <h2 style="font-size:var(--t-md)">Avisos</h2>
      ${alertas.length ? '<button type="button" class="boton boton--fantasma" data-leer-todo>Marcar como leídos</button>' : ''}
    </div>
    ${alertas.length
      ? `<ul>${alertas.map((a) => `
          <li><a class="alerta alerta--${esc(a.nivel)}${leidas.has(a.id) ? ' alerta--leida' : ''}" href="${esc(a.enlace)}" data-alerta="${esc(a.id)}">
            <strong>${esc(a.titulo)}</strong><span>${esc(a.mensaje)}</span>
          </a></li>`).join('')}</ul>`
      : `<div class="vacio" style="padding:var(--e-6) var(--e-4)">${iconos.ok}<p>Estás al día. No hay avisos pendientes.</p></div>`}
    <div class="avisos-panel__pie">${pie}</div>`;
}

function marcarLeidas(ids) {
  guardar(CLAVE_LEIDAS, [...new Set([...leer(CLAVE_LEIDAS), ...ids])]);
  pintarContadores();
}

function cerrarPanel() {
  panel?.remove();
  panel = null;
  document.removeEventListener('click', clicFuera, true);
  document.removeEventListener('keydown', teclaEscape);
}
function clicFuera(e) {
  if (panel && !panel.contains(e.target) && !e.target.closest('[data-campana]')) cerrarPanel();
}
function teclaEscape(e) {
  if (e.key === 'Escape') cerrarPanel();
}

function abrirPanel(boton) {
  if (panel) return cerrarPanel();
  panel = document.createElement('div');
  panel.className = 'avisos-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Avisos');
  const r = boton.getBoundingClientRect();
  const ancho = Math.min(380, window.innerWidth - 24);
  panel.style.top = `${Math.min(r.bottom + 8, window.innerHeight - 200)}px`;
  panel.style.left = `${Math.max(12, Math.min(r.left, window.innerWidth - ancho - 12))}px`;
  document.body.append(panel);
  pintarPanel();

  panel.addEventListener('click', async (e) => {
    const enlace = e.target.closest('[data-alerta]');
    if (enlace) {
      marcarLeidas([enlace.dataset.alerta]);
      cerrarPanel();
      return;
    }
    if (e.target.closest('[data-leer-todo]')) {
      marcarLeidas(alertas.map((a) => a.id));
      pintarPanel();
      return;
    }
    const notif = e.target.closest('[data-notif]');
    if (notif) {
      if (notif.dataset.notif === 'si') {
        const permiso = await Notification.requestPermission();
        try { localStorage.setItem(CLAVE_PREFERENCIA, permiso === 'granted' ? '1' : '0'); } catch { /* sin almacenamiento */ }
      } else {
        try { localStorage.setItem(CLAVE_PREFERENCIA, '0'); } catch { /* sin almacenamiento */ }
      }
      pintarPanel();
    }
  });
  setTimeout(() => {
    document.addEventListener('click', clicFuera, true);
    document.addEventListener('keydown', teclaEscape);
  });
}

export function montarAlertas() {
  document.querySelectorAll('[data-campana]').forEach((b) => b.addEventListener('click', () => abrirPanel(b)));
  actualizarAlertas();
  clearInterval(intervalo);
  intervalo = setInterval(actualizarAlertas, 5 * 60 * 1000);
}
