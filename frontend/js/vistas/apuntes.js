/**
 * Apuntes (RF05, HU06) organizados por semestre, bloque o carpeta, con
 * favoritos, etiquetas y vistas rápidas (recientes, favoritos, por repasar).
 * Cada apunte se puede leer con formato, editar, resumir con IA (RF07) y
 * convertir en cuestionario o tarjetas de memoria.
 */
import { api } from '../api.js';
import { obtenerMaterias, obtenerPeriodos, invalidarPeriodos, invalidarMaterias, TIPOS_PERIODO } from '../datos.js';
import { iconos } from '../iconos.js';
import { markdownAHtml } from '../markdown.js';
import { aviso, abrirFormulario, confirmar, conCarga, esqueleto, errorCarga, vacio, mostrarError } from '../ui.js';
import { esc, colorSeguro, formato, plural, debounce } from '../utilidades.js';
import { campoPeriodo, conectarCampoPeriodo, resolverPeriodo } from './materias.js';

const SIN_PERIODO = 'ninguno';
const VISTAS = [
  ['semestres', 'Por semestre'],
  ['todos', 'Todos'],
  ['recientes', 'Recientes'],
  ['favoritos', 'Favoritos'],
  ['repasar', 'Por repasar'],
];

const porRepasar = (a) => a.tarjetasPendientes > 0 || a.recomendado;
const normalizar = (t) => String(t || '').toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

export async function renderApuntes(contenedor, parametros) {
  let materias = [];
  let periodos = [];
  let apuntes = [];
  let actual = null;          // apunte abierto o { nuevo: true }
  let editando = false;
  let cambiosSinGuardar = false;
  const estado = {
    vista: 'semestres',
    periodoId: '',            // '' = todos, uuid o SIN_PERIODO
    materiaId: parametros.materiaId || '',
    etiqueta: '',
    buscar: '',
    cerrados: new Set(),
  };

  contenedor.innerHTML = esqueleto(8);
  try {
    [materias, periodos, { apuntes }] = await Promise.all([
      obtenerMaterias({ forzar: true }), obtenerPeriodos({ forzar: true }), api.apuntes(),
    ]);
  } catch (error) {
    contenedor.innerHTML = errorCarga(error, false);
    return;
  }

  if (!materias.length) {
    contenedor.innerHTML = `
      <div class="encabezado-vista"><div><h1>Apuntes</h1></div></div>
      <section class="hoja">${vacio({
        icono: iconos.apuntes,
        titulo: 'Primero registra una materia',
        texto: 'Los apuntes se guardan dentro de una materia.',
        accion: '<a class="boton boton--primario" href="#/materias">Agregar materia</a>',
      })}</section>`;
    return;
  }

  contenedor.innerHTML = `
    <div class="apuntes2" data-modo="lista">
      <aside class="hoja organizador" aria-label="Organización de apuntes">
        <div class="organizador__cabeza">
          <h2>Organización</h2>
          <button type="button" class="boton boton--icono" data-nueva-carpeta aria-label="Nuevo semestre, bloque o carpeta" title="Nuevo semestre, bloque o carpeta">${iconos.carpetaMas}</button>
        </div>
        <div class="organizador__vistas" role="tablist" aria-label="Vistas" data-vistas></div>
        <label class="buscador">${iconos.buscar}<span class="solo-lectores">Buscar</span>
          <input type="search" name="buscar" placeholder="Buscar apuntes o etiquetas…"></label>
        <nav class="arbol" data-arbol aria-label="Semestres y materias"></nav>
        <div class="organizador__lista">
          <div class="organizador__subtitulo">
            <h3 data-titulo-lista>Apuntes</h3>
            <button type="button" class="boton boton--icono" data-nuevo aria-label="Nuevo apunte">${iconos.mas}</button>
          </div>
          <ul class="notas" data-items></ul>
        </div>
      </aside>

      <div class="apuntes2__principal">
        <div class="apuntes2__cabeza">
          <div>
            <nav class="migas" aria-label="Ubicación" data-migas></nav>
            <h1>Apuntes</h1>
            <p>Organiza tus notas por semestre, materia y tema.</p>
          </div>
          <div class="apuntes2__lado">
            <dl class="estadisticas" data-estadisticas></dl>
            <div class="apuntes2__botones">
              <button type="button" class="boton boton--primario" data-nuevo>${iconos.mas}Nuevo apunte</button>
              <button type="button" class="boton boton--secundario" data-nueva-carpeta>${iconos.carpeta}Nueva carpeta</button>
              <div class="desplegable">
                <button type="button" class="boton boton--secundario" data-abrir-filtro aria-expanded="false">${iconos.filtro}Etiquetas${iconos.abajo}</button>
                <div class="desplegable__menu" data-menu-filtro hidden></div>
              </div>
            </div>
          </div>
        </div>
        <div data-filtros-activos></div>
        <section class="hoja nota" data-detalle aria-live="polite"></section>
      </div>
    </div>`;

  const raiz = contenedor.querySelector('.apuntes2');
  const zonaVistas = contenedor.querySelector('[data-vistas]');
  const arbol = contenedor.querySelector('[data-arbol]');
  const listaItems = contenedor.querySelector('[data-items]');
  const detalle = contenedor.querySelector('[data-detalle]');

  const materia = (id) => materias.find((m) => m.id === id);
  const periodo = (id) => periodos.find((p) => p.id === id);
  const opciones = (lista, elegido, campo = 'nombre') => lista
    .map((x) => `<option value="${esc(x.id)}"${x.id === elegido ? ' selected' : ''}>${esc(x[campo])}</option>`).join('');

  /* ---------- Filtros ---------- */
  function filtrados() {
    let lista = apuntes;
    if (estado.vista === 'favoritos') lista = lista.filter((a) => a.favorito);
    if (estado.vista === 'repasar') lista = lista.filter(porRepasar);
    if (estado.vista === 'semestres') {
      if (estado.periodoId === SIN_PERIODO) lista = lista.filter((a) => !a.periodoId);
      else if (estado.periodoId) lista = lista.filter((a) => a.periodoId === estado.periodoId);
      if (estado.materiaId) lista = lista.filter((a) => a.materiaId === estado.materiaId);
    }
    if (estado.etiqueta) lista = lista.filter((a) => a.etiquetas.some((e) => normalizar(e) === normalizar(estado.etiqueta)));
    if (estado.buscar) {
      const q = normalizar(estado.buscar);
      lista = lista.filter((a) => normalizar(a.titulo).includes(q) || normalizar(a.contenido).includes(q)
        || a.etiquetas.some((e) => normalizar(e).includes(q)));
    }
    lista = [...lista].sort((x, y) => new Date(y.actualizadoEn) - new Date(x.actualizadoEn));
    return estado.vista === 'recientes' ? lista.slice(0, 10) : lista;
  }

  /* ---------- Pintar ---------- */
  function pintarVistas() {
    const cuenta = { favoritos: apuntes.filter((a) => a.favorito).length, repasar: apuntes.filter(porRepasar).length, todos: apuntes.length };
    zonaVistas.innerHTML = VISTAS.map(([k, v]) => `
      <button type="button" role="tab" class="pestana" data-vista="${k}" aria-selected="${estado.vista === k}">
        ${k === 'favoritos' ? iconos.estrella : k === 'recientes' ? iconos.reciente : k === 'repasar' ? iconos.reorganizar : ''}${v}
        ${cuenta[k] !== undefined ? `<span class="pestana__cuenta">${cuenta[k]}</span>` : ''}
      </button>`).join('');
  }

  /** Árbol: semestre → materias (con contador). Incluye materias asignadas al semestre aunque no tengan apuntes. */
  function pintarArbol() {
    arbol.hidden = estado.vista !== 'semestres';
    if (arbol.hidden) return;
    const grupos = [...periodos.map((p) => ({ id: p.id, nombre: p.nombre, tipo: p.tipo })), { id: SIN_PERIODO, nombre: 'Sin semestre', tipo: 'carpeta' }]
      .map((g) => {
        const delGrupo = apuntes.filter((a) => (g.id === SIN_PERIODO ? !a.periodoId : a.periodoId === g.id));
        const ids = new Set(delGrupo.map((a) => a.materiaId));
        if (g.id !== SIN_PERIODO) materias.filter((m) => m.periodoId === g.id).forEach((m) => ids.add(m.id));
        const lista = [...ids].map((id) => ({ m: materia(id), total: delGrupo.filter((a) => a.materiaId === id).length }))
          .filter((x) => x.m).sort((x, y) => x.m.nombre.localeCompare(y.m.nombre));
        return { ...g, total: delGrupo.length, materias: lista };
      })
      .filter((g) => g.id !== SIN_PERIODO || g.total);

    arbol.innerHTML = `
      <button type="button" class="arbol__todos" data-periodo="" aria-current="${!estado.periodoId && !estado.materiaId}">${iconos.libro}Todos los apuntes<span class="contador">${apuntes.length}</span></button>
      ${grupos.map((g) => {
        const abierto = !estado.cerrados.has(g.id);
        const elegido = estado.periodoId === g.id && !estado.materiaId;
        return `
        <div class="arbol__grupo">
          <div class="arbol__fila${elegido ? ' arbol__fila--activa' : ''}">
            <button type="button" class="arbol__flecha" data-plegar="${esc(g.id)}" aria-expanded="${abierto}" aria-label="${abierto ? 'Contraer' : 'Expandir'} ${esc(g.nombre)}">${iconos.abajo}</button>
            <button type="button" class="arbol__nombre" data-periodo="${esc(g.id)}">${esc(g.nombre)}</button>
            <span class="contador">${g.total}</span>
            ${g.id === SIN_PERIODO ? '' : `<button type="button" class="arbol__menu" data-editar-periodo="${esc(g.id)}" aria-label="Opciones de ${esc(g.nombre)}">${iconos.editar}</button>`}
          </div>
          <ul ${abierto ? '' : 'hidden'}>
            ${g.materias.length ? g.materias.map(({ m, total }) => `
              <li><button type="button" class="arbol__materia" data-periodo="${esc(g.id)}" data-materia="${esc(m.id)}"
                  aria-current="${estado.periodoId === g.id && estado.materiaId === m.id}" style="--color:${colorSeguro(m.color)}">
                <span class="punto"></span><span>${esc(m.nombre)}</span><span class="contador">${total}</span></button></li>`).join('')
              : '<li class="arbol__vacio">Sin materias todavía</li>'}
          </ul>
        </div>`;
      }).join('')}
      ${!periodos.length ? `<p class="arbol__ayuda">Crea semestres o bloques con ${iconos.carpetaMas.replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"')} para agrupar tus apuntes.</p>` : ''}`;
  }

  function pintarLista() {
    const lista = filtrados();
    const titulo = contenedor.querySelector('[data-titulo-lista]');
    titulo.textContent = estado.vista === 'recientes' ? 'Editados recientemente'
      : estado.vista === 'favoritos' ? 'Tus favoritos'
        : estado.vista === 'repasar' ? 'Pendientes de repasar'
          : estado.materiaId ? `Apuntes de ${materia(estado.materiaId)?.nombre || 'la materia'}`
            : estado.periodoId === SIN_PERIODO ? 'Apuntes sin semestre'
              : estado.periodoId ? `Apuntes de ${periodo(estado.periodoId)?.nombre || ''}` : 'Todos los apuntes';
    listaItems.innerHTML = lista.length
      ? lista.map((a) => `
        <li><button type="button" class="nota-item" data-abrir="${esc(a.id)}" aria-current="${actual?.id === a.id}">
          <span class="nota-item__icono" style="--color:${colorSeguro(a.materiaColor)}">${iconos.apuntes}</span>
          <span class="nota-item__texto">
            <b>${esc(a.titulo)}</b>
            <small>${estado.materiaId ? '' : `${esc(a.materia)} · `}${esc(formato.fechaCorta(a.actualizadoEn))}</small>
          </span>
          <span class="nota-item__marcas">
            ${a.favorito ? `<span class="marca-favorito" title="Favorito">${iconos.estrellaLlena}</span>` : ''}
            ${porRepasar(a) ? `<span class="insignia insignia--ambar" title="${a.tarjetasPendientes ? `${a.tarjetasPendientes} tarjetas por repasar` : 'Recomendado por tus cuestionarios'}">Repasar</span>` : ''}
          </span>
        </button></li>`).join('')
      : `<li class="notas__vacio">${estado.buscar || estado.etiqueta ? 'Ningún apunte coincide.'
        : estado.vista === 'favoritos' ? `Marca un apunte con ${iconos.estrella.replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"')} para verlo aquí.`
          : estado.vista === 'repasar' ? '¡Nada pendiente! Aquí aparecen los apuntes con tarjetas por repasar o que fallaste en un cuestionario.'
            : 'Aún no hay apuntes aquí.'}</li>`;
  }

  function pintarCabecera() {
    const conIa = apuntes.filter((a) => a.resumenIa).length;
    const materiasConApuntes = new Set(apuntes.map((a) => a.materiaId)).size;
    contenedor.querySelector('[data-estadisticas]').innerHTML = [
      [iconos.apuntes, apuntes.length, apuntes.length === 1 ? 'apunte' : 'apuntes'],
      [iconos.materias, materiasConApuntes, materiasConApuntes === 1 ? 'materia' : 'materias'],
      [iconos.examen, periodos.length, periodos.length === 1 ? 'semestre o bloque' : 'semestres y bloques'],
      [iconos.chispa, conIa, 'con resumen IA'],
    ].map(([icono, n, texto]) => `<div>${icono}<dt>${esc(texto)}</dt><dd>${n}</dd></div>`).join('');

    // Migas: Apuntes > Semestre > Materia > Apunte
    const partes = ['Apuntes'];
    const a = actual && !actual.nuevo ? actual : null;
    const p = a ? (a.periodoId ? periodo(a.periodoId)?.nombre : null) : estado.periodoId === SIN_PERIODO ? 'Sin semestre' : periodo(estado.periodoId)?.nombre;
    const m = a ? a.materia : materia(estado.materiaId)?.nombre;
    if (p) partes.push(p);
    if (m) partes.push(m);
    if (a) partes.push(a.titulo);
    contenedor.querySelector('[data-migas]').innerHTML = partes
      .map((t, i) => `<span${i === partes.length - 1 ? ' aria-current="page"' : ''}>${esc(t)}</span>`).join(iconos.adelante);

    // Etiquetas disponibles y filtro activo
    const conteo = new Map();
    for (const ap of apuntes) for (const e of ap.etiquetas) conteo.set(e.toLowerCase(), (conteo.get(e.toLowerCase()) || 0) + 1);
    contenedor.querySelector('[data-menu-filtro]').innerHTML = conteo.size
      ? [...conteo].sort((x, y) => y[1] - x[1]).map(([e, n]) => `
          <button type="button" data-etiqueta="${esc(e)}" aria-pressed="${normalizar(e) === normalizar(estado.etiqueta)}">${iconos.etiqueta}${esc(e)}<span class="contador">${n}</span></button>`).join('')
      : '<p>Aún no tienes etiquetas. Agrégalas al editar un apunte.</p>';
    contenedor.querySelector('[data-filtros-activos]').innerHTML = estado.etiqueta
      ? `<p class="filtros-activos">Filtrando por <button type="button" class="chip chip--activo" data-quitar-etiqueta>${iconos.etiqueta}${esc(estado.etiqueta)} ${iconos.cerrar}</button></p>` : '';
  }

  function etiquetasHtml(a) {
    return a.etiquetas.map((e) => `<button type="button" class="chip" data-etiqueta="${esc(e)}">#${esc(e)}</button>`).join('');
  }

  function pintarDetalle() {
    pintarCabecera();
    if (!actual) {
      detalle.innerHTML = vacio({
        icono: iconos.apuntes,
        titulo: apuntes.length ? 'Elige un apunte' : 'Escribe tu primer apunte',
        texto: apuntes.length ? 'Ábrelo para leerlo, editarlo o estudiarlo con el asistente.' : 'Guarda lo que vas aprendiendo en cada materia.',
        accion: `<button type="button" class="boton boton--primario" data-nuevo>${iconos.mas}Nuevo apunte</button>`,
      });
      return;
    }
    const a = actual;
    if (editando) {
      const materiaId = a.materiaId || estado.materiaId || materias[0].id;
      const periodoId = a.nuevo ? (estado.periodoId && estado.periodoId !== SIN_PERIODO ? estado.periodoId : materia(materiaId)?.periodoId) : a.periodoId;
      detalle.innerHTML = `
        <form class="nota__cuerpo editor" novalidate>
          <button type="button" class="boton boton--fantasma volver-movil" data-volver>${iconos.atras}Todos los apuntes</button>
          <div class="formulario__error" role="alert" hidden></div>
          <label class="campo"><span class="solo-lectores">Título</span>
            <input class="editor__titulo" name="titulo" maxlength="200" required value="${esc(a.titulo)}" placeholder="Título del apunte"></label>
          <div class="formulario__fila editor__meta">
            <label class="campo"><span>Materia</span>
              <select class="selector" name="materiaId" required>${opciones(materias, materiaId)}</select></label>
            ${campoPeriodo(periodos, periodoId)}
          </div>
          <label class="campo"><span>Etiquetas <span class="opcional">(separadas por coma, máximo 10)</span></span>
            <input class="entrada" name="etiquetas" maxlength="300" value="${esc(a.etiquetas?.join(', ') || '')}" placeholder="Ej. parcial 2, sql"></label>
          <label class="campo"><span class="solo-lectores">Contenido</span>
            <textarea class="area-texto editor__contenido" name="contenido" maxlength="50000" required placeholder="Escribe aquí tus apuntes…&#10;&#10;Consejo: una línea en MAYÚSCULAS se muestra como título y el código va entre líneas con \`\`\`">${esc(a.contenido)}</textarea></label>
          <div class="editor__barra">
            <div class="editor__acciones">
              <button type="submit" class="boton boton--primario">${iconos.guardar}${a.nuevo ? 'Guardar apunte' : 'Guardar cambios'}</button>
              <button type="button" class="boton boton--fantasma" data-cancelar>Cancelar</button>
            </div>
          </div>
        </form>`;
      conectarCampoPeriodo(detalle.querySelector('form'));
      cambiosSinGuardar = false;
      return;
    }

    detalle.innerHTML = `
      <div class="nota__cuerpo">
        <button type="button" class="boton boton--fantasma volver-movil" data-volver>${iconos.atras}Todos los apuntes</button>
        <div class="nota__cabeza">
          <h2>${esc(a.titulo)}</h2>
          <div class="nota__herramientas">
            <small>Última edición: ${esc(formato.fechaHora(a.actualizadoEn))}</small>
            <button type="button" class="boton boton--icono${a.favorito ? ' es-favorito' : ''}" data-favorito aria-pressed="${a.favorito}"
              aria-label="${a.favorito ? 'Quitar de favoritos' : 'Marcar como favorito'}" title="${a.favorito ? 'Quitar de favoritos' : 'Marcar como favorito'}">${a.favorito ? iconos.estrellaLlena : iconos.estrella}</button>
            <button type="button" class="boton boton--icono" data-editar aria-label="Editar apunte" title="Editar">${iconos.editar}</button>
            <button type="button" class="boton boton--icono peligro" data-borrar aria-label="Eliminar apunte" title="Eliminar">${iconos.borrar}</button>
          </div>
        </div>
        <div class="nota__chips">
          <span class="chip chip--materia" style="--color:${colorSeguro(a.materiaColor)}"><span class="punto"></span>${esc(a.materia)}</span>
          <span class="chip">${iconos.examen}${esc(a.periodo || 'Sin semestre')}</span>
          ${a.resumenIa ? `<a class="chip" href="#resumen-apunte" data-ir-resumen>${iconos.chispa}Resumen IA</a>` : ''}
          ${a.tarjetasPendientes ? `<a class="chip chip--ambar" href="#/tarjetas?repaso=1&apunteId=${esc(a.id)}">${iconos.tarjetas}${plural(a.tarjetasPendientes, 'tarjeta', 'tarjetas')} por repasar</a>` : ''}
          ${a.recomendado ? '<span class="chip chip--rojo" title="Fallaste preguntas de este apunte en tu último cuestionario">Recomendado para reforzar</span>' : ''}
          ${etiquetasHtml(a)}
        </div>
        <article class="lectura texto-ia">${markdownAHtml(a.contenido, { titulosEnMayusculas: true })}</article>
        <div data-resumen id="resumen-apunte">
          ${a.resumenIa ? `
            <div class="resumen-ia">
              <div class="resumen-ia__cabeza">
                <h3>Resumen</h3>
                <span class="firma-ia">${iconos.chispa}Generado por IA · ${esc(formato.fechaHora(a.resumenGeneradoEn))}</span>
              </div>
              <div class="texto-ia">${markdownAHtml(a.resumenIa)}</div>
            </div>` : ''}
        </div>
        <div class="formulario__error" role="alert" hidden></div>
        <div class="nota__acciones">
          <button type="button" class="boton boton--primario" data-editar>${iconos.editar}Editar</button>
          <button type="button" class="boton boton--ia" data-resumir>${iconos.chispa}${a.resumenIa ? 'Volver a resumir' : 'Resumir con IA'}</button>
          <a class="boton boton--secundario" href="#/cuestionarios?nuevo=apuntes&apunteIds=${esc(a.id)}">${iconos.cuestionario}Generar cuestionario</a>
          <a class="boton boton--secundario" href="#/tarjetas?generar=1&apunteId=${esc(a.id)}">${iconos.tarjetas}Crear tarjetas</a>
        </div>
      </div>`;
  }

  function pintarTodo() {
    pintarVistas();
    pintarArbol();
    pintarLista();
    pintarDetalle();
  }

  /* ---------- Acciones ---------- */
  async function recargar() {
    [{ apuntes }, periodos] = await Promise.all([api.apuntes(), obtenerPeriodos({ forzar: true })]);
    if (actual && !actual.nuevo) actual = apuntes.find((x) => x.id === actual.id) || null;
    pintarTodo();
  }

  async function descartarCambios() {
    if (!editando || !cambiosSinGuardar) return true;
    return confirmar({ titulo: 'Cambios sin guardar', mensaje: 'Si sales de la edición perderás lo que no has guardado.', textoConfirmar: 'Descartar cambios' });
  }

  async function abrir(id) {
    if (!(await descartarCambios())) return;
    actual = apuntes.find((a) => a.id === id) || null;
    editando = false;
    pintarLista();
    pintarDetalle();
    raiz.dataset.modo = 'detalle';
    if (!window.matchMedia('(min-width: 1101px)').matches) window.scrollTo(0, 0);
  }

  async function guardar(formulario) {
    const f = Object.fromEntries(new FormData(formulario));
    const datos = {
      titulo: f.titulo,
      materiaId: f.materiaId,
      contenido: f.contenido,
      periodoId: await resolverPeriodo(f),
      etiquetas: f.etiquetas.split(',').map((e) => e.trim()).filter(Boolean),
    };
    const { apunte } = actual.nuevo ? await api.crearApunte(datos) : await api.editarApunte(actual.id, datos);
    if (f.periodoId === '__nuevo__') periodos = await obtenerPeriodos({ forzar: true });
    actual = apunte;
    cambiosSinGuardar = false;
    return apunte;
  }

  function abrirCarpeta(p) {
    abrirFormulario({
      titulo: p ? `Editar ${TIPOS_PERIODO[p.tipo].toLowerCase()}` : 'Nuevo semestre, bloque o carpeta',
      textoEnviar: p ? 'Guardar cambios' : 'Crear',
      contenido: `
        <label class="campo"><span>Nombre</span>
          <input class="entrada" name="nombre" required maxlength="80" value="${esc(p?.nombre)}" placeholder="Ej. Semestre 3, Bloque 2 o Proyecto final"></label>
        <fieldset class="campo" style="border:0;padding:0;margin:0">
          <legend>Tipo</legend>
          <div class="segmentos segmentos--bloque" style="margin-top:6px">
            ${Object.entries(TIPOS_PERIODO).map(([k, v]) => `<label><input type="radio" name="tipo" value="${k}"${k === (p?.tipo || 'semestre') ? ' checked' : ''}><span>${v}</span></label>`).join('')}
          </div>
        </fieldset>
        <p class="acceso__ayuda">Asigna materias a un semestre desde Materias, y apuntes desde el editor de cada apunte.</p>
        ${p ? `<button type="button" class="boton boton--fantasma" data-borrar-periodo style="color:var(--rojo);justify-self:start">${iconos.borrar}Eliminar ${esc(TIPOS_PERIODO[p.tipo].toLowerCase())}</button>` : ''}`,
      alAbrir: (form) => {
        form.querySelector('[data-borrar-periodo]')?.addEventListener('click', async () => {
          form.closest('dialog').close();
          const ok = await confirmar({
            titulo: `Eliminar «${p.nombre}»`,
            mensaje: `Sus ${plural(p.totalApuntes, 'apunte', 'apuntes')} y ${plural(p.totalMaterias, 'materia', 'materias')} NO se borran: quedarán "sin semestre".`,
          });
          if (!ok) return;
          try {
            await api.borrarPeriodo(p.id);
            invalidarPeriodos();
            invalidarMaterias();
            materias = await obtenerMaterias({ forzar: true });
            if (estado.periodoId === p.id) Object.assign(estado, { periodoId: '', materiaId: '' });
            aviso('Eliminado');
            await recargar();
          } catch (error) {
            aviso(error.message, 'error');
          }
        });
      },
      alEnviar: async (f) => {
        if (p) await api.editarPeriodo(p.id, { nombre: f.nombre, tipo: f.tipo });
        else await api.crearPeriodo({ nombre: f.nombre, tipo: f.tipo });
        invalidarPeriodos();
        aviso(p ? 'Cambios guardados' : `${TIPOS_PERIODO[f.tipo]} creado`);
        await recargar();
      },
    });
  }

  /* ---------- Eventos ---------- */
  const buscar = debounce((texto) => { estado.buscar = texto.trim(); pintarLista(); }, 200);
  contenedor.querySelector('[name="buscar"]').addEventListener('input', (e) => buscar(e.target.value));

  detalle.addEventListener('input', () => { if (editando) cambiosSinGuardar = true; });

  detalle.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formulario = e.target;
    const cajaError = formulario.querySelector('.formulario__error');
    cajaError.hidden = true;
    const eraNuevo = actual.nuevo;
    try {
      await conCarga(formulario.querySelector('[type="submit"]'), () => guardar(formulario));
      aviso(eraNuevo ? 'Apunte guardado' : 'Cambios guardados');
      editando = false;
      await recargar();
    } catch (error) {
      mostrarError(cajaError, error);
    }
  });

  document.addEventListener('click', cerrarMenuFuera);
  function cerrarMenuFuera(e) {
    if (!e.target.closest('.desplegable')) {
      const menu = contenedor.querySelector('[data-menu-filtro]');
      if (menu && !menu.hidden) {
        menu.hidden = true;
        contenedor.querySelector('[data-abrir-filtro]').setAttribute('aria-expanded', 'false');
      }
    }
  }

  contenedor.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('[data-nuevo]')) {
      if (!(await descartarCambios())) return;
      actual = { nuevo: true, titulo: '', contenido: '', materiaId: estado.materiaId, etiquetas: [] };
      editando = true;
      pintarLista();
      pintarDetalle();
      raiz.dataset.modo = 'detalle';
      detalle.querySelector('[name="titulo"]').focus();
      return;
    }
    if (t.closest('[data-nueva-carpeta]')) return abrirCarpeta();
    const editarPeriodo = t.closest('[data-editar-periodo]');
    if (editarPeriodo) return abrirCarpeta(periodo(editarPeriodo.dataset.editarPeriodo));

    const vista = t.closest('[data-vista]');
    if (vista) {
      estado.vista = vista.dataset.vista;
      if (estado.vista !== 'semestres') Object.assign(estado, { periodoId: '', materiaId: '' });
      pintarVistas();
      pintarArbol();
      pintarLista();
      pintarCabecera();
      return;
    }
    const plegar = t.closest('[data-plegar]');
    if (plegar) {
      const id = plegar.dataset.plegar;
      if (estado.cerrados.has(id)) estado.cerrados.delete(id); else estado.cerrados.add(id);
      return pintarArbol();
    }
    const nodo = t.closest('[data-periodo]');
    if (nodo && nodo.closest('[data-arbol]')) {
      estado.periodoId = nodo.dataset.periodo;
      estado.materiaId = nodo.dataset.materia || '';
      pintarArbol();
      pintarLista();
      pintarCabecera();
      return;
    }

    const abrirFiltro = t.closest('[data-abrir-filtro]');
    if (abrirFiltro) {
      const menu = contenedor.querySelector('[data-menu-filtro]');
      menu.hidden = !menu.hidden;
      abrirFiltro.setAttribute('aria-expanded', String(!menu.hidden));
      return;
    }
    const etiqueta = t.closest('[data-etiqueta]');
    if (etiqueta) {
      estado.etiqueta = normalizar(estado.etiqueta) === normalizar(etiqueta.dataset.etiqueta) ? '' : etiqueta.dataset.etiqueta;
      contenedor.querySelector('[data-menu-filtro]').hidden = true;
      pintarLista();
      pintarCabecera();
      return;
    }
    if (t.closest('[data-quitar-etiqueta]')) {
      estado.etiqueta = '';
      pintarLista();
      pintarCabecera();
      return;
    }

    const abrirBtn = t.closest('[data-abrir]');
    if (abrirBtn) return abrir(abrirBtn.dataset.abrir);
    if (t.closest('[data-volver]')) {
      if (!(await descartarCambios())) return;
      raiz.dataset.modo = 'lista';
      if (actual?.nuevo) actual = null;
      editando = false;
      return;
    }
    if (t.closest('[data-reintentar]')) return recargar();
    if (t.closest('[data-editar]')) {
      editando = true;
      pintarDetalle();
      detalle.querySelector('[name="contenido"]').focus();
      return;
    }
    if (t.closest('[data-cancelar]')) {
      if (!(await descartarCambios())) return;
      editando = false;
      if (actual.nuevo) actual = null;
      pintarDetalle();
      return;
    }
    if (t.closest('[data-ir-resumen]')) {
      e.preventDefault();
      detalle.querySelector('#resumen-apunte')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const copiar = t.closest('[data-copiar]');
    if (copiar) {
      const codigo = copiar.closest('.codigo').querySelector('code').innerText;
      try {
        await navigator.clipboard.writeText(codigo);
        copiar.textContent = 'Copiado';
        setTimeout(() => { copiar.textContent = 'Copiar'; }, 1500);
      } catch {
        aviso('No se pudo copiar', 'error');
      }
      return;
    }

    const favorito = t.closest('[data-favorito]');
    if (favorito) {
      try {
        const { apunte } = await api.editarApunte(actual.id, { favorito: !actual.favorito });
        Object.assign(actual, apunte);
        const i = apuntes.findIndex((x) => x.id === apunte.id);
        if (i >= 0) apuntes[i] = apunte;
        actual = apuntes[i] || apunte;
        aviso(apunte.favorito ? 'Agregado a favoritos' : 'Quitado de favoritos');
        pintarVistas();
        pintarLista();
        pintarDetalle();
      } catch (error) {
        aviso(error.message, 'error');
      }
      return;
    }

    // RF07: resumir con IA
    const resumir = t.closest('[data-resumir]');
    if (resumir) {
      const cajaError = detalle.querySelector('.formulario__error');
      cajaError.hidden = true;
      detalle.querySelector('[data-resumen]').innerHTML = `
        <div class="generando">${iconos.lapiz.replace('<svg', '<svg class="generando__lapiz"')}<p>El asistente está leyendo tu apunte…</p></div>`;
      try {
        await conCarga(resumir, async () => {
          const { apunte } = await api.resumirApunte(actual.id);
          actual = apunte;
        });
        aviso('Resumen listo');
        await recargar();
        detalle.querySelector('#resumen-apunte')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (error) {
        detalle.querySelector('[data-resumen]').innerHTML = '';
        mostrarError(cajaError, error);
      }
      return;
    }

    if (t.closest('[data-borrar]')) {
      const ok = await confirmar({ titulo: 'Eliminar apunte', mensaje: `Se eliminará «${actual.titulo}» y su resumen. Esta acción no se puede deshacer.` });
      if (!ok) return;
      try {
        await api.borrarApunte(actual.id);
        actual = null;
        aviso('Apunte eliminado');
        raiz.dataset.modo = 'lista';
        await recargar();
      } catch (error) {
        aviso(error.message, 'error');
      }
    }
  });

  // Aviso del navegador si se intenta cerrar la pestaña con cambios sin guardar
  const antesDeSalir = (e) => { if (cambiosSinGuardar) e.preventDefault(); };
  window.addEventListener('beforeunload', antesDeSalir);

  // Abrir un apunte directamente (#/apuntes?id=...) o el primero en pantallas grandes
  if (parametros.id) {
    actual = apuntes.find((a) => a.id === parametros.id) || null;
    if (actual) raiz.dataset.modo = 'detalle';
  } else if (window.matchMedia('(min-width: 1101px)').matches) {
    actual = filtrados()[0] || null;
  }
  pintarTodo();

  return () => {
    window.removeEventListener('beforeunload', antesDeSalir);
    document.removeEventListener('click', cerrarMenuFuera);
  };
}
