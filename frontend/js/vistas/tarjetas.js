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

  async function abrirGenerar() {
    let apuntes;
    try {
      ({ apuntes } = await api.apuntes(filtro.materiaId ? { materiaId: filtro.materiaId } : {}));
    } catch (error) {
      aviso(error.message, 'error');
      return;
    }
    if (!apuntes.length) {
      aviso('Primero escribe un apunte para generar tarjetas.', 'error');
      return;
    }
    abrirFormulario({
      titulo: 'Generar tarjetas con IA',
      textoEnviar: 'Generar tarjetas',
      contenido: `
        <label class="campo"><span>Apunte</span>
          <select class="selector" name="apunteId">${apuntes.map((a) => `<option value="${esc(a.id)}">${esc(a.titulo)} · ${esc(a.materia)}</option>`).join('')}</select></label>
        <label class="campo"><span>Cantidad</span>
          <select class="selector" name="cantidad">${[5, 10, 15, 20].map((n) => `<option value="${n}"${n === 10 ? ' selected' : ''}>${n} tarjetas</option>`).join('')}</select></label>
        <p class="acceso__ayuda">El asistente leerá el apunte y escribirá una pregunta y su respuesta por cada concepto importante.</p>`,
      alEnviar: async (f) => {
        const { tarjetas: nuevas } = await api.generarTarjetas({ apunteId: f.apunteId, cantidad: Number(f.cantidad) });
        aviso(`${plural(nuevas.length, 'tarjeta creada', 'tarjetas creadas')}`);
        cargar();
      },
    });
  }

  function abrirEditor(t) {
    abrirFormulario({
      titulo: t ? 'Editar tarjeta' : 'Nueva tarjeta',
      textoEnviar: t ? 'Guardar cambios' : 'Crear tarjeta',
      contenido: `
        <label class="campo"><span>Materia</span>
          <select class="selector" name="materiaId">${materias.map((m) => `<option value="${esc(m.id)}"${m.id === (t?.materiaId || filtro.materiaId) ? ' selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select></label>
        <label class="campo"><span>Frente (pregunta o concepto)</span>
          <textarea class="area-texto" name="frente" required maxlength="500" style="min-height:4.5rem">${esc(t?.frente)}</textarea></label>
        <label class="campo"><span>Reverso (respuesta)</span>
          <textarea class="area-texto" name="reverso" required maxlength="1500" style="min-height:6rem">${esc(t?.reverso)}</textarea></label>`,
      alEnviar: async (f) => {
        if (t) await api.editarTarjeta(t.id, f);
        else await api.crearTarjeta(f);
        aviso(t ? 'Cambios guardados' : 'Tarjeta creada');
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
    if (e.target.closest('[data-generar]')) return abrirGenerar();
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
}

/* ---------- Modo repaso ---------- */
async function vistaRepaso(contenedor, parametros) {
  contenedor.innerHTML = esqueleto(6);
  let cola;
  try {
    ({ tarjetas: cola } = await api.tarjetas({ pendientes: true, ...(parametros.materiaId ? { materiaId: parametros.materiaId } : {}) }));
  } catch (error) {
    contenedor.innerHTML = errorCarga(error, false);
    return;
  }

  const total = cola.length;
  const resultado = { olvidado: 0, dificil: 0, facil: 0 };
  let volteada = false;
  let enviando = false;

  function pintarFin() {
    contenedor.innerHTML = `
      <div class="repaso">
        <section class="hoja">${vacio({
          icono: iconos.ok,
          titulo: total ? '¡Repaso terminado!' : 'No tienes tarjetas para hoy',
          texto: total
            ? `Fácil: ${resultado.facil} · Difícil: ${resultado.dificil} · No lo recordaste: ${resultado.olvidado}. Las tarjetas volverán cuando toque repasarlas.`
            : 'Vuelve mañana o genera tarjetas nuevas desde tus apuntes.',
          accion: '<a class="boton boton--primario" href="#/tarjetas">Volver a mis tarjetas</a>',
        })}</section>
      </div>`;
  }

  function pintar() {
    if (!cola.length) return pintarFin();
    const t = cola[0];
    const hechas = total - cola.length;
    volteada = false;
    contenedor.innerHTML = `
      <div class="repaso">
        <div class="encabezado-vista" style="margin-bottom:0">
          <div><a href="#/tarjetas" class="boton boton--fantasma" style="margin-left:-.8rem">${iconos.atras}Salir del repaso</a></div>
        </div>
        <div class="repaso__progreso">
          <div style="display:flex;justify-content:space-between"><span>${hechas} de ${total} repasadas</span><span>${esc(t.materia)}</span></div>
          <div class="avance" aria-hidden="true"><span style="--valor:${(hechas / total) * 100}%;--color:var(--tinta)"></span></div>
        </div>
        <div class="tarjeta-3d" style="--color:${colorSeguro(t.materiaColor)}">
          <div class="tarjeta-3d__interior">
            <div class="tarjeta-3d__cara" aria-hidden="false" data-cara="frente">
              <small>Pregunta</small>
              <p>${esc(t.frente)}</p>
            </div>
            <div class="tarjeta-3d__cara tarjeta-3d__reverso" aria-hidden="true" data-cara="reverso">
              <small>Respuesta</small>
              <p>${esc(t.reverso)}</p>
            </div>
          </div>
        </div>
        <div data-acciones>
          <button type="button" class="boton boton--primario boton--bloque" data-voltear>${iconos.voltear}Mostrar respuesta <small style="opacity:.75;font-weight:400">(espacio)</small></button>
        </div>
      </div>`;
  }

  function voltear() {
    if (volteada) return;
    volteada = true;
    const t = cola[0];
    contenedor.querySelector('.tarjeta-3d').classList.add('tarjeta-3d--volteada');
    contenedor.querySelector('[data-cara="frente"]').setAttribute('aria-hidden', 'true');
    contenedor.querySelector('[data-cara="reverso"]').setAttribute('aria-hidden', 'false');
    contenedor.querySelector('[data-acciones]').innerHTML = `
      <p style="text-align:center;font-size:var(--t-sm);color:var(--grafito-suave);margin-bottom:var(--e-2)">¿Qué tan bien lo recordaste?</p>
      <div class="calificar">
        ${CALIFICACIONES.map((c) => `
          <button type="button" class="boton ${c.clase}" data-calificar="${c.valor}">
            ${c.texto}<small>Volverá ${esc(cuando(t.proximosIntervalos[c.valor]))} · tecla ${c.tecla}</small>
          </button>`).join('')}
      </div>`;
    contenedor.querySelector('[data-calificar="facil"]').focus();
  }

  async function calificar(valor) {
    if (enviando || !volteada) return;
    enviando = true;
    const t = cola.shift();
    try {
      await api.repasarTarjeta(t.id, valor);
      resultado[valor] += 1;
      // Lo que no recordó vuelve al final de esta misma sesión
      if (valor === 'olvidado') cola.push({ ...t, proximosIntervalos: { olvidado: 0, dificil: 1, facil: 2 } });
    } catch (error) {
      cola.unshift(t);
      aviso(error.message, 'error');
    }
    enviando = false;
    pintar();
  }

  contenedor.addEventListener('click', (e) => {
    if (e.target.closest('[data-voltear]') || e.target.closest('.tarjeta-3d')) return voltear();
    const c = e.target.closest('[data-calificar]');
    if (c) calificar(c.dataset.calificar);
  });

  const teclas = (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === ' ' && !volteada) { e.preventDefault(); voltear(); }
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
