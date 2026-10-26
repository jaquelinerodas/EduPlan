/** Materias: estante de cuadernos con su avance (RF03, HU02). */
import { api } from '../api.js';
import { obtenerMaterias, invalidarMaterias } from '../datos.js';
import { iconos } from '../iconos.js';
import { aviso, abrirFormulario, confirmar, esqueleto, errorCarga, vacio } from '../ui.js';
import { esc, colorSeguro, describirEntrega, plural, COLORES_MATERIA } from '../utilidades.js';

function cuaderno(m) {
  const abiertas = m.pendientes + m.enProgreso;
  const pct = m.totalTareas ? Math.round((m.completadas / m.totalTareas) * 100) : 0;
  const proxima = m.proximaEntrega ? describirEntrega({ fechaLimite: m.proximaEntrega, estado: 'pendiente' }) : null;

  return `
    <article class="cuaderno" style="--color:${colorSeguro(m.color)}">
      <div class="cuaderno__cabeza">
        <div style="min-width:0">
          <h3>${esc(m.nombre)}</h3>
          ${m.docente ? `<p class="cuaderno__docente">${esc(m.docente)}</p>` : ''}
        </div>
        <div style="display:flex">
          <button type="button" class="boton boton--icono" data-editar="${esc(m.id)}" aria-label="Editar ${esc(m.nombre)}">${iconos.editar}</button>
          <button type="button" class="boton boton--icono peligro" data-borrar="${esc(m.id)}" aria-label="Eliminar ${esc(m.nombre)}">${iconos.borrar}</button>
        </div>
      </div>
      <div style="display:grid;gap:.5rem;align-content:start">
        ${m.descripcion ? `<p class="cuaderno__descripcion">${esc(m.descripcion)}</p>` : ''}
        <p class="cuaderno__numeros">
          <span><b>${abiertas}</b> ${abiertas === 1 ? 'abierta' : 'abiertas'}</span>
          <span><b>${m.completadas}</b> ${m.completadas === 1 ? 'completada' : 'completadas'}</span>
          ${m.vencidas ? `<span class="vencidas"><b>${m.vencidas}</b> ${m.vencidas === 1 ? 'vencida' : 'vencidas'}</span>` : ''}
        </p>
        ${proxima ? `<p class="fecha ${proxima.clase}" style="justify-self:start">Próxima entrega: ${esc(proxima.texto)}</p>` : ''}
      </div>
      <div class="cuaderno__pie">
        <div class="avance" role="progressbar" aria-label="Avance de ${esc(m.nombre)}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
          <span style="--valor:${pct}%;--color:${colorSeguro(m.color)}"></span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap">
          <a href="#/tareas?materiaId=${esc(m.id)}">Ver ${plural(m.totalTareas, 'tarea', 'tareas')}</a>
          <a href="#/apuntes?materiaId=${esc(m.id)}">Ver apuntes</a>
        </div>
      </div>
    </article>`;
}

function formularioMateria(m = {}) {
  const actual = (m.color || COLORES_MATERIA[0]).toUpperCase();
  const colores = COLORES_MATERIA.includes(actual) ? COLORES_MATERIA : [...COLORES_MATERIA, actual];
  return `
    <label class="campo"><span>Nombre</span>
      <input class="entrada" name="nombre" required maxlength="120" value="${esc(m.nombre)}" placeholder="Ej. Desarrollo Web I">
    </label>
    <label class="campo"><span>Docente <span class="opcional">(opcional)</span></span>
      <input class="entrada" name="docente" maxlength="120" value="${esc(m.docente)}" placeholder="Ej. Ing. Guillermo Pisqui">
    </label>
    <label class="campo"><span>Descripción <span class="opcional">(opcional)</span></span>
      <textarea class="area-texto" name="descripcion" rows="2" maxlength="2000" style="min-height:4.5rem">${esc(m.descripcion)}</textarea>
    </label>
    <fieldset class="campo" style="border:0;padding:0;margin:0">
      <legend>Color</legend>
      <div class="paleta">
        ${colores.map((c) => `
          <label><input type="radio" name="color" value="${c}" ${c === actual ? 'checked' : ''} aria-label="Color ${c}">
          <span style="--color:${c}"></span></label>`).join('')}
      </div>
    </fieldset>`;
}

export async function renderMaterias(contenedor) {
  let materias = [];

  contenedor.innerHTML = `
    <div class="encabezado-vista">
      <div>
        <h1>Materias</h1>
        <p>Cada materia agrupa sus tareas y apuntes.</p>
      </div>
      <button type="button" class="boton boton--primario" data-nueva>${iconos.mas}Nueva materia</button>
    </div>
    <div data-estante>${esqueleto(6)}</div>`;

  const estante = contenedor.querySelector('[data-estante]');

  async function cargar() {
    try {
      materias = await obtenerMaterias({ forzar: true });
      estante.innerHTML = materias.length
        ? `<div class="estante">${materias.map(cuaderno).join('')}</div>`
        : `<section class="hoja">${vacio({
          icono: iconos.materias,
          titulo: 'Aún no tienes materias',
          texto: 'Agrega los cursos que llevas este ciclo. Después podrás anotar sus tareas y apuntes.',
          accion: `<button type="button" class="boton boton--primario" data-nueva>${iconos.mas}Agregar materia</button>`,
        })}</section>`;
    } catch (error) {
      estante.innerHTML = errorCarga(error);
    }
  }

  function abrirEditor(materia) {
    abrirFormulario({
      titulo: materia ? 'Editar materia' : 'Nueva materia',
      textoEnviar: materia ? 'Guardar cambios' : 'Crear materia',
      contenido: formularioMateria(materia),
      alEnviar: async (f) => {
        const datos = {
          nombre: f.nombre,
          docente: f.docente.trim() ? f.docente : null,
          descripcion: f.descripcion.trim() ? f.descripcion : null,
          color: f.color,
        };
        if (materia) await api.editarMateria(materia.id, datos);
        else await api.crearMateria(datos);
        invalidarMaterias();
        aviso(materia ? 'Cambios guardados' : 'Materia creada');
        cargar();
      },
    });
  }

  contenedor.addEventListener('click', async (e) => {
    if (e.target.closest('[data-nueva]')) return abrirEditor();
    if (e.target.closest('[data-reintentar]')) return cargar();

    const editar = e.target.closest('[data-editar]');
    if (editar) return abrirEditor(materias.find((m) => m.id === editar.dataset.editar));

    const borrar = e.target.closest('[data-borrar]');
    if (borrar) {
      const m = materias.find((x) => x.id === borrar.dataset.borrar);
      const ok = await confirmar({
        titulo: 'Eliminar materia',
        mensaje: `Se eliminará «${m.nombre}» junto con ${plural(m.totalTareas, 'tarea', 'tareas')} y todos sus apuntes. Esta acción no se puede deshacer.`,
      });
      if (!ok) return;
      try {
        await api.borrarMateria(m.id);
        invalidarMaterias();
        aviso('Materia eliminada');
        cargar();
      } catch (error) {
        aviso(error.message, 'error');
      }
    }
  });

  await cargar();
}
