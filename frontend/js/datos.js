/** Caché corta de materias: varias vistas las necesitan para filtros y formularios. */
import { api } from './api.js';

let materias = null;

export async function obtenerMaterias({ forzar = false } = {}) {
  if (!materias || forzar) {
    materias = (await api.materias()).materias;
  }
  return materias;
}

export function invalidarMaterias() {
  materias = null;
}
