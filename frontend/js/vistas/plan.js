/**
 * Plan de estudio (RF08, HU08): planes generados por IA, mostrados en tarjetas por día.
 * El estudiante elige el alcance (todas sus tareas, una materia, temas de sus apuntes
 * o un examen), marca su avance y puede pedir que se reorganice lo atrasado.
 */
import { api } from '../api.js';
import { obtenerMaterias } from '../datos.js';
import { iconos } from '../iconos.js';
import { markdownAHtml } from '../markdown.js';
import { aviso, confirmar, conCarga, esqueleto, errorCarga, vacio, mostrarError } from '../ui.js';
import { montarSelectorTemas, resumenContexto } from '../seleccion.js';
import {
  esc, colorSeguro, formato, desdeISO, hoyISO, minutosEntre, duracion, plural, diasHasta, TIPOS_ACTIVIDAD,
} from '../utilidades.js';

const ALCANCES = {
  general: 'Todas mis tareas',
  materia: 'Una materia',
  apuntes: 'Temas de mis apuntes',
  examen: 'Un examen',
  cuestionario: 'Repaso de cuestionario',
};

const OBJETIVOS = [
  { valor: 'general', titulo: 'Mis tareas', texto: 'Pendientes y entregas', icono: iconos.lista },
  { valor: 'materia', titulo: 'Una materia', texto: 'Semestre y temas específicos', icono: iconos.libro },
  { valor: 'apuntes', titulo: 'Mis apuntes', texto: 'Repasar temas elegidos', icono: iconos.apuntes },
  { valor: 'examen', titulo: 'Un examen', texto: 'Preparación con temas', icono: iconos.examen },
];
const PRIORIDADES = { baja: 'Baja', media: 'Media', alta: 'Alta' };
const DESCRIPCION_PRIORIDAD = {
  baja: 'Ritmo ligero, sin saturarte.',
  media: 'Equilibrio entre estudio, práctica y repaso.',
  alta: 'Ritmo intenso: más práctica y más temas por día.',
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
              ${p.prioridad && p.prioridad !== 'media' ? `<span aria-hidden="true">·</span><span>Prioridad ${esc(PRIORIDADES[p.prioridad].toLowerCase())}</span>` : ''}
            </p>
            ${p.temasPrioridad ? `<p class="plan-cabeza__prioriza">${iconos.objetivo}Prioriza: ${esc(p.temasPrioridad)}</p>` : ''}
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

/* ---------- Asistente para crear un plan (3 pasos + vista previa) ---------- */
function pasoObjetivo({ materias, apuntes, examenes }, inicial) {
  const grupos = new Map();
  for (const a of apuntes) {
    const clave = `${a.materia}${a.periodo ? ` · ${a.periodo}` : ''}`;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(a);
  }
  const elegidos = new Set(String(inicial.apunteIds || '').split(',').filter(Boolean));
  return `
    <h3 class="asistente__pregunta">¿Qué quieres estudiar?</h3>
    <div class="objetivos" role="radiogroup" aria-label="Objetivo del plan">
      ${OBJETIVOS.map((o) => `
        <label class="objetivo">
          <input type="radio" name="alcance" value="${o.valor}"${o.valor === inicial.alcance ? ' checked' : ''}>
          <span class="objetivo__caja">${o.icono}<b>${o.titulo}</b><small>${o.texto}</small><span class="objetivo__check">${iconos.ok}</span></span>
        </label>`).join('')}
    </div>

    <div data-si="general"><div data-contexto-general></div></div>
    <div data-si="materia">
      <label class="campo"><span>Materia</span>
        <select class="selector" name="materiaId">${materias.map((m) => `<option value="${esc(m.id)}"${m.id === inicial.materiaId ? ' selected' : ''}>${esc(m.nombre)}${m.periodo ? ` · ${esc(m.periodo)}` : ''}</option>`).join('')}</select></label>
    </div>
    <div data-si="examen">
      <label class="campo"><span>Examen</span>
        ${examenes.length
          ? `<select class="selector" name="examenId">${examenes.map((e) => `<option value="${esc(e.id)}" data-fecha="${esc(e.fecha)}"${e.id === inicial.examenId ? ' selected' : ''}>${esc(e.titulo)} · ${esc(e.materia)} · ${esc(formato.diaCorto(e.fecha))}</option>`).join('')}</select>`
          : '<p class="acceso__ayuda">No tienes exámenes próximos. <a href="#/examenes">Registra uno</a>.</p>'}
      </label>
    </div>
    <div data-si="apuntes">
      <div class="campo"><span>Temas (elige hasta 15 apuntes)</span>
        ${apuntes.length ? `<div class="lista-seleccion">${[...grupos].map(([grupo, lista]) => `
          <p class="lista-seleccion__grupo">${esc(grupo)}</p>
          ${lista.map((a) => `<label><input type="checkbox" name="apunteIdsLibres" value="${esc(a.id)}"${elegidos.has(a.id) ? ' checked' : ''}>${esc(a.titulo)}</label>`).join('')}`).join('')}
        </div>` : '<p class="acceso__ayuda">Aún no tienes apuntes. <a href="#/apuntes">Escribe uno</a>.</p>'}
      </div>
    </div>
    <div data-zona-temas></div>
    <div data-si-varios="materia examen">
      <label class="campo"><span>Temas que quieres priorizar <span class="opcional">(opcional)</span></span>
        <textarea class="area-texto" name="temasPrioridad" maxlength="500" style="min-height:3.5rem" placeholder="Ej. Procedimientos almacenados, triggers y transacciones"></textarea></label>
    </div>
    <fieldset class="campo prioridad" style="border:0;padding:0;margin:0">
      <legend>Nivel de prioridad</legend>
      <div class="radios-linea">
        ${Object.entries(PRIORIDADES).map(([k, v]) => `<label><input type="radio" name="prioridad" value="${k}"${k === 'media' ? ' checked' : ''}>${v}</label>`).join('')}
      </div>
      <small data-descripcion-prioridad>${DESCRIPCION_PRIORIDAD.media}</small>
    </fieldset>`;
}

function pasoDisponibilidad() {
  return `
    <h3 class="asistente__pregunta">¿Cuánto tiempo tienes?</h3>
    <div class="formulario__fila">
      <label class="campo"><span>Días a planificar</span>
        <select class="selector" name="dias">${[3, 5, 7, 10, 14, 21, 30].map((d) => `<option value="${d}"${d === 7 ? ' selected' : ''}>${d} días</option>`).join('')}</select></label>
      <label class="campo"><span>Horas de estudio al día</span>
        <select class="selector" name="horasPorDia">${[1, 2, 3, 4, 5, 6].map((h) => `<option value="${h}"${h === 2 ? ' selected' : ''}>${plural(h, 'hora', 'horas')}</option>`).join('')}</select></label>
    </div>
    <p class="acceso__ayuda" data-aviso-examen hidden></p>
    <div class="formulario__fila">
      <label class="campo"><span>Empiezo a estudiar a las</span>
        <input class="entrada" type="time" name="horaInicio" value="18:00" required></label>
      <div class="campo"><span>Fines de semana</span>
        <label class="casilla" style="min-height:44px"><input type="checkbox" name="finesDeSemana" checked>Incluir sábado y domingo</label></div>
    </div>
    <div class="consejo-disponibilidad">${iconos.reloj}<p>Se agregan descansos cortos entre bloques de 25 a 60 minutos. Puedes ajustar cada actividad en la vista previa.</p></div>`;
}

/** Vista previa editable: el estudiante puede cambiar horarios y títulos o quitar actividades. */
function vistaPreviaHtml(propuesta) {
  return `
    <label class="campo"><span>Título del plan</span>
      <input class="entrada" name="tituloPlan" maxlength="200" value="${esc(propuesta.titulo)}"></label>
    <p class="vista-previa__resumen">${esc(propuesta.resumen)}</p>
    <div class="dias dias--previa">${propuesta.dias.map((d, i) => {
      const minutos = d.actividades.filter((a) => a.tipo !== 'descanso').reduce((s, a) => s + minutosEntre(a.inicio, a.fin), 0);
      return `
      <article class="dia-plan">
        <div class="dia-plan__cabeza">
          <h3>${d.fecha === hoyISO() ? 'Hoy · ' : ''}${esc(formato.diaCorto(desdeISO(d.fecha)))}</h3>
          <small>${esc(duracion(minutos))}</small>
        </div>
        <ol>${d.actividades.map((a, j) => {
          const tipo = TIPOS_ACTIVIDAD[a.tipo] || TIPOS_ACTIVIDAD.estudio;
          return `
          <li class="actividad-editable${a.tipo === 'descanso' ? ' actividad-editable--descanso' : ''}" style="--c:${tipo.color}" data-dia="${i}" data-act="${j}">
            <div class="actividad-editable__horas">
              <input type="time" value="${esc(a.inicio)}" data-campo="inicio" aria-label="Inicio">
              <span>–</span>
              <input type="time" value="${esc(a.fin)}" data-campo="fin" aria-label="Fin">
            </div>
            <span class="etiqueta-tipo" style="--c:${tipo.color}">${esc(tipo.nombre)}</span>
            <input class="actividad-editable__titulo" value="${esc(a.titulo)}" data-campo="titulo" maxlength="200" aria-label="Título de la actividad">
            <button type="button" class="boton boton--icono peligro" data-quitar aria-label="Quitar actividad">${iconos.cerrar}</button>
            ${a.descripcion ? `<small class="actividad-editable__desc">${esc(a.descripcion)}</small>` : ''}
          </li>`;
        }).join('')}</ol>
      </article>`;
    }).join('')}</div>
    ${propuesta.consejos?.length ? `<section class="consejos"><h3>Consejos del asistente</h3><ul>${propuesta.consejos.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></section>` : ''}`;
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

    const PASOS = ['Objetivo', 'Disponibilidad', 'Confirmación'];
    const dialogo = document.createElement('dialog');
    dialogo.className = 'modal modal--asistente';
    dialogo.setAttribute('aria-labelledby', 'asistente-titulo');
    dialogo.innerHTML = `
      <form class="formulario" novalidate>
        <div class="modal__encabezado asistente__cabeza">
          <div>
            <h2 id="asistente-titulo">Nuevo plan de estudio</h2>
            <p>Configura un plan adaptado a tus objetivos.</p>
          </div>
          <button type="button" class="boton boton--icono" data-cerrar aria-label="Cerrar">${iconos.cerrar}</button>
        </div>
        <ol class="pasos" data-pasos>${PASOS.map((p, i) => `<li data-paso-indicador="${i}"><span></span>${i + 1}. ${p}</li>`).join('')}</ol>
        <div class="modal__cuerpo">
          <div class="formulario__error" role="alert" hidden></div>
          <section data-paso="0">${pasoObjetivo(datos, { alcance: 'general', ...inicial })}</section>
          <section data-paso="1" hidden>${pasoDisponibilidad()}</section>
          <section data-paso="2" hidden><div data-confirmacion></div></section>
          <section data-paso="3" hidden><div data-vista-previa></div></section>
        </div>
        <div class="modal__pie asistente__pie">
          <button type="button" class="boton boton--fantasma" data-anterior>${iconos.atras}Anterior</button>
          <span class="asistente__espacio"></span>
          <button type="button" class="boton boton--secundario" data-regenerar hidden>${iconos.reorganizar}Volver a generar</button>
          <button type="button" class="boton boton--primario" data-continuar>Continuar${iconos.adelante}</button>
        </div>
      </form>`;
    document.body.append(dialogo);

    const form = dialogo.querySelector('form');
    const cajaError = dialogo.querySelector('.formulario__error');
    const btnAnterior = dialogo.querySelector('[data-anterior]');
    const btnContinuar = dialogo.querySelector('[data-continuar]');
    const btnRegenerar = dialogo.querySelector('[data-regenerar]');
    let paso = 0;
    let selector = null;
    let peticion = 0;
    let propuesta = null;
    let opcionesEnviadas = null;
    let ocupado = false;

    const alcance = () => form.querySelector('[name="alcance"]:checked').value;
    const examenElegido = () => datos.examenes.find((e) => e.id === form.examenId?.value);

    async function cargarTemas() {
      const a = alcance();
      const zona = form.querySelector('[data-zona-temas]');
      selector = null;
      const filtro = a === 'materia' ? { materiaId: form.materiaId.value } : a === 'examen' && form.examenId ? { examenId: form.examenId.value } : null;
      if (!filtro) {
        zona.innerHTML = '';
        if (a === 'general') {
          const cont = form.querySelector('[data-contexto-general]');
          cont.innerHTML = esqueleto(2);
          try {
            const { contexto } = await api.contexto({ dias: 14 });
            cont.innerHTML = contexto.tareasPendientes.length
              ? resumenContexto(contexto)
              : '<p class="acceso__ayuda">No tienes tareas pendientes en las próximas dos semanas. Elige una materia, tus apuntes o un examen.</p>';
          } catch { cont.innerHTML = ''; }
        }
        return;
      }
      const mia = ++peticion;
      try {
        const sel = await montarSelectorTemas(zona, filtro, { seleccion: inicial.apunteIds ? String(inicial.apunteIds).split(',') : null });
        if (mia === peticion) selector = sel;
      } catch (error) {
        zona.innerHTML = `<p class="formulario__error">${esc(error.message)}</p>`;
      }
    }

    function alternar() {
      const a = alcance();
      form.querySelectorAll('[data-si]').forEach((el) => { el.hidden = el.dataset.si !== a; });
      form.querySelectorAll('[data-si-varios]').forEach((el) => { el.hidden = !el.dataset.siVarios.split(' ').includes(a); });
      cargarTemas();
    }

    function ajustarDiasExamen() {
      const aviso_ = form.querySelector('[data-aviso-examen]');
      const e = alcance() === 'examen' ? examenElegido() : null;
      aviso_.hidden = !e;
      if (!e) return;
      const faltan = Math.max(1, diasHasta(e.fecha));
      aviso_.textContent = `El examen es ${faltan === 1 ? 'mañana' : `en ${faltan} días`}: el plan terminará el día anterior.`;
      const opcion = [...form.dias.options].map((o) => Number(o.value)).filter((d) => d <= faltan).pop() || 3;
      form.dias.value = String(Math.min(opcion, 30));
    }

    /** Arma el cuerpo de la petición; lanza un error si falta algo. */
    function cuerpo() {
      const a = alcance();
      const c = {
        alcance: a,
        dias: Number(form.dias.value),
        horasPorDia: Number(form.horasPorDia.value),
        horaInicio: form.horaInicio.value || '18:00',
        finesDeSemana: form.finesDeSemana.checked,
        prioridad: form.querySelector('[name="prioridad"]:checked').value,
      };
      if (a === 'materia' || a === 'examen') {
        if (a === 'examen' && !form.examenId) throw new Error('Primero registra un examen.');
        if (!selector) throw new Error('Espera a que carguen los temas.');
        Object.assign(c, selector.cuerpo());
        if (a === 'materia') c.materiaId = form.materiaId.value;
        if (a === 'examen') c.examenId = form.examenId.value;
        if (form.temasPrioridad.value.trim()) c.temasPrioridad = form.temasPrioridad.value.trim();
      }
      if (a === 'apuntes') {
        c.apunteIds = [...form.querySelectorAll('[name="apunteIdsLibres"]:checked')].map((x) => x.value);
        if (!c.apunteIds.length) throw new Error('Elige al menos un apunte.');
        if (c.apunteIds.length > 15) throw new Error('Puedes elegir hasta 15 apuntes a la vez.');
      }
      return c;
    }

    function confirmacionHtml(c) {
      const a = c.alcance;
      const m = datos.materias.find((x) => x.id === c.materiaId);
      const e = datos.examenes.find((x) => x.id === c.examenId);
      const objetivo = a === 'general' ? 'Todas mis tareas pendientes'
        : a === 'materia' ? `Una materia: ${m?.nombre}`
          : a === 'examen' ? `Preparar ${e?.titulo} (${e?.materia})`
            : `${plural(c.apunteIds.length, 'apunte', 'apuntes')} elegidos`;
      const filas = [
        ['Objetivo', objetivo],
        ...(selector && (a === 'materia' || a === 'examen') ? [['Apuntes', plural(selector.apunteIds().length, 'apunte', 'apuntes')]] : []),
        ...(c.temas ? [['Temas del examen', c.temas.join(', ')]] : []),
        ...(c.temasPrioridad ? [['Priorizar', c.temasPrioridad]] : []),
        ['Prioridad', `${PRIORIDADES[c.prioridad]} · ${DESCRIPCION_PRIORIDAD[c.prioridad]}`],
        ['Disponibilidad', `${c.dias} días · ${plural(c.horasPorDia, 'hora', 'horas')} al día desde las ${c.horaInicio}${c.finesDeSemana ? ' · con fines de semana' : ' · sin fines de semana'}`],
      ];
      return `
        <h3 class="asistente__pregunta">Revisa tu plan antes de generarlo</h3>
        <dl class="confirmacion">${filas.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        ${selector ? resumenContexto(selector.contexto, { apuntesElegidos: selector.apunteIds().length, temasElegidos: c.temas }) : ''}
        <p class="acceso__ayuda">${iconos.chispa.replace('<svg', '<svg style="width:14px;height:14px;display:inline;vertical-align:-2px"')} Verás una vista previa para revisarla o editarla. Nada se guarda hasta que la aceptes.</p>`;
    }

    function irA(n) {
      paso = n;
      dialogo.querySelectorAll('[data-paso]').forEach((el) => { el.hidden = Number(el.dataset.paso) !== n; });
      dialogo.querySelectorAll('[data-paso-indicador]').forEach((el) => {
        const i = Number(el.dataset.pasoIndicador);
        el.classList.toggle('hecho', i < Math.min(n, 3));
        el.classList.toggle('actual', i === Math.min(n, 2));
      });
      btnAnterior.disabled = n === 0;
      btnRegenerar.hidden = n !== 3 || !propuesta;
      btnContinuar.innerHTML = n === 2 ? `${iconos.chispa}Generar vista previa` : n === 3 ? `${iconos.guardar}Aceptar y guardar` : `Continuar${iconos.adelante}`;
      btnContinuar.disabled = n === 3 && !propuesta;
      dialogo.querySelector('.modal__cuerpo').scrollTop = 0;
    }

    async function generarVistaPrevia() {
      const zona = dialogo.querySelector('[data-vista-previa]');
      propuesta = null;
      irA(3);
      zona.innerHTML = `<div class="generando">${iconos.lapiz.replace('<svg', '<svg class="generando__lapiz"')}
        <h3>Armando tu plan</h3><p>El asistente está revisando tus apuntes, tareas, exámenes y resultados. Puede tardar hasta un minuto.</p></div>`;
      try {
        ({ propuesta } = await api.vistaPreviaPlan(opcionesEnviadas));
        zona.innerHTML = vistaPreviaHtml(propuesta);
      } catch (error) {
        zona.innerHTML = `<div class="vacio" role="alert">${iconos.alerta}<h3>No se pudo generar el plan</h3><p>${esc(error.message)}</p></div>`;
      }
      irA(3);
      btnRegenerar.hidden = false;
    }

    /** Lee los cambios que hizo el estudiante en la vista previa. */
    function leerPropuesta() {
      const dias = propuesta.dias.map((d, i) => ({
        fecha: d.fecha,
        actividades: d.actividades.map((a, j) => {
          const fila = dialogo.querySelector(`[data-dia="${i}"][data-act="${j}"]`);
          if (!fila) return null;
          const valor = (campo) => fila.querySelector(`[data-campo="${campo}"]`).value;
          return { ...a, inicio: valor('inicio'), fin: valor('fin'), titulo: valor('titulo').trim() || a.titulo };
        }).filter(Boolean),
      })).filter((d) => d.actividades.length);
      const invalida = dias.flatMap((d) => d.actividades).find((a) => !a.inicio || !a.fin || a.fin <= a.inicio);
      if (invalida) throw new Error(`Revisa el horario de «${invalida.titulo}»: la hora de fin debe ser después del inicio.`);
      if (!dias.some((d) => d.actividades.some((a) => a.tipo !== 'descanso'))) throw new Error('El plan quedó sin actividades.');
      return { titulo: form.tituloPlan.value.trim() || propuesta.titulo, resumen: propuesta.resumen, consejos: propuesta.consejos, dias };
    }

    async function continuar() {
      cajaError.hidden = true;
      try {
        if (paso === 0) {
          cuerpo();
          ajustarDiasExamen();
          return irA(1);
        }
        if (paso === 1) {
          dialogo.querySelector('[data-confirmacion]').innerHTML = confirmacionHtml(cuerpo());
          return irA(2);
        }
        if (paso === 2) {
          opcionesEnviadas = cuerpo();
          return generarVistaPrevia();
        }
        if (paso === 3 && propuesta) {
          const { plan } = await conCarga(btnContinuar, () => api.generarPlan({ ...opcionesEnviadas, propuesta: leerPropuesta() }));
          dialogo.close();
          aviso('Plan de estudio guardado');
          await cargar(plan.id);
        }
      } catch (error) {
        mostrarError(cajaError, error);
        cajaError.scrollIntoView({ block: 'nearest' });
      }
    }

    // Eventos del asistente
    dialogo.addEventListener('close', () => dialogo.remove());
    dialogo.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', () => dialogo.close()));
    dialogo.addEventListener('cancel', async (e) => {
      if (!propuesta) return;
      e.preventDefault();
      if (await confirmar({ titulo: 'Cerrar sin guardar', mensaje: 'La vista previa del plan se perderá.', textoConfirmar: 'Cerrar' })) dialogo.close();
    });
    form.addEventListener('submit', (e) => e.preventDefault());
    btnContinuar.addEventListener('click', async () => {
      if (ocupado) return;
      ocupado = true;
      await continuar();
      ocupado = false;
    });
    btnAnterior.addEventListener('click', () => { cajaError.hidden = true; irA(Math.max(0, paso - 1)); });
    btnRegenerar.addEventListener('click', () => { if (opcionesEnviadas) generarVistaPrevia(); });
    form.addEventListener('change', (e) => {
      if (e.target.name === 'alcance') alternar();
      if (e.target.name === 'materiaId' || e.target.name === 'examenId') cargarTemas();
      if (e.target.name === 'prioridad') form.querySelector('[data-descripcion-prioridad]').textContent = DESCRIPCION_PRIORIDAD[e.target.value];
    });
    form.addEventListener('click', (e) => {
      const quitar = e.target.closest('[data-quitar]');
      if (quitar) {
        const fila = quitar.closest('li');
        const lista = fila.parentElement;
        fila.remove();
        if (!lista.children.length) lista.closest('.dia-plan').remove();
      }
    });

    dialogo.showModal();
    alternar();
    irA(0);
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
      alcance: OBJETIVOS.some((o) => o.valor === parametros.nuevo) ? parametros.nuevo : 'general',
      materiaId: parametros.materiaId,
      examenId: parametros.examenId,
      apunteIds: parametros.apunteIds,
    });
    history.replaceState(null, '', actual ? `#/plan?id=${actual.id}` : '#/plan');
  }
}
