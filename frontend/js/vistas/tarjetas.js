/**
 * Tarjetas de memoria (flashcards) con repaso espaciado.
 * En el repaso el estudiante responde "No lo recuerdo", "Difícil" o "Fácil"
 * y el sistema programa cuándo volverá a ver cada tarjeta.
 */
import { api } from '../api.js';
import { obtenerMaterias } from '../datos.js';
import { iconos } from '../iconos.js';
import { aviso, abrirFormulario, confirmar, esqueleto, errorCarga, vacio } from '../ui.js';
import { esc, colorSeguro, desdeISO, plural, cuentaRegresiva } from '../utilidades.js';

const CALIFICACIONES = [
  { valor: 'olvidado', texto: 'No lo recuerdo', clase: 'boton--olvidado', tecla: '1' },
  { valor: 'dificil', texto: 'Difícil', clase: 'boton--dificil', tecla: '2' },
  { valor: 'facil', texto: 'Fácil', clase: 'boton--facil', tecla: '3' },
];

const cuando = (dias) => (dias === 0 ? 'hoy otra vez' : dias === 1 ? 'mañana' : `en ${dias} días`);

/* ---------- Pantalla principal ---------- */
async function vistaInicio(contenedor, parametros) {
  let materias = [];
  let tarjetas = [];
  const filtro = { materiaId: parametros.materiaId || '' };

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
        <h1>Tarjetas de memoria</h1>
        <p>Memoriza conceptos con repasos cortos. Las tarjetas difíciles aparecen más seguido.</p>
      </div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <button type="button" class="boton boton--secundario" data-nueva>${iconos.mas}Nueva tarjeta</button>
        <button type="button" class="boton boton--ia" data-generar>${iconos.chispa}Generar desde un apunte</button>
      </div>
    </div>
    <div data-contenido style="display:grid;gap:var(--e-5)">${esqueleto(6)}</div>`;

  const zona = contenedor.querySelector('[data-contenido]');

  async function cargar() {
    try {
      const [{ resumen }, lista] = await Promise.all([api.resumenTarjetas(), api.tarjetas(filtro.materiaId ? { materiaId: filtro.materiaId } : {})]);
      tarjetas = lista.tarjetas;
      if (!resumen.total) {
        zona.innerHTML = `<section class="hoja">${vacio({
          icono: iconos.tarjetas,
          titulo: 'Crea tus primeras tarjetas',
          texto: 'El asistente puede convertir cualquier apunte en tarjetas de pregunta y respuesta.',
          accion: `<button type="button" class="boton boton--ia" data-generar>${iconos.chispa}Generar desde un apunte</button>`,
        })}</section>`;
        return;
      }
      zona.innerHTML = `
        <section class="hoja repaso-hoy">
          <div>
            <h2>${resumen.pendientes ? `${plural(resumen.pendientes, 'tarjeta', 'tarjetas')} para repasar hoy` : 'Estás al día con tus repasos'}</h2>
            <p>${plural(resumen.total, 'tarjeta', 'tarjetas')} en total · ${plural(resumen.dominadas, 'dominada', 'dominadas')} (repasadas con éxito 3 veces o más)</p>
          </div>
          ${resumen.pendientes ? `<a class="boton boton--primario" href="#/tarjetas?repaso=1">${iconos.jugar}Empezar repaso</a>` : ''}
        </section>

        <section class="hoja">
          <div class="hoja__encabezado"><h2 style="font-size:var(--t-md)">Por materia</h2></div>
          <ul class="mazos">${resumen.porMateria.map((m) => `
            <li class="mazo" style="--color:${colorSeguro(m.materiaColor)}">
              <div>
                <strong>${esc(m.materia)}</strong>
                <p class="mazo__meta">${plural(m.total, 'tarjeta', 'tarjetas')} · ${m.pendientes} para hoy · ${m.dominadas} dominadas</p>
              </div>
              ${m.pendientes ? `<a class="boton boton--secundario" href="#/tarjetas?repaso=1&materiaId=${esc(m.materiaId)}">Repasar</a>` : '<span class="mazo__meta">Al día</span>'}
              <div class="avance" aria-hidden="true"><span style="--valor:${m.total ? (m.dominadas / m.total) * 100 : 0}%;--color:${colorSeguro(m.materiaColor)}"></span></div>
            </li>`).join('')}
          </ul>
        </section>

        <section class="hoja">
          <div class="hoja__encabezado">
            <h2 style="font-size:var(--t-md)">Todas las tarjetas</h2>
            <label class="campo" style="min-width:12rem"><span class="solo-lectores">Materia</span>
              <select class="selector" data-filtro>
                <option value="">Todas las materias</option>
                ${materias.map((m) => `<option value="${esc(m.id)}"${m.id === filtro.materiaId ? ' selected' : ''}>${esc(m.nombre)}</option>`).join('')}
              </select></label>
          </div>
          ${tarjetas.length ? `<ul class="tabla-tarjetas">${tarjetas.map((t) => `
            <li>
              <strong>${esc(t.frente)}</strong>
              <span>${esc(t.reverso)}</span>
              <small>${t.pendiente ? '<b style="color:var(--tinta)">Para hoy</b>' : `Repaso ${esc(cuentaRegresiva(desdeISO(t.proximoRepaso)))}`}</small>
              <div style="display:flex">
                <button type="button" class="boton boton--icono" data-editar="${esc(t.id)}" aria-label="Editar tarjeta">${iconos.editar}</button>
                <button type="button" class="boton boton--icono peligro" data-borrar="${esc(t.id)}" aria-label="Eliminar tarjeta">${iconos.borrar}</button>
              </div>
            </li>`).join('')}</ul>` : '<p class="hoja__cuerpo">No hay tarjetas de esta materia.</p>'}
        </section>`;
    } catch (error) {
      zona.innerHTML = errorCarga(error);
    }
  }

  /** Apuntes de una materia agrupados por semestre o bloque (para el <select>). */
  function opcionesApuntes(apuntes, materiaId, elegido) {
    const lista = apuntes.filter((a) => a.materiaId === materiaId);
    if (!lista.length) return '<option value="">Esta materia no tiene apuntes</option>';
    const grupos = new Map();
    for (const a of lista) {
      const g = a.periodo || 'Sin semestre';
      if (!grupos.has(g)) grupos.set(g, []);
      grupos.get(g).push(a);
    }
    return [...grupos].map(([g, items]) => `<optgroup label="${esc(g)}">${items.map((a) => `
      <option value="${esc(a.id)}"${a.id === elegido ? ' selected' : ''}>${esc(a.titulo)}${a.tarjetasPendientes ? ` (${a.tarjetasPendientes} por repasar)` : ''}</option>`).join('')}</optgroup>`).join('');
  }

  /**
   * Nueva tarjeta: escribirla a mano o generarla con IA desde un apunte existente.
   * Para editar solo se muestra el formulario manual.
   */
  async function abrirEditor(t, { modo = 'manual', apunteId } = {}) {
    let apuntes = [];
    if (!t) {
      try {
        ({ apuntes } = await api.apuntes());
      } catch (error) {
        aviso(error.message, 'error');
        return;
      }
    }
    const materiaInicial = t?.materiaId || apuntes.find((a) => a.id === apunteId)?.materiaId || filtro.materiaId || materias[0]?.id;
    abrirFormulario({
      titulo: t ? 'Editar tarjeta' : 'Nueva tarjeta',
      textoEnviar: t ? 'Guardar cambios' : modo === 'apunte' ? 'Generar tarjetas' : 'Crear tarjeta',
      contenido: `
        ${t ? '' : `
          <div class="segmentos segmentos--bloque" role="radiogroup" aria-label="Cómo crear la tarjeta">
            <label><input type="radio" name="modo" value="manual"${modo === 'manual' ? ' checked' : ''}><span>${iconos.editar}Escribirla yo</span></label>
            <label><input type="radio" name="modo" value="apunte"${modo === 'apunte' ? ' checked' : ''}><span>${iconos.chispa}Desde un apunte</span></label>
          </div>`}
        <label class="campo"><span>Materia</span>
          <select class="selector" name="materiaId">${materias.map((m) => `<option value="${esc(m.id)}"${m.id === materiaInicial ? ' selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select></label>
        <div data-modo="manual">
          <label class="campo"><span>Frente (pregunta o concepto)</span>
            <textarea class="area-texto" name="frente" maxlength="500" style="min-height:4.5rem">${esc(t?.frente)}</textarea></label>
          <label class="campo" style="margin-top:var(--e-4)"><span>Reverso (respuesta)</span>
            <textarea class="area-texto" name="reverso" maxlength="1500" style="min-height:6rem">${esc(t?.reverso)}</textarea></label>
        </div>
        ${t ? '' : `
        <div data-modo="apunte" style="display:grid;gap:var(--e-4)">
          <label class="campo"><span>Apunte</span>
            <select class="selector" name="apunteId">${opcionesApuntes(apuntes, materiaInicial, apunteId)}</select></label>
          <label class="campo"><span>Cantidad</span>
            <select class="selector" name="cantidad">${[5, 10, 15, 20].map((n) => `<option value="${n}"${n === 10 ? ' selected' : ''}>${n} tarjetas</option>`).join('')}</select></label>
          <p class="acceso__ayuda">El asistente leerá el apunte y escribirá una pregunta y su respuesta por cada concepto importante.</p>
        </div>`}`,
      alAbrir: (form) => {
        const alternar = () => {
          const m = form.querySelector('[name="modo"]:checked')?.value || 'manual';
          form.querySelectorAll('[data-modo]').forEach((el) => { el.hidden = el.dataset.modo !== m; });
          form.querySelector('[type="submit"]').textContent = t ? 'Guardar cambios' : m === 'apunte' ? 'Generar tarjetas' : 'Crear tarjeta';
        };
        alternar();
        form.addEventListener('change', (e) => {
          if (e.target.name === 'modo') alternar();
          if (e.target.name === 'materiaId' && form.apunteId) form.apunteId.innerHTML = opcionesApuntes(apuntes, e.target.value);
        });
      },
      alEnviar: async (f) => {
        if (!t && f.modo === 'apunte') {
          if (!f.apunteId) throw new Error('Esta materia no tiene apuntes. Elige otra o escribe la tarjeta.');
          const { tarjetas: nuevas } = await api.generarTarjetas({ apunteId: f.apunteId, cantidad: Number(f.cantidad) });
          aviso(`${plural(nuevas.length, 'tarjeta creada', 'tarjetas creadas')}`);
        } else {
          const datos = { materiaId: f.materiaId, frente: f.frente, reverso: f.reverso };
          if (t) await api.editarTarjeta(t.id, datos);
          else await api.crearTarjeta(datos);
          aviso(t ? 'Cambios guardados' : 'Tarjeta creada');
        }
        cargar();
      },
    });
  }

  contenedor.addEventListener('change', (e) => {
    if (e.target.matches('[data-filtro]')) {
      filtro.materiaId = e.target.value;
      cargar();
    }
  });
  contenedor.addEventListener('click', async (e) => {
    if (e.target.closest('[data-generar]')) return abrirEditor(null, { modo: 'apunte' });
    if (e.target.closest('[data-nueva]')) return abrirEditor();
    if (e.target.closest('[data-reintentar]')) return cargar();
    const editar = e.target.closest('[data-editar]');
    if (editar) return abrirEditor(tarjetas.find((t) => t.id === editar.dataset.editar));
    const borrar = e.target.closest('[data-borrar]');
    if (borrar) {
      if (!(await confirmar({ titulo: 'Eliminar tarjeta', mensaje: 'Se eliminará esta tarjeta y su historial de repaso.' }))) return;
      try {
        await api.borrarTarjeta(borrar.dataset.borrar);
        aviso('Tarjeta eliminada');
        cargar();
      } catch (error) {
        aviso(error.message, 'error');
      }
    }
  });

  await cargar();
  if (parametros.generar) {
    abrirEditor(null, { modo: 'apunte', apunteId: parametros.apunteId });
    history.replaceState(null, '', '#/tarjetas');
  }
}

/* ---------- Modo repaso ---------- */
async function vistaRepaso(contenedor, parametros) {
  contenedor.innerHTML = esqueleto(6);
  let cola;
  try {
    ({ tarjetas: cola } = await api.tarjetas({
      pendientes: true,
      ...(parametros.materiaId ? { materiaId: parametros.materiaId } : {}),
      ...(parametros.apunteId ? { apunteId: parametros.apunteId } : {}),
    }));
  } catch (error) {
    contenedor.innerHTML = errorCarga(error, false);
    return;
  }

  /*
   * La sesión es una lista de turnos. Cada turno es una tarjeta y, si ya se
   * calificó, su calificación. "Siguiente" avanza sin calificar (la tarjeta se
   * puede retomar al final); "Atrás" vuelve a ver la anterior. Una tarjeta ya
   * calificada no se vuelve a calificar en la misma sesión.
   */
  const turnos = cola.map((t) => ({ t, calificacion: null }));
  const total = cola.length;
  const resultado = { olvidado: 0, dificil: 0, facil: 0 };
  let indice = 0;
  let volteada = false;
  let enviando = false;

  const pendientes = () => turnos.filter((x) => !x.calificacion).length;
  const calificadas = () => turnos.filter((x) => x.calificacion && !x.repetida).length;
  const nombreCalificacion = (v) => CALIFICACIONES.find((c) => c.valor === v)?.texto;

  function pintarFin() {
    const saltadas = pendientes();
    contenedor.innerHTML = `
      <div class="repaso">
        <section class="hoja">${vacio({
          icono: saltadas ? iconos.tarjetas : iconos.ok,
          titulo: !total ? 'No tienes tarjetas para hoy' : saltadas ? `Te ${saltadas === 1 ? 'falta 1 tarjeta' : `faltan ${saltadas} tarjetas`}` : '¡Repaso terminado!',
          texto: !total
            ? 'Vuelve mañana o genera tarjetas nuevas desde tus apuntes.'
            : `Fácil: ${resultado.facil} · Difícil: ${resultado.dificil} · No lo recordaste: ${resultado.olvidado}.${saltadas ? ' Las que saltaste siguen pendientes para hoy.' : ' Las tarjetas volverán cuando toque repasarlas.'}`,
          accion: `${saltadas ? `<button type="button" class="boton boton--primario" data-retomar>${iconos.jugar}Repasar las que salté</button> ` : ''}
            <a class="boton ${saltadas ? 'boton--secundario' : 'boton--primario'}" href="#/tarjetas">Volver a mis tarjetas</a>`,
        })}</section>
      </div>`;
  }

  function botonesCalificar(turno) {
    if (turno.calificacion) {
      return `<p class="ya-calificada">${iconos.ok}Ya la calificaste: <b>${esc(nombreCalificacion(turno.calificacion))}</b></p>`;
    }
    return `
      <p style="text-align:center;font-size:var(--t-sm);color:var(--grafito-suave);margin-bottom:var(--e-2)">¿Qué tan bien lo recordaste?</p>
      <div class="calificar">
        ${CALIFICACIONES.map((c) => `
          <button type="button" class="boton ${c.clase}" data-calificar="${c.valor}">
            ${c.texto}<small>Volverá ${esc(cuando(turno.t.proximosIntervalos[c.valor]))} · tecla ${c.tecla}</small>
          </button>`).join('')}
      </div>`;
  }

  function pintar() {
    if (!turnos.length || indice >= turnos.length) return pintarFin();
    const turno = turnos[indice];
    const { t } = turno;
    volteada = Boolean(turno.calificacion);
    const hechas = calificadas();
    contenedor.innerHTML = `
      <div class="repaso">
        <div class="encabezado-vista" style="margin-bottom:0">
          <div><a href="#/tarjetas" class="boton boton--fantasma" style="margin-left:-.8rem">${iconos.atras}Salir del repaso</a></div>
        </div>
        <div class="repaso__progreso">
          <div style="display:flex;justify-content:space-between;gap:1rem">
            <span>Tarjeta ${indice + 1} de ${turnos.length} · ${hechas} de ${total} calificadas</span><span>${esc(t.materia)}</span>
          </div>
          <div class="avance" aria-hidden="true"><span style="--valor:${(hechas / total) * 100}%;--color:var(--tinta)"></span></div>
        </div>
        <div class="tarjeta-3d${volteada ? ' tarjeta-3d--volteada' : ''}" style="--color:${colorSeguro(t.materiaColor)}">
          <div class="tarjeta-3d__interior">
            <div class="tarjeta-3d__cara" aria-hidden="${volteada}" data-cara="frente">
              <small>Pregunta${turno.repetida ? ' · otra vez' : ''}</small>
              <p>${esc(t.frente)}</p>
              ${t.apunte ? `<small class="tarjeta-3d__origen">${iconos.apuntes}${esc(t.apunte)}</small>` : ''}
            </div>
            <div class="tarjeta-3d__cara tarjeta-3d__reverso" aria-hidden="${!volteada}" data-cara="reverso">
              <small>Respuesta</small>
              <p>${esc(t.reverso)}</p>
            </div>
          </div>
        </div>
        <div data-acciones>
          ${volteada ? botonesCalificar(turno)
            : `<button type="button" class="boton boton--primario boton--bloque" data-voltear>${iconos.voltear}Mostrar respuesta <small style="opacity:.75;font-weight:400">(espacio)</small></button>`}
        </div>
        <nav class="repaso__nav" aria-label="Navegar entre tarjetas">
          <button type="button" class="boton boton--secundario" data-atras ${indice === 0 ? 'disabled' : ''}>${iconos.atras}Atrás</button>
          <span>← →</span>
          <button type="button" class="boton boton--secundario" data-siguiente>${indice === turnos.length - 1 ? 'Terminar' : 'Siguiente'}${iconos.adelante}</button>
        </nav>
      </div>`;
  }

  function voltear() {
    if (volteada) return;
    volteada = true;
    const turno = turnos[indice];
    contenedor.querySelector('.tarjeta-3d').classList.add('tarjeta-3d--volteada');
    contenedor.querySelector('[data-cara="frente"]').setAttribute('aria-hidden', 'true');
    contenedor.querySelector('[data-cara="reverso"]').setAttribute('aria-hidden', 'false');
    contenedor.querySelector('[data-acciones]').innerHTML = botonesCalificar(turno);
    contenedor.querySelector('[data-calificar="facil"]')?.focus();
  }

  function mover(paso) {
    if (enviando) return;
    indice = Math.max(0, Math.min(turnos.length, indice + paso));
    pintar();
  }

  async function calificar(valor) {
    const turno = turnos[indice];
    if (enviando || !volteada || turno.calificacion) return;
    enviando = true;
    try {
      await api.repasarTarjeta(turno.t.id, valor);
      turno.calificacion = valor;
      resultado[valor] += 1;
      // Lo que no recordó vuelve al final de esta misma sesión
      if (valor === 'olvidado') {
        turnos.push({ t: { ...turno.t, proximosIntervalos: { olvidado: 0, dificil: 1, facil: 2 } }, calificacion: null, repetida: true });
      }
      indice += 1;
    } catch (error) {
      aviso(error.message, 'error');
    }
    enviando = false;
    pintar();
  }

  contenedor.addEventListener('click', (e) => {
    if (e.target.closest('[data-voltear]') || e.target.closest('.tarjeta-3d')) return voltear();
    if (e.target.closest('[data-atras]')) return mover(-1);
    if (e.target.closest('[data-siguiente]')) return mover(1);
    if (e.target.closest('[data-retomar]')) {
      indice = turnos.findIndex((x) => !x.calificacion);
      return pintar();
    }
    const c = e.target.closest('[data-calificar]');
    if (c) calificar(c.dataset.calificar);
  });

  const teclas = (e) => {
    if (e.target.matches('input, textarea, select') || document.querySelector('dialog[open]')) return;
    if (indice >= turnos.length) return;
    if (e.key === ' ' && !volteada) { e.preventDefault(); voltear(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); mover(1); }
    if (e.key === 'ArrowLeft' && indice > 0) { e.preventDefault(); mover(-1); }
    const c = CALIFICACIONES.find((x) => x.tecla === e.key);
    if (c && volteada) calificar(c.valor);
  };
  document.addEventListener('keydown', teclas);

  pintar();
  return () => document.removeEventListener('keydown', teclas);
}

export function renderTarjetas(contenedor, parametros) {
  return parametros.repaso ? vistaRepaso(contenedor, parametros) : vistaInicio(contenedor, parametros);
}
