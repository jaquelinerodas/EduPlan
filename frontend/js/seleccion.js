/**
 * Selector de temas compartido por cuestionarios y planes de estudio.
 *  - Filtro por semestre o bloque
 *  - Casillas con los apuntes de la materia (todas marcadas al inicio)
 *  - Temas del examen (si se eligió un examen)
 *  - Resumen de lo que EduPlan le enviará a la IA (tareas, exámenes, temas débiles, tarjetas)
 */
import { api } from './api.js';
import { iconos } from './iconos.js';
import { esqueleto } from './ui.js';
import { esc, formato, plural, cuentaRegresiva } from './utilidades.js';

const SIN_PERIODO = 'ninguno';

function htmlApuntes(cx, seleccion) {
  if (!cx.apuntes.length) {
    return `<p class="acceso__ayuda">Esta materia aún no tiene apuntes.
      ${cx.examen ? 'Se usarán los temas del examen.' : '<a href="#/apuntes">Escribe uno</a> para obtener mejores resultados.'}</p>`;
  }
  const marcado = (id) => (seleccion ? seleccion.has(id) : true);
  const periodos = cx.periodos;
  const haySinPeriodo = cx.apuntes.some((a) => !a.periodoId);
  return `
    ${periodos.length ? `
      <div class="filtro-periodo" role="group" aria-label="Filtrar por semestre o bloque">
        <button type="button" class="chip" data-periodo="" aria-pressed="true">Todos</button>
        ${periodos.map((p) => `<button type="button" class="chip" data-periodo="${esc(p.id)}" aria-pressed="false">${esc(p.nombre)}</button>`).join('')}
        ${haySinPeriodo ? `<button type="button" class="chip" data-periodo="${SIN_PERIODO}" aria-pressed="false">Sin semestre</button>` : ''}
      </div>` : ''}
    <div class="lista-seleccion lista-seleccion--temas" data-lista-apuntes>
      ${cx.apuntes.map((a) => `
        <label data-periodo-apunte="${esc(a.periodoId || SIN_PERIODO)}">
          <input type="checkbox" name="apunteIds" value="${esc(a.id)}"${marcado(a.id) ? ' checked' : ''}>
          <span class="tema-apunte">
            <span>${esc(a.titulo)}</span>
            ${a.recomendado ? '<span class="insignia insignia--rojo">Para reforzar</span>' : ''}
          </span>
          <small>${a.periodo ? esc(a.periodo) : 'Sin semestre'} · editado ${esc(formato.fechaCorta(a.actualizadoEn))}</small>
        </label>`).join('')}
    </div>
    <div class="seleccion-pie">
      <span data-cuenta></span>
      <span>
        <button type="button" class="enlace" data-todos="1">Elegir todos</button> ·
        <button type="button" class="enlace" data-todos="0">Ninguno</button>
      </span>
    </div>`;
}

function htmlTemasExamen(examen) {
  if (!examen?.temas.length) return '';
  return `
    <div class="campo">
      <span>Temas del examen que entran</span>
      <div class="chips-check">
        ${examen.temas.map((t) => `<label><input type="checkbox" name="temas" value="${esc(t)}" checked><span>${esc(t)}</span></label>`).join('')}
      </div>
    </div>`;
}

/** Lo que la IA tomará en cuenta (para que el estudiante sepa por qué el resultado es personalizado). */
export function resumenContexto(cx, { apuntesElegidos, temasElegidos } = {}) {
  const filas = [];
  if (apuntesElegidos !== undefined) filas.push([iconos.apuntes, plural(apuntesElegidos, 'apunte elegido', 'apuntes elegidos')]);
  if (temasElegidos?.length) filas.push([iconos.objetivo, `Temas: ${temasElegidos.join(', ')}`]);
  if (cx.tareasPendientes.length) {
    const t = cx.tareasPendientes[0];
    filas.push([iconos.tareas, `${plural(cx.tareasPendientes.length, 'tarea pendiente', 'tareas pendientes')} · la más próxima: ${t.titulo} (${cuentaRegresiva(t.fechaLimite)})`]);
  }
  const examenes = cx.examenesProximos.filter((e) => e.id !== cx.examen?.id);
  if (cx.examen) filas.push([iconos.examen, `${cx.examen.titulo}: ${formato.fechaHora(cx.examen.fecha)} (${cuentaRegresiva(cx.examen.fecha)})`]);
  if (examenes.length) filas.push([iconos.examen, `${plural(examenes.length, 'examen próximo', 'exámenes próximos')}: ${examenes.map((e) => e.titulo).join(', ')}`]);
  if (cx.temasDebiles.length) filas.push([iconos.alerta, `Temas débiles en tus cuestionarios: ${cx.temasDebiles.slice(0, 5).map((t) => t.tema).join(', ')}`]);
  if (cx.tarjetasPendientes) filas.push([iconos.tarjetas, `${plural(cx.tarjetasPendientes, 'tarjeta', 'tarjetas')} de memoria por repasar`]);
  if (!filas.length) return '';
  return `
    <div class="contexto-ia">
      <p class="contexto-ia__titulo">${iconos.chispa}EduPlan tomará en cuenta</p>
      <ul>${filas.map(([icono, texto]) => `<li>${icono}<span>${esc(texto)}</span></li>`).join('')}</ul>
    </div>`;
}

/**
 * Carga el contexto de una materia o examen y pinta el selector dentro de "zona".
 * Devuelve un objeto para leer la selección: { contexto, apunteIds(), temas(), periodoId() }.
 */
export async function montarSelectorTemas(zona, filtro, { seleccion = null, conResumen = true, alCambiar } = {}) {
  zona.innerHTML = esqueleto(3);
  const { contexto: cx } = await api.contexto(filtro);
  let periodo = '';

  zona.innerHTML = `
    ${htmlTemasExamen(cx.examen)}
    <div class="campo">
      <span>${cx.examen ? 'Apuntes de la materia' : 'Temas de tus apuntes'}</span>
      ${htmlApuntes(cx, seleccion ? new Set(seleccion) : null)}
    </div>
    ${conResumen ? '<div data-resumen-contexto></div>' : ''}`;

  const casillas = () => [...zona.querySelectorAll('[name="apunteIds"]')];
  const visibles = () => casillas().filter((c) => !c.closest('label').hidden);

  const api_ = {
    contexto: cx,
    apunteIds: () => visibles().filter((c) => c.checked).map((c) => c.value),
    temas: () => [...zona.querySelectorAll('[name="temas"]:checked')].map((c) => c.value),
    periodoId: () => (periodo && periodo !== SIN_PERIODO ? periodo : undefined),
    /**
     * Campos para la API. Si eligió todos los apuntes no se envía la lista
     * (el servidor toma los más recientes); si filtró por semestre, se envía el semestre.
     */
    cuerpo: () => {
      const ids = api_.apunteIds();
      const total = visibles().length;
      if (cx.apuntes.length && !ids.length) throw new Error('Elige al menos un apunte.');
      const temasTotal = zona.querySelectorAll('[name="temas"]').length;
      const temas = api_.temas();
      if (temasTotal && !temas.length) throw new Error('Elige al menos un tema del examen.');
      const datos = {};
      if (temasTotal && temas.length < temasTotal) datos.temas = temas;
      if (ids.length === total && periodo !== SIN_PERIODO) {
        if (periodo) datos.periodoId = periodo;
        return datos;
      }
      if (ids.length > 15) throw new Error('Puedes elegir hasta 15 apuntes a la vez.');
      if (ids.length) datos.apunteIds = ids;
      if (api_.periodoId()) datos.periodoId = api_.periodoId();
      return datos;
    },
  };

  function actualizar() {
    const cuenta = zona.querySelector('[data-cuenta]');
    const elegidos = api_.apunteIds().length;
    if (cuenta) cuenta.textContent = `${elegidos} de ${visibles().length} elegidos`;
    const resumen = zona.querySelector('[data-resumen-contexto]');
    if (resumen) resumen.innerHTML = resumenContexto(cx, { apuntesElegidos: cx.apuntes.length ? elegidos : undefined, temasElegidos: cx.examen ? api_.temas() : undefined });
    alCambiar?.(api_);
  }

  zona.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-periodo]');
    if (chip) {
      periodo = chip.dataset.periodo;
      zona.querySelectorAll('[data-periodo]').forEach((b) => b.setAttribute('aria-pressed', String(b === chip)));
      zona.querySelectorAll('[data-periodo-apunte]').forEach((l) => {
        l.hidden = Boolean(periodo) && l.dataset.periodoApunte !== periodo;
      });
      actualizar();
      return;
    }
    const todos = e.target.closest('[data-todos]');
    if (todos) {
      visibles().forEach((c) => { c.checked = todos.dataset.todos === '1'; });
      actualizar();
    }
  });
  zona.addEventListener('change', actualizar);
  actualizar();
  return api_;
}
