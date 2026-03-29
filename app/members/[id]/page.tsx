'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelTabs from '@/components/ui/PixelTabs';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelModal from '@/components/ui/PixelModal';
import BrandLoader from '@/components/ui/BrandLoader';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

const PORTFOLIO_TABS = [
  { value: 'project', label: 'Proyectos' },
  { value: 'product', label: 'Productos' },
  { value: 'automation', label: 'Automatizaciones' },
];

export default function MemberProfilePage() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [portfolioTab, setPortfolioTab] = useState('project');

  // Image gallery
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryTitle, setGalleryTitle] = useState('');

  useEffect(() => {
    fetch(`/api/members/${id}/public`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <BrandLoader size="lg" label="Cargando perfil..." />
      </div>
    );
  }

  if (!data?.member) {
    return (
      <div className="max-w-2xl mx-auto pixel-card text-center py-12">
        <p className="pixel-heading text-sm text-red-400">Miembro no encontrado</p>
        <Link href="/#equipo" className="text-[10px] text-accent-glow mt-3 inline-block" style={pf}>&lt; Volver al equipo</Link>
      </div>
    );
  }

  const { member, cv, portfolio } = data;
  const education = cv?.education || [];
  const experience = cv?.experience || [];
  const filteredPortfolio = (portfolio || []).filter((p: any) => p.type === portfolioTab);

  const openGallery = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const imgs: string[] = item.images?.length > 0 ? item.images : item.image_url ? [item.image_url] : [];
    if (imgs.length === 0) return;
    setGalleryImages(imgs);
    setGalleryIndex(0);
    setGalleryTitle(item.title || '');
    setGalleryOpen(true);
  };

  const imageCount = (item: any) => {
    if (item.images?.length > 0) return item.images.length;
    return item.image_url ? 1 : 0;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/#equipo" className="text-[10px] text-accent-glow opacity-60 hover:opacity-100 mb-4 inline-block" style={pf}>&lt; Volver al equipo</Link>

      {/* ===== HEADER ===== */}
      <div className="pixel-card flex flex-col sm:flex-row items-center sm:items-start gap-5 mb-6">
        {member.photo_url ? (
          <img src={member.photo_url} alt={member.name} className="w-24 h-24 object-cover border-2 border-accent/50 shrink-0" />
        ) : (
          <div className="w-24 h-24 flex items-center justify-center bg-accent/20 border-2 border-accent/50 text-accent-glow text-2xl shrink-0" style={pf}>
            {member.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>
        )}
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-sm text-white mb-1" style={pf}>{member.name}</h1>
          {member.position && (
            <p className="text-[10px] text-accent-glow mb-2" style={pf}>{member.position}</p>
          )}
          {cv?.bio && (
            <p className="text-xs text-digi-muted leading-relaxed" style={mf}>{cv.bio}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
            {cv?.linkedin_url && (
              <a href={cv.linkedin_url} target="_blank" rel="noopener noreferrer"
                className="text-[9px] text-accent-glow border border-accent/30 px-2 py-0.5 hover:bg-accent/10 transition-colors" style={pf}>
                LinkedIn
              </a>
            )}
            {cv?.website_url && (
              <a href={cv.website_url} target="_blank" rel="noopener noreferrer"
                className="text-[9px] text-accent-glow border border-accent/30 px-2 py-0.5 hover:bg-accent/10 transition-colors" style={pf}>
                Website
              </a>
            )}
            {member.phone && (
              <a href={`https://wa.me/${member.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                className="text-[9px] text-green-400 border border-green-500/30 px-2 py-0.5 hover:bg-green-900/10 transition-colors" style={pf}>
                WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ===== SKILLS & LANGUAGES ===== */}
      {(cv?.skills?.length > 0 || cv?.languages?.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {cv.skills?.length > 0 && (
            <div className="pixel-card">
              <h3 className="text-[10px] text-accent-glow mb-2" style={pf}>Skills</h3>
              <div className="flex flex-wrap gap-1.5">
                {cv.skills.map((s: string) => <PixelBadge key={s}>{s}</PixelBadge>)}
              </div>
            </div>
          )}
          {cv.languages?.length > 0 && (
            <div className="pixel-card">
              <h3 className="text-[10px] text-accent-glow mb-2" style={pf}>Idiomas</h3>
              <div className="flex flex-wrap gap-1.5">
                {cv.languages.map((l: string) => <PixelBadge key={l} variant="info">{l}</PixelBadge>)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== EDUCATION ===== */}
      {education.length > 0 && (
        <div className="pixel-card mb-6">
          <h3 className="text-[10px] text-accent-glow mb-3" style={pf}>Educacion</h3>
          <div className="space-y-3">
            {education.map((edu: any, i: number) => (
              <div key={i} className="border-b border-digi-border/30 pb-3 last:border-0 last:pb-0">
                <p className="text-xs text-white" style={pf}>{edu.degree}{edu.field ? ` — ${edu.field}` : ''}</p>
                <p className="text-[10px] text-digi-muted mt-0.5" style={mf}>{edu.institution}</p>
                <p className="text-[9px] text-digi-muted/60 mt-0.5" style={mf}>
                  {edu.start_year}{edu.end_year ? ` - ${edu.end_year}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== EXPERIENCE ===== */}
      {experience.length > 0 && (
        <div className="pixel-card mb-6">
          <h3 className="text-[10px] text-accent-glow mb-3" style={pf}>Experiencia</h3>
          <div className="space-y-3">
            {experience.map((exp: any, i: number) => (
              <div key={i} className="border-b border-digi-border/30 pb-3 last:border-0 last:pb-0">
                <p className="text-xs text-white" style={pf}>{exp.position}</p>
                <p className="text-[10px] text-accent-glow mt-0.5" style={mf}>{exp.company}</p>
                {exp.description && (
                  <p className="text-[10px] text-digi-muted mt-1 leading-relaxed" style={mf}>{exp.description}</p>
                )}
                <p className="text-[9px] text-digi-muted/60 mt-0.5" style={mf}>
                  {exp.start_year}{exp.end_year ? ` - ${exp.end_year}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== PORTFOLIO ===== */}
      <div className="pixel-card">
        <h3 className="text-[10px] text-accent-glow mb-3" style={pf}>Portafolio</h3>
        <PixelTabs tabs={PORTFOLIO_TABS} active={portfolioTab} onChange={setPortfolioTab} />
        <PixelDataTable
          columns={[
            { key: 'id', header: 'ID', render: (item: any) => `#${item.id}`, width: '50px' },
            {
              key: 'images', header: 'Fotos', width: '65px',
              render: (item: any) => {
                const count = imageCount(item);
                return (
                  <button
                    onClick={(e) => openGallery(item, e)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 border transition-colors ${
                      count > 0 ? 'border-accent/40 text-accent-glow hover:bg-accent/10' : 'border-digi-border/30 text-digi-muted/40 cursor-default'
                    }`}
                    disabled={count === 0}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="1" y="3" width="14" height="10" rx="1" />
                      <circle cx="5.5" cy="7" r="1.5" />
                      <path d="M14 13L10.5 9L7.5 12L5.5 10.5L2 13" />
                    </svg>
                    <span className="text-[9px]" style={mf}>{count}</span>
                  </button>
                );
              },
            },
            { key: 'title', header: 'Titulo', render: (item: any) => <span className="text-white">{item.title}</span> },
            {
              key: 'tags', header: 'Tags', render: (item: any) => (
                <div className="flex flex-wrap gap-1">
                  {(item.tags || []).slice(0, 3).map((t: string) => <PixelBadge key={t}>{t}</PixelBadge>)}
                </div>
              ),
            },
            {
              key: 'price', header: 'Precio', width: '90px',
              render: (item: any) => <span className="text-accent-glow">${Number(item.price || 0).toFixed(2)}</span>,
            },
          ]}
          data={filteredPortfolio}
          emptyTitle={`Sin ${portfolioTab === 'project' ? 'proyectos' : portfolioTab === 'product' ? 'productos' : 'automatizaciones'}`}
          emptyDesc="Este miembro aun no tiene registros aqui."
        />
      </div>

      {/* ===== GALLERY MODAL ===== */}
      <PixelModal open={galleryOpen} onClose={() => setGalleryOpen(false)} title={galleryTitle || 'Galeria'} size="lg">
        {galleryImages.length > 0 && (
          <div className="space-y-3">
            <div className="relative border-2 border-digi-border bg-black/20 flex items-center justify-center min-h-[200px]">
              <img src={galleryImages[galleryIndex]} alt={`Foto ${galleryIndex + 1}`} className="max-w-full max-h-[50vh] object-contain" />
              {galleryImages.length > 1 && (
                <>
                  <button onClick={() => setGalleryIndex(p => (p - 1 + galleryImages.length) % galleryImages.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-digi-darker/80 border border-digi-border text-digi-text hover:border-accent hover:text-accent-glow transition-colors" style={pf}>&lt;</button>
                  <button onClick={() => setGalleryIndex(p => (p + 1) % galleryImages.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-digi-darker/80 border border-digi-border text-digi-text hover:border-accent hover:text-accent-glow transition-colors" style={pf}>&gt;</button>
                </>
              )}
            </div>
            <div className="text-center">
              <span className="text-[10px] text-digi-muted" style={mf}>{galleryIndex + 1} / {galleryImages.length}</span>
            </div>
            {galleryImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {galleryImages.map((img, i) => (
                  <button key={i} onClick={() => setGalleryIndex(i)}
                    className={`flex-shrink-0 w-16 h-16 border-2 overflow-hidden transition-colors ${i === galleryIndex ? 'border-accent' : 'border-digi-border/50 hover:border-digi-border'}`}>
                    <img src={img} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </PixelModal>
    </div>
  );
}
