/** Piezas de interfaz compartidas: avisos, ventanas modales y estados de carga. */
import { esc } from './utilidades.js';
import { iconos } from './iconos.js';

/* ---------- Avisos ---------- */
export function aviso(mensaje, tipo = 'exito') {
  const contenedor = document.getElementById('avisos');
  const elemento = document.createElement('div');
  elemento.className = `aviso aviso--${tipo}`;
  elemento.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  elemento.innerHTML = `${tipo === 'error' ? iconos.alerta : iconos.ok}<span>${esc(mensaje)}</span>`;
  contenedor.append(elemento);
  setTimeout(() => elemento.remove(), tipo === 'error' ? 6000 : 3500);
}

/* ---------- Errores en formularios ---------- */
const NOMBRES_CAMPOS = {
  materiaId: 'La materia', fechaLimite: 'La fecha de entrega', titulo: 'El título', contenido: 'El contenido',
  nombre: 'El nombre', descripcion: 'La descripción', docente: 'El docente', prioridad: 'La prioridad',
  estado: 'El estado', color: 'El color', dias: 'Los días', horasPorDia: 'Las horas por día',
};
function legible(texto) {
  const resultado = texto.replace(/^(\w+)/, (campo) => NOMBRES_CAMPOS[campo] || campo);
  // Concordancia de género para los campos femeninos ("La fecha ... es obligatoria")
  return /^Las? /.test(resultado)
    ? resultado.replace(/obligatorio\b/, 'obligatoria').replace(/vacío\b/, 'vacía').replace(/nulo\b/, 'nula')
    : resultado;
}

export function mostrarError(contenedor, error) {
  if (!contenedor) return;
  const detalles = error?.detalles?.length
    ? `<ul>${error.detalles.map((d) => `<li>${esc(legible(d))}</li>`).join('')}</ul>`
    : '';
  contenedor.innerHTML = `<strong>${esc(error?.message || 'Ocurrió un error.')}</strong>${detalles}`;
  contenedor.hidden = false;
}

/* ---------- Botón con estado de carga ---------- */
export async function conCarga(boton, accion) {
  if (!boton) return accion();
  const textoOriginal = boton.innerHTML;
  boton.disabled = true;
  boton.classList.add('cargando');
  try {
    return await accion();
  } finally {
    boton.disabled = false;
    boton.classList.remove('cargando');
    boton.innerHTML = textoOriginal;
  }
}

/* ---------- Ventana modal con formulario ---------- */
/**
 * Abre un <dialog> con un formulario.
 *   alEnviar(datosFormulario) debe devolver una promesa; si lanza un error
 *   se muestra dentro de la ventana y esta permanece abierta.
 */
export function abrirFormulario({ titulo, contenido, textoEnviar = 'Guardar', alEnviar, alAbrir }) {
  const dialogo = document.createElement('dialog');
  dialogo.className = 'modal';
  dialogo.setAttribute('aria-labelledby', 'modal-titulo');
  dialogo.innerHTML = `
    <form method="dialog" class="formulario" novalidate>
      <div class="modal__encabezado">
        <h2 id="modal-titulo">${esc(titulo)}</h2>
        <button type="button" class="boton boton--icono" data-cerrar aria-label="Cerrar">${iconos.cerrar}</button>
      </div>
      <div class="modal__cuerpo formulario">
        <div class="formulario__error" role="alert" hidden></div>
        ${contenido}
      </div>
      <div class="modal__pie">
        <button type="button" class="boton boton--fantasma" data-cerrar>Cancelar</button>
        <button type="submit" class="boton boton--primario">${esc(textoEnviar)}</button>
      </div>
    </form>`;

  document.body.append(dialogo);
  const formulario = dialogo.querySelector('form');
  const cajaError = dialogo.querySelector('.formulario__error');
  const cerrar = () => dialogo.close();

  dialogo.addEventListener('close', () => dialogo.remove());
  dialogo.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', cerrar));
  dialogo.addEventListener('click', (e) => { if (e.target === dialogo) cerrar(); });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    cajaError.hidden = true;
    const boton = formulario.querySelector('[type="submit"]');
    try {
      await conCarga(boton, () => alEnviar(Object.fromEntries(new FormData(formulario)), formulario));
      cerrar();
    } catch (error) {
      mostrarError(cajaError, error);
    }
  });

  dialogo.showModal();
  alAbrir?.(formulario);
  formulario.querySelector('input, select, textarea')?.focus();
  return dialogo;
}

/* ---------- Confirmación ---------- */
export function confirmar({ titulo, mensaje, textoConfirmar = 'Eliminar' }) {
  return new Promise((resolver) => {
    const dialogo = document.createElement('dialog');
    dialogo.className = 'modal';
    dialogo.setAttribute('aria-labelledby', 'confirmar-titulo');
    dialogo.innerHTML = `
      <div class="modal__encabezado"><h2 id="confirmar-titulo">${esc(titulo)}</h2></div>
      <div class="modal__cuerpo"><p>${esc(mensaje)}</p></div>
      <div class="modal__pie">
        <button type="button" class="boton boton--fantasma" data-respuesta="no">Cancelar</button>
        <button type="button" class="boton boton--peligro" data-respuesta="si">${esc(textoConfirmar)}</button>
      </div>`;
    document.body.append(dialogo);
    let respuesta = false;
    dialogo.addEventListener('click', (e) => {
      const boton = e.target.closest('[data-respuesta]');
      if (boton) {
        respuesta = boton.dataset.respuesta === 'si';
        dialogo.close();
      } else if (e.target === dialogo) {
        dialogo.close();
      }
    });
    dialogo.addEventListener('close', () => {
      dialogo.remove();
      resolver(respuesta);
    });
    dialogo.showModal();
    dialogo.querySelector('[data-respuesta="no"]').focus();
  });
}

/* ---------- Bloques de estado ---------- */
export const esqueleto = (lineas = 5) =>
  `<div class="esqueleto" aria-hidden="true">${'<i></i>'.repeat(lineas)}</div><span class="solo-lectores" role="status">Cargando…</span>`;

export function vacio({ icono = iconos.tareas, titulo, texto, accion = '' }) {
  return `<div class="vacio">${icono}<h3>${esc(titulo)}</h3><p>${esc(texto)}</p>${accion}</div>`;
}

export function errorCarga(error, reintentar = true) {
  return `<div class="vacio" role="alert">${iconos.alerta}
    <h3>No se pudo cargar esta sección</h3>
    <p>${esc(error?.message || 'Inténtalo de nuevo en unos segundos.')}</p>
    ${reintentar ? '<button class="boton boton--secundario" data-reintentar>Reintentar</button>' : ''}
  </div>`;
}
