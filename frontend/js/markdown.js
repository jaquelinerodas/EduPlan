
import { esc } from './utilidades.js';

function enLinea(texto) {
  return esc(texto)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>');
}

export function markdownAHtml(markdown) {
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

  for (const linea of lineas) {
    const limpia = linea.trim();
    let m;

    if (!limpia) {
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
  cerrarParrafo();
  cerrarLista();
  return html.join('\n');
}
