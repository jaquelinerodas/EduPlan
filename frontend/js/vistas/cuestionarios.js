/**
 * Cuestionarios de opción múltiple generados con IA a partir de los apuntes.
 *   #/cuestionarios               lista y botón para crear
 *   #/cuestionarios/<id>          resolver
 *   #/cuestionarios/<id>?revision revisar el último intento
 */
import { api } from '../api.js';
import { obtenerMaterias } from '../datos.js';
import { iconos } from '../iconos.js';
import { aviso, abrirFormulario, confirmar, conCarga, esqueleto, errorCarga, vacio } from '../ui.js';
import { montarSelectorTemas } from '../seleccion.js';
import { esc, colorSeguro, formato, plural, cuentaRegresiva, aISO, sumarDias, DIFICULTADES } from '../utilidades.js';

const LETRAS = ['A', 'B', 'C', 'D'];

function anillo(puntaje, clase = '') {
  if (puntaje === null || puntaje === undefined) {
    return `<div class="puntaje puntaje--vacio ${clase}" style="--p:0" aria-label="Sin intentos"><b>—</b></div>`;
  }
  const p = Math.round(puntaje);
  const color = p >= 80 ? 'var(--verde)' : p >= 60 ? 'var(--c-practica)' : 'var(--rojo)';
  return `<div class="puntaje ${clase}" style="--p:${p};--color-puntaje:${color}" role="img" aria-label="Puntaje ${p}%"><b>${p}%</b></div>`;
}

function mensajePuntaje(p) {
  if (p >= 90) return '¡Excelente! Dominas este material.';
  if (p >= 75) return 'Muy bien. Repasa los temas que fallaste para asegurarlos.';
  if (p >= 60) return 'Vas por buen camino. Te conviene reforzar algunos temas.';
  return 'Este material necesita más repaso. Empieza por los temas débiles.';
}

/* ---------- Lista ---------- */
function filaCuestionario(c) {
  return `
    <article class="cuestionario-fila">
      ${anillo(c.mejorPuntaje)}
      <div class="cuestionario-fila__datos">
        <h3 style="font-size:var(--t-base)">${esc(c.titulo)}</h3>
        <p class="cuestionario-fila__meta">
          ${c.materia ? `<span class="etiqueta-materia" style="--color:${colorSeguro(c.materiaColor)}"><span>${esc(c.materia)}</span></span>` : ''}
          ${c.examen ? `<span>Examen: ${esc(c.examen)}</span>` : ''}
          <span>${plural(c.totalPreguntas, 'pregunta', 'preguntas')}</span>
          <span>Dificultad ${esc((DIFICULTADES[c.dificultad] || '').toLowerCase())}</span>
          <span>${c.intentos ? `${plural(c.intentos, 'intento', 'intentos')}` : 'Sin resolver'}</span>
        </p>
      </div>
      <div class="cuestionario-fila__acciones">
        ${c.intentos ? `<a class="boton boton--fantasma" href="#/cuestionarios/${esc(c.id)}?revision=1">Ver revisión</a>` : ''}
        <a class="boton ${c.intentos ? 'boton--secundario' : 'boton--primario'}" href="#/cuestionarios/${esc(c.id)}">${iconos.jugar}${c.intentos ? 'Repetir' : 'Resolver'}</a>
        <button type="button" class="boton boton--icono peligro" data-borrar="${esc(c.id)}" aria-label="Eliminar ${esc(c.titulo)}">${iconos.borrar}</button>
      </div>
    </article>`;
}

function formularioNuevo({ materias, apuntes, examenes }, inicial) {
  const seleccion = new Set(String(inicial.apunteIds || '').split(',').filter(Boolean));
  const grupos = new Map();
  for (const a of apuntes) {
    const clave = `${a.materia}${a.periodo ? ` · ${a.periodo}` : ''}`;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(a);
  }
  return `
    <fieldset class="campo" style="border:0;padding:0;margin:0">
      <legend>¿De dónde salen las preguntas?</legend>
      <div class="segmentos segmentos--bloque" style="margin-top:6px">
        ${[['apuntes', 'Apuntes que elija'], ['materia', 'Una materia'], ['examen', 'Un examen']]
          .map(([k, v]) => `<label><input type="radio" name="fuente" value="${k}"${k === inicial.fuente ? ' checked' : ''}><span>${v}</span></label>`).join('')}
      </div>
    </fieldset>
    <div data-si="apuntes">
      <div class="campo"><span>Apuntes</span>
        ${apuntes.length ? `<div class="lista-seleccion">${[...grupos].map(([grupo, lista]) => `
          <p class="lista-seleccion__grupo">${esc(grupo)}</p>
          ${lista.map((a) => `<label><input type="checkbox" name="apunteIdsLibres" value="${esc(a.id)}"${seleccion.has(a.id) ? ' checked' : ''}>${esc(a.titulo)}</label>`).join('')}`).join('')}
        </div>` : '<p class="acceso__ayuda">Aún no tienes apuntes. <a href="#/apuntes">Escribe uno</a>.</p>'}
      </div>
    </div>
    <div data-si="materia">
      <label class="campo"><span>Materia</span>
        <select class="selector" name="materiaId">${materias.map((m) => `<option value="${esc(m.id)}"${m.id === inicial.materiaId ? ' selected' : ''}>${esc(m.nombre)}${m.periodo ? ` · ${esc(m.periodo)}` : ''}</option>`).join('')}</select></label>
    </div>
    <div data-si="examen">
      <label class="campo"><span>Examen</span>
        ${examenes.length
          ? `<select class="selector" name="examenId">${examenes.map((e) => `<option value="${esc(e.id)}"${e.id === inicial.examenId ? ' selected' : ''}>${esc(e.titulo)} · ${esc(e.materia)} · ${esc(cuentaRegresiva(e.fecha))}</option>`).join('')}</select>`
          : '<p class="acceso__ayuda">No tienes exámenes próximos. <a href="#/examenes">Registra uno</a>.</p>'}
      </label>
    </div>
    <div data-zona-temas></div>
    <div class="formulario__fila">
      <label class="campo"><span>Número de preguntas</span>
        <select class="selector" name="numPreguntas">${[5, 10, 15, 20].map((n) => `<option value="${n}"${n === 10 ? ' selected' : ''}>${n} preguntas</option>`).join('')}</select></label>
      <fieldset class="campo" style="border:0;padding:0;margin:0">
        <legend>Dificultad</legend>
        <div class="segmentos" style="margin-top:6px">
          ${Object.entries(DIFICULTADES).map(([k, v]) => `<label><input type="radio" name="dificultad" value="${k}"${k === 'media' ? ' checked' : ''}><span>${v}</span></label>`).join('')}
        </div>
      </fieldset>
    </div>
    <p class="acceso__ayuda">El asistente puede tardar hasta un minuto en escribir las preguntas.</p>`;
}

async function vistaLista(contenedor, parametros) {
  let cuestionarios = [];
  contenedor.innerHTML = `
    <div class="encabezado-vista">
      <div>
        <h1>Cuestionarios</h1>
        <p>Practica con preguntas generadas a partir de tus apuntes. El asistente te califica y explica cada respuesta.</p>
      </div>
      <button type="button" class="boton boton--ia" data-nuevo>${iconos.chispa}Nuevo cuestionario</button>
    </div>
    <div data-lista>${esqueleto(6)}</div>`;
  const zona = contenedor.querySelector('[data-lista]');

  async function cargar() {
    try {
      ({ cuestionarios } = await api.cuestionarios());
      zona.innerHTML = cuestionarios.length
        ? `<div class="lista-cuestionarios">${cuestionarios.map(filaCuestionario).join('')}</div>`
        : `<section class="hoja">${vacio({
          icono: iconos.cuestionario,
          titulo: 'Pon a prueba lo que sabes',
          texto: 'Elige tus apuntes y el asistente te preparará preguntas de opción múltiple, como en un examen.',
          accion: `<button type="button" class="boton boton--ia" data-nuevo>${iconos.chispa}Crear mi primer cuestionario</button>`,
        })}</section>`;
    } catch (error) {
      zona.innerHTML = errorCarga(error);
    }
  }

  async function abrirNuevo(inicial = {}) {
    let datos;
    try {
      const [materias, { apuntes }, { examenes }] = await Promise.all([obtenerMaterias(), api.apuntes(), api.examenes({ periodo: 'proximos' })]);
      datos = { materias, apuntes, examenes };
    } catch (error) {
      aviso(error.message, 'error');
      return;
    }
    let selector = null;
    let peticion = 0;

    // Al elegir una materia o un examen se cargan sus apuntes, semestres y temas
    async function cargarTemas(form) {
      const fuente = form.querySelector('[name="fuente"]:checked').value;
      const zona = form.querySelector('[data-zona-temas]');
      selector = null;
      const filtro = fuente === 'materia' ? { materiaId: form.materiaId.value }
        : fuente === 'examen' && form.examenId ? { examenId: form.examenId.value } : null;
      if (!filtro) { zona.innerHTML = ''; return; }
      const mia = ++peticion;
      try {
        const s = await montarSelectorTemas(zona, filtro, { seleccion: inicial.apunteIds ? String(inicial.apunteIds).split(',') : null });
        if (mia === peticion) selector = s;
      } catch (error) {
        zona.innerHTML = `<p class="formulario__error">${esc(error.message)}</p>`;
      }
    }
    const alternar = (form) => {
      const fuente = form.querySelector('[name="fuente"]:checked').value;
      form.querySelectorAll('[data-si]').forEach((el) => { el.hidden = el.dataset.si !== fuente; });
      cargarTemas(form);
    };
    abrirFormulario({
      titulo: 'Nuevo cuestionario',
      textoEnviar: 'Generar preguntas',
      contenido: formularioNuevo(datos, { fuente: 'apuntes', ...inicial }),
      alAbrir: (form) => {
        form.closest('dialog').classList.add('modal--ancho');
        alternar(form);
        form.addEventListener('change', (e) => {
          if (e.target.name === 'fuente') alternar(form);
          if (e.target.name === 'materiaId' || e.target.name === 'examenId') cargarTemas(form);
        });
      },
      alEnviar: async (f, form) => {
        const cuerpo = { fuente: f.fuente, numPreguntas: Number(f.numPreguntas), dificultad: f.dificultad };
        if (f.fuente === 'apuntes') cuerpo.apunteIds = new FormData(form).getAll('apunteIdsLibres');
        else {
          if (!selector) throw new Error('Espera a que carguen los temas.');
          Object.assign(cuerpo, selector.cuerpo());
          if (f.fuente === 'materia') cuerpo.materiaId = f.materiaId;
          if (f.fuente === 'examen') cuerpo.examenId = f.examenId;
        }
        const { cuestionario } = await api.generarCuestionario(cuerpo);
        aviso('Cuestionario listo');
        location.hash = `#/cuestionarios/${cuestionario.id}`;
      },
    });
  }

  contenedor.addEventListener('click', async (e) => {
    if (e.target.closest('[data-nuevo]')) return abrirNuevo();
    if (e.target.closest('[data-reintentar]')) return cargar();
    const borrar = e.target.closest('[data-borrar]');
    if (borrar) {
      const c = cuestionarios.find((x) => x.id === borrar.dataset.borrar);
      if (!(await confirmar({ titulo: 'Eliminar cuestionario', mensaje: `Se eliminará «${c.titulo}» y sus resultados.` }))) return;
      try {
        await api.borrarCuestionario(c.id);
        aviso('Cuestionario eliminado');
        cargar();
      } catch (error) {
        aviso(error.message, 'error');
      }
    }
  });

  await cargar();
  if (parametros.nuevo) {
    abrirNuevo({
      fuente: ['apuntes', 'materia', 'examen'].includes(parametros.nuevo) ? parametros.nuevo : 'apuntes',
      examenId: parametros.examenId, materiaId: parametros.materiaId, apunteIds: parametros.apunteIds,
    });
    history.replaceState(null, '', '#/cuestionarios');
  }
}

/* ---------- Resultado y revisión ---------- */
function comparacionHtml(intento, comp) {
  if (!comp) return '';
  const dif = Math.round(intento.puntaje - comp.puntajeAnterior);
  const tono = dif > 0 ? 'var(--verde)' : dif < 0 ? 'var(--rojo)' : 'var(--grafito-suave)';
  return `
    <div class="comparacion">
      <p><b>Comparado con tu intento anterior</b> (${esc(formato.fechaCorta(comp.fechaAnterior))})</p>
      <p class="comparacion__cifras">
        <span>${Math.round(comp.puntajeAnterior)}%</span><span aria-hidden="true">→</span><b>${Math.round(intento.puntaje)}%</b>
        <span style="color:${tono};font-weight:700">${dif > 0 ? '+' : ''}${dif} puntos</span>
      </p>
      ${comp.mejoraron.length ? `<p>Mejoraste en: ${comp.mejoraron.map((t) => `<span class="insignia insignia--verde">${esc(t)}</span>`).join(' ')}</p>` : ''}
      ${comp.siguenDebiles.length ? `<p>Siguen pendientes: ${comp.siguenDebiles.map((t) => `<span class="insignia insignia--rojo">${esc(t)}</span>`).join(' ')}</p>` : ''}
    </div>`;
}

function accionesHtml(c, { intento, analisis }) {
  const a = analisis;
  if (!a) return '';
  const debiles = a.temas.filter((t) => t.fallos > 0);
  if (!debiles.length) {
    return `<section class="hoja siguientes"><div class="hoja__cuerpo">
      <h2>${iconos.ok}Respondiste todo bien</h2>
      ${comparacionHtml(intento, a.comparacion)}
      <p style="color:var(--grafito-suave)">Vuelve a practicar en unos días para no olvidarlo.</p></div></section>`;
  }
  return `
    <section class="hoja siguientes" aria-labelledby="siguientes-titulo">
      <div class="hoja__encabezado"><h2 id="siguientes-titulo">Qué hacer ahora</h2></div>
      <div class="siguientes__rejilla">
        <article class="paso-repaso">
          <span class="paso-repaso__num">1</span>
          <div>
            <h3>Temas donde fallaste</h3>
            <ul class="temas-fallo">${debiles.map((t) => `
              <li><span>${esc(t.tema)}</span><small>${t.fallos} de ${t.total} mal</small>
                <span class="avance" aria-hidden="true"><span style="--valor:${((t.total - t.fallos) / t.total) * 100}%;--color:var(--verde)"></span></span></li>`).join('')}
            </ul>
          </div>
        </article>
        <article class="paso-repaso">
          <span class="paso-repaso__num">2</span>
          <div>
            <h3>Vuelve a estudiar</h3>
            ${a.recomendaciones.length ? `<ul class="apuntes-recomendados">${a.recomendaciones.map((r) => `
              <li><a href="#/apuntes?id=${esc(r.id)}">${iconos.apuntes}<span><b>${esc(r.titulo)}</b>
                <small>${esc(r.materia)} · ${plural(r.fallos, 'pregunta fallada', 'preguntas falladas')}</small></span></a></li>`).join('')}</ul>`
              : '<p class="acceso__ayuda">Repasa tus apuntes de los temas de la izquierda.</p>'}
          </div>
        </article>
        <article class="paso-repaso">
          <span class="paso-repaso__num">3</span>
          <div>
            <h3>Memoriza lo que fallaste</h3>
            ${a.falladasSinTarjeta
              ? `<p class="acceso__ayuda">Convierte cada pregunta fallada en una tarjeta con su respuesta y explicación.</p>
                 <button type="button" class="boton boton--secundario" data-tarjetas-falladas>${iconos.tarjetas}Crear ${plural(a.falladasSinTarjeta, 'tarjeta', 'tarjetas')}</button>`
              : `<p class="acceso__ayuda">Ya tienes tarjetas de estas preguntas.</p>
                 <a class="boton boton--secundario" href="#/tarjetas?repaso=1">${iconos.jugar}Repasar tarjetas</a>`}
          </div>
        </article>
        <article class="paso-repaso">
          <span class="paso-repaso__num">4</span>
          <div>
            <h3>Agenda un repaso</h3>
            <p class="acceso__ayuda">EduPlan propone un horario libre y lo agrega a tu plan de estudio.</p>
            <button type="button" class="boton boton--secundario" data-agendar-repaso>${iconos.calendario}Programar sesión</button>
          </div>
        </article>
      </div>
      ${a.comparacion ? `<div class="hoja__cuerpo" style="padding-top:0">${comparacionHtml(intento, a.comparacion)}</div>` : ''}
    </section>`;
}

function historialHtml(historial) {
  if (!historial || historial.length < 2) return '';
  const lista = [...historial].reverse();
  return `
    <section class="hoja">
      <div class="hoja__encabezado"><h2 style="font-size:var(--t-md)">Tus intentos</h2></div>
      <ol class="intentos">${lista.map((i, n) => `
        <li><small>${n + 1}.º · ${esc(formato.fechaCorta(i.creadoEn))}</small>
          <span class="intentos__barra" style="--valor:${i.puntaje}%"></span><b>${Math.round(i.puntaje)}%</b></li>`).join('')}
      </ol>
    </section>`;
}

function resultadoHtml(c, datos) {
  const { intento, revision } = datos;
  const p = Math.round(intento.puntaje);
  return `
    <section class="hoja resultado">
      ${anillo(intento.puntaje)}
      <div>
        <h2>${intento.correctas} de ${intento.total} correctas</h2>
        <p style="color:var(--grafito-suave)">${esc(mensajePuntaje(p))}</p>
        <div class="resultado__acciones">
          <a class="boton boton--primario" href="#/cuestionarios/${esc(c.id)}?r=${Date.now()}">${iconos.reorganizar}Intentar de nuevo</a>
          ${c.examenId ? `<a class="boton boton--secundario" href="#/plan?nuevo=examen&examenId=${esc(c.examenId)}">${iconos.plan}Plan para reforzar</a>`
            : c.materiaId ? `<a class="boton boton--secundario" href="#/plan?nuevo=materia&materiaId=${esc(c.materiaId)}">${iconos.plan}Plan para reforzar</a>` : ''}
          <a class="boton boton--fantasma" href="#/cuestionarios">Volver a cuestionarios</a>
        </div>
      </div>
    </section>
    <div data-acciones-resultado>${accionesHtml(c, datos)}</div>
    ${historialHtml(datos.historial)}
    <h2 style="margin:var(--e-6) 0 var(--e-4);font-size:var(--t-md)">Revisión de cada pregunta</h2>
    <ol class="revision">${revision.map((r, i) => `
      <li class="hoja${r.esCorrecta ? '' : ' mal'}">
        <p class="pregunta__tema">Pregunta ${i + 1} · ${esc(r.tema)} · ${r.esCorrecta ? '<span style="color:var(--verde)">Correcta</span>' : r.elegida === null ? '<span style="color:var(--rojo)">Sin responder</span>' : '<span style="color:var(--rojo)">Incorrecta</span>'}</p>
        <h3>${esc(r.pregunta)}</h3>
        <ol>${r.opciones.map((o, j) => `<li class="${j === r.correcta ? 'correcta' : j === r.elegida ? 'elegida-mal' : ''}">${esc(o)}${j === r.correcta ? ' ✓' : ''}</li>`).join('')}</ol>
        <p class="revision__explicacion">${esc(r.explicacion)}</p>
      </li>`).join('')}</ol>`;
}

/** Ventana para programar la sesión de repaso con la sugerencia de EduPlan. */
async function agendarRepaso(c, boton) {
  let s;
  try {
    ({ sugerencia: s } = await conCarga(boton, () => api.sugerirRepaso(c.id)));
  } catch (error) {
    aviso(error.message, 'error');
    return;
  }
  const hoy = aISO(new Date());
  abrirFormulario({
    titulo: 'Programar sesión de repaso',
    textoEnviar: 'Agregar a mi plan',
    contenido: `
      <div class="sugerencia-repaso">
        <p><b>${esc(s.titulo)}</b></p>
        <p class="acceso__ayuda">${esc(s.descripcion)}</p>
      </div>
      <div class="formulario__fila">
        <label class="campo"><span>Día</span>
          <input class="entrada" type="date" name="fecha" value="${esc(s.fecha)}" min="${hoy}" max="${aISO(sumarDias(new Date(), 60))}" required></label>
        <label class="campo"><span>Hora</span>
          <input class="entrada" type="time" name="inicio" value="${esc(s.inicio)}" required></label>
        <label class="campo"><span>Duración</span>
          <select class="selector" name="duracion">${[30, 45, 60, 90, 120].map((m) => `<option value="${m}"${m === s.duracion ? ' selected' : ''}>${m < 60 ? `${m} minutos` : m === 60 ? '1 hora' : `${m / 60} horas`}</option>`).join('')}</select></label>
      </div>
      <p class="acceso__ayuda" data-destino>${s.plan ? `Se agregará a tu plan «${esc(s.plan.titulo)}».` : 'Como no tienes un plan para ese día, EduPlan creará un plan de repaso.'}</p>`,
    alEnviar: async (f) => {
      const { plan, nuevo } = await api.programarRepaso(c.id, { fecha: f.fecha, inicio: f.inicio, duracion: Number(f.duracion) });
      aviso(nuevo ? 'Plan de repaso creado' : `Sesión agregada a «${plan.titulo}»`);
      location.hash = `#/plan?id=${plan.id}`;
    },
  });
}

/* ---------- Resolver ---------- */
async function vistaResolver(contenedor, id, parametros) {
  contenedor.innerHTML = esqueleto(8);
  let c;
  try {
    ({ cuestionario: c } = await api.cuestionario(id));
  } catch (error) {
    contenedor.innerHTML = errorCarga(error, false);
    return;
  }

  const encabezado = `
    <div class="encabezado-vista">
      <div>
        <a href="#/cuestionarios" class="boton boton--fantasma" style="margin-left:-.8rem">${iconos.atras}Cuestionarios</a>
        <h1>${esc(c.titulo)}</h1>
        <p>${c.materia ? `${esc(c.materia)} · ` : ''}${plural(c.totalPreguntas, 'pregunta', 'preguntas')} · dificultad ${esc((DIFICULTADES[c.dificultad] || '').toLowerCase())}</p>
      </div>
    </div>`;

  let resultado = null;
  const mostrarResultado = (datos) => {
    resultado = { ...datos, historial: datos.historial ?? c.historial };
    contenedor.innerHTML = `<div class="examen-en-curso">${encabezado}${resultadoHtml(c, resultado)}</div>`;
  };

  // Acciones después de calificar (tarjetas de falladas y sesión de repaso)
  contenedor.addEventListener('click', async (e) => {
    const tarjetas = e.target.closest('[data-tarjetas-falladas]');
    if (tarjetas) {
      try {
        const r = await conCarga(tarjetas, () => api.tarjetasDeFalladas(c.id));
        aviso(`${plural(r.creadas, 'tarjeta creada', 'tarjetas creadas')} con tus preguntas falladas`);
        resultado.analisis.falladasSinTarjeta = 0;
        contenedor.querySelector('[data-acciones-resultado]').innerHTML = accionesHtml(c, resultado);
      } catch (error) {
        aviso(error.message, 'error');
      }
      return;
    }
    const agendar = e.target.closest('[data-agendar-repaso]');
    if (agendar) agendarRepaso(c, agendar);
  });

  if (parametros.revision) {
    try {
      mostrarResultado(await api.revisionCuestionario(id));
    } catch (error) {
      contenedor.innerHTML = errorCarga(error, false);
    }
    return;
  }

  const respuestas = Array(c.preguntas.length).fill(null);
  let indice = 0;

  function pintar() {
    const p = c.preguntas[indice];
    const respondidas = respuestas.filter((r) => r !== null).length;
    const ultima = indice === c.preguntas.length - 1;
    contenedor.innerHTML = `
      <div class="examen-en-curso">
        ${encabezado}
        <div class="examen-en-curso__progreso">
          <div style="display:flex;justify-content:space-between"><span>Pregunta ${indice + 1} de ${c.preguntas.length}</span><span>${respondidas} respondidas</span></div>
          <div class="avance" aria-hidden="true"><span style="--valor:${(respondidas / c.preguntas.length) * 100}%;--color:var(--tinta)"></span></div>
          <div class="puntos-preguntas" aria-label="Ir a una pregunta">
            ${c.preguntas.map((_, i) => `<button type="button" data-ir="${i}" class="${respuestas[i] !== null ? 'respondida' : ''}" ${i === indice ? 'aria-current="true"' : ''} aria-label="Pregunta ${i + 1}">${i + 1}</button>`).join('')}
          </div>
        </div>
        <section class="hoja pregunta">
          <p class="pregunta__tema">${esc(p.tema)}</p>
          <h2 id="pregunta-texto">${esc(p.pregunta)}</h2>
          <fieldset class="opciones" aria-labelledby="pregunta-texto">
            ${p.opciones.map((o, j) => `
              <label class="opcion"><input type="radio" name="opcion" value="${j}" ${respuestas[indice] === j ? 'checked' : ''}>
                <span data-letra="${LETRAS[j]}">${esc(o)}</span></label>`).join('')}
          </fieldset>
          <div class="pregunta__nav">
            <button type="button" class="boton boton--fantasma" data-anterior ${indice === 0 ? 'disabled' : ''}>${iconos.atras}Anterior</button>
            ${ultima
              ? `<button type="button" class="boton boton--primario" data-terminar>${iconos.ok}Terminar y calificar</button>`
              : `<button type="button" class="boton boton--primario" data-siguiente>Siguiente${iconos.adelante}</button>`}
          </div>
        </section>
      </div>`;
  }

  async function terminar(boton) {
    const faltan = respuestas.filter((r) => r === null).length;
    if (faltan && !(await confirmar({
      titulo: 'Hay preguntas sin responder',
      mensaje: `Te ${faltan === 1 ? 'falta 1 pregunta' : `faltan ${faltan} preguntas`}. Las que dejes en blanco contarán como incorrectas.`,
      textoConfirmar: 'Calificar de todos modos', tono: 'exito',
    }))) return;
    try {
      const datos = await conCarga(boton, () => api.responderCuestionario(c.id, respuestas));
      const nuevo = { id: datos.intento.id, puntaje: datos.intento.puntaje, creadoEn: datos.intento.creadoEn || new Date().toISOString() };
      mostrarResultado({ ...datos, historial: [nuevo, ...(c.historial || [])] });
      window.scrollTo(0, 0);
    } catch (error) {
      aviso(error.message, 'error');
    }
  }

  contenedor.addEventListener('change', (e) => {
    if (e.target.name === 'opcion') {
      respuestas[indice] = Number(e.target.value);
      contenedor.querySelector(`[data-ir="${indice}"]`)?.classList.add('respondida');
    }
  });
  contenedor.addEventListener('click', (e) => {
    if (e.target.closest('[data-siguiente]')) { indice += 1; return pintar(); }
    if (e.target.closest('[data-anterior]')) { indice -= 1; return pintar(); }
    const ir = e.target.closest('[data-ir]');
    if (ir) { indice = Number(ir.dataset.ir); return pintar(); }
    const t = e.target.closest('[data-terminar]');
    if (t) terminar(t);
  });

  pintar();
}

export function renderCuestionarios(contenedor, parametros) {
  return parametros.id ? vistaResolver(contenedor, parametros.id, parametros) : vistaLista(contenedor, parametros);
}
