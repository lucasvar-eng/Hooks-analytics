import { marked } from 'marked';

// Configuración global de marked: GFM (GitHub Flavored Markdown) incluye tablas, strikethrough, links autocompletados.
// breaks=false respeta el comportamiento estándar (doble salto = nuevo párrafo, no <br> en cada salto).
marked.setOptions({
  gfm: true,
  breaks: false,
  pedantic: false,
});

// Render simple. El contenido viene del backend (reportes guardados, análisis AI). No es input directo del usuario.
// Si en el futuro renderizamos markdown user-generated, agregar DOMPurify.
export function renderMarkdown(source) {
  if (!source || typeof source !== 'string') return '';
  try {
    return marked.parse(source);
  } catch {
    return source;
  }
}
