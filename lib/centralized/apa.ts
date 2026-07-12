// Referencias bibliográficas en formato APA (7.ª edición) para las fuentes de Gestión de Datos.
// Módulo PURO (sin DB, importable en cliente y servidor): define los tipos de referencia con sus
// campos requeridos y formatea la cita a partir de los datos capturados, con las cursivas correctas.

export type ApaCampo = {
  key: string;
  label: string;
  required?: boolean;
  kind?: 'text' | 'textarea' | 'year';
  placeholder?: string;
  help?: string;
};

export type ApaTipo = {
  value: string;
  label: string;
  help?: string;
  campos: ApaCampo[];
};

// Campos reutilizables.
const AUTORES: ApaCampo = {
  key: 'autores', label: 'Autor(es)', required: true,
  placeholder: 'Apellido, N. N.',
  help: 'Formato APA: «Apellido, N. N.». Separa varios autores con «;».',
};

/** Catálogo de tipos de referencia soportados y los campos que pide cada uno (APA 7). */
export const APA_TIPOS: ApaTipo[] = [
  {
    value: 'libro', label: 'Libro',
    help: 'Apellido, N. N. (Año). Título del libro (ed.). Editorial.',
    campos: [
      AUTORES,
      { key: 'anio', label: 'Año', required: true, kind: 'year', placeholder: '2021' },
      { key: 'titulo', label: 'Título del libro', required: true, placeholder: 'Título del libro' },
      { key: 'edicion', label: 'Edición (opcional)', placeholder: '2', help: 'Solo el número; se muestra «2.ª ed.». Omite si es la 1.ª.' },
      { key: 'editorial', label: 'Editorial', required: true, placeholder: 'Nombre de la editorial' },
      { key: 'url', label: 'DOI o URL (opcional)', placeholder: 'https://doi.org/10.xxxx' },
    ],
  },
  {
    value: 'articulo_revista', label: 'Artículo de revista',
    help: 'Apellido, N. N. (Año, Mes). Título del artículo. Nombre de la Revista, vol(núm), páginas. URL',
    campos: [
      AUTORES,
      { key: 'fecha', label: 'Fecha de publicación', required: true, placeholder: '2021, marzo', help: 'Año y, si aplica, mes (p. ej. «2021, marzo»).' },
      { key: 'titulo', label: 'Título del artículo', required: true },
      { key: 'revista', label: 'Nombre de la revista', required: true, help: 'Se muestra en cursiva.' },
      { key: 'volumen', label: 'Volumen (opcional)', placeholder: '12' },
      { key: 'numero', label: 'Número (opcional)', placeholder: '3' },
      { key: 'paginas', label: 'Páginas (opcional)', placeholder: '45-58' },
      { key: 'url', label: 'URL (opcional)', placeholder: 'https://…' },
    ],
  },
  {
    value: 'articulo_cientifico', label: 'Artículo científico',
    help: 'Apellido, N. N. (Año). Título del artículo. Nombre de la Revista, vol(núm), páginas. https://doi.org/xxxx',
    campos: [
      AUTORES,
      { key: 'anio', label: 'Año', required: true, kind: 'year', placeholder: '2021' },
      { key: 'titulo', label: 'Título del artículo', required: true },
      { key: 'revista', label: 'Revista científica', required: true, help: 'Se muestra en cursiva.' },
      { key: 'volumen', label: 'Volumen (opcional)', placeholder: '12' },
      { key: 'numero', label: 'Número (opcional)', placeholder: '3' },
      { key: 'paginas', label: 'Páginas (opcional)', placeholder: '45-58' },
      { key: 'doi', label: 'DOI (opcional)', placeholder: '10.1000/xyz o https://doi.org/…', help: 'Se antepone «https://doi.org/» si escribes solo el código.' },
    ],
  },
  {
    value: 'contenido_academico', label: 'Contenido académico',
    help: 'Tesis, informe o documento. Apellido, N. N. (Año). Título [tipo]. Institución. URL',
    campos: [
      AUTORES,
      { key: 'anio', label: 'Año', required: true, kind: 'year', placeholder: '2021' },
      { key: 'titulo', label: 'Título', required: true, help: 'Se muestra en cursiva.' },
      { key: 'tipo_doc', label: 'Tipo de documento (opcional)', placeholder: 'Tesis de maestría, Informe técnico…' },
      { key: 'institucion', label: 'Institución (opcional)', placeholder: 'Universidad / Organismo' },
      { key: 'url', label: 'URL (opcional)', placeholder: 'https://…' },
    ],
  },
  {
    value: 'pagina_web', label: 'Página web',
    help: 'Autor u organización. (Año, Mes Día). Título de la página. Nombre del sitio. URL',
    campos: [
      { key: 'autores', label: 'Autor u organización', required: true, placeholder: 'Apellido, N. N. o Nombre de la organización', help: 'Separa varios con «;».' },
      { key: 'fecha', label: 'Fecha de publicación', required: true, placeholder: '2021, 15 de marzo', help: 'Escribe «s. f.» si no tiene fecha.' },
      { key: 'titulo', label: 'Título de la página', required: true, help: 'Se muestra en cursiva.' },
      { key: 'sitio', label: 'Nombre del sitio web (opcional)', placeholder: 'Nombre del sitio' },
      { key: 'url', label: 'URL', required: true, placeholder: 'https://…' },
    ],
  },
  {
    value: 'video_youtube', label: 'Video de YouTube',
    help: 'Autor/Canal. (Año, Mes Día). Título del video [Video]. YouTube. URL',
    campos: [
      { key: 'autores', label: 'Autor o canal', required: true, placeholder: 'Apellido, N. N. o Nombre del canal' },
      { key: 'fecha', label: 'Fecha de publicación', required: true, placeholder: '2021, 15 de marzo' },
      { key: 'titulo', label: 'Título del video', required: true, help: 'Se muestra en cursiva.' },
      { key: 'url', label: 'URL', required: true, placeholder: 'https://www.youtube.com/watch?v=…' },
    ],
  },
  {
    value: 'otro', label: 'Otro (referencia manual)',
    help: 'Escribe la referencia completa ya formateada en APA.',
    campos: [
      { key: 'referencia', label: 'Referencia completa (APA)', required: true, kind: 'textarea', placeholder: 'Pega o escribe la referencia completa en formato APA.' },
    ],
  },
];

export function apaTipoLabel(value?: string | null): string {
  return APA_TIPOS.find((t) => t.value === value)?.label || '';
}

/** Une varios autores según APA: «A», «A, & B», «A, B, & C». Cada autor ya viene como «Apellido, N. N.». */
export function apaAuthors(raw: string): string {
  const parts = (raw || '').split(';').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')}, & ${parts[parts.length - 1]}`;
}

// Marcador interno para delimitar el texto en cursiva dentro de la cadena construida.
const IT = '';
const it = (s: string) => (s ? `${IT}${s}${IT}` : '');

function normalizeDoi(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `https://doi.org/${v.replace(/^doi:\s*/i, '')}`;
}

/** Limpia espacios y puntuación sobrante producto del ensamblado condicional. */
function clean(s: string): string {
  return s
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([.,)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\(\)/g, '')
    .replace(/,\s*,/g, ',')
    .replace(/\.\s*\./g, '.')
    .replace(/,\s*\./g, '.')
    .trim();
}

/** Construye la referencia como cadena con marcadores de cursiva, o '' si no hay datos suficientes. */
function buildRef(tipo: string, d: Record<string, string>): string {
  const g = (k: string) => (d[k] || '').trim();
  const who = apaAuthors(g('autores'));
  const lead = who ? `${who} ` : '';

  const volNumPags = (): string => {
    const parts: string[] = [];
    if (g('volumen')) parts.push(it(g('volumen')) + (g('numero') ? `(${g('numero')})` : ''));
    else if (g('numero')) parts.push(`(${g('numero')})`);
    if (g('paginas')) parts.push(g('paginas'));
    return parts.join(', ');
  };

  switch (tipo) {
    case 'libro': {
      if (!g('titulo') && !who) return '';
      const ed = g('edicion') ? ` (${g('edicion')}.ª ed.)` : '';
      const editorial = g('editorial') ? ` ${g('editorial')}.` : '';
      const url = g('url') ? ` ${g('url')}` : '';
      return clean(`${lead}(${g('anio') || 's. f.'}). ${it(g('titulo'))}${ed}.${editorial}${url}`);
    }
    case 'articulo_revista': {
      if (!g('titulo') && !who) return '';
      const src = it(g('revista'));
      const vnp = volNumPags();
      const source = `${src}${vnp ? `, ${vnp}` : ''}.`;
      const url = g('url') ? ` ${g('url')}` : '';
      return clean(`${lead}(${g('fecha') || 's. f.'}). ${g('titulo')}. ${source}${url}`);
    }
    case 'articulo_cientifico': {
      if (!g('titulo') && !who) return '';
      const src = it(g('revista'));
      const vnp = volNumPags();
      const source = `${src}${vnp ? `, ${vnp}` : ''}.`;
      const doi = g('doi') ? ` ${normalizeDoi(g('doi'))}` : '';
      return clean(`${lead}(${g('anio') || 's. f.'}). ${g('titulo')}. ${source}${doi}`);
    }
    case 'contenido_academico': {
      if (!g('titulo') && !who) return '';
      const tipoDoc = g('tipo_doc') ? ` [${g('tipo_doc')}]` : '';
      const inst = g('institucion') ? ` ${g('institucion')}.` : '';
      const url = g('url') ? ` ${g('url')}` : '';
      return clean(`${lead}(${g('anio') || 's. f.'}). ${it(g('titulo'))}${tipoDoc}.${inst}${url}`);
    }
    case 'pagina_web': {
      if (!g('titulo') && !who) return '';
      const sitio = g('sitio') ? ` ${g('sitio')}.` : '';
      const url = g('url') ? ` ${g('url')}` : '';
      return clean(`${lead}(${g('fecha') || 's. f.'}). ${it(g('titulo'))}.${sitio}${url}`);
    }
    case 'video_youtube': {
      if (!g('titulo') && !who) return '';
      const url = g('url') ? ` ${g('url')}` : '';
      return clean(`${lead}(${g('fecha') || 's. f.'}). ${it(g('titulo'))} [Video]. YouTube.${url}`);
    }
    case 'otro':
      return clean(g('referencia'));
    default:
      return '';
  }
}

export type ApaSeg = { t: string; i?: boolean };

/** Referencia APA como segmentos (para render con cursivas). Vacío si no hay datos suficientes. */
export function formatApaSegments(tipo?: string | null, datos?: Record<string, string> | null): ApaSeg[] {
  if (!tipo) return [];
  const raw = buildRef(tipo, datos || {});
  if (!raw) return [];
  const parts = raw.split(IT);
  const segs: ApaSeg[] = [];
  // Los índices impares corresponden al texto que estaba entre marcadores (cursiva).
  parts.forEach((p, i) => { if (p) segs.push(i % 2 === 1 ? { t: p, i: true } : { t: p }); });
  return segs;
}

/** Referencia APA como texto plano (para copiar). */
export function formatApaText(tipo?: string | null, datos?: Record<string, string> | null): string {
  return formatApaSegments(tipo, datos).map((s) => s.t).join('');
}
