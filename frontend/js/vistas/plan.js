/**
 * Plan de estudio (RF08, HU08): planes generados por IA, mostrados en tarjetas por día.
 * El estudiante elige el alcance (todas sus tareas, una materia, temas de sus apuntes
 * o un examen), marca su avance y puede pedir que se reorganice lo atrasado.
 */
import { api } from '../api.js';
import { obtenerMaterias } from '../datos.js';
import { iconos } from '../iconos.js';
import { markdownAHtml } from '../markdown.js';
import { aviso, abrirFormulario, confirmar, conCarga, esqueleto, errorCarga, vacio, mostrarError } from '../ui.js';
import {
  esc, colorSeguro, formato, desdeISO, hoyISO, minutosEntre, duracion, plural, TIPOS_ACTIVIDAD,
} from '../utilidades.js';

const ALCANCES = {
  general: 'Todas mis tareas',
  materia: 'Una materia',
  apuntes: 'Temas de mis apuntes',
  examen: 'Un examen',
};

const rangoTexto = (p) =>
  p.fechaInicio === p.fechaFin
    ? formato.diaCorto(desdeISO(p.fechaInicio))
    : `${formato.diaCorto(desdeISO(p.fechaInicio))} – ${formato.diaCorto(desdeISO(p.fechaFin))}`;

const porcentaje = (p) => (p.totalActividades ? Math.round((p.completadas / p.totalActividades) * 100) : 0);

function agrupar(actividades) {
  const mapa = new Map();
  for (const a of actividades) {
    if (!mapa.has(a.fecha)) mapa.set(a.fecha, []);
    mapa.get(a.fecha).push(a);
  }
  return [...mapa];
}

/* ---------- Tarjetas por día ---------- */
function actividadHtml(a, { soloLectura = false } = {}) {
  const tipo = TIPOS_ACTIVIDAD[a.tipo] || TIPOS_ACTIVIDAD.estudio;
  if (a.tipo === 'descanso') {
    return `<li class="actividad actividad--descanso"><span class="actividad__titulo">${esc(a.inicio)} – ${esc(a.fin)} · ${esc(a.titulo || 'Descanso')}</span></li>`;
  }
  const atrasada = !soloLectura && !a.completada && a.fecha < hoyISO();
  return `
    <li class="actividad${a.completada ? ' actividad--hecha' : ''}${atrasada ? ' actividad--atrasada' : ''}"
        style="--c:${a.materiaColor ? colorSeguro(a.materiaColor) : tipo.color}">
      ${soloLectura ? '<span></span>' : `<input type="checkbox" class="check" data-actividad="${esc(a.id)}" ${a.completada ? 'checked' : ''}
        aria-label="${a.completada ? 'Marcar como pendiente' : 'Marcar como hecha'}: ${esc(a.titulo)}">`}
      <span class="actividad__hora">
        ${esc(a.inicio)} – ${esc(a.fin)}
        <span class="etiqueta-tipo" style="--c:${tipo.color}">${esc(tipo.nombre)}</span>
        ${atrasada ? '<span style="color:var(--rojo)">Atrasada</span>' : ''}
      </span>
      <span class="actividad__titulo">${esc(a.titulo)}</span>
      ${a.descripcion ? `<span class="actividad__desc">${esc(a.descripcion)}</span>` : ''}
      ${a.materia || a.tarea ? `<span class="actividad__desc">
        ${a.materia ? `<span class="etiqueta-materia" style="--color:${colorSeguro(a.materiaColor)}"><span>${esc(a.materia)}</span></span>` : ''}
        ${a.tarea ? ` · Tarea: <a href="#/tareas?materiaId=${esc(a.materiaId)}">${esc(a.tarea)}</a>` : ''}</span>` : ''}
    </li>`;
}

function diasHtml(actividades, opciones = {}) {
  const hoy = hoyISO();
  return `<div class="dias">${agrupar(actividades).map(([fecha, acts]) => {
    const minutos = acts.filter((a) => a.tipo !== 'descanso').reduce((s, a) => s + minutosEntre(a.inicio, a.fin), 0);
    const hechas = acts.filter((a) => a.tipo !== 'descanso' && a.completada).length;
    const total = acts.filter((a) => a.tipo !== 'descanso').length;
    return `
      <article class="dia-plan${fecha === hoy ? ' dia-plan--hoy' : ''}">
        <div class="dia-plan__cabeza">
          <h3>${fecha === hoy ? 'Hoy · ' : ''}${esc(formato.diaCorto(desdeISO(fecha)))}</h3>
          <small>${esc(duracion(minutos))}${opciones.soloLectura ? '' : ` · ${hechas}/${total}`}</small>
        </div>
        <ol>${acts.map((a) => actividadHtml(a, opciones)).join('')}</ol>
      </article>`;
  }).join('')}</div>`;
}

function chipAlcance(p) {
  const extra = p.alcance === 'materia' && p.materia ? `: ${p.materia}`
    : p.alcance === 'examen' && p.examen ? `: ${p.examen}`
      : p.alcance === 'apuntes' ? ` (${plural(p.apuntesIncluidos.length, 'apunte', 'apuntes')})` : '';
  return `${ALCANCES[p.alcance] || 'Plan'}${extra}`;
}

function planHtml(p) {
  const pct = porcentaje(p);
  const legado = !p.actividades.length;
  return `
    <section class="hoja">
      <div class="hoja__cuerpo plan-cabeza">
        <div class="plan-cabeza__fila">
          <div style="min-width:0">
            <h2>${esc(p.titulo || 'Plan de estudio')}</h2>
            <p class="plan-cabeza__chips">
              <span>${esc(chipAlcance(p))}</span><span aria-hidden="true">·</span>
              <span>${esc(rangoTexto(p))}</span>
              ${p.horasPorDia ? `<span aria-hidden="true">·</span><span>${plural(p.horasPorDia, 'hora', 'horas')} al día</span>` : ''}
            </p>
          </div>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap">
            ${legado ? '' : `<button type="button" class="boton boton--secundario" data-reorganizar>${iconos.reorganizar}Reorganizar</button>`}
            <button type="button" class="boton boton--icono peligro" data-borrar-plan="${esc(p.id)}" aria-label="Eliminar plan">${iconos.borrar}</button>
          </div>
        </div>
        ${legado ? '' : `
          <div class="plan-cabeza__avance">
            <span>Avance del plan</span><span><b>${p.completadas}</b> de ${p.totalActividades} actividades · ${pct}%</span>
            <div class="avance" role="progressbar" aria-label="Avance del plan" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="--valor:${pct}%"></span></div>
          </div>`}
        ${p.atrasadas ? `
          <div class="aviso-reorganizar">
            <span><strong>${plural(p.atrasadas, 'actividad atrasada', 'actividades atrasadas')}.</strong> El asistente puede repartirlas en los próximos días.</span>
            <button type="button" class="boton boton--ia" data-reorganizar>${iconos.reorganizar}Reorganizar mi semana</button>
          </div>` : ''}
        ${legado ? `<div class="texto-ia">${markdownAHtml(p.resumen)}</div>` : `<p style="color:var(--grafito-suave)">${esc(p.resumen)}</p>`}
        ${p.reorganizadoEn ? `<p class="firma-ia">${iconos.reorganizar}Reorganizado el ${esc(formato.fechaHora(p.reorganizadoEn))}</p>` : ''}
      </div>
    </section>
    ${legado ? '' : diasHtml(p.actividades)}
    ${p.consejos?.length ? `<section class="consejos"><h3>Consejos del asistente</h3><ul>${p.consejos.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></section>` : ''}
    <p class="firma-ia">${iconos.chispa}Generado por IA el ${esc(formato.fechaHora(p.creadoEn))}${p.modeloIa ? ` · ${esc(p.modeloIa)}` : ''}</p>`;
}

/* ---------- Formulario para crear un plan ---------- */
function formularioPlan({ materias, apuntes, examenes }, inicial) {
  const porMateria = new Map();
  for (const a of apuntes) {
    if (!porMateria.has(a.materia)) porMateria.set(a.materia, []);
    porMateria.get(a.materia).push(a);
  }
  const seleccionados = new Set(String(inicial.apunteIds || '').split(',').filter(Boolean));
  return `
    <fieldset class="campo" style="border:0;padding:0;margin:0">
      <legend>¿Sobre qué quieres estudiar?</legend>
      <div class="segmentos segmentos--bloque" style="margin-top:6px">
        ${Object.entries(ALCANCES).map(([k, v]) => `<label><input type="radio" name="alcance" value="${k}"${k === inicial.alcance ? ' checked' : ''}><span>${v}</span></label>`).join('')}
      </div>
    </fieldset>

    <div data-si="materia">
      <label class="campo"><span>Materia</span>
        <select class="selector" name="materiaId">${materias.map((m) => `<option value="${esc(m.id)}"${m.id === inicial.materiaId ? ' selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select></label>
    </div>
    <div data-si="apuntes">
      <div class="campo"><span>Temas (elige hasta 10 apuntes)</span>
        ${apuntes.length ? `<div class="lista-seleccion">${[...porMateria].map(([materia, lista]) => `
          <p class="lista-seleccion__grupo">${esc(materia)}</p>
          ${lista.map((a) => `<label><input type="checkbox" name="apunteIds" value="${esc(a.id)}"${seleccionados.has(a.id) ? ' checked' : ''}>${esc(a.titulo)}</label>`).join('')}`).join('')}
        </div>` : '<p class="acceso__ayuda">Aún no tienes apuntes. <a href="#/apuntes">Escribe uno</a>.</p>'}
      </div>
    </div>
    <div data-si="examen">
      <label class="campo"><span>Examen</span>
        ${examenes.length
          ? `<select class="selector" name="examenId">${examenes.map((e) => `<option value="${esc(e.id)}"${e.id === inicial.examenId ? ' selected' : ''}>${esc(e.titulo)} · ${esc(e.materia)} · ${esc(formato.diaCorto(e.fecha))}</option>`).join('')}</select>`
          : '<p class="acceso__ayuda">No tienes exámenes próximos. <a href="#/examenes">Registra uno</a>.</p>'}
      </label>
      <p class="acceso__ayuda">El plan termina el día antes del examen y da más tiempo a los temas que fallaste en tus cuestionarios.</p>
    </div>

    <div class="formulario__fila">
      <label class="campo"><span>Días a planificar</span>
        <select class="selector" name="dias">${[3, 5, 7, 14, 21, 30].map((d) => `<option value="${d}"${d === 7 ? ' selected' : ''}>${d} días</option>`).join('')}</select></label>
      <label class="campo"><span>Horas de estudio al día</span>
        <select class="selector" name="horasPorDia">${[1, 2, 3, 4, 5, 6].map((h) => `<option value="${h}"${h === 2 ? ' selected' : ''}>${plural(h, 'hora', 'horas')}</option>`).join('')}</select></label>
      <label class="campo"><span>Empiezo a estudiar a las</span>
        <input class="entrada" type="time" name="horaInicio" value="18:00" required></label>
    </div>
    <label class="casilla"><input type="checkbox" name="finesDeSemana" checked>Incluir sábado y domingo</label>
    <p class="acceso__ayuda">${iconos.chispa.replace('<svg', '<svg style="width:14px;height:14px;display:inline;vertical-align:-2px"')} El asistente puede tardar hasta un minuto en organizar tu plan.</p>`;
}

function alternarCampos(form) {
  const alcance = form.querySelector('[name="alcance"]:checked').value;
  form.querySelectorAll('[data-si]').forEach((el) => { el.hidden = el.dataset.si !== alcance; });
}

/* ---------- Vista ---------- */
export async function renderPlan(contenedor, parametros) {
  let planes = [];
  let actual = null;

  contenedor.innerHTML = `
    <div class="encabezado-vista">
      <div>
        <h1>Plan de estudio</h1>
        <p>El asistente organiza tus días según tus entregas, tus temas y tus exámenes.</p>
      </div>
      <button type="button" class="boton boton--ia" data-nuevo>${iconos.chispa}Nuevo plan</button>
    </div>
    <div class="plan">
      <div data-plan style="display:grid;gap:var(--e-5);min-width:0">${esqueleto(8)}</div>
      <aside class="hoja" aria-labelledby="planes-titulo">
        <div class="hoja__encabezado"><h2 id="planes-titulo" style="font-size:var(--t-md)">Tus planes</h2></div>
        <ul class="historial historial-plan" data-historial></ul>
      </aside>
    </div>`;

  const zona = contenedor.querySelector('[data-plan]');
  const historial = contenedor.querySelector('[data-historial]');

  function pintarHistorial() {
    historial.innerHTML = planes.length
      ? planes.map((p) => `
        <li>
          <button type="button" class="historial__item" data-ver="${esc(p.id)}" ${actual?.id === p.id ? 'aria-current="true"' : ''}>
            <strong>${esc(p.titulo || 'Plan de estudio')}</strong>
            <small>${esc(rangoTexto(p))}${p.atrasadas ? ` · <span style="color:var(--rojo)">${p.atrasadas} atrasadas</span>` : ''}</small>
            ${p.totalActividades ? `<span class="avance" aria-hidden="true"><span style="--valor:${porcentaje(p)}%"></span></span>` : ''}
          </button>
        </li>`).join('')
      : '<li style="padding:var(--e-3);color:var(--grafito-tenue)">Todavía no has creado planes.</li>';
  }

  function pintarPlan() {
    zona.innerHTML = actual
      ? planHtml(actual)
      : `<section class="hoja">${vacio({
        icono: iconos.calendario,
        titulo: 'Crea tu primer plan de estudio',
        texto: 'Elige si quieres organizar todas tus tareas, una materia, algunos temas de tus apuntes o la preparación de un examen.',
        accion: `<button type="button" class="boton boton--ia" data-nuevo>${iconos.chispa}Nuevo plan</button>`,
      })}</section>`;
  }

  async function abrirPlan(id) {
    zona.innerHTML = esqueleto(8);
    try {
      ({ plan: actual } = await api.plan(id));
      history.replaceState(null, '', `#/plan?id=${actual.id}`);
    } catch (error) {
      actual = null;
      if (error.estado !== 404) {
        zona.innerHTML = errorCarga(error);
        return;
      }
    }
    pintarHistorial();
    pintarPlan();
  }

  async function cargar(idPreferido) {
    try {
      ({ planes } = await api.planes());
    } catch (error) {
      zona.innerHTML = errorCarga(error);
      return;
    }
    const id = idPreferido || planes[0]?.id;
    if (id) await abrirPlan(id);
    else {
      actual = null;
      pintarHistorial();
      pintarPlan();
    }
  }

  async function abrirGenerador(inicial = {}) {
    let datos;
    try {
      const [materias, { apuntes }, { examenes }] = await Promise.all([
        obtenerMaterias(), api.apuntes(), api.examenes({ periodo: 'proximos' }),
      ]);
      datos = { materias, apuntes, examenes };
    } catch (error) {
      aviso(error.message, 'error');
      return;
    }
    abrirFormulario({
      titulo: 'Nuevo plan de estudio',
      textoEnviar: 'Generar plan',
      contenido: formularioPlan(datos, { alcance: 'general', ...inicial }),
      alAbrir: (form) => {
        alternarCampos(form);
        form.addEventListener('change', (e) => { if (e.target.name === 'alcance') alternarCampos(form); });
      },
      alEnviar: async (f, form) => {
        const cuerpo = {
          alcance: f.alcance,
          dias: Number(f.dias),
          horasPorDia: Number(f.horasPorDia),
          horaInicio: f.horaInicio,
          finesDeSemana: form.querySelector('[name="finesDeSemana"]').checked,
        };
        if (f.alcance === 'materia') cuerpo.materiaId = f.materiaId;
        if (f.alcance === 'examen') cuerpo.examenId = f.examenId;
        if (f.alcance === 'apuntes') cuerpo.apunteIds = new FormData(form).getAll('apunteIds');
        const { plan } = await api.generarPlan(cuerpo);
        aviso('Plan de estudio listo');
        await cargar(plan.id);
      },
    });
  }

  /* Reorganizar: propuesta de la IA -> revisión -> aplicar */
  function abrirReorganizacion() {
    const dialogo = document.createElement('dialog');
    dialogo.className = 'modal';
    dialogo.style.width = 'min(860px, calc(100vw - 2rem))';
    dialogo.setAttribute('aria-labelledby', 'reorg-titulo');
    dialogo.innerHTML = `
      <div class="modal__encabezado">
        <h2 id="reorg-titulo">Reorganizar mi semana</h2>
        <button type="button" class="boton boton--icono" data-cerrar aria-label="Cerrar">${iconos.cerrar}</button>
      </div>
      <div class="modal__cuerpo" data-cuerpo>
        <div class="generando">${iconos.lapiz.replace('<svg', '<svg class="generando__lapiz"')}
          <h3>Buscando un mejor acomodo</h3><p>El asistente está repartiendo tus actividades pendientes desde hoy.</p></div>
      </div>
      <div class="modal__pie" data-pie hidden>
        <button type="button" class="boton boton--fantasma" data-cerrar>Descartar</button>
        <button type="button" class="boton boton--primario" data-aplicar>Aplicar cambios</button>
      </div>`;
    document.body.append(dialogo);
    dialogo.addEventListener('close', () => dialogo.remove());
    dialogo.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', () => dialogo.close()));
    dialogo.showModal();

    const cuerpo = dialogo.querySelector('[data-cuerpo]');
    let propuesta = null;

    api.proponerReorganizacion(actual.id).then(({ propuesta: p }) => {
      propuesta = p;
      const actividades = p.dias.flatMap((d) => d.actividades.map((a) => ({ ...a, fecha: d.fecha })));
      cuerpo.innerHTML = `
        <div class="formulario__error" role="alert" hidden></div>
        <p style="margin-bottom:var(--e-4)">${esc(p.resumen)}</p>
        <p class="acceso__ayuda" style="margin-bottom:var(--e-4)">Revisa la propuesta. Tus actividades completadas no cambian. Nada se guarda hasta que presiones "Aplicar cambios".</p>
        ${diasHtml(actividades, { soloLectura: true })}`;
      dialogo.querySelector('[data-pie]').hidden = false;
    }).catch((error) => {
      cuerpo.innerHTML = `<div class="vacio" role="alert">${iconos.alerta}<h3>No se pudo reorganizar</h3><p>${esc(error.message)}</p></div>`;
    });

    dialogo.querySelector('[data-aplicar]').addEventListener('click', async (e) => {
      try {
        await conCarga(e.currentTarget, async () => {
          const { plan } = await api.aplicarReorganizacion(actual.id, propuesta.dias);
          actual = plan;
        });
        dialogo.close();
        aviso('Plan reorganizado');
        await cargar(actual.id);
      } catch (error) {
        mostrarError(cuerpo.querySelector('.formulario__error'), error);
      }
    });
  }

  contenedor.addEventListener('click', async (e) => {
    if (e.target.closest('[data-nuevo]')) return abrirGenerador();
    if (e.target.closest('[data-reorganizar]')) return abrirReorganizacion();
    if (e.target.closest('[data-reintentar]')) return cargar();
    const ver = e.target.closest('[data-ver]');
    if (ver) return abrirPlan(ver.dataset.ver);

    const borrar = e.target.closest('[data-borrar-plan]');
    if (borrar) {
      if (!(await confirmar({ titulo: 'Eliminar plan', mensaje: 'Se eliminará este plan y todas sus actividades.' }))) return;
      try {
        await api.borrarPlan(borrar.dataset.borrarPlan);
        aviso('Plan eliminado');
        actual = null;
        history.replaceState(null, '', '#/plan');
        await cargar();
      } catch (error) {
        aviso(error.message, 'error');
      }
    }
  });

  // Marcar actividades como hechas
  zona.addEventListener('change', async (e) => {
    const id = e.target.dataset?.actividad;
    if (!id) return;
    const hecha = e.target.checked;
    e.target.disabled = true;
    try {
      const { actividad } = await api.marcarActividad(actual.id, id, hecha);
      const i = actual.actividades.findIndex((a) => a.id === id);
      actual.actividades[i] = { ...actual.actividades[i], ...actividad };
      const estudio = actual.actividades.filter((a) => a.tipo !== 'descanso');
      actual.completadas = estudio.filter((a) => a.completada).length;
      actual.atrasadas = estudio.filter((a) => !a.completada && a.fecha < hoyISO()).length;
      const resumen = planes.find((p) => p.id === actual.id);
      if (resumen) Object.assign(resumen, { completadas: actual.completadas, atrasadas: actual.atrasadas });
      pintarPlan();
      pintarHistorial();
      if (hecha && actual.completadas === actual.totalActividades) aviso('¡Terminaste todo el plan!');
    } catch (error) {
      e.target.checked = !hecha;
      e.target.disabled = false;
      aviso(error.message, 'error');
    }
  });

  await cargar(parametros.id);
  if (parametros.nuevo) {
    abrirGenerador({
      alcance: ALCANCES[parametros.nuevo] ? parametros.nuevo : 'general',
      materiaId: parametros.materiaId,
      examenId: parametros.examenId,
      apunteIds: parametros.apunteIds,
    });
    history.replaceState(null, '', actual ? `#/plan?id=${actual.id}` : '#/plan');
  }
}
