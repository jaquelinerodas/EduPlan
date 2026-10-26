/** Tareas: lista con filtros (RF06), crear/editar/eliminar (RF04) y completar (HU04). */
import { api } from '../api.js';
import { obtenerMaterias, invalidarMaterias } from '../datos.js';
import { iconos } from '../iconos.js';
import { aviso, abrirFormulario, confirmar, esqueleto, errorCarga, vacio } from '../ui.js';
import {
  esc, colorSeguro, describirEntrega, aEntradaFechaHora, desdeEntradaFechaHora, plural, ESTADOS, PRIORIDADES,
} from '../utilidades.js';

const FILTROS = ['materiaId', 'estado', 'prioridad', 'desde', 'hasta', 'vencidas'];

const opciones = (mapa, seleccion, todos) =>
  `${todos ? `<option value="">${esc(todos)}</option>` : ''}${Object.entries(mapa)
    .map(([v, t]) => `<option value="${esc(v)}"${v === seleccion ? ' selected' : ''}>${esc(t)}</option>`).join('')}`;

const opcionesMaterias = (materias, seleccion, todos) =>
  `${todos ? `<option value="">${esc(todos)}</option>` : ''}${materias
    .map((m) => `<option value="${esc(m.id)}"${m.id === seleccion ? ' selected' : ''}>${esc(m.nombre)}</option>`).join('')}`;

function renglon(t) {
  const entrega = describirEntrega(t);
  const hecha = t.estado === 'completada';
  return `
    <li class="renglon${hecha ? ' renglon--hecho' : ''}" style="--color:${colorSeguro(t.materiaColor)}">
      <input type="checkbox" class="check" data-alternar="${esc(t.id)}" ${hecha ? 'checked' : ''}
        aria-label="${hecha ? 'Marcar como pendiente' : 'Marcar como completada'}: ${esc(t.titulo)}">
      <div>
        <div class="renglon__titulo">${esc(t.titulo)}</div>
        ${t.descripcion ? `<p class="renglon__descripcion">${esc(t.descripcion)}</p>` : ''}
        <div class="renglon__detalle">
          <span class="etiqueta-materia" style="--color:${colorSeguro(t.materiaColor)}"><span>${esc(t.materia)}</span></span>
          <span class="fecha ${entrega.clase}">${esc(entrega.texto)}</span>
          ${t.estado === 'en_progreso' ? '<span class="estado estado--en_progreso">En progreso</span>' : ''}
        </div>
      </div>
      <div class="renglon__acciones">
        <span class="prioridad prioridad--${esc(t.prioridad)}">${esc(PRIORIDADES[t.prioridad])}</span>
        <button type="button" class="boton boton--icono" data-editar="${esc(t.id)}" aria-label="Editar ${esc(t.titulo)}">${iconos.editar}</button>
        <button type="button" class="boton boton--icono peligro" data-borrar="${esc(t.id)}" aria-label="Eliminar ${esc(t.titulo)}">${iconos.borrar}</button>
      </div>
    </li>`;
}

function formularioTarea(materias, t = {}) {
  return `
    <label class="campo"><span>Título</span>
      <input class="entrada" name="titulo" required maxlength="200" value="${esc(t.titulo)}" placeholder="Ej. Entregar laboratorio 3">
    </label>
    <label class="campo"><span>Materia</span>
      <select class="selector" name="materiaId" required>${opcionesMaterias(materias, t.materiaId)}</select>
    </label>
    <div class="formulario__fila">
      <label class="campo"><span>Fecha y hora de entrega</span>
        <input class="entrada" type="datetime-local" name="fechaLimite" required value="${t.fechaLimite ? aEntradaFechaHora(t.fechaLimite) : ''}">
      </label>
      <label class="campo"><span>Prioridad</span>
        <select class="selector" name="prioridad">${opciones(PRIORIDADES, t.prioridad || 'media')}</select>
      </label>
    </div>
    ${t.id ? `<label class="campo"><span>Estado</span><select class="selector" name="estado">${opciones(ESTADOS, t.estado)}</select></label>` : ''}
    <label class="campo"><span>Descripción <span class="opcional">(opcional)</span></span>
      <textarea class="area-texto" name="descripcion" rows="3" maxlength="5000" style="min-height:6rem">${esc(t.descripcion)}</textarea>
    </label>`;
}

function datosDelFormulario(f) {
  return {
    titulo: f.titulo,
    materiaId: f.materiaId,
    fechaLimite: desdeEntradaFechaHora(f.fechaLimite),
    prioridad: f.prioridad,
    descripcion: f.descripcion.trim() ? f.descripcion : null,
    ...(f.estado ? { estado: f.estado } : {}),
  };
}

export async function renderTareas(contenedor, parametros) {
  const filtros = Object.fromEntries(FILTROS.filter((k) => parametros[k]).map((k) => [k, parametros[k]]));
  let tareas = [];
  let materias = [];

  contenedor.innerHTML = esqueleto(6);
  try {
    materias = await obtenerMaterias({ forzar: true });
  } catch (error) {
    contenedor.innerHTML = errorCarga(error, false);
    return;
  }

  if (!materias.length) {
    contenedor.innerHTML = `
      <div class="encabezado-vista"><div><h1>Tareas</h1></div></div>
      <section class="hoja">${vacio({
        icono: iconos.materias,
        titulo: 'Primero registra una materia',
        texto: 'Cada tarea pertenece a una materia. Agrega al menos una para empezar a anotar tus entregas.',
        accion: '<a class="boton boton--primario" href="#/materias">Agregar materia</a>',
      })}</section>`;
    return;
  }

  contenedor.innerHTML = `
    <div class="encabezado-vista">
      <div>
        <h1>Tareas</h1>
        <p>Filtra por materia, estado, prioridad o fecha de entrega.</p>
      </div>
      <button type="button" class="boton boton--primario" data-nueva>${iconos.mas}Nueva tarea</button>
    </div>

    <section class="hoja">
      <form class="filtros" aria-label="Filtros de tareas">
        <label class="campo"><span>Materia</span>
          <select class="selector" name="materiaId">${opcionesMaterias(materias, filtros.materiaId, 'Todas')}</select></label>
        <label class="campo"><span>Estado</span>
          <select class="selector" name="estado">${opciones(ESTADOS, filtros.estado, 'Todos')}</select></label>
        <label class="campo"><span>Prioridad</span>
          <select class="selector" name="prioridad">${opciones(PRIORIDADES, filtros.prioridad, 'Todas')}</select></label>
        <label class="campo"><span>Entrega desde</span>
          <input class="entrada" type="date" name="desde" value="${esc(filtros.desde)}"></label>
        <label class="campo"><span>Entrega hasta</span>
          <input class="entrada" type="date" name="hasta" value="${esc(filtros.hasta)}"></label>
        <div class="filtros__pie">
          <label class="casilla"><input type="checkbox" name="vencidas" value="true" ${filtros.vencidas === 'true' ? 'checked' : ''}>Solo vencidas</label>
          <span style="display:flex;align-items:center;gap:.75rem">
            <span data-conteo aria-live="polite"></span>
            <button type="button" class="boton boton--fantasma" data-limpiar>Quitar filtros</button>
          </span>
        </div>
      </form>
      <div data-lista>${esqueleto(5)}</div>
    </section>`;

  const lista = contenedor.querySelector('[data-lista]');
  const formFiltros = contenedor.querySelector('.filtros');
  const conteo = contenedor.querySelector('[data-conteo]');

  async function cargar() {
    try {
      ({ tareas } = await api.tareas(filtros));
      const hayFiltros = Object.keys(filtros).length > 0;
      conteo.textContent = plural(tareas.length, 'tarea', 'tareas');
      lista.innerHTML = tareas.length
        ? `<ul class="renglones">${tareas.map(renglon).join('')}</ul>`
        : vacio({
          titulo: hayFiltros ? 'Ninguna tarea coincide' : 'No tienes tareas',
          texto: hayFiltros ? 'Prueba con otros filtros o quítalos para ver todas tus tareas.' : 'Anota tu próxima entrega para no olvidarla.',
          accion: hayFiltros ? '' : `<button type="button" class="boton boton--primario" data-nueva>${iconos.mas}Nueva tarea</button>`,
        });
    } catch (error) {
      lista.innerHTML = errorCarga(error);
    }
  }

  // Los filtros se reflejan en la URL para poder compartir o volver a la misma vista
  function aplicarFiltros() {
    const datos = new FormData(formFiltros);
    for (const k of FILTROS) {
      const v = datos.get(k);
      if (v) filtros[k] = v; else delete filtros[k];
    }
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
      aviso('La fecha "desde" no puede ser posterior a "hasta".', 'error');
      return;
    }
    const consulta = new URLSearchParams(filtros).toString();
    history.replaceState(null, '', `#/tareas${consulta ? `?${consulta}` : ''}`);
    cargar();
  }

  function abrirEditor(tarea) {
    abrirFormulario({
      titulo: tarea ? 'Editar tarea' : 'Nueva tarea',
      textoEnviar: tarea ? 'Guardar cambios' : 'Crear tarea',
      contenido: formularioTarea(materias, tarea || { materiaId: filtros.materiaId }),
      alEnviar: async (f) => {
        if (tarea) await api.editarTarea(tarea.id, datosDelFormulario(f));
        else await api.crearTarea(datosDelFormulario(f));
        invalidarMaterias();
        aviso(tarea ? 'Cambios guardados' : 'Tarea creada');
        cargar();
      },
    });
  }

  formFiltros.addEventListener('change', aplicarFiltros);
  formFiltros.addEventListener('submit', (e) => e.preventDefault());

  contenedor.addEventListener('click', async (e) => {
    if (e.target.closest('[data-nueva]')) return abrirEditor();
    if (e.target.closest('[data-reintentar]')) return cargar();
    if (e.target.closest('[data-limpiar]')) {
      formFiltros.reset();
      formFiltros.querySelectorAll('select, input[type="date"]').forEach((el) => { el.value = ''; });
      formFiltros.querySelector('[name="vencidas"]').checked = false;
      return aplicarFiltros();
    }

    const editar = e.target.closest('[data-editar]');
    if (editar) return abrirEditor(tareas.find((t) => t.id === editar.dataset.editar));

    const borrar = e.target.closest('[data-borrar]');
    if (borrar) {
      const tarea = tareas.find((t) => t.id === borrar.dataset.borrar);
      const ok = await confirmar({ titulo: 'Eliminar tarea', mensaje: `Se eliminará «${tarea.titulo}». Esta acción no se puede deshacer.` });
      if (!ok) return;
      try {
        await api.borrarTarea(tarea.id);
        invalidarMaterias();
        aviso('Tarea eliminada');
        cargar();
      } catch (error) {
        aviso(error.message, 'error');
      }
    }
  });

  // HU04: marcar como completada o regresar a pendiente
  lista.addEventListener('change', async (e) => {
    const id = e.target.dataset?.alternar;
    if (!id) return;
    const completar = e.target.checked;
    e.target.disabled = true;
    try {
      await api.cambiarEstado(id, completar ? 'completada' : 'pendiente');
      invalidarMaterias();
      aviso(completar ? 'Tarea completada' : 'Tarea marcada como pendiente');
      cargar();
    } catch (error) {
      e.target.checked = !completar;
      e.target.disabled = false;
      aviso(error.message, 'error');
    }
  });

  await cargar();
}
