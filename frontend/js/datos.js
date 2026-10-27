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

/* Semestres, bloques y carpetas */
let periodos = null;

export async function obtenerPeriodos({ forzar = false } = {}) {
  if (!periodos || forzar) {
    periodos = (await api.periodos()).periodos;
  }
  return periodos;
}

export function invalidarPeriodos() {
  periodos = null;
}

export const TIPOS_PERIODO = { semestre: 'Semestre', bloque: 'Bloque', carpeta: 'Carpeta' };
