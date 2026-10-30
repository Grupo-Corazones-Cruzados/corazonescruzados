/**
 * `/llms.txt` — el resumen del grupo para los modelos de IA (2026-10-30).
 *
 * Es una convención joven (llmstxt.org): un texto plano en la raíz con lo esencial del sitio y
 * sus enlaces. No está demostrado que Google o Bing lo usen; cuesta poco y lo leen algunos
 * agentes. Sale de las MISMAS fuentes que las páginas (`lib/sitio/modeloGcc.ts`, `DESARROLLO`),
 * así que no se queda viejo cuando cambia un texto.
 */

import { SITIO, DESARROLLO } from '@/lib/sitio/contenido';
import { HERRAMIENTAS, HERRAMIENTAS_INTRO, MODELO_INTRO, PASOS, PASOS_CONDICIOLOGIA, PISOS, REGLAS_4P, sinNegritas } from '@/lib/sitio/modeloGcc';

export const dynamic = 'force-static';

export function GET() {
  const dh = `${SITIO.url}/desarrollo-humano`;
  const texto = [
    `# ${SITIO.nombre}`,
    '',
    `> Proyecto de desarrollo humano que reconoce y aprovecha las condiciones de las personas, y descubre el talento de cada una para posicionarla en un rol y una función dentro de los proyectos del grupo, con el Modelo Organizacional 4P y sus herramientas.`,
    '',
    '## Modelo Organizacional 4P',
    '',
    sinNegritas(MODELO_INTRO),
    '',
    `Pisos (roles): ${PISOS.map((p, i) => `${i + 1}. ${p.name}: ${p.desc}`).join(' ')}`,
    '',
    `Pasos (funciones): ${PASOS.map((p, i) => `${i + 1}. ${p.name}: ${p.desc}`).join(' ')}`,
    '',
    ...REGLAS_4P.map((r, i) => `${i + 1}. ${r}`),
    '',
    `Más: ${dh}/modelo-organizacional-4p`,
    '',
    '## Herramientas del Modelo',
    '',
    sinNegritas(HERRAMIENTAS_INTRO),
    '',
    ...HERRAMIENTAS.flatMap((h) => [
      `### ${h.nombre}`,
      '',
      ...h.parrafos.map(sinNegritas).flatMap((p, i) => (h.conPasos && i === 0
        ? [p, '', `Los seis pasos: ${PASOS_CONDICIOLOGIA.join(', ')}.`, '']
        : [p, ''])),
      `Más: ${dh}/herramientas-del-modelo#${h.id}`,
      '',
    ]),
    '## Páginas',
    '',
    `- [Inicio](${SITIO.url})`,
    ...DESARROLLO.map((a) => `- [${a.titulo}](${dh}/${a.id}): ${a.texto}`),
    `- [Clientes](${SITIO.url}/clientes)`,
    `- [Soluciones](${SITIO.url}/soluciones)`,
    '',
  ].join('\n');
  return new Response(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
