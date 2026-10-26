/** Pantalla de inicio de sesión con Google (RF01, HU01). */
import { logotipo, logoGoogle } from '../iconos.js';
import { esc, formato } from '../utilidades.js';
import { iniciarSesion } from '../sesion.js';

const MENSAJES = {
  expirada: 'Tu sesión expiró. Inicia sesión de nuevo para continuar.',
  invalida: 'Tu sesión ya no es válida. Inicia sesión de nuevo.',
  ACCESO_CANCELADO: 'Cancelaste el inicio de sesión con Google.',
  STATE_INVALIDO: 'El inicio de sesión tardó demasiado o no es válido. Inténtalo otra vez.',
  EMAIL_NO_VERIFICADO: 'Tu correo de Google no está verificado.',
  USUARIO_INACTIVO: 'Tu cuenta está desactivada. Contacta al administrador.',
  GOOGLE_CODIGO_INVALIDO: 'Google no pudo confirmar tu inicio de sesión. Inténtalo otra vez.',
};

export function renderEntrar(raiz, { motivo } = {}) {
  const hoy = new Date();
  const manana = new Date(hoy.getTime() + 86400000);
  const alerta = motivo ? MENSAJES[motivo] || 'No se pudo iniciar sesión. Inténtalo otra vez.' : '';

  document.title = 'Iniciar sesión · EduPlan';
  raiz.innerHTML = `
    <main class="login papel-cuadriculado">
      <section class="login__texto" aria-labelledby="login-titulo">
        <span class="marca">${logotipo}EduPlan</span>
        <h1 id="login-titulo" class="login__titulo">Tus materias, tareas y apuntes en un solo cuaderno.</h1>
        <p class="login__bajada">Anota tus entregas, marca lo que terminas y deja que el asistente resuma tus apuntes y te arme un plan de estudio.</p>
        ${alerta ? `<p class="login__alerta" role="alert">${esc(alerta)}</p>` : ''}
        <div class="login__acciones">
          <button type="button" class="boton boton--google" id="btn-google">${logoGoogle}Continuar con Google</button>
          <p class="login__nota">Usamos tu cuenta de Google para identificarte. No necesitas otra contraseña.</p>
        </div>
      </section>

      <figure class="hoja-muestra" aria-label="Ejemplo de cómo se ven tus entregas">
        <p class="hoja-muestra__fecha">${esc(formato.diaLargoTitulo(hoy))}</p>
        <ol>
          <li><span class="hoja-muestra__caja hoja-muestra__caja--lista"></span>
            <div><span class="tachada">Diagrama de arquitectura</span><small>Desarrollo Web I</small></div></li>
          <li><span class="hoja-muestra__caja"></span>
            <div><strong>Modelo relacional</strong> <span class="fecha fecha--urgente">Mañana, 23:59</span><small>Base de Datos II</small></div></li>
          <li><span class="hoja-muestra__caja"></span>
            <div>Guía de grafos, ejercicios 1 al 15<small>Matemática Discreta · ${esc(formato.fechaCorta(new Date(manana.getTime() + 5 * 86400000)))}</small></div></li>
          <li><span class="hoja-muestra__caja"></span>
            <div>Repasar formas normales<small>Plan sugerido por el asistente</small></div></li>
        </ol>
      </figure>
    </main>`;

  raiz.querySelector('#btn-google').addEventListener('click', iniciarSesion);
}
