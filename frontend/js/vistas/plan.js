/** Plan de estudio sugerido por la IA a partir de las tareas pendientes (RF08, HU08). */
import { api } from '../api.js';
import { iconos } from '../iconos.js';
import { markdownAHtml } from '../markdown.js';
import { aviso, confirmar, conCarga, esqueleto, errorCarga, vacio } from '../ui.js';
import { esc, formato, plural } from '../utilidades.js';

const fechaLocal = (yyyyMmDd) => new Date(`${yyyyMmDd}T12:00:00`);

export async function renderPlan(contenedor) {
  let planes = [];
  let seleccionado = null;

  contenedor.innerHTML = `
    <div class="encabezado-vista">
      <div>
        <h1>Plan de estudio</h1>
        <p>El asistente reparte tus tareas pendientes según su fecha de entrega y prioridad.</p>
      </div>
    </div>
    <div class="plan">
      <div style="display:grid;gap:var(--e-5)">
        <section class="hoja">
          <form class="hoja__cuerpo plan__generar" data-generar>
            <label class="campo"><span>Planificar los próximos</span>
              <select class="selector" name="dias">
                <option value="3">3 días</option>
                <option value="7" selected>7 días</option>
                <option value="14">14 días</option>
                <option value="30">30 días</option>
              </select></label>
            <label class="campo"><span>Horas de estudio al día</span>
              <select class="selector" name="horasPorDia">
                ${[1, 2, 3, 4, 5, 6].map((h) => `<option value="${h}"${h === 2 ? ' selected' : ''}>${plural(h, 'hora', 'horas')}</option>`).join('')}
              </select></label>
            <button type="submit" class="boton boton--ia">${iconos.chispa}Generar plan</button>
          </form>
        </section>
        <section class="hoja plan__hoja" data-plan aria-live="polite">${esqueleto(8)}</section>
      </div>
      <aside class="hoja" aria-labelledby="historial-titulo">
        <div class="hoja__encabezado"><h2 id="historial-titulo" style="font-size:var(--t-md)">Planes anteriores</h2></div>
        <ul class="historial" data-historial></ul>
      </aside>
    </div>`;

  const hojaPlan = contenedor.querySelector('[data-plan]');
  const historial = contenedor.querySelector('[data-historial]');

  function pintarHistorial() {
    historial.innerHTML = planes.length
      ? planes.map((p) => `
        <li>
          <button type="button" class="historial__item" data-ver="${esc(p.id)}" ${seleccionado?.id === p.id ? 'aria-current="true"' : ''}>
            <strong>${esc(formato.fechaCorta(fechaLocal(p.fechaInicio)))} – ${esc(formato.fechaCorta(fechaLocal(p.fechaFin)))}</strong>
            <small>Creado ${esc(formato.fechaHora(p.creadoEn))} · ${plural(p.tareasIncluidas.length, 'tarea', 'tareas')}</small>
          </button>
          <button type="button" class="boton boton--icono peligro" data-borrar="${esc(p.id)}" aria-label="Eliminar plan">${iconos.borrar}</button>
        </li>`).join('')
      : '<li style="padding:var(--e-3);color:var(--grafito-tenue)">Todavía no has generado planes.</li>';
  }

  function pintarPlan() {
    if (!seleccionado) {
      hojaPlan.innerHTML = vacio({
        icono: iconos.calendario,
        titulo: 'Genera tu primer plan',
        texto: 'Elige cuántos días quieres planificar y cuántas horas puedes estudiar al día.',
      });
      return;
    }
    const p = seleccionado;
    hojaPlan.innerHTML = `
      <div class="hoja__cuerpo">
        <div class="plan__meta">
          <span><b>Del ${esc(formato.fechaCompleta(fechaLocal(p.fechaInicio)))} al ${esc(formato.fechaCompleta(fechaLocal(p.fechaFin)))}</b> · ${plural(p.tareasIncluidas.length, 'tarea incluida', 'tareas incluidas')}</span>
          <span class="firma-ia">${iconos.chispa}Generado por IA · ${esc(formato.fechaHora(p.creadoEn))}</span>
        </div>
        <article class="texto-ia">${markdownAHtml(p.contenido)}</article>
      </div>`;
  }

  async function cargar() {
    try {
      ({ planes } = await api.planes());
      seleccionado = seleccionado ? planes.find((p) => p.id === seleccionado.id) || planes[0] || null : planes[0] || null;
      pintarHistorial();
      pintarPlan();
    } catch (error) {
      hojaPlan.innerHTML = errorCarga(error);
    }
  }

  contenedor.querySelector('[data-generar]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const opciones = { dias: Number(f.get('dias')), horasPorDia: Number(f.get('horasPorDia')) };
    const anterior = hojaPlan.innerHTML;
    hojaPlan.innerHTML = `
      <div class="generando">
        ${iconos.lapiz.replace('<svg', '<svg class="generando__lapiz"')}
        <h3>Organizando tus próximos ${opciones.dias} días</h3>
        <p>El asistente está revisando tus entregas. Puede tardar unos segundos.</p>
      </div>`;
    try {
      await conCarga(e.submitter, async () => {
        const { plan } = await api.generarPlan(opciones);
        seleccionado = plan;
      });
      aviso('Plan generado');
      await cargar();
    } catch (error) {
      if (error.codigo === 'SIN_TAREAS_PENDIENTES') {
        hojaPlan.innerHTML = vacio({
          icono: iconos.tareas,
          titulo: 'No hay tareas que planificar',
          texto: `No tienes entregas pendientes en los próximos ${opciones.dias} días. Prueba con un periodo más largo o agrega tus próximas tareas.`,
          accion: '<a class="boton boton--secundario" href="#/tareas">Ir a tareas</a>',
        });
      } else {
        hojaPlan.innerHTML = anterior;
        aviso(error.message, 'error');
      }
    }
  });

  contenedor.addEventListener('click', async (e) => {
    const ver = e.target.closest('[data-ver]');
    if (ver) {
      seleccionado = planes.find((p) => p.id === ver.dataset.ver);
      pintarHistorial();
      pintarPlan();
      hojaPlan.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (e.target.closest('[data-reintentar]')) return cargar();

    const borrar = e.target.closest('[data-borrar]');
    if (borrar) {
      if (!(await confirmar({ titulo: 'Eliminar plan', mensaje: 'Se eliminará este plan del historial.' }))) return;
      try {
        await api.borrarPlan(borrar.dataset.borrar);
        if (seleccionado?.id === borrar.dataset.borrar) seleccionado = null;
        aviso('Plan eliminado');
        cargar();
      } catch (error) {
        aviso(error.message, 'error');
      }
    }
  });

  await cargar();
}
