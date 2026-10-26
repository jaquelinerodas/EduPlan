/**
 * Pantalla de acceso: correo y contraseña (iniciar sesión o crear cuenta)
 * y "Continuar con Google" (OAuth 2.0, RF01).
 */
import { logotipo, logoGoogle, iconos } from '../iconos.js';
import { esc, formato } from '../utilidades.js';
import { iniciarSesion, guardarToken } from '../sesion.js';
import { api } from '../api.js';
import { mostrarError, conCarga } from '../ui.js';

const MENSAJES = {
  expirada: 'Tu sesión expiró. Inicia sesión de nuevo para continuar.',
  invalida: 'Tu sesión ya no es válida. Inicia sesión de nuevo.',
  ACCESO_CANCELADO: 'Cancelaste el inicio de sesión con Google.',
  STATE_INVALIDO: 'El inicio de sesión tardó demasiado o no es válido. Inténtalo otra vez.',
  EMAIL_NO_VERIFICADO: 'Tu correo de Google no está verificado.',
  USUARIO_INACTIVO: 'Tu cuenta está desactivada. Contacta al administrador.',
  GOOGLE_CODIGO_INVALIDO: 'Google no pudo confirmar tu inicio de sesión. Inténtalo otra vez.',
};

const campoClave = (nombre, etiqueta, autocompletar, ayuda = '') => `
  <label class="campo"><span>${etiqueta}</span>
    <span class="campo-clave">
      <input class="entrada" type="password" name="${nombre}" required autocomplete="${autocompletar}" maxlength="72">
      <button type="button" class="boton boton--icono" data-ver-clave aria-label="Mostrar contraseña">${iconos.ojo}</button>
    </span>
    ${ayuda ? `<small class="acceso__ayuda">${ayuda}</small>` : ''}
  </label>`;

function formulario(modo) {
  const registro = modo === 'registro';
  return `
    <div>
      <h2 id="acceso-titulo">${registro ? 'Crea tu cuenta' : 'Inicia sesión'}</h2>
      <p class="acceso__ayuda">${registro ? 'Solo necesitas tu nombre, un correo y una contraseña.' : 'Usa tu correo y contraseña, o tu cuenta de Google.'}</p>
    </div>
    <form class="formulario" novalidate data-modo="${modo}">
      <div class="formulario__error" role="alert" hidden></div>
      ${registro ? `<label class="campo"><span>Nombre</span>
        <input class="entrada" name="nombre" required maxlength="150" autocomplete="name" placeholder="Tu nombre completo"></label>` : ''}
      <label class="campo"><span>Correo electrónico</span>
        <input class="entrada" type="email" name="email" required autocomplete="email" placeholder="nombre@correo.com"></label>
      ${campoClave('password', 'Contraseña', registro ? 'new-password' : 'current-password', registro ? 'Mínimo 8 caracteres, con al menos una letra y un número.' : '')}
      ${registro ? campoClave('confirmar', 'Confirma la contraseña', 'new-password') : ''}
      <button type="submit" class="boton boton--primario boton--bloque">${registro ? 'Crear cuenta' : 'Iniciar sesión'}</button>
    </form>
    <p class="acceso__separador">o</p>
    <button type="button" class="boton boton--google" data-google>${logoGoogle}Continuar con Google</button>
    <p class="acceso__cambio">
      ${registro
        ? '¿Ya tienes cuenta? <button type="button" data-cambiar="login">Inicia sesión</button>'
        : '¿Primera vez en EduPlan? <button type="button" data-cambiar="registro">Crea una cuenta</button>'}
    </p>`;
}

/** Validación en el navegador; el servidor vuelve a validar todo. */
function validar(datos, modo) {
  const errores = [];
  if (modo === 'registro' && (datos.nombre || '').trim().length < 2) errores.push('Escribe tu nombre.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((datos.email || '').trim())) errores.push('Escribe un correo válido.');
  if (!datos.password) errores.push('Escribe tu contraseña.');
  if (modo === 'registro') {
    if (datos.password && (datos.password.length < 8 || !/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(datos.password) || !/\d/.test(datos.password))) {
      errores.push('La contraseña debe tener al menos 8 caracteres, con una letra y un número.');
    }
    if (datos.password !== datos.confirmar) errores.push('Las contraseñas no coinciden.');
  }
  return errores;
}

export function renderEntrar(raiz, { motivo } = {}) {
  const hoy = new Date();
  const alerta = motivo ? MENSAJES[motivo] || 'No se pudo iniciar sesión. Inténtalo otra vez.' : '';
  let modo = 'login';

  document.title = 'Iniciar sesión · EduPlan';
  raiz.innerHTML = `
    <main class="login papel-cuadriculado">
      <section class="login__lado">
        <div class="login__texto">
          <span class="marca">${logotipo}</span>
          <h1 class="login__titulo">Tus materias, tareas y apuntes en un solo cuaderno.</h1>
          <p class="login__bajada">Organiza tus entregas y prepara tus exámenes con un asistente que resume, te pregunta y te arma un plan de estudio.</p>
        </div>
        <figure class="hoja-muestra" aria-label="Ejemplo de cómo se ven tus entregas">
          <p class="hoja-muestra__fecha">${esc(formato.diaLargoTitulo(hoy))}</p>
          <ol>
            <li><span class="hoja-muestra__caja hoja-muestra__caja--lista"></span>
              <div><span class="tachada">Diagrama de arquitectura</span><small>Desarrollo Web I</small></div></li>
            <li><span class="hoja-muestra__caja"></span>
              <div><strong>Modelo relacional</strong> <span class="fecha fecha--urgente">Mañana, 23:59</span><small>Base de Datos II</small></div></li>
            <li><span class="hoja-muestra__caja"></span>
              <div>Cuestionario de normalización<small>Práctica sugerida por el asistente</small></div></li>
          </ol>
        </figure>
      </section>

      <section class="acceso" aria-labelledby="acceso-titulo">
        ${alerta ? `<p class="login__alerta" role="alert">${esc(alerta)}</p>` : ''}
        <div data-formulario>${formulario(modo)}</div>
      </section>
    </main>`;

  const zona = raiz.querySelector('[data-formulario]');

  zona.addEventListener('click', (e) => {
    if (e.target.closest('[data-google]')) return iniciarSesion();
    const cambiar = e.target.closest('[data-cambiar]');
    if (cambiar) {
      modo = cambiar.dataset.cambiar;
      zona.innerHTML = formulario(modo);
      zona.querySelector('input').focus();
      return;
    }
    const ver = e.target.closest('[data-ver-clave]');
    if (ver) {
      const input = ver.previousElementSibling;
      const mostrar = input.type === 'password';
      input.type = mostrar ? 'text' : 'password';
      ver.innerHTML = mostrar ? iconos.ojoTachado : iconos.ojo;
      ver.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
    }
  });

  zona.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const caja = form.querySelector('.formulario__error');
    const datos = Object.fromEntries(new FormData(form));
    const errores = validar(datos, modo);
    if (errores.length) {
      mostrarError(caja, { message: 'Revisa los datos', detalles: errores });
      return;
    }
    caja.hidden = true;
    try {
      await conCarga(form.querySelector('[type="submit"]'), async () => {
        const { token } = modo === 'registro'
          ? await api.registro({ nombre: datos.nombre, email: datos.email, password: datos.password })
          : await api.login({ email: datos.email, password: datos.password });
        guardarToken(token);
      });
      location.replace(`${location.pathname}#/panel`);
      location.reload();
    } catch (error) {
      mostrarError(caja, error);
    }
  });
}
