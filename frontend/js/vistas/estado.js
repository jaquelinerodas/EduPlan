/** Estado de los servicios para el administrador (HU10). */
import { api } from '../api.js';
import { iconos } from '../iconos.js';
import { esc, formato } from '../utilidades.js';

function tarjeta(nombre, descripcion, datos, error) {
  const ok = datos && datos.estado === 'ok';
  const filas = datos
    ? [
      ['Estado', `<span class="semaforo semaforo--${ok ? 'ok' : 'error'}">${ok ? 'Funcionando' : 'Con fallas'}</span>`],
      ['Base de datos', esc(datos.baseDatos === 'ok' ? `Conectada (${datos.latenciaBaseDatosMs} ms)` : 'Sin conexión')],
      ...(datos.ia ? [['Asistente de IA', esc(datos.ia.configurada ? `${datos.ia.proveedor} · ${datos.ia.modelo}` : 'Sin clave configurada')]] : []),
      ['Versión', esc(datos.version)],
      ['Activo desde hace', esc(`${Math.floor(datos.tiempoActivoSeg / 60)} min`)],
      ['Revisado', esc(formato.hora(datos.fecha))],
    ]
    : [['Estado', `<span class="semaforo semaforo--error">Sin respuesta</span>`], ['Detalle', esc(error?.message || '')]];

  return `
    <section class="hoja servicio">
      <div class="hoja__encabezado"><div><h2 style="font-size:var(--t-md)">${esc(nombre)}</h2>
        <p style="color:var(--grafito-suave);font-size:var(--t-sm)">${esc(descripcion)}</p></div></div>
      <dl class="hoja__cuerpo">${filas.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    </section>`;
}

export async function renderEstado(contenedor) {
  contenedor.innerHTML = `
    <div class="encabezado-vista">
      <div><h1>Estado del sistema</h1><p>Consulta si los microservicios y la base de datos responden.</p></div>
      <button type="button" class="boton boton--secundario" data-actualizar>${iconos.estado}Revisar de nuevo</button>
    </div>
    <div class="servicios" data-servicios></div>`;

  const zona = contenedor.querySelector('[data-servicios]');

  async function cargar() {
    zona.innerHTML = '<p>Consultando servicios…</p>';
    const [auth, academico] = await Promise.allSettled([api.saludAuth(), api.saludAcademico()]);
    zona.innerHTML = [
      tarjeta('ms-auth', 'Inicio de sesión con Google y emisión de JWT', auth.value, auth.reason),
      tarjeta('ms-academico', 'Materias, tareas, apuntes y asistente de IA', academico.value, academico.reason),
    ].join('');
  }

  contenedor.querySelector('[data-actualizar]').addEventListener('click', cargar);
  await cargar();
}
