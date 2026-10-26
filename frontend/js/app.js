
import { datosSesion, leerRetornoDeGoogle, cerrarSesion, programarExpiracion, estaCerrando } from './sesion.js';
import { api } from './api.js';
import { iconos, logotipo } from './iconos.js';
import { esc, iniciales } from './utilidades.js';
import { montarAlertas, actualizarAlertas } from './alertas.js';
import { renderEntrar } from './vistas/entrar.js';
import { renderPanel } from './vistas/panel.js';
import { renderCalendario } from './vistas/calendario.js';
import { renderTareas } from './vistas/tareas.js';
import { renderExamenes } from './vistas/examenes.js';
import { renderMaterias } from './vistas/materias.js';
import { renderApuntes } from './vistas/apuntes.js';
import { renderPlan } from './vistas/plan.js';
import { renderCuestionarios } from './vistas/cuestionarios.js';
import { renderTarjetas } from './vistas/tarjetas.js';
import { renderEstado } from './vistas/estado.js';

const RUTAS = {
  panel: { titulo: 'Panel', icono: iconos.panel, render: renderPanel, grupo: 'Organización', movil: true },
  calendario: { titulo: 'Calendario', icono: iconos.calendario, render: renderCalendario, grupo: 'Organización', movil: true },
  tareas: { titulo: 'Tareas', icono: iconos.tareas, render: renderTareas, grupo: 'Organización', movil: true },
  examenes: { titulo: 'Exámenes', icono: iconos.examen, render: renderExamenes, grupo: 'Organización' },
  materias: { titulo: 'Materias', icono: iconos.materias, render: renderMaterias, grupo: 'Organización' },
  apuntes: { titulo: 'Apuntes', icono: iconos.apuntes, render: renderApuntes, grupo: 'Organización', movil: true },
  plan: { titulo: 'Plan de estudio', icono: iconos.plan, render: renderPlan, grupo: 'Estudiar con IA' },
  cuestionarios: { titulo: 'Cuestionarios', icono: iconos.cuestionario, render: renderCuestionarios, grupo: 'Estudiar con IA' },
  tarjetas: { titulo: 'Tarjetas de memoria', corto: 'Tarjetas', icono: iconos.tarjetas, render: renderTarjetas, grupo: 'Estudiar con IA' },
  estado: { titulo: 'Estado del sistema', icono: iconos.estado, render: renderEstado, grupo: 'Administración', soloAdmin: true },
};

const raiz = document.getElementById('app');
let usuario = null;
let limpiarVista = null;

/** "#/cuestionarios/abc?revision=1" => { ruta: 'cuestionarios', id: 'abc', parametros: { revision: '1' } } */
function leerRuta() {
  const [camino, consulta] = location.hash.replace(/^#\/?/, '').split('?');
  const [ruta, id] = camino.split('/');
  return { ruta: ruta || 'panel', id: id || null, parametros: Object.fromEntries(new URLSearchParams(consulta || '')) };
}

const visibles = () => Object.entries(RUTAS).filter(([, r]) => !r.soloAdmin || usuario?.rol === 'administrador');

function navegacionAgrupada() {
  let grupoActual = null;
  return visibles().map(([clave, r]) => {
    const cabecera = r.grupo !== grupoActual ? `<p class="navegacion__grupo">${esc(r.grupo)}</p>` : '';
    grupoActual = r.grupo;
    return `${cabecera}<a href="#/${clave}" data-ruta="${clave}">${r.icono}<span>${esc(r.titulo)}</span></a>`;
  }).join('');
}

function avatar() {
  return usuario?.fotoUrl
    ? `<img class="avatar" src="${esc(usuario.fotoUrl)}" alt="" referrerpolicy="no-referrer">`
    : `<span class="avatar" aria-hidden="true">${esc(iniciales(usuario?.nombre))}</span>`;
}

const bloqueUsuario = () => `
  <div class="lateral__usuario">
    <span data-avatar>${avatar()}</span>
    <div style="min-width:0">
      <div class="lateral__nombre">${esc(usuario.nombre)}</div>
      <div class="lateral__correo">${esc(usuario.email)}</div>
    </div>
    <button type="button" class="boton boton--secundario" data-salir>${iconos.salir}Cerrar sesión</button>
  </div>`;

const botonCampana = () =>
  `<button type="button" class="boton boton--icono campana" data-campana aria-label="Avisos">${iconos.campana}</button>`;

function renderMarco() {
  raiz.innerHTML = `
    <a class="solo-lectores" href="#contenido">Saltar al contenido</a>
    <div class="app">
      <aside class="lateral">
        <div class="lateral__cabeza">
          <a class="marca" href="#/panel" aria-label="EduPlan, ir al panel">${logotipo}</a>
          ${botonCampana()}
        </div>
        <nav class="navegacion" aria-label="Secciones">${navegacionAgrupada()}</nav>
        ${bloqueUsuario()}
      </aside>

      <div class="principal papel-cuadriculado">
        <header class="barra-superior">
          <button type="button" class="boton boton--icono" data-menu aria-label="Abrir menú">${iconos.menu}</button>
          <a class="marca" href="#/panel" aria-label="EduPlan, ir al panel">${logotipo}</a>
          ${botonCampana()}
        </header>
        <main id="contenido" class="contenido" tabindex="-1"></main>
      </div>

      <nav class="navegacion-movil" aria-label="Secciones principales">
        ${Object.entries(RUTAS).filter(([, r]) => r.movil)
          .map(([clave, r]) => `<a href="#/${clave}" data-ruta="${clave}">${r.icono}<span>${esc(r.corto || r.titulo)}</span></a>`).join('')}
        <a href="#" data-menu>${iconos.menu}<span>Más</span></a>
      </nav>
    </div>

    <dialog class="cajon" aria-label="Menú">
      <div class="lateral__cabeza">
        <span class="marca">${logotipo}</span>
        <button type="button" class="boton boton--icono" data-cerrar-menu aria-label="Cerrar menú">${iconos.cerrar}</button>
      </div>
      <nav class="navegacion" aria-label="Todas las secciones">${navegacionAgrupada()}</nav>
      ${bloqueUsuario()}
    </dialog>`;

  const cajon = raiz.querySelector('.cajon');
  raiz.querySelectorAll('[data-salir]').forEach((b) => b.addEventListener('click', () => cerrarSesion()));
  raiz.querySelectorAll('[data-menu]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); cajon.showModal(); }));
  cajon.addEventListener('click', (e) => {
    if (e.target === cajon || e.target.closest('[data-cerrar-menu]') || e.target.closest('a[href^="#/"]')) cajon.close();
  });
  montarAlertas();
}

async function navegar() {
  const { ruta, id, parametros } = leerRuta();

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
  contenedor.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  limpiarVista = (await definicion.render(contenedor, { ...parametros, id }, usuario)) || null;
  actualizarAlertas();
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
