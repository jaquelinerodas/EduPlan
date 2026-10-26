/** Apuntes por materia (RF05, HU06) con resumen generado por IA (RF07, HU07). */
import { api } from '../api.js';
import { obtenerMaterias } from '../datos.js';
import { iconos } from '../iconos.js';
import { markdownAHtml } from '../markdown.js';
import { aviso, confirmar, conCarga, esqueleto, errorCarga, vacio, mostrarError } from '../ui.js';
import { esc, colorSeguro, formato, debounce } from '../utilidades.js';

export async function renderApuntes(contenedor, parametros) {
  const filtros = { materiaId: parametros.materiaId || '', buscar: '' };
  let materias = [];
  let apuntes = [];
  let actual = null; // apunte abierto, o { nuevo: true }
  let cambiosSinGuardar = false;

  contenedor.innerHTML = esqueleto(6);
  try {
    materias = await obtenerMaterias({ forzar: true });
  } catch (error) {
    contenedor.innerHTML = errorCarga(error, false);
    return;
  }

  if (!materias.length) {
    contenedor.innerHTML = `
      <div class="encabezado-vista"><div><h1>Apuntes</h1></div></div>
      <section class="hoja">${vacio({
        icono: iconos.apuntes,
        titulo: 'Primero registra una materia',
        texto: 'Los apuntes se guardan dentro de una materia.',
        accion: '<a class="boton boton--primario" href="#/materias">Agregar materia</a>',
      })}</section>`;
    return;
  }

  const opcionesMaterias = (seleccion, todas) =>
    `${todas ? '<option value="">Todas las materias</option>' : ''}${materias
      .map((m) => `<option value="${esc(m.id)}"${m.id === seleccion ? ' selected' : ''}>${esc(m.nombre)}</option>`).join('')}`;

  contenedor.innerHTML = `
    <div class="encabezado-vista">
      <div>
        <h1>Apuntes</h1>
        <p>Escribe tus notas por materia y pide un resumen cuando lo necesites.</p>
      </div>
      <button type="button" class="boton boton--primario" data-nuevo>${iconos.mas}Nuevo apunte</button>
    </div>
    <div class="apuntes" data-modo="lista">
      <aside class="hoja apuntes__lista" aria-label="Lista de apuntes">
        <div class="apuntes__buscador">
          <label class="campo"><span class="solo-lectores">Buscar</span>
            <input class="entrada" type="search" name="buscar" placeholder="Buscar en tus apuntes"></label>
          <label class="campo"><span class="solo-lectores">Materia</span>
            <select class="selector" name="materiaId">${opcionesMaterias(filtros.materiaId, true)}</select></label>
        </div>
        <ul class="apuntes__items" data-items>${esqueleto(4)}</ul>
      </aside>
      <section class="hoja apuntes__detalle" data-detalle aria-live="polite"></section>
    </div>`;

  const contenedorApuntes = contenedor.querySelector('.apuntes');
  const listaItems = contenedor.querySelector('[data-items]');
  const detalle = contenedor.querySelector('[data-detalle]');

  function pintarLista() {
    listaItems.innerHTML = apuntes.length
      ? apuntes.map((a) => `
        <li><button type="button" data-abrir="${esc(a.id)}" ${actual?.id === a.id ? 'aria-current="true"' : ''}>
          <strong>${esc(a.titulo)}</strong>
          <span class="etiqueta-materia" style="--color:${colorSeguro(a.materiaColor)}"><span>${esc(a.materia)}</span></span>
          <small>Editado ${esc(formato.fechaHora(a.actualizadoEn))}${a.resumenIa ? ' · con resumen' : ''}</small>
        </button></li>`).join('')
      : `<li class="vacio" style="padding:2rem 1rem"><p>${filtros.buscar || filtros.materiaId ? 'Ningún apunte coincide.' : 'Aún no tienes apuntes.'}</p></li>`;
  }

  function pintarDetalle() {
    if (!actual) {
      detalle.innerHTML = vacio({
        icono: iconos.apuntes,
        titulo: apuntes.length ? 'Elige un apunte' : 'Escribe tu primer apunte',
        texto: apuntes.length ? 'Ábrelo para leerlo, editarlo o resumirlo con el asistente.' : 'Guarda lo que vas aprendiendo en cada materia.',
        accion: `<button type="button" class="boton boton--primario" data-nuevo>${iconos.mas}Nuevo apunte</button>`,
      });
      return;
    }

    const a = actual;
    detalle.innerHTML = `
      <form class="hoja__cuerpo editor" novalidate>
        <button type="button" class="boton boton--fantasma volver-movil" data-volver>${iconos.atras}Todos los apuntes</button>
        <div class="formulario__error" role="alert" hidden></div>
        <label class="campo"><span class="solo-lectores">Título</span>
          <input class="editor__titulo" name="titulo" maxlength="200" required value="${esc(a.titulo)}" placeholder="Título del apunte"></label>
        <div class="editor__barra">
          <label class="campo" style="min-width:12rem"><span class="solo-lectores">Materia</span>
            <select class="selector" name="materiaId" required>${opcionesMaterias(a.materiaId || filtros.materiaId || materias[0].id)}</select></label>
          ${a.actualizadoEn ? `<small style="color:var(--grafito-tenue)">Guardado ${esc(formato.fechaHora(a.actualizadoEn))}</small>` : ''}
        </div>
        <label class="campo"><span class="solo-lectores">Contenido</span>
          <textarea class="area-texto editor__contenido" name="contenido" maxlength="50000" required placeholder="Escribe aquí tus apuntes…">${esc(a.contenido)}</textarea></label>

        <div class="editor__barra">
          <div class="editor__acciones">
            <button type="submit" class="boton boton--primario">${iconos.guardar}${a.nuevo ? 'Guardar apunte' : 'Guardar cambios'}</button>
            ${a.nuevo ? '' : `<button type="button" class="boton boton--ia" data-resumir>${iconos.chispa}${a.resumenIa ? 'Volver a resumir' : 'Resumir con IA'}</button>`}
            ${a.nuevo ? '' : `<a class="boton boton--secundario" href="#/cuestionarios?nuevo=apuntes&apunteIds=${esc(a.id)}">${iconos.cuestionario}Cuestionario</a>
            <button type="button" class="boton boton--secundario" data-tarjetas>${iconos.tarjetas}Crear tarjetas</button>`}
          </div>
          ${a.nuevo ? '' : `<button type="button" class="boton boton--fantasma" data-borrar style="color:var(--rojo)">${iconos.borrar}Eliminar</button>`}
        </div>

        <div data-resumen>
          ${a.resumenIa ? `
            <div class="resumen-ia">
              <div class="resumen-ia__cabeza">
                <h3>Resumen</h3>
                <span class="firma-ia">${iconos.chispa}Generado por IA · ${esc(formato.fechaHora(a.resumenGeneradoEn))}</span>
              </div>
              <div class="texto-ia">${markdownAHtml(a.resumenIa)}</div>
            </div>` : ''}
        </div>
      </form>`;
    cambiosSinGuardar = false;
  }

  async function cargarLista() {
    try {
      ({ apuntes } = await api.apuntes(filtros));
      pintarLista();
      if (!actual && window.matchMedia('(min-width: 901px)').matches && apuntes.length) {
        actual = apuntes[0];
      }
      if (!actual || !actual.nuevo) pintarDetalle();
    } catch (error) {
      listaItems.innerHTML = `<li>${errorCarga(error)}</li>`;
    }
  }

  async function abrir(id) {
    if (cambiosSinGuardar && !(await confirmar({ titulo: 'Cambios sin guardar', mensaje: 'Si cambias de apunte perderás lo que no has guardado.', textoConfirmar: 'Descartar cambios' }))) return;
    actual = apuntes.find((a) => a.id === id) || null;
    pintarLista();
    pintarDetalle();
    contenedorApuntes.dataset.modo = 'detalle';
  }

  async function guardar(formulario) {
    const f = Object.fromEntries(new FormData(formulario));
    const datos = { titulo: f.titulo, materiaId: f.materiaId, contenido: f.contenido };
    const { apunte } = actual.nuevo ? await api.crearApunte(datos) : await api.editarApunte(actual.id, datos);
    actual = apunte;
    cambiosSinGuardar = false;
    return apunte;
  }

  // ---------- Eventos ----------
  const buscar = debounce((texto) => { filtros.buscar = texto.trim(); cargarLista(); }, 350);
  contenedor.querySelector('[name="buscar"]').addEventListener('input', (e) => buscar(e.target.value));
  contenedor.querySelector('.apuntes__buscador [name="materiaId"]').addEventListener('change', (e) => {
    filtros.materiaId = e.target.value;
    cargarLista();
  });

  detalle.addEventListener('input', () => { cambiosSinGuardar = true; });

  detalle.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formulario = e.target;
    const cajaError = formulario.querySelector('.formulario__error');
    cajaError.hidden = true;
    const eraNuevo = actual.nuevo;
    try {
      await conCarga(formulario.querySelector('[type="submit"]'), () => guardar(formulario));
      aviso(eraNuevo ? 'Apunte guardado' : 'Cambios guardados');
      await cargarLista();
      pintarDetalle();
    } catch (error) {
      mostrarError(cajaError, error);
    }
  });

  contenedor.addEventListener('click', async (e) => {
    if (e.target.closest('[data-nuevo]')) {
      if (cambiosSinGuardar && !(await confirmar({ titulo: 'Cambios sin guardar', mensaje: 'Perderás lo que no has guardado.', textoConfirmar: 'Descartar cambios' }))) return;
      actual = { nuevo: true, titulo: '', contenido: '', materiaId: filtros.materiaId };
      pintarLista();
      pintarDetalle();
      contenedorApuntes.dataset.modo = 'detalle';
      detalle.querySelector('[name="titulo"]').focus();
      return;
    }
    const abrirBtn = e.target.closest('[data-abrir]');
    if (abrirBtn) return abrir(abrirBtn.dataset.abrir);

    if (e.target.closest('[data-volver]')) {
      contenedorApuntes.dataset.modo = 'lista';
      return;
    }
    if (e.target.closest('[data-reintentar]')) return cargarLista();

    // RF07: resumir con IA (si hay cambios sin guardar, se guardan primero)
    const resumir = e.target.closest('[data-resumir]');
    if (resumir) {
      const formulario = detalle.querySelector('form');
      const cajaError = formulario.querySelector('.formulario__error');
      cajaError.hidden = true;
      detalle.querySelector('[data-resumen]').innerHTML = `
        <div class="generando">${iconos.lapiz}<p>El asistente está leyendo tu apunte…</p></div>`;
      detalle.querySelector('[data-resumen] svg').classList.add('generando__lapiz');
      try {
        await conCarga(resumir, async () => {
          if (cambiosSinGuardar) await guardar(formulario);
          const { apunte } = await api.resumirApunte(actual.id);
          actual = apunte;
        });
        aviso('Resumen listo');
        pintarDetalle();
        cargarLista();
      } catch (error) {
        detalle.querySelector('[data-resumen]').innerHTML = '';
        mostrarError(cajaError, error);
      }
      return;
    }

    const botonTarjetas = e.target.closest('[data-tarjetas]');
    if (botonTarjetas) {
      try {
        await conCarga(botonTarjetas, async () => {
          if (cambiosSinGuardar) await guardar(detalle.querySelector('form'));
          const { tarjetas } = await api.generarTarjetas({ apunteId: actual.id, cantidad: 10 });
          aviso(`${tarjetas.length} tarjetas creadas. Repásalas en Tarjetas de memoria.`);
        });
      } catch (error) {
        aviso(error.message, 'error');
      }
      return;
    }

    if (e.target.closest('[data-borrar]')) {
      const ok = await confirmar({ titulo: 'Eliminar apunte', mensaje: `Se eliminará «${actual.titulo}» y su resumen. Esta acción no se puede deshacer.` });
      if (!ok) return;
      try {
        await api.borrarApunte(actual.id);
        actual = null;
        aviso('Apunte eliminado');
        contenedorApuntes.dataset.modo = 'lista';
        await cargarLista();
        pintarDetalle();
      } catch (error) {
        aviso(error.message, 'error');
      }
    }
  });

  // Aviso del navegador si se intenta cerrar la pestaña con cambios sin guardar
  const antesDeSalir = (e) => { if (cambiosSinGuardar) e.preventDefault(); };
  window.addEventListener('beforeunload', antesDeSalir);

  await cargarLista();
  return () => window.removeEventListener('beforeunload', antesDeSalir);
}
