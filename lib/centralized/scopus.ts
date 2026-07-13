// Conector a Scopus (Elsevier) para BUSCAR fuentes y a Crossref para ENRIQUECER la referencia
// APA por DOI (lista completa de autores). Solo servidor: usa SCOPUS_API_KEY del entorno.
// Devuelve resultados ya mapeados a { ref_tipo, ref_datos } del catálogo APA (lib/centralized/apa.ts).

export type ScopusResult = {
  scopusId: string;
  title: string;
  creator: string;
  authorCount: number;
  journal: string;
  year: string;
  volume: string;
  issue: string;
  pages: string;
  doi: string;
  aggregationType: string;
  subtype: string;
  citedby: number;
  apa: { ref_tipo: string; ref_datos: Record<string, string> };
};

const CROSSREF_MAILTO = 'lfgonzalezm0@gmail.com';

/** Iniciales APA de un nombre de pila: "Madihatou" → "M.", "Jean Pierre" → "J. P." */
function initials(given: string): string {
  return (given || '')
    .split(/[\s.\-]+/)
    .filter(Boolean)
    .map((w) => `${w[0].toUpperCase()}.`)
    .join(' ');
}

/** "Yesigat A." (formato Scopus dc:creator) → "Yesigat, A." (formato APA). */
function scopusCreatorToApa(creator: string): string {
  const m = (creator || '').trim().match(/^(.*?)[,\s]+([A-Za-z.\s]+)$/);
  if (!m) return (creator || '').trim();
  const surname = m[1].replace(/,$/, '').trim();
  const inits = m[2].replace(/\s+/g, ' ').trim();
  return `${surname}, ${inits}`;
}

const yearOf = (coverDate?: string) => (coverDate || '').slice(0, 4);

function aggregationToTipo(agg: string): string {
  const a = (agg || '').toLowerCase();
  if (a.includes('book')) return 'libro';
  if (a.includes('journal')) return 'articulo_cientifico';
  return 'articulo_cientifico';
}

/** Mapea una entry de Scopus (view Standard) a una referencia APA (solo primer autor). */
function scopusEntryToApa(e: any): { ref_tipo: string; ref_datos: Record<string, string> } {
  const tipo = aggregationToTipo(e['prism:aggregationType']);
  const count = Number(e['author-count']?.['$'] ?? e['author-count'] ?? 1) || 1;
  let autores = scopusCreatorToApa(e['dc:creator'] || '');
  if (count > 1 && autores) autores = `${autores}; et al.`;
  const datos: Record<string, string> = {};
  if (autores) datos.autores = autores;
  const year = yearOf(e['prism:coverDate']);
  if (year) datos.anio = year;
  if (e['dc:title']) datos.titulo = e['dc:title'];
  if (tipo === 'libro') {
    if (e['prism:publicationName']) datos.editorial = e['prism:publicationName'];
    if (e['prism:doi']) datos.url = `https://doi.org/${e['prism:doi']}`;
  } else {
    if (e['prism:publicationName']) datos.revista = e['prism:publicationName'];
    if (e['prism:volume']) datos.volumen = e['prism:volume'];
    if (e['prism:issueIdentifier']) datos.numero = e['prism:issueIdentifier'];
    if (e['prism:pageRange']) datos.paginas = e['prism:pageRange'];
    if (e['prism:doi']) datos.doi = e['prism:doi'];
  }
  return { ref_tipo: tipo, ref_datos: datos };
}

/** Busca en Scopus (Search API, view Standard). Devuelve resultados normalizados + APA de arranque. */
export async function searchScopus(query: string, count = 10): Promise<ScopusResult[]> {
  const apiKey = process.env.SCOPUS_API_KEY;
  if (!apiKey) throw new Error('Scopus no está configurado (SCOPUS_API_KEY)');
  const q = (query || '').trim();
  if (!q) return [];
  // Si el usuario no usa códigos de campo de Scopus, buscamos en título/resumen/keywords.
  const scopusQuery = /[():]/.test(q) ? q : `TITLE-ABS-KEY(${q})`;
  const fields = [
    'dc:identifier', 'dc:title', 'dc:creator', 'prism:publicationName', 'prism:coverDate',
    'prism:volume', 'prism:issueIdentifier', 'prism:pageRange', 'prism:doi',
    'prism:aggregationType', 'subtypeDescription', 'citedby-count', 'author-count',
  ].join(',');
  const url = `https://api.elsevier.com/content/search/scopus?query=${encodeURIComponent(scopusQuery)}&count=${Math.min(25, Math.max(1, count))}&field=${fields}`;
  const res = await fetch(url, { headers: { 'X-ELS-APIKey': apiKey, Accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Scopus respondió ${res.status}${res.status === 401 || res.status === 403 ? ' (sin acceso/entitlement)' : ''}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const entries = data?.['search-results']?.entry || [];
  if (entries.length === 1 && entries[0]?.error) return []; // "Result set was empty"
  return entries.map((e: any): ScopusResult => ({
    scopusId: String(e['dc:identifier'] || '').replace('SCOPUS_ID:', ''),
    title: e['dc:title'] || '',
    creator: e['dc:creator'] || '',
    authorCount: Number(e['author-count']?.['$'] ?? e['author-count'] ?? 1) || 1,
    journal: e['prism:publicationName'] || '',
    year: yearOf(e['prism:coverDate']),
    volume: e['prism:volume'] || '',
    issue: e['prism:issueIdentifier'] || '',
    pages: e['prism:pageRange'] || '',
    doi: e['prism:doi'] || '',
    aggregationType: e['prism:aggregationType'] || '',
    subtype: e['subtypeDescription'] || '',
    citedby: Number(e['citedby-count'] || 0),
    apa: scopusEntryToApa(e),
  }));
}

function crossrefTypeToTipo(t: string): string {
  const x = (t || '').toLowerCase();
  if (x.includes('journal-article')) return 'articulo_cientifico';
  if (x.includes('proceedings')) return 'articulo_cientifico';
  if (x === 'book' || x.includes('monograph') || x.includes('reference-book')) return 'libro';
  if (x.includes('dissertation')) return 'contenido_academico';
  if (x.includes('book-chapter')) return 'otro';
  return 'articulo_cientifico';
}

/** Enriquece una referencia APA a partir de un DOI usando Crossref (lista completa de autores). */
export async function crossrefToApa(doi: string): Promise<{ ref_tipo: string; ref_datos: Record<string, string> } | null> {
  const clean = (doi || '').trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '');
  if (!clean) return null;
  const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(clean)}?mailto=${encodeURIComponent(CROSSREF_MAILTO)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const m = (await res.json())?.message;
  if (!m) return null;
  const tipo = crossrefTypeToTipo(m.type);
  const authors = (m.author || [])
    .map((a: any) => (a.family ? `${a.family}${a.given ? `, ${initials(a.given)}` : ''}` : (a.name || '')))
    .filter(Boolean)
    .join('; ');
  const year = String(m.issued?.['date-parts']?.[0]?.[0] || m.published?.['date-parts']?.[0]?.[0] || '');
  const titulo = (m.title || [])[0] || '';
  const datos: Record<string, string> = {};
  if (authors) datos.autores = authors;
  if (year) datos.anio = year;
  if (titulo) datos.titulo = titulo;
  if (tipo === 'libro') {
    if (m.publisher) datos.editorial = m.publisher;
    if (m.DOI) datos.url = `https://doi.org/${m.DOI}`;
  } else if (tipo === 'contenido_academico') {
    if (m.publisher) datos.institucion = m.publisher;
    if (m.DOI) datos.url = `https://doi.org/${m.DOI}`;
  } else if (tipo === 'otro') {
    // Capítulo de libro u otros: referencia legible completa.
    const cont = (m['container-title'] || [])[0] || '';
    const parts = [authors && `${authors}`, year && `(${year}).`, titulo && `${titulo}.`, cont && `En ${cont}.`, m.publisher && `${m.publisher}.`, m.DOI && `https://doi.org/${m.DOI}`].filter(Boolean);
    datos.referencia = parts.join(' ');
  } else {
    const cont = (m['container-title'] || [])[0] || '';
    if (cont) datos.revista = cont;
    if (m.volume) datos.volumen = m.volume;
    if (m.issue) datos.numero = m.issue;
    if (m.page) datos.paginas = m.page;
    if (m.DOI) datos.doi = m.DOI;
  }
  return { ref_tipo: tipo, ref_datos: datos };
}
