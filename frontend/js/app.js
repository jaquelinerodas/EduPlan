/**
 * EduPlan · Punto de entrada del frontend (SPA con rutas por hash: #/panel, #/tareas...).
 */
import { datosSesion, leerRetornoDeGoogle, cerrarSesion, programarExpiracion, estaCerrando } from './sesion.js';
import { api } from './api.js';
import { iconos, logotipo } from './iconos.js';
import { esc, iniciales } from './utilidades.js';
import { renderEntrar } from './vistas/entrar.js';
import { renderPanel } from './vistas/panel.js';
import { renderTareas } from './vistas/tareas.js';
import { renderMaterias } from './vistas/materias.js';
import { renderApuntes } from './vistas/apuntes.js';
import { renderPlan } from './vistas/plan.js';
import { renderEstado } from './vistas/estado.js';

const RUTAS = {
  panel: { titulo: 'Panel', icono: iconos.panel, render: renderPanel },
  tareas: { titulo: 'Tareas', icono: iconos.tareas, render: renderTareas },
  materias: { titulo: 'Materias', icono: iconos.materias, render: renderMaterias },
  apuntes: { titulo: 'Apuntes', icono: iconos.apuntes, render: renderApuntes },
  plan: { titulo: 'Plan de estudio', corto: 'Plan', icono: iconos.plan, render: renderPlan },
  estado: { titulo: 'Estado del sistema', icono: iconos.estado, render: renderEstado, soloAdmin: true },
};

const raiz = document.getElementById('app');
let usuario = null;
let limpiarVista = null;

/** Lee "#/tareas?materiaId=..." => { ruta: 'tareas', parametros: {...} } */
function leerRuta() {
  const [ruta, consulta] = location.hash.replace(/^#\/?/, '').split('?');
  return { ruta: ruta || 'panel', parametros: Object.fromEntries(new URLSearchParams(consulta || '')) };
}

function rutasVisibles() {
  return Object.entries(RUTAS).filter(([, r]) => !r.soloAdmin || usuario?.rol === 'administrador');
}

function enlacesNavegacion(corto = false) {
  return rutasVisibles()
    .filter(([clave]) => !(corto && clave === 'estado'))
    .map(([clave, r]) => `<a href="#/${clave}" data-ruta="${clave}">${r.icono}<span>${esc(corto ? r.corto || r.titulo : r.titulo)}</span></a>`)
    .join('');
}

function avatar(clase = 'avatar') {
  return usuario?.fotoUrl
    ? `<img class="${clase}" src="${esc(usuario.fotoUrl)}" alt="" referrerpolicy="no-referrer">`
    : `<span class="${clase}" aria-hidden="true">${esc(iniciales(usuario?.nombre))}</span>`;
}

function renderMarco() {
  raiz.innerHTML = `
    <a class="solo-lectores" href="#contenido">Saltar al contenido</a>
    <div class="app">
      <aside class="lateral">
        <a class="marca" href="#/panel">${logotipo}EduPlan</a>
        <nav class="navegacion" aria-label="Secciones">${enlacesNavegacion()}</nav>
        <div class="lateral__usuario">
          <span data-avatar>${avatar()}</span>
          <div style="min-width:0">
            <div class="lateral__nombre">${esc(usuario.nombre)}</div>
            <div class="lateral__correo">${esc(usuario.email)}</div>
          </div>
          <button type="button" class="boton boton--secundario" data-salir>${iconos.salir}Cerrar sesión</button>
        </div>
      </aside>

      <div class="principal papel-cuadriculado">
        <header class="barra-superior">
          <a class="marca" href="#/panel">${logotipo}EduPlan</a>
          <div style="display:flex;align-items:center;gap:.5rem">
            <span data-avatar>${avatar()}</span>
            <button type="button" class="boton boton--icono" data-salir aria-label="Cerrar sesión">${iconos.salir}</button>
          </div>
        </header>
        <main id="contenido" class="contenido" tabindex="-1"></main>
      </div>

      <nav class="navegacion-movil" aria-label="Secciones">${enlacesNavegacion(true)}</nav>
    </div>`;

  raiz.querySelectorAll('[data-salir]').forEach((b) => b.addEventListener('click', () => cerrarSesion()));
}

async function navegar() {
  const { ruta, parametros } = leerRuta();

  if (!usuario) {
    renderEntrar(raiz, parametros);
    return;
  }

  const definicion = RUTAS[ruta];
  if (!definicion || (definicion.soloAdmin && usuario.rol !== 'administrador')) {
    location.replace('#/panel');
    return;
  }

  raiz.querySelectorAll('[data-ruta]').forEach((a) => {
    if (a.dataset.ruta === ruta) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  document.title = `${definicion.titulo} · EduPlan`;
  limpiarVista?.();
  // Contenedor nuevo en cada vista: así no se acumulan eventos de vistas anteriores
  const anterior = document.getElementById('contenido');
  const contenedor = anterior.cloneNode(false);
  anterior.replaceWith(contenedor);
  limpiarVista = (await definicion.render(contenedor, parametros, usuario)) || null;
  contenedor.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

// Si el token de Google llega con la página ya abierta, se recarga para procesarlo
function alCambiarRuta() {
  if (estaCerrando()) return;
  if (/^#(token|error)=/.test(location.hash)) location.reload();
  else navegar();
}

async function iniciar() {
  const retorno = leerRetornoDeGoogle();
  const sesion = datosSesion();

  if (!sesion) {
    usuario = null;
    const motivo = retorno?.error || leerRuta().parametros.motivo;
    if (location.hash && !location.hash.startsWith('#/entrar')) history.replaceState(null, '', '#/entrar');
    renderEntrar(raiz, { motivo });
    window.addEventListener('hashchange', alCambiarRuta);
    return;
  }

  usuario = { id: sesion.sub, nombre: sesion.nombre, email: sesion.email, rol: sesion.rol, fotoUrl: null };
  programarExpiracion();
  if (leerRuta().ruta === 'entrar' || !location.hash) history.replaceState(null, '', '#/panel');

  renderMarco();
  window.addEventListener('hashchange', alCambiarRuta);
  navegar();

  // El perfil completo (foto de Google) se pide a ms-auth sin bloquear la carga
  try {
    const { usuario: perfil } = await api.perfil();
    usuario = { ...usuario, ...perfil };
    raiz.querySelectorAll('[data-avatar]').forEach((el) => { el.innerHTML = avatar(); });
  } catch { /* si falla, se queda con las iniciales */ }
}

iniciar();
