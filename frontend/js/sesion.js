
const CLAVE = 'eduplan_token';
let tokenEnMemoria = null; // respaldo si el navegador bloquea localStorage
let temporizador = null;

function decodificar(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64).split('').map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function obtenerToken() {
  try {
    return localStorage.getItem(CLAVE) || tokenEnMemoria;
  } catch {
    return tokenEnMemoria;
  }
}

export function guardarToken(token) {
  tokenEnMemoria = token;
  try { localStorage.setItem(CLAVE, token); } catch { /* modo privado */ }
}

function borrarToken() {
  tokenEnMemoria = null;
  try { localStorage.removeItem(CLAVE); } catch { /* modo privado */ }
}

/** Datos del token si existe y no ha expirado; si no, null. */
export function datosSesion() {
  const token = obtenerToken();
  if (!token) return null;
  const datos = decodificar(token);
  if (!datos || !datos.exp || datos.exp * 1000 <= Date.now()) {
    borrarToken();
    return null;
  }
  return datos;
}

/**
 * Lee el resultado del inicio de sesión en la URL (#token=... o #error=...)
 * y limpia la dirección para que el token no quede visible.
 */
export function leerRetornoDeGoogle() {
  const fragmento = new URLSearchParams(location.hash.slice(1));
  const token = fragmento.get('token');
  const error = fragmento.get('error');
  if (!token && !error) return null;

  if (token) guardarToken(token);
  history.replaceState(null, '', `${location.pathname}#/panel`);
  return { error };
}

export function iniciarSesion() {
  location.href = '/auth/google';
}

let cerrando = false;
export const estaCerrando = () => cerrando;

/** RF11: cerrar sesión elimina el token del cliente. */
export async function cerrarSesion(motivo) {
  if (cerrando) return;
  cerrando = true;
  const token = obtenerToken();
  if (token) {
    // Se avisa al servidor, pero el cierre no depende de su respuesta
    fetch('/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  }
  borrarToken();
  clearTimeout(temporizador);
  const destino = motivo ? `#/entrar?motivo=${encodeURIComponent(motivo)}` : '#/entrar';
  location.replace(`${location.pathname}${destino}`);
  location.reload();
}

/** Cierra la sesión automáticamente cuando el token expira. */
export function programarExpiracion() {
  const datos = datosSesion();
  if (!datos) return;
  clearTimeout(temporizador);
  const restante = datos.exp * 1000 - Date.now();
  temporizador = setTimeout(() => cerrarSesion('expirada'), Math.min(restante, 2 ** 31 - 1));
}
