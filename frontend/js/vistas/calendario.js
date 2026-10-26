/** Calendario académico: tareas, exámenes y sesiones de estudio en vista mensual, semanal o diaria. */
import { api } from '../api.js';
import { iconos } from '../iconos.js';
import { esqueleto, errorCarga } from '../ui.js';
import { esc, colorSeguro, formato, aISO, desdeISO, hoyISO, sumarDias, inicioDelDia } from '../utilidades.js';

const VISTAS = { mes: 'Mes', semana: 'Semana', dia: 'Día' };
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MAX_EN_CELDA = 3;

/** Lunes de la semana de la fecha. */
function inicioSemana(fecha) {
  const d = inicioDelDia(fecha);
  return sumarDias(d, -((d.getDay() + 6) % 7));
}

function rango(vista, fecha) {
  if (vista === 'dia') return [inicioDelDia(fecha), inicioDelDia(fecha)];
  if (vista === 'semana') {
    const lunes = inicioSemana(fecha);
    return [lunes, sumarDias(lunes, 6)];
  }
  const primero = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
  const ultimo = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
  return [inicioSemana(primero), sumarDias(inicioSemana(ultimo), 6)];
}

function colorEvento(ev) {
  if (ev.tipo === 'examen') return 'var(--c-examen)';
  if (ev.color) return colorSeguro(ev.color);
  return 'var(--c-estudio)';
}

function enlaceEvento(ev) {
  if (ev.tipo === 'examen') return '#/examenes';
  if (ev.tipo === 'sesion') return `#/plan?id=${ev.planId}`;
  return `#/tareas?materiaId=${ev.materiaId}`;
}

function chip(ev, { conHora = true } = {}) {
  const hora = ev.tipo === 'tarea' ? `Entrega ${formato.hora(ev.inicio)}` : formato.hora(ev.inicio);
  const titulo = ev.tipo === 'examen' ? `Examen: ${ev.titulo}` : ev.titulo;
  const descripcion = `${titulo} · ${ev.materia || 'Sesión de estudio'} · ${hora}`;
  return `
    <a class="evento evento--${esc(ev.tipo)}${ev.completado && ev.tipo !== 'examen' ? ' evento--hecho' : ''}"
       href="${esc(enlaceEvento(ev))}" style="--c:${colorEvento(ev)}" title="${esc(descripcion)}">
      ${conHora ? `<b>${esc(formato.hora(ev.inicio))}</b>` : ''}<span>${esc(titulo)}</span>
    </a>`;
}

function agruparPorDia(eventos) {
  const mapa = new Map();
  for (const ev of eventos) {
    const clave = aISO(new Date(ev.inicio));
    if (!mapa.has(clave)) mapa.set(clave, []);
    mapa.get(clave).push(ev);
  }
  return mapa;
}

function vistaMes(fecha, desde, porDia) {
  const hoy = hoyISO();
  const celdas = [];
  for (let i = 0; i < 42; i++) {
    const dia = sumarDias(desde, i);
    if (i >= 35 && dia.getMonth() !== fecha.getMonth()) break;
    const clave = aISO(dia);
    const eventos = porDia.get(clave) || [];
    const fuera = dia.getMonth() !== fecha.getMonth();
    celdas.push(`
      <div class="celda${fuera ? ' celda--fuera' : ''}${clave === hoy ? ' celda--hoy' : ''}" data-dia="${clave}">
        <button type="button" class="celda__numero boton--fantasma" data-ir-dia="${clave}"
          aria-label="${esc(formato.diaLargoTitulo(dia))}: ${eventos.length} eventos" style="border:0;cursor:pointer;font:inherit">${dia.getDate()}</button>
        ${eventos.slice(0, MAX_EN_CELDA).map((ev) => chip(ev, { conHora: false })).join('')}
        ${eventos.length > MAX_EN_CELDA ? `<span class="celda__mas">+${eventos.length - MAX_EN_CELDA} más</span>` : ''}
      </div>`);
  }
  return `
    <div class="mes" role="grid">
      ${DIAS_SEMANA.map((d) => `<div class="mes__dia-semana" role="columnheader">${d}</div>`).join('')}
      ${celdas.join('')}
    </div>`;
}

function vistaSemana(desde, porDia) {
  const hoy = hoyISO();
  return `<div class="semana-cal">${Array.from({ length: 7 }, (_, i) => {
    const dia = sumarDias(desde, i);
    const clave = aISO(dia);
    const eventos = porDia.get(clave) || [];
    return `
      <div class="semana-cal__dia${clave === hoy ? ' semana-cal__dia--hoy' : ''}">
        <button type="button" data-ir-dia="${clave}"><span>${DIAS_SEMANA[i]}</span><b>${dia.getDate()}</b></button>
        ${eventos.map((ev) => chip(ev)).join('') || '<span style="font-size:var(--t-xs);color:var(--grafito-tenue);padding:4px">Libre</span>'}
      </div>`;
  }).join('')}</div>`;
}

function vistaDia(fecha, porDia) {
  const eventos = porDia.get(aISO(fecha)) || [];
  if (!eventos.length) {
    return `<div class="vacio">${iconos.calendario}
      <h3>Día libre</h3><p>No hay entregas, exámenes ni sesiones de estudio.</p>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center">
        <a class="boton boton--secundario" href="#/tareas">Agregar tarea</a>
        <a class="boton boton--secundario" href="#/examenes">Agregar examen</a>
      </div></div>`;
  }
  return `<ol class="agenda-dia">${eventos.map((ev) => `
    <li>
      <time datetime="${esc(ev.inicio)}">${esc(formato.hora(ev.inicio))}${ev.fin ? `<br><small style="font-weight:400">a ${esc(formato.hora(ev.fin))}</small>` : ''}</time>
      <div style="display:grid;gap:4px">
        ${chip(ev, { conHora: false })}
        <small style="color:var(--grafito-suave)">${esc(
          ev.tipo === 'tarea' ? `Entrega de tarea · ${ev.materia}${ev.completado ? ' · completada' : ''}`
            : ev.tipo === 'examen' ? `Examen · ${ev.materia}`
              : `Sesión de estudio${ev.materia ? ` · ${ev.materia}` : ''}${ev.completado ? ' · hecha' : ''}`)}</small>
      </div>
    </li>`).join('')}</ol>`;
}

function tituloRango(vista, fecha, desde) {
  if (vista === 'mes') return formato.mesAnio(fecha);
  if (vista === 'dia') return formato.diaLargoTitulo(fecha);
  const fin = sumarDias(desde, 6);
  return `${desde.getDate()} ${formato.mesCorto(desde)} – ${fin.getDate()} ${formato.mesCorto(fin)} ${fin.getFullYear()}`;
}

export async function renderCalendario(contenedor, parametros) {
  let vista = VISTAS[parametros.vista] ? parametros.vista : (window.matchMedia('(max-width: 760px)').matches ? 'semana' : 'mes');
  let fecha = parametros.fecha ? desdeISO(parametros.fecha) : inicioDelDia();
  if (Number.isNaN(fecha.getTime())) fecha = inicioDelDia();

  contenedor.innerHTML = `
    <div class="encabezado-vista">
      <div>
        <h1>Calendario</h1>
        <p>Tus entregas, exámenes y sesiones de estudio en un solo lugar.</p>
      </div>
    </div>
    <section class="hoja">
      <div class="cal-barra">
        <div class="cal-barra__nav">
          <button type="button" class="boton boton--icono" data-mover="-1" aria-label="Anterior">${iconos.atras}</button>
          <button type="button" class="boton boton--secundario" data-hoy>Hoy</button>
          <button type="button" class="boton boton--icono" data-mover="1" aria-label="Siguiente">${iconos.adelante}</button>
          <h2 data-titulo aria-live="polite"></h2>
        </div>
        <div class="segmentos" role="radiogroup" aria-label="Vista">
          ${Object.entries(VISTAS).map(([k, v]) => `<label><input type="radio" name="vista" value="${k}"${k === vista ? ' checked' : ''}><span>${v}</span></label>`).join('')}
        </div>
      </div>
      <div data-cuerpo>${esqueleto(8)}</div>
      <div class="cal-leyenda">
        <span><i style="--c:var(--c-tarea)"></i>Entrega de tarea (color de la materia)</span>
        <span><i style="--c:var(--c-examen)"></i>Examen</span>
        <span><i class="punteado"></i>Sesión de estudio del plan</span>
      </div>
    </section>`;

  const cuerpo = contenedor.querySelector('[data-cuerpo]');
  const titulo = contenedor.querySelector('[data-titulo]');
  let solicitud = 0;

  async function cargar() {
    const [desde, hasta] = rango(vista, fecha);
    titulo.textContent = tituloRango(vista, fecha, desde);
    history.replaceState(null, '', `#/calendario?vista=${vista}&fecha=${aISO(fecha)}`);
    const id = ++solicitud;
    try {
      const { eventos } = await api.calendario(aISO(desde), aISO(hasta));
      if (id !== solicitud) return; // el usuario ya cambió de rango
      const porDia = agruparPorDia(eventos);
      cuerpo.innerHTML = vista === 'mes' ? vistaMes(fecha, desde, porDia)
        : vista === 'semana' ? vistaSemana(desde, porDia)
          : vistaDia(fecha, porDia);
    } catch (error) {
      cuerpo.innerHTML = errorCarga(error);
    }
  }

  function mover(paso) {
    if (vista === 'mes') fecha = new Date(fecha.getFullYear(), fecha.getMonth() + paso, 1);
    else fecha = sumarDias(fecha, vista === 'semana' ? 7 * paso : paso);
    cargar();
  }

  function irADia(clave) {
    fecha = desdeISO(clave);
    vista = 'dia';
    contenedor.querySelector(`input[value="dia"]`).checked = true;
    cargar();
  }

  contenedor.addEventListener('change', (e) => {
    if (e.target.name === 'vista') {
      vista = e.target.value;
      cargar();
    }
  });
  contenedor.addEventListener('click', (e) => {
    const m = e.target.closest('[data-mover]');
    if (m) return mover(Number(m.dataset.mover));
    if (e.target.closest('[data-hoy]')) { fecha = inicioDelDia(); return cargar(); }
    if (e.target.closest('[data-reintentar]')) return cargar();
    const dia = e.target.closest('[data-ir-dia]');
    if (dia) return irADia(dia.dataset.irDia);
    // Clic en una zona vacía de la celda del mes
    const celda = e.target.closest('.celda');
    if (celda && !e.target.closest('a')) irADia(celda.dataset.dia);
  });

  await cargar();
}
