/** Exámenes: fechas, temas y accesos a su plan de preparación y cuestionarios de práctica. */
import { api } from '../api.js';
import { obtenerMaterias } from '../datos.js';
import { iconos } from '../iconos.js';
import { aviso, abrirFormulario, confirmar, conCarga, esqueleto, errorCarga, vacio } from '../ui.js';
import {
  esc, colorSeguro, formato, cuentaRegresiva, diasHasta, aEntradaFechaHora, desdeEntradaFechaHora, plural,
} from '../utilidades.js';

const temasDe = (e) => String(e.temas || '').split(/\n|;/).map((t) => t.trim()).filter(Boolean);

function tarjetaExamen(e) {
  const pasado = new Date(e.fecha) < new Date();
  const dias = diasHasta(e.fecha);
  const temas = temasDe(e);
  return `
    <article class="examen${pasado ? ' examen--pasado' : ''}" style="--color:${colorSeguro(e.materiaColor)}">
      <div class="examen__fecha" aria-hidden="true">
        <span>${esc(formato.mesCorto(e.fecha))}</span>
        <b>${new Date(e.fecha).getDate()}</b>
        <span>${esc(formato.hora(e.fecha))}</span>
      </div>
      <div class="examen__cuerpo">
        <div class="examen__cabeza">
          <div style="min-width:0">
            <h3>${esc(e.titulo)}</h3>
            <span class="etiqueta-materia" style="--color:${colorSeguro(e.materiaColor)}"><span>${esc(e.materia)}</span></span>
          </div>
          <div style="display:flex">
            <button type="button" class="boton boton--icono" data-editar="${esc(e.id)}" aria-label="Editar ${esc(e.titulo)}">${iconos.editar}</button>
            <button type="button" class="boton boton--icono peligro" data-borrar="${esc(e.id)}" aria-label="Eliminar ${esc(e.titulo)}">${iconos.borrar}</button>
          </div>
        </div>
        <p class="examen__cuenta${!pasado && dias <= 3 ? ' examen__cuenta--cerca' : ''}">
          ${esc(formato.diaLargoTitulo(e.fecha))} · ${pasado ? 'ya pasó' : esc(cuentaRegresiva(e.fecha))}
        </p>
        ${temas.length ? `<ul class="examen__temas" aria-label="Temas">${temas.slice(0, 8).map((t) => `<li>${esc(t)}</li>`).join('')}${temas.length > 8 ? `<li>+${temas.length - 8}</li>` : ''}</ul>` : ''}
        ${e.notas ? `<p style="font-size:var(--t-sm);color:var(--grafito-suave)">${esc(e.notas)}</p>` : ''}
        <p style="font-size:var(--t-sm);color:var(--grafito-suave)">
          ${e.cuestionarios ? `${plural(e.cuestionarios, 'cuestionario de práctica', 'cuestionarios de práctica')} · mejor puntaje <b>${Math.round(e.mejorPuntaje ?? 0)}%</b>` : 'Aún no has practicado para este examen.'}
        </p>
        ${pasado ? '' : `
          <div class="examen__acciones">
            ${e.planId
              ? `<a class="boton boton--secundario" href="#/plan?id=${esc(e.planId)}">${iconos.plan}Ver plan de preparación</a>`
              : `<button type="button" class="boton boton--ia" data-plan="${esc(e.id)}">${iconos.chispa}Crear plan de preparación</button>`}
            <a class="boton boton--secundario" href="#/cuestionarios?nuevo=examen&examenId=${esc(e.id)}">${iconos.cuestionario}Practicar con un cuestionario</a>
          </div>`}
      </div>
    </article>`;
}

function formularioExamen(materias, e = {}) {
  return `
    <label class="campo"><span>Nombre del examen</span>
      <input class="entrada" name="titulo" required maxlength="200" value="${esc(e.titulo)}" placeholder="Ej. Segundo parcial"></label>
    <div class="formulario__fila">
      <label class="campo"><span>Materia</span>
        <select class="selector" name="materiaId" required>
          ${materias.map((m) => `<option value="${esc(m.id)}"${m.id === e.materiaId ? ' selected' : ''}>${esc(m.nombre)}</option>`).join('')}
        </select></label>
      <label class="campo"><span>Fecha y hora</span>
        <input class="entrada" type="datetime-local" name="fecha" required value="${e.fecha ? aEntradaFechaHora(e.fecha) : ''}"></label>
    </div>
    <label class="campo"><span>Temas que entran <span class="opcional">(uno por línea)</span></span>
      <textarea class="area-texto" name="temas" rows="4" maxlength="5000" style="min-height:7rem" placeholder="Normalización&#10;Índices&#10;Transacciones">${esc(e.temas)}</textarea></label>
    <label class="campo"><span>Notas <span class="opcional">(opcional)</span></span>
      <input class="entrada" name="notas" maxlength="5000" value="${esc(e.notas)}" placeholder="Ej. Se permite calculadora"></label>`;
}

export async function renderExamenes(contenedor) {
  let examenes = [];
  let materias = [];

  contenedor.innerHTML = esqueleto(6);
  try {
    materias = await obtenerMaterias({ forzar: true });
  } catch (error) {
    contenedor.innerHTML = errorCarga(error, false);
    return;
  }

  contenedor.innerHTML = `
    <div class="encabezado-vista">
      <div>
        <h1>Exámenes</h1>
        <p>Registra tus parciales y prepáralos con un plan y cuestionarios de práctica.</p>
      </div>
      ${materias.length ? `<button type="button" class="boton boton--primario" data-nuevo>${iconos.mas}Nuevo examen</button>` : ''}
    </div>
    <div data-lista>${esqueleto(5)}</div>`;

  const zona = contenedor.querySelector('[data-lista]');

  async function cargar() {
    if (!materias.length) {
      zona.innerHTML = `<section class="hoja">${vacio({
        icono: iconos.materias, titulo: 'Primero registra una materia',
        texto: 'Cada examen pertenece a una materia.',
        accion: '<a class="boton boton--primario" href="#/materias">Agregar materia</a>',
      })}</section>`;
      return;
    }
    try {
      ({ examenes } = await api.examenes());
      const proximos = examenes.filter((e) => new Date(e.fecha) >= new Date());
      const pasados = examenes.filter((e) => new Date(e.fecha) < new Date());
      zona.innerHTML = examenes.length
        ? `${proximos.length
            ? `<div class="lista-examenes">${proximos.map(tarjetaExamen).join('')}</div>`
            : '<section class="hoja"><p class="hoja__cuerpo">No tienes exámenes próximos.</p></section>'}
           ${pasados.length ? `
            <details style="margin-top:var(--e-6)">
              <summary style="cursor:pointer;font-weight:700;color:var(--grafito-suave)">Exámenes anteriores (${pasados.length})</summary>
              <div class="lista-examenes" style="margin-top:var(--e-4)">${pasados.map(tarjetaExamen).join('')}</div>
            </details>` : ''}`
        : `<section class="hoja">${vacio({
          icono: iconos.examen, titulo: 'No tienes exámenes registrados',
          texto: 'Anota la fecha y los temas de tu próximo parcial. El asistente te ayudará a prepararlo.',
          accion: `<button type="button" class="boton boton--primario" data-nuevo>${iconos.mas}Nuevo examen</button>`,
        })}</section>`;
    } catch (error) {
      zona.innerHTML = errorCarga(error);
    }
  }

  function abrirEditor(examen) {
    abrirFormulario({
      titulo: examen ? 'Editar examen' : 'Nuevo examen',
      textoEnviar: examen ? 'Guardar cambios' : 'Guardar examen',
      contenido: formularioExamen(materias, examen),
      alEnviar: async (f) => {
        const datos = {
          titulo: f.titulo,
          materiaId: f.materiaId,
          fecha: desdeEntradaFechaHora(f.fecha),
          temas: f.temas.trim() ? f.temas : null,
          notas: f.notas.trim() ? f.notas : null,
        };
        if (examen) await api.editarExamen(examen.id, datos);
        else await api.crearExamen(datos);
        aviso(examen ? 'Cambios guardados' : 'Examen guardado');
        cargar();
      },
    });
  }

  contenedor.addEventListener('click', async (e) => {
    if (e.target.closest('[data-nuevo]')) return abrirEditor();
    if (e.target.closest('[data-reintentar]')) return cargar();

    const editar = e.target.closest('[data-editar]');
    if (editar) return abrirEditor(examenes.find((x) => x.id === editar.dataset.editar));

    const plan = e.target.closest('[data-plan]');
    if (plan) {
      try {
        await conCarga(plan, async () => {
          const { plan: creado } = await api.generarPlan({ alcance: 'examen', examenId: plan.dataset.plan, dias: 30, horasPorDia: 2 });
          aviso('Plan de preparación listo');
          location.hash = `#/plan?id=${creado.id}`;
        });
      } catch (error) {
        aviso(error.message, 'error');
      }
      return;
    }

    const borrar = e.target.closest('[data-borrar]');
    if (borrar) {
      const ex = examenes.find((x) => x.id === borrar.dataset.borrar);
      const ok = await confirmar({ titulo: 'Eliminar examen', mensaje: `Se eliminará «${ex.titulo}» y su plan de preparación. Esta acción no se puede deshacer.` });
      if (!ok) return;
      try {
        await api.borrarExamen(ex.id);
        aviso('Examen eliminado');
        cargar();
      } catch (error) {
        aviso(error.message, 'error');
      }
    }
  });

  await cargar();
}
