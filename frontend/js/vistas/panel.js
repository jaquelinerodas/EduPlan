/** Panel principal: resumen del día, entregas atrasadas y agenda de la semana. */
import { api } from '../api.js';
import { obtenerMaterias } from '../datos.js';
import { iconos } from '../iconos.js';
import { markdownAHtml } from '../markdown.js';
import { aviso, esqueleto, errorCarga, vacio } from '../ui.js';
import {
  esc, colorSeguro, formato, saludo, primerNombre, plural, describirEntrega, inicioDelDia, PRIORIDADES,
} from '../utilidades.js';

function fraseResumen(r) {
  const abiertas = r.pendientes + r.enProgreso;
  if (r.tareas === 0) return 'Todavía no tienes tareas. Empieza registrando tus materias y sus entregas.';
  if (abiertas === 0) return 'No tienes tareas pendientes. Buen momento para repasar tus apuntes.';

  const partes = [`Tienes <b>${plural(abiertas, 'tarea abierta', 'tareas abiertas')}</b>`];
  if (r.vencidas) partes.push(`<b class="vencidas">${plural(r.vencidas, 'vencida', 'vencidas')}</b>`);
  partes.push(r.proximos7Dias
    ? `<b>${plural(r.proximos7Dias, 'entrega', 'entregas')}</b> en los próximos 7 días`
    : 'ninguna entrega en los próximos 7 días');
  const ultima = partes.pop();
  return `${partes.join(', ')} y ${ultima}.`;
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

function agendaSemana(tareas) {
  const hoy = inicioDelDia();
  const dias = Array.from({ length: 7 }, (_, i) => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i));

  return dias.map((dia, i) => {
    const siguiente = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() + 1);
    const delDia = tareas.filter((t) => {
      const f = new Date(t.fechaLimite);
      return f >= dia && f < siguiente && !t.vencida;
    });
    const nombre = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : formato.diaSemana(dia);
    const finde = dia.getDay() === 0 || dia.getDay() === 6;

    return `
      <div class="dia${i === 0 ? ' dia--hoy' : ''}${finde ? ' dia--finde' : ''}">
        <div class="dia__nombre"><span>${esc(nombre)}</span><span class="dia__numero">${dia.getDate()}</span></div>
        <div class="dia__tareas">
          ${delDia.length
            ? delDia.map((t) => `
              <a class="entrega entrega--${esc(t.prioridad)}" href="#/tareas?materiaId=${esc(t.materiaId)}" style="--color:${colorSeguro(t.materiaColor)}">
                <strong>${esc(t.titulo)}</strong>
                <span>${esc(formato.hora(t.fechaLimite))} · ${esc(t.materia)}</span>
              </a>`).join('')
            : '<span class="dia__libre">Sin entregas</span>'}
        </div>
      </div>`;
  }).join('');
}

export async function renderPanel(contenedor, _parametros, usuario) {
  contenedor.innerHTML = esqueleto(8);

  async function cargar() {
    try {
      const [{ resumen }, { tareas }, materias, { planes }] = await Promise.all([
        api.resumen(),
        api.tareas(),
        obtenerMaterias({ forzar: true }),
        api.planes(),
      ]);
      const abiertas = tareas.filter((t) => t.estado !== 'completada');
      const vencidas = abiertas.filter((t) => t.vencida);
      const porcentaje = resumen.tareas ? Math.round((resumen.completadas / resumen.tareas) * 100) : 0;
      const ultimoPlan = planes[0];

      contenedor.innerHTML = `
        <div class="panel">
          <section class="saludo" aria-labelledby="saludo-titulo">
            <p class="saludo__fecha">${esc(formato.diaLargoTitulo(new Date()))}</p>
            <h1 id="saludo-titulo">${esc(saludo())}, ${esc(primerNombre(usuario.nombre))}</h1>
            <p class="saludo__resumen">${fraseResumen(resumen)}</p>
            ${resumen.tareas ? `
              <div class="avance-general">
                <span>Avance general</span>
                <span><b>${resumen.completadas}</b> de ${resumen.tareas} completadas</span>
                <div class="avance" role="progressbar" aria-label="Tareas completadas" aria-valuenow="${porcentaje}" aria-valuemin="0" aria-valuemax="100">
                  <span style="--valor:${porcentaje}%"></span>
                </div>
              </div>` : ''}
          </section>

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
              <a class="boton boton--secundario" href="#/tareas">${iconos.mas}Nueva tarea</a>
            </div>
            ${materias.length
              ? `<div class="semana">${agendaSemana(abiertas)}</div>`
              : vacio({
                icono: iconos.materias,
                titulo: 'Registra tu primera materia',
                texto: 'Las tareas y los apuntes se organizan por materia. Agrega las que llevas este ciclo.',
                accion: '<a class="boton boton--primario" href="#/materias">Agregar materia</a>',
              })}
          </section>

          <div class="panel__columnas">
            <section class="hoja" aria-labelledby="materias-titulo">
              <div class="hoja__encabezado">
                <h2 id="materias-titulo">Materias</h2>
                <a href="#/materias">Administrar</a>
              </div>
              ${materias.length ? `
                <ul class="lista-materias-mini">
                  ${materias.map((m) => {
                    const pct = m.totalTareas ? Math.round((m.completadas / m.totalTareas) * 100) : 0;
                    return `
                      <li>
                        <div class="fila">
                          <a href="#/tareas?materiaId=${esc(m.id)}">${esc(m.nombre)}</a>
                          <span>${plural(m.pendientes + m.enProgreso, 'abierta', 'abiertas')}${m.vencidas ? ` · <b style="color:var(--rojo)">${plural(m.vencidas, 'vencida', 'vencidas')}</b>` : ''}</span>
                        </div>
                        <div class="avance" aria-hidden="true"><span style="--valor:${pct}%;--color:${colorSeguro(m.color)}"></span></div>
                      </li>`;
                  }).join('')}
                </ul>` : '<p class="hoja__cuerpo">Aún no tienes materias.</p>'}
            </section>

            <section class="hoja" aria-labelledby="plan-titulo">
              <div class="hoja__encabezado">
                <h2 id="plan-titulo">Plan de estudio</h2>
                <a href="#/plan">${ultimoPlan ? 'Ver completo' : 'Crear plan'}</a>
              </div>
              <div class="plan-mini">
                ${ultimoPlan ? `
                  <p class="firma-ia">${iconos.chispa}Generado el ${esc(formato.fechaHora(ultimoPlan.creadoEn))}</p>
                  <div class="texto-ia">${markdownAHtml(ultimoPlan.contenido.split('\n').slice(0, 8).join('\n'))}</div>
                  <a href="#/plan">Seguir leyendo</a>`
                  : `<p>El asistente reparte tus tareas pendientes en los próximos días según su fecha y prioridad.</p>
                     <a class="boton boton--ia" href="#/plan">${iconos.chispa}Generar mi plan</a>`}
              </div>
            </section>
          </div>
        </div>`;
    } catch (error) {
      contenedor.innerHTML = errorCarga(error);
    }
  }

  // Completar tareas desde el panel (HU04)
  contenedor.addEventListener('change', async (e) => {
    const id = e.target.dataset?.completar;
    if (!id) return;
    e.target.disabled = true;
    try {
      await api.cambiarEstado(id, 'completada');
      aviso('Tarea completada');
      cargar();
    } catch (error) {
      e.target.checked = false;
      e.target.disabled = false;
      aviso(error.message, 'error');
    }
  });
  contenedor.addEventListener('click', (e) => {
    if (e.target.closest('[data-reintentar]')) cargar();
  });

  await cargar();
}
