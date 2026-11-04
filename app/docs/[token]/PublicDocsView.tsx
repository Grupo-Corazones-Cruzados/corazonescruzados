'use client';

/**
 * LA DOCUMENTACIÓN PÚBLICA DE UN PROYECTO (caso de estudio), con el diseño del panel
 * (Fernando, 2026-11-04: «habrá que editarla con el nuevo diseño de /dashboard»).
 *
 * Antes era el estilo oscuro antiguo: letra pixel, resplandores y bordes de 2 px fuera de `.corp`.
 * Ahora vive en `MarcoPublico` (mismos tokens, fondo y tarjetas que el panel, en el tema del
 * visitante). Es un texto largo, así que se navega: en escritorio un índice fijo a la izquierda
 * que marca la sección que se está leyendo; en el teléfono, un `<select>` «Ir a…» arriba.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Home, Store } from 'lucide-react';
import MarcoPublico from '@/components/public/MarcoPublico';
import Segmentado from '@/components/ui/Segmentado';
import { BTN_SECONDARY } from '@/components/ui/Button';

/** El selector nativo del teléfono, igual que el «Ir a…» de Generación de Contenido. */
const SELECT_MOVIL = 'field-control field-select appearance-none w-full h-11 px-3 bg-digi-darker border-2 border-digi-border text-[14px] text-digi-text focus:border-accent focus:outline-none';
/** La etiqueta pequeña en mayúsculas del panel (`.ep-titulo`). */
const ETIQUETA = 'text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--etiqueta)]';
const TARJETA = 'bg-digi-card border border-digi-border rounded-xl';

interface Bi { es: string; en: string }

interface Section {
  imageIndex: number;
  title: Bi;
  narrative: Bi;
}

interface HighlightItem {
  label: Bi;
  value: Bi;
}

interface TechItem {
  name: string;
  category?: string;
  description?: Bi;
}

interface PublicDocs {
  hero: {
    title: Bi;
    subtitle: Bi;
  };
  highlights?: HighlightItem[];
  sections: Section[];
  techStack?: {
    title: Bi;
    items: TechItem[];
  };
}

interface Props {
  docs: PublicDocs;
  images: string[];
  publishedAt: string | null;
  initialLang: 'es' | 'en';
  token: string;
}

const LABELS = {
  es: {
    kicker: 'Caso de estudio',
    published: 'Publicado',
    backToMarket: 'Ver marketplace',
    home: 'Ir al inicio',
    index: 'Contenido',
    goTo: 'Ir a…',
    highlights: 'En cifras',
    disclaimer: 'Este caso de estudio es una presentación pública. Nombres, datos y marcas pueden ser genéricos para proteger información confidencial del cliente.',
  },
  en: {
    kicker: 'Case study',
    published: 'Published',
    backToMarket: 'View marketplace',
    home: 'Go to home',
    index: 'Contents',
    goTo: 'Go to…',
    highlights: 'At a glance',
    disclaimer: 'This case study is a public presentation. Names, data and brands may be generic to protect confidential client information.',
  },
} as const;

const idSeccion = (i: number) => `doc-seccion-${i}`;
const ID_TECNOLOGIA = 'doc-tecnologia';

export default function PublicDocsView({ docs, images, publishedAt, initialLang }: Props) {
  const [lang, setLang] = useState<'es' | 'en'>(initialLang);
  const t = LABELS[lang];

  const validSections = docs.sections.filter((s) => {
    const idx = Number(s.imageIndex);
    return Number.isInteger(idx) && idx >= 0 && idx < images.length;
  });
  const hayTecnologia = !!docs.techStack && docs.techStack.items.length > 0;

  // El índice: las secciones y, al final, la tecnología.
  const indice = [
    ...validSections.map((s, i) => ({ id: idSeccion(i), texto: `${String(i + 1).padStart(2, '0')} · ${s.title[lang]}` })),
    ...(hayTecnologia ? [{ id: ID_TECNOLOGIA, texto: docs.techStack!.title[lang] }] : []),
  ];

  // La sección que se está leyendo, para marcarla en el índice.
  const [activa, setActiva] = useState<string | null>(null);
  useEffect(() => {
    const els = indice.map((x) => document.getElementById(x.id)).filter(Boolean) as HTMLElement[];
    if (!els.length || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver((entradas) => {
      const visibles = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visibles[0]) setActiva(visibles[0].target.id);
    }, { rootMargin: '-80px 0px -60% 0px' });
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice.length, lang]);

  const ir = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiva(id);
  };

  const heroImage = images[0] || null;
  const publishedLabel = publishedAt
    ? new Date(publishedAt).toLocaleDateString(lang === 'es' ? 'es-EC' : 'en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : null;

  const grouped = hayTecnologia
    ? docs.techStack!.items.reduce<Record<string, TechItem[]>>((acc, it) => {
        (acc[it.category || 'General'] ||= []).push(it);
        return acc;
      }, {})
    : {};

  return (
    <MarcoPublico ancho="amplio">
      {/* ── Cabecera: qué es, cuándo se publicó y el idioma ── */}
      <div className="flex items-center justify-between gap-3">
        <p className={`${ETIQUETA} min-w-0 truncate`}>
          {t.kicker}{publishedLabel && <span className="normal-case tracking-normal font-normal"> · {t.published} {publishedLabel}</span>}
        </p>
        <Segmentado className="w-[112px] shrink-0" etiqueta="Idioma" valor={lang} onChange={setLang}
          opciones={[{ valor: 'es', texto: 'ES' }, { valor: 'en', texto: 'EN' }]} />
      </div>

      <section className={`${TARJETA} mt-4 overflow-hidden`}>
        {heroImage && (
          <div className="border-b border-digi-border bg-digi-darker">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImage} alt="" className="w-full max-h-[340px] object-cover object-top" />
          </div>
        )}
        <div className="p-5 sm:p-8">
          <h1 className="titulo-progreso text-[26px] sm:text-[34px] leading-[1.15] text-digi-text">{docs.hero.title[lang]}</h1>
          <p className="mt-3 max-w-3xl text-[15px] sm:text-[16px] leading-relaxed text-digi-muted">{docs.hero.subtitle[lang]}</p>
        </div>
      </section>

      {/* ── Cifras ── */}
      {docs.highlights && docs.highlights.length > 0 && (
        <section className={`${TARJETA} mt-4 p-5 sm:p-6`} aria-label={t.highlights}>
          <p className={ETIQUETA}>{t.highlights}</p>
          <dl className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            {docs.highlights.map((h, i) => (
              <div key={i} className="min-w-0 border-l-2 border-accent/50 pl-3">
                <dt className="text-[12px] text-digi-muted">{h.label[lang]}</dt>
                <dd className="mt-0.5 text-[15px] font-semibold text-digi-text break-words">{h.value[lang]}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {validSections.length === 0 && !hayTecnologia ? (
        <p className="text-center text-digi-muted text-sm py-16">{t.disclaimer}</p>
      ) : (
        <div className="mt-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8 lg:items-start">
          {/* ── Índice: fijo en escritorio, «Ir a…» en el teléfono ── */}
          {indice.length > 1 && (
            <>
              <nav aria-label={t.index} className={`${TARJETA} hidden lg:block sticky top-20 p-3`}>
                <p className={`${ETIQUETA} px-2 pb-2`}>{t.index}</p>
                <ul className="space-y-0.5">
                  {indice.map((x) => (
                    <li key={x.id}>
                      <button type="button" onClick={() => ir(x.id)} aria-current={activa === x.id ? 'location' : undefined}
                        className={`w-full text-left rounded-lg px-2 py-1.5 text-[13px] leading-snug transition-colors ${
                          activa === x.id ? 'bg-accent-light text-accent font-semibold' : 'text-digi-muted hover:text-digi-text hover:bg-black/[0.04]'}`}>
                        {x.texto}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
              <label className="lg:hidden block mb-4">
                <span className="sr-only">{t.goTo}</span>
                <select className={SELECT_MOVIL} value="" onChange={(e) => e.target.value && ir(e.target.value)}>
                  <option value="">{t.goTo}</option>
                  {indice.map((x) => <option key={x.id} value={x.id}>{x.texto}</option>)}
                </select>
              </label>
            </>
          )}

          <div className={`min-w-0 space-y-4 ${indice.length > 1 ? '' : 'lg:col-span-2'}`}>
            {validSections.map((section, i) => (
              <article key={i} id={idSeccion(i)} className={`${TARJETA} scroll-mt-20 p-5 sm:p-6`}>
                <p className={ETIQUETA}>{String(i + 1).padStart(2, '0')}</p>
                <h2 className="titulo-progreso mt-1 text-[20px] sm:text-[22px] leading-snug text-digi-text">{section.title[lang]}</h2>
                <p className="mt-3 text-[14.5px] sm:text-[15px] leading-relaxed text-digi-text/85 whitespace-pre-wrap break-words">
                  {section.narrative[lang]}
                </p>
                <div className="mt-5 rounded-lg border border-digi-border bg-digi-darker overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={images[section.imageIndex]} alt={section.title[lang]} className="w-full h-auto object-contain" loading="lazy" />
                </div>
              </article>
            ))}

            {/* ── Tecnología ── */}
            {hayTecnologia && (
              <section id={ID_TECNOLOGIA} className={`${TARJETA} scroll-mt-20 p-5 sm:p-6`}>
                <h2 className="titulo-progreso text-[20px] sm:text-[22px] leading-snug text-digi-text">{docs.techStack!.title[lang]}</h2>
                <div className="mt-4 space-y-5">
                  {Object.keys(grouped).map((cat) => (
                    <div key={cat}>
                      <h3 className={ETIQUETA}>{cat}</h3>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                        {grouped[cat].map((item, i) => (
                          <div key={i} className="bg-digi-card border border-digi-border rounded-lg px-3.5 py-3 min-w-0">
                            <p className="text-[14px] font-semibold text-digi-text break-words">{item.name}</p>
                            {item.description && (
                              <p className="mt-1 text-[12.5px] leading-relaxed text-digi-muted">{item.description[lang]}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {/* ── Pie ── */}
      <footer className="mt-10 space-y-4 text-center">
        <p className="text-[12px] text-digi-muted leading-relaxed max-w-2xl mx-auto">{t.disclaimer}</p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
          <Link href="/" className={BTN_SECONDARY}><Home className="w-4 h-4" /> {t.home}</Link>
          <Link href="/dashboard/marketplace" className={BTN_SECONDARY}><Store className="w-4 h-4" /> {t.backToMarket}</Link>
        </div>
        <p className="text-[11px] text-digi-muted">© GCC World · Grupo Corazones Cruzados</p>
      </footer>
    </MarcoPublico>
  );
}
