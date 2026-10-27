/**
 * Convierte el Markdown sencillo que devuelve la IA en HTML seguro.
 * Primero escapa TODO el texto y después aplica el formato, así ningún
 * contenido de la IA puede inyectar etiquetas HTML.
 * Soporta: ### títulos, **negritas**, *cursivas*, `código`, bloques ```código```,
 * listas (- , * , 1.), --- y párrafos. En los apuntes, una línea sola escrita
 * en MAYÚSCULAS (por ejemplo "1. INTRODUCCIÓN") se muestra como título.
 */
import { esc } from './utilidades.js';

function enLinea(texto) {
  return esc(texto)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>');
}

const esTituloEnMayusculas = (linea) => {
  const letras = linea.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
  return letras.length >= 4 && linea.length <= 80 && letras === letras.toLocaleUpperCase('es') && !/[.;,]$/.test(linea);
};

function bloqueCodigo(lineas, lenguaje) {
  const filas = lineas.map((l) => `<span class="codigo__linea">${esc(l) || ' '}</span>`).join('');
  return `<div class="codigo"><div class="codigo__barra"><span>${esc(lenguaje || 'código')}</span>`
    + '<button type="button" class="codigo__copiar" data-copiar>Copiar</button></div>'
    + `<pre><code>${filas}</code></pre></div>`;
}

export function markdownAHtml(markdown, { titulosEnMayusculas = false } = {}) {
  const lineas = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let lista = null; // 'ul' | 'ol'
  let parrafo = [];

  const cerrarParrafo = () => {
    if (parrafo.length) {
      html.push(`<p>${parrafo.map(enLinea).join('<br>')}</p>`);
      parrafo = [];
    }
  };
  const cerrarLista = () => {
    if (lista) {
      html.push(`</${lista}>`);
      lista = null;
    }
  };

  let codigo = null; // { lenguaje, lineas }

  for (const linea of lineas) {
    const limpia = linea.trim();
    let m;

    if (codigo) {
      if (/^```/.test(limpia)) {
        html.push(bloqueCodigo(codigo.lineas, codigo.lenguaje));
        codigo = null;
      } else {
        codigo.lineas.push(linea.replace(/\s+$/, ''));
      }
    } else if ((m = limpia.match(/^```\s*([\w+-]*)/))) {
      cerrarParrafo();
      cerrarLista();
      codigo = { lenguaje: m[1], lineas: [] };
    } else if (!limpia) {
      cerrarParrafo();
      cerrarLista();
    } else if ((m = limpia.match(/^(#{1,6})\s+(.*)$/))) {
      cerrarParrafo();
      cerrarLista();
      const nivel = m[1].length <= 2 ? 'h3' : 'h4';
      html.push(`<${nivel}>${enLinea(m[2])}</${nivel}>`);
    } else if (/^(-{3,}|\*{3,})$/.test(limpia)) {
      cerrarParrafo();
      cerrarLista();
      html.push('<hr>');
    } else if (titulosEnMayusculas && esTituloEnMayusculas(limpia)) {
      cerrarParrafo();
      cerrarLista();
      html.push(`<h3>${enLinea(limpia)}</h3>`);
    } else if ((m = limpia.match(/^[-*•]\s+(.*)$/)) || (m = limpia.match(/^\d+[.)]\s+(.*)$/))) {
      cerrarParrafo();
      const tipo = /^\d/.test(limpia) ? 'ol' : 'ul';
      if (lista !== tipo) {
        cerrarLista();
        html.push(`<${tipo}>`);
        lista = tipo;
      }
      html.push(`<li>${enLinea(m[1])}</li>`);
    } else {
      cerrarLista();
      parrafo.push(limpia);
    }
  }
  if (codigo) html.push(bloqueCodigo(codigo.lineas, codigo.lenguaje));
  cerrarParrafo();
  cerrarLista();
  return html.join('\n');
}
