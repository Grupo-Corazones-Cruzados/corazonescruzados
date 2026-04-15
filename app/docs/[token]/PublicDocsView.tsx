'use client';

import { useState } from 'react';
import Link from 'next/link';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;
const sf = { fontFamily: "'Inter', sans-serif" } as const;

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
    published: 'Publicado',
    backToMarket: 'Ver marketplace',
    home: 'Ir al inicio',
    langToggle: 'EN',
    disclaimer: 'Este caso de estudio es una presentacion publica. Nombres, datos y marcas pueden ser genericos para proteger informacion confidencial del cliente.',
  },
  en: {
    published: 'Published',
    backToMarket: 'View marketplace',
    home: 'Go to home',
    langToggle: 'ES',
    disclaimer: 'This case study is a public presentation. Names, data and brands may be generic to protect confidential client information.',
  },
} as const;

export default function PublicDocsView({ docs, images, publishedAt, initialLang }: Props) {
  const [lang, setLang] = useState<'es' | 'en'>(initialLang);
  const t = LABELS[lang];

  const validSections = docs.sections.filter((s) => {
    const idx = Number(s.imageIndex);
    return Number.isInteger(idx) && idx >= 0 && idx < images.length;
  });

  const heroImage = images[0] || null;
  const publishedLabel = publishedAt
    ? new Date(publishedAt).toLocaleDateString(lang === 'es' ? 'es-EC' : 'en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : null;

  return (
    <div className="min-h-screen bg-digi-darker text-digi-text" style={sf}>
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b-2 border-digi-border bg-digi-darker/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-[11px] text-accent-glow hover:text-accent transition-colors" style={pf}>
            GCC WORLD
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
              className="px-3 py-1.5 text-[9px] text-accent-glow border border-accent/40 hover:bg-accent/10 transition-colors"
              style={pf}
              aria-label={`Switch to ${t.langToggle}`}
            >
              {t.langToggle}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b-2 border-digi-border">
        {heroImage && (
          <div className="absolute inset-0 opacity-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImage} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-digi-darker/60 via-digi-darker/80 to-digi-darker" />
          </div>
        )}
        <div className="relative max-w-5xl mx-auto px-4 py-20 md:py-28 text-center">
          <h1
            className="text-3xl md:text-5xl font-bold text-white mb-4"
            style={{ ...pf, letterSpacing: '0.02em', textShadow: '0 0 30px rgba(123, 95, 191, 0.4)' }}
          >
            {docs.hero.title[lang]}
          </h1>
          <p className="text-sm md:text-base text-digi-text/80 max-w-2xl mx-auto leading-relaxed">
            {docs.hero.subtitle[lang]}
          </p>
          {publishedLabel && (
            <p className="text-[9px] text-digi-muted mt-6" style={mf}>
              {t.published}: {publishedLabel}
            </p>
          )}
        </div>
      </section>

      {/* Highlights */}
      {docs.highlights && docs.highlights.length > 0 && (
        <section className="border-b-2 border-digi-border bg-digi-card/30">
          <div className="max-w-5xl mx-auto px-4 py-10">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {docs.highlights.map((h, i) => (
                <div
                  key={i}
                  className="border border-digi-border bg-digi-darker/60 px-4 py-3 hover:border-accent/60 transition-colors"
                >
                  <p className="text-[9px] text-accent-glow/80 uppercase tracking-wider mb-1" style={pf}>
                    {h.label[lang]}
                  </p>
                  <p className="text-sm text-white font-medium">{h.value[lang]}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Sections */}
      <main className="max-w-5xl mx-auto px-4 py-12 space-y-20">
        {validSections.length === 0 ? (
          <p className="text-center text-digi-muted text-sm py-16">{t.disclaimer}</p>
        ) : (
          validSections.map((section, i) => {
            const imgUrl = images[section.imageIndex];
            const reverse = i % 2 === 1;
            return (
              <article
                key={i}
                className={`grid md:grid-cols-2 gap-8 md:gap-12 items-center ${reverse ? 'md:[&>div:first-child]:order-2' : ''}`}
              >
                <div className="relative group">
                  <div
                    className="absolute -inset-1 bg-gradient-to-br from-accent/40 to-accent-glow/20 blur-xl opacity-50 group-hover:opacity-70 transition-opacity"
                    aria-hidden
                  />
                  <div className="relative border-2 border-digi-border bg-digi-card overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgUrl}
                      alt={section.title[lang]}
                      className="w-full h-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-accent-glow" style={pf}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="h-px flex-1 bg-digi-border" />
                  </div>
                  <h2 className="text-xl md:text-2xl font-semibold text-white leading-tight">
                    {section.title[lang]}
                  </h2>
                  <p className="text-sm md:text-[15px] text-digi-text/85 leading-relaxed whitespace-pre-wrap">
                    {section.narrative[lang]}
                  </p>
                </div>
              </article>
            );
          })
        )}
      </main>

      {/* Tech Stack */}
      {docs.techStack && docs.techStack.items.length > 0 && (
        <section className="border-t-2 border-digi-border bg-digi-card/30">
          <div className="max-w-5xl mx-auto px-4 py-14">
            <div className="flex items-center gap-3 mb-8">
              <span className="h-px flex-1 bg-digi-border" />
              <h2 className="text-lg md:text-xl text-accent-glow" style={pf}>
                {docs.techStack.title[lang]}
              </h2>
              <span className="h-px flex-1 bg-digi-border" />
            </div>
            {(() => {
              const grouped = docs.techStack!.items.reduce<Record<string, TechItem[]>>((acc, it) => {
                const cat = it.category || (lang === 'es' ? 'General' : 'General');
                (acc[cat] ||= []).push(it);
                return acc;
              }, {});
              const categories = Object.keys(grouped);
              return (
                <div className="space-y-8">
                  {categories.map((cat) => (
                    <div key={cat}>
                      <h3 className="text-[10px] text-accent-glow/70 uppercase tracking-wider mb-3" style={pf}>
                        {cat}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {grouped[cat].map((item, i) => (
                          <div
                            key={i}
                            className="border border-digi-border bg-digi-darker/60 px-4 py-3 hover:border-accent/60 transition-colors"
                          >
                            <p className="text-sm text-white font-semibold mb-1">{item.name}</p>
                            {item.description && (
                              <p className="text-[11px] text-digi-text/70 leading-relaxed">
                                {item.description[lang]}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t-2 border-digi-border mt-16">
        <div className="max-w-5xl mx-auto px-4 py-10 space-y-4 text-center">
          <p className="text-[10px] text-digi-muted leading-relaxed max-w-2xl mx-auto" style={mf}>
            {t.disclaimer}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/"
              className="px-3 py-1.5 text-[9px] text-digi-muted border border-digi-border hover:text-white hover:border-accent transition-colors"
              style={pf}
            >
              {t.home}
            </Link>
            <Link
              href="/dashboard/marketplace"
              className="px-3 py-1.5 text-[9px] text-accent-glow border border-accent/40 hover:bg-accent/10 transition-colors"
              style={pf}
            >
              {t.backToMarket}
            </Link>
          </div>
          <p className="text-[8px] text-digi-muted/60" style={pf}>
            © GCC WORLD · Grupo Corazones Cruzados
          </p>
        </div>
      </footer>
    </div>
  );
}
