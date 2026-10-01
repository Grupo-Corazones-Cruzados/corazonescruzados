import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

/**
 * HTML del editor de «Prompts» → Markdown. Lo usan los DOS lados con la misma regla: el
 * servidor para guardar `content_md` y el navegador para «Copiar como prompt», que así copia
 * lo que hay en pantalla aunque el último guardado aún no haya salido.
 */
let turndown: TurndownService | null = null;
function md(): TurndownService {
  if (turndown) return turndown;
  const t = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    hr: '---',
    // Un nodo vacío sale como salto de párrafo. Dentro de una tabla eso la parte: una
    // celda vacía tiene que seguir siendo una celda.
    blankReplacement: (_content, node) => {
      const n = node as HTMLElement;
      if (n.nodeName === 'TD' || n.nodeName === 'TH') {
        const primera = Array.prototype.indexOf.call(n.parentNode?.childNodes ?? [], n) === 0;
        return `${primera ? '| ' : ' '} |`;
      }
      if (['TD', 'TH'].includes(n.parentNode?.nodeName ?? '')) return '';
      return (n as unknown as { isBlock?: boolean }).isBlock ? '\n\n' : '';
    },
  });
  t.use(gfm);
  t.addRule('tachado', { filter: ['del', 's'], replacement: (content) => `~~${content}~~` });
  // TipTap mete cada línea de una lista o de una celda en su <p>. Turndown los separa con
  // una línea en blanco, y eso hace las listas «sueltas» y parte las tablas en dos.
  t.addRule('parrafoContenido', {
    filter: (node) => {
      if (node.nodeName !== 'P') return false;
      const padre = node.parentNode as HTMLElement | null;
      if (!padre) return false;
      if (['LI', 'TD', 'TH'].includes(padre.nodeName)) return true;
      return padre.nodeName === 'DIV' && padre.parentNode?.nodeName === 'LI';
    },
    replacement: (content, node) => {
      const celda = ['TD', 'TH'].includes(node.parentNode?.nodeName ?? '');
      if (celda) return node.nextSibling ? `${content}<br>` : content;
      return node.nextSibling ? `${content}\n` : content;
    },
  });
  t.addRule('elementoLista', {
    filter: 'li',
    replacement: (content, node) => {
      const padre = node.parentNode as HTMLElement;
      let prefijo = '- ';
      if (padre.nodeName === 'OL') {
        const inicio = Number(padre.getAttribute('start') || 1);
        prefijo = `${inicio + Array.prototype.indexOf.call(padre.children, node)}. `;
      }
      const cuerpo = content.replace(/^\n+/, '').replace(/\n+$/, '')
        .replace(/\n/g, `\n${' '.repeat(prefijo.length)}`);
      return `${prefijo}${cuerpo}\n`;
    },
  });
  // TipTap pinta las casillas como <li data-type="taskItem" data-checked="true">; el plugin
  // gfm solo entiende el <input type=checkbox> suelto.
  t.addRule('tareas', {
    filter: (node) => node.nodeName === 'LI' && node.getAttribute('data-type') === 'taskItem',
    replacement: (content, node) => {
      const hecho = (node as HTMLElement).getAttribute('data-checked') === 'true';
      return `- [${hecho ? 'x' : ' '}] ${content.trim().replace(/\n+/g, '\n  ')}\n`;
    },
  });
  // El resaltado no existe en Markdown: se queda el texto.
  t.addRule('resaltado', { filter: ['mark'], replacement: (content) => content });
  turndown = t;
  return t;
}

export function htmlToMarkdown(html: string): string {
  if (!html.trim() || html === '<p></p>') return '';
  // El plugin de tablas solo reconoce la fila de cabecera si es lo primero de la tabla, y
  // TipTap pone delante un <colgroup> con los anchos.
  const limpio = html.replace(/<colgroup>[\s\S]*?<\/colgroup>/g, '');
  return md().turndown(limpio).replace(/\n{3,}/g, '\n\n').trim();
}
