/** Panel principal: resumen del día, lo de hoy, atrasadas y agenda de la semana. */
import { api } from '../api.js';
import { obtenerMaterias, invalidarMaterias } from '../datos.js';
import { iconos } from '../iconos.js';
import { aviso, confirmar, esqueleto, errorCarga, vacio } from '../ui.js';
import {
  esc, colorSeguro, formato, saludo, primerNombre, plural, describirEntrega, inicioDelDia, aISO, hoyISO,
  cuentaRegresiva, diasHasta, PRIORIDADES,
} from '../utilidades.js';

function fraseResumen(r) {
  const abiertas = r.pendientes + r.enProgreso;
  if (r.tareas === 0 && !r.examenesProximos) return 'Todavía no tienes tareas. Empieza registrando tus materias y sus entregas.';
  const partes = [];
  partes.push(abiertas ? `<b>${plural(abiertas, 'tarea abierta', 'tareas abiertas')}</b>` : 'ninguna tarea abierta');
  if (r.vencidas) partes.push(`<b class="vencidas">${plural(r.vencidas, 'vencida', 'vencidas')}</b>`);
  if (r.proximos7Dias) partes.push(`<b>${plural(r.proximos7Dias, 'entrega', 'entregas')}</b> en los próximos 7 días`);
  if (r.examenesProximos) partes.push(`<b>${plural(r.examenesProximos, 'examen próximo', 'exámenes próximos')}</b>`);
  const ultima = partes.length > 1 ? ` y ${partes.pop()}` : '';
  return `Tienes ${partes.join(', ')}${ultima}.`;
}

function renglonTarea(t) {
  const entrega = describirEntrega(t);
  return `
    <li class="renglon" style="--color:${colorSeguro(t.materiaColor)}">
      <input type="checkbox" class="check" data-completar="${esc(t.id)}" aria-label="Marcar «${esc(t.titulo)}» como completada">
      <div>
        <div class="renglon__titulo">${esc(t.titulo)}</div>
        <div class="renglon__detalle">
          <span class="etiqueta-materia" style="--color:${colorSeguro(t.materiaColor)}"><span>${esc(t.materia)}</span></span>
          <span class="fecha ${entrega.clase}">${esc(entrega.texto)}</span>
        </div>
      </div>
      <span class="prioridad prioridad--${esc(t.prioridad)}">${esc(PRIORIDADES[t.prioridad])}</span>
    </li>`;
}

function agendaSemana(tareas, examenes) {
  const hoy = inicioDelDia();
  return Array.from({ length: 7 }, (_, i) => {
    const dia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i);
    const siguiente = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() + 1);
    const enDia = (f) => new Date(f) >= dia && new Date(f) < siguiente;
    const delDia = tareas.filter((t) => enDia(t.fechaLimite) && !t.vencida);
    const examenesDia = examenes.filter((e) => enDia(e.fecha));
    const nombre = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : formato.diaSemana(dia);
    const finde = dia.getDay() === 0 || dia.getDay() === 6;
    const vacioDia = !delDia.length && !examenesDia.length;

    return `
      <div class="dia${i === 0 ? ' dia--hoy' : ''}${finde ? ' dia--finde' : ''}">
        <div class="dia__nombre"><span>${esc(nombre)}</span><span class="dia__numero">${dia.getDate()}</span></div>
        <div class="dia__tareas">
          ${examenesDia.map((e) => `
            <a class="entrega entrega--examen" href="#/examenes" style="--color:var(--c-examen)">
              <strong>Examen: ${esc(e.titulo)}</strong>
              <span>${esc(formato.hora(e.fecha))} · ${esc(e.materia)}</span>
            </a>`).join('')}
          ${delDia.map((t) => `
            <a class="entrega" href="#/tareas?materiaId=${esc(t.materiaId)}" style="--color:${colorSeguro(t.materiaColor)}">
              <strong>${esc(t.titulo)}</strong>
              <span>${esc(formato.hora(t.fechaLimite))} · ${esc(t.materia)}</span>
            </a>`).join('')}
          ${vacioDia ? '<span class="dia__libre">Sin entregas</span>' : ''}
        </div>
      </div>`;
  }).join('');
}

function bloqueHoy({ sesiones, examenes, resumen }) {
  return `
    <div class="panel__hoy">
      <section class="hoja" aria-labelledby="hoy-plan">
        <div class="hoja__encabezado"><h2 id="hoy-plan">Hoy en tu plan</h2><a href="#/plan">Ver plan</a></div>
        ${sesiones.length
          ? `<ul class="mini-lista">${sesiones.map((s) => `
              <li class="${s.completado ? 'hecha' : ''}">
                <input type="checkbox" class="check" data-sesion="${esc(s.id)}" data-plan="${esc(s.planId)}" ${s.completado ? 'checked' : ''}
                  aria-label="${s.completado ? 'Marcar como pendiente' : 'Marcar como hecha'}: ${esc(s.titulo)}">
                <strong>${esc(s.titulo)}</strong>
                <small>${esc(formato.hora(s.inicio))} – ${esc(formato.hora(s.fin))}${s.materia ? ` · ${esc(s.materia)}` : ''}</small>
              </li>`).join('')}</ul>`
          : `<p class="mini-lista__vacio">No tienes sesiones de estudio hoy. <a href="#/plan?nuevo=general">Crea un plan</a> y el asistente organizará tus días.</p>`}
      </section>

      <section class="hoja" aria-labelledby="hoy-examenes">
        <div class="hoja__encabezado"><h2 id="hoy-examenes">Próximos exámenes</h2><a href="#/examenes">Ver todos</a></div>
        ${examenes.length
          ? `<ul class="mini-lista">${examenes.slice(0, 3).map((e) => `
              <li style="grid-template-columns:1fr">
                <strong style="grid-column:1">${esc(e.titulo)}</strong>
                <small style="grid-column:1">${esc(e.materia)} · <b style="color:${diasHasta(e.fecha) <= 3 ? 'var(--rojo)' : 'var(--tinta)'}">${esc(cuentaRegresiva(e.fecha))}</b>${e.mejorPuntaje !== null ? ` · práctica ${Math.round(e.mejorPuntaje)}%` : ''}</small>
              </li>`).join('')}</ul>`
          : '<p class="mini-lista__vacio">Sin exámenes próximos. <a href="#/examenes">Registra uno</a> para prepararlo con tiempo.</p>'}
      </section>

      <section class="hoja" aria-labelledby="hoy-tarjetas">
        <div class="hoja__encabezado"><h2 id="hoy-tarjetas">Repaso de tarjetas</h2><a href="#/tarjetas">Ver tarjetas</a></div>
        <div class="mini-lista__vacio" style="display:grid;gap:var(--e-3)">
          ${resumen.tarjetasPendientes
            ? `<p><b style="font-size:var(--t-lg);font-family:var(--fuente-titulos);color:var(--grafito)">${resumen.tarjetasPendientes}</b> ${resumen.tarjetasPendientes === 1 ? 'tarjeta te espera' : 'tarjetas te esperan'} hoy.</p>
               <a class="boton boton--primario" href="#/tarjetas?repaso=1">${iconos.jugar}Empezar repaso</a>`
            : `<p>No tienes tarjetas pendientes hoy.</p><a class="boton boton--secundario" href="#/tarjetas">${iconos.chispa}Crear tarjetas</a>`}
        </div>
      </section>
    </div>`;
}

export async function renderPanel(contenedor, _parametros, usuario) {
  contenedor.innerHTML = esqueleto(8);

  async function cargar() {
    try {
      const hoy = hoyISO();
      const [{ resumen }, { tareas }, materias, { examenes }, { eventos }] = await Promise.all([
        api.resumen(),
        api.tareas(),
        obtenerMaterias({ forzar: true }),
        api.examenes({ periodo: 'proximos' }),
        api.calendario(hoy, hoy),
      ]);
      const abiertas = tareas.filter((t) => t.estado !== 'completada');
      const vencidas = abiertas.filter((t) => t.vencida);
      const sesiones = eventos.filter((e) => e.tipo === 'sesion');
      const porcentaje = resumen.tareas ? Math.round((resumen.completadas / resumen.tareas) * 100) : 0;

      contenedor.innerHTML = `
        <div class="panel">
          <section class="saludo" aria-labelledby="saludo-titulo">
            <p class="saludo__fecha">${esc(formato.diaLargoTitulo(new Date()))}</p>
            <h1 id="saludo-titulo">${esc(saludo())}, ${esc(primerNombre(usuario.nombre))}</h1>
            <p class="saludo__resumen">${fraseResumen(resumen)}</p>
            ${resumen.tareas ? `
              <div class="avance-general">
                <span>Avance general</span>
                <span><b>${resumen.completadas}</b> de ${resumen.tareas} tareas completadas</span>
                <div class="avance" role="progressbar" aria-label="Tareas completadas" aria-valuenow="${porcentaje}" aria-valuemin="0" aria-valuemax="100">
                  <span style="--valor:${porcentaje}%"></span>
                </div>
              </div>` : ''}
          </section>

          ${materias.length ? bloqueHoy({ sesiones, examenes, resumen }) : ''}

          ${vencidas.length ? `
            <section class="hoja atrasadas" aria-labelledby="atrasadas-titulo">
              <div class="hoja__encabezado">
                <h2 id="atrasadas-titulo">Atrasadas</h2>
                <a href="#/tareas?vencidas=true">Ver todas</a>
              </div>
              <ul class="renglones">${vencidas.slice(0, 5).map(renglonTarea).join('')}</ul>
            </section>` : ''}

          <section class="hoja" aria-labelledby="semana-titulo">
            <div class="hoja__encabezado">
              <h2 id="semana-titulo">Esta semana</h2>
              <a class="boton boton--secundario" href="#/calendario?vista=semana&fecha=${aISO(new Date())}">${iconos.calendario}Ver calendario</a>
            </div>
            ${materias.length
              ? `<div class="semana">${agendaSemana(abiertas, examenes)}</div>`
              : vacio({
                icono: iconos.materias,
                titulo: 'Registra tu primera materia',
                texto: 'Las tareas, apuntes y exámenes se organizan por materia. Agrega las que llevas este ciclo.',
                accion: '<a class="boton boton--primario" href="#/materias">Agregar materia</a>',
              })}
          </section>

          ${materias.length ? `
            <section class="hoja" aria-labelledby="materias-titulo">
              <div class="hoja__encabezado">
                <h2 id="materias-titulo">Avance por materia</h2>
                <a href="#/materias">Administrar</a>
              </div>
              <ul class="lista-materias-mini">
                ${materias.map((m) => {
                  const pct = m.totalTareas ? Math.round((m.completadas / m.totalTareas) * 100) : 0;
                  return `
                    <li>
                      <div class="fila">
                        <a href="#/tareas?materiaId=${esc(m.id)}">${esc(m.nombre)}</a>
                        <span>${plural(m.pendientes + m.enProgreso, 'pendiente', 'pendientes')} · ${plural(m.completadas, 'completada', 'completadas')}${m.vencidas ? ` · <b style="color:var(--rojo)">${plural(m.vencidas, 'vencida', 'vencidas')}</b>` : ''}</span>
                      </div>
                      <div class="avance" aria-hidden="true"><span style="--valor:${pct}%;--color:${colorSeguro(m.color)}"></span></div>
                    </li>`;
                }).join('')}
              </ul>
            </section>` : ''}
        </div>`;
    } catch (error) {
      contenedor.innerHTML = errorCarga(error);
    }
  }

  contenedor.addEventListener('change', async (e) => {
    // Completar una tarea atrasada (con confirmación, es definitivo)
    const tareaId = e.target.dataset?.completar;
    if (tareaId) {
      e.target.checked = false;
      const ok = await confirmar({
        titulo: 'Completar tarea',
        mensaje: 'Después de completarla ya no podrás editarla ni cambiar su estado.',
        textoConfirmar: 'Sí, completar', tono: 'exito',
      });
      if (!ok) return;
      try {
        await api.cambiarEstado(tareaId, 'completada');
        invalidarMaterias();
        aviso('Tarea completada');
        cargar();
      } catch (error) {
        aviso(error.message, 'error');
      }
      return;
    }
    // Marcar una sesión de estudio de hoy
    const sesionId = e.target.dataset?.sesion;
    if (sesionId) {
      const hecha = e.target.checked;
      e.target.disabled = true;
      try {
        await api.marcarActividad(e.target.dataset.plan, sesionId, hecha);
        e.target.closest('li').classList.toggle('hecha', hecha);
        aviso(hecha ? 'Sesión marcada como hecha' : 'Sesión marcada como pendiente');
      } catch (error) {
        e.target.checked = !hecha;
        aviso(error.message, 'error');
      }
      e.target.disabled = false;
    }
  });
  contenedor.addEventListener('click', (e) => {
    if (e.target.closest('[data-reintentar]')) cargar();
  });

  await cargar();
}
