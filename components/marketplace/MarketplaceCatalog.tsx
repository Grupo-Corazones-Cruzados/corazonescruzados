'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import ImageGallery from '@/components/ui/ImageGallery';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { FolderKanban, Package, Workflow, Search, X, ListChecks, FileText, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { fmt2 } from '@/lib/format';

// Dashboard es Fluent (.corp): --font-display y --font-body resuelven a Segoe UI.
const mf = { fontFamily: 'var(--font-body)' } as const;
const pf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

export type CatalogTab = { value: string; label: string; Icon: any };

// Catálogo base compartido entre la vista con sesión y la pública.
const CATALOG_TABS: CatalogTab[] = [
  { value: 'projects', label: 'Proyectos', Icon: FolderKanban },
  { value: 'products', label: 'Productos', Icon: Package },
  { value: 'automations', label: 'Automatizaciones', Icon: Workflow },
];
const CATALOG_VALUES = new Set(CATALOG_TABS.map((t) => t.value));

const TAB_TO_TYPE: Record<string, string> = {
  projects: 'project',
  products: 'product',
  automations: 'automation',
};

export interface MarketplaceCatalogProps {
  /** Acción del botón principal de cada tarjeta (Comprar / Solicitar / gate público). */
  onPrimaryAction: (item: any) => void;
  /** Pestañas extra (p. ej. "Mis pedidos") que solo aplican con sesión. */
  tabsExtra?: CatalogTab[];
  /** Contenido de una pestaña extra (no-catálogo). */
  renderExtra?: (value: string) => React.ReactNode;
  /** Notifica el cambio de pestaña (p. ej. para cargar pedidos on-demand). */
  onTabChange?: (value: string) => void;
}

/**
 * Catálogo del Marketplace (rail de categorías + buscador + tarjetas + panel de
 * detalle + galería). Es la ÚNICA fuente del diseño de navegación del marketplace:
 * la usan tanto la página con sesión (`/dashboard/marketplace`) como la pública
 * (`/marketplace-publico`). Los endpoints de datos son públicos, así que ambas
 * variantes leen exactamente lo mismo; solo cambia el botón principal (prop
 * `onPrimaryAction`) y las pestañas extra con sesión (prop `tabsExtra`).
 */
export default function MarketplaceCatalog({ onPrimaryAction, tabsExtra = [], renderExtra, onTabChange }: MarketplaceCatalogProps) {
  const tabs = [...CATALOG_TABS, ...tabsExtra];
  const [tab, setTabState] = useState('projects');
  const isCatalog = CATALOG_VALUES.has(tab);

  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  // Image gallery modal
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryTitle, setGalleryTitle] = useState('');
  const [galleryLoading, setGalleryLoading] = useState(false);

  // Right detail panel
  const [selected, setSelected] = useState<any>(null);
  const [panelImages, setPanelImages] = useState<string[]>([]);
  const [panelImgLoading, setPanelImgLoading] = useState(false);

  // Marketplace published projects
  const [marketplaceProjects, setMarketplaceProjects] = useState<any[]>([]);

  const setTab = (v: string) => { setTabState(v); onTabChange?.(v); };

  const fetchMarketplaceProjects = useCallback(async () => {
    try {
      // Fetch both: published completed projects + portfolio project items
      const [mpRes, pfRes] = await Promise.all([
        fetch(`/api/marketplace/projects${search ? `?search=${encodeURIComponent(search)}` : ''}`),
        fetch(`/api/portfolio/public?type=project`),
      ]);
      const mpData = await mpRes.json();
      const pfData = await pfRes.json();

      const portfolioItems = (pfData.data || []).map((p: any) => ({
        ...p, source_type: 'portfolio', final_cost: p.price, team: [], requirements_count: 0, member_photo: p.member_photo,
      }));
      const mpItems = (mpData.data || []).map((p: any) => ({ ...p, source_type: 'project' }));

      setMarketplaceProjects([...mpItems, ...portfolioItems]);
    } catch { setMarketplaceProjects([]); }
  }, [search]);

  const fetchItems = useCallback(async () => {
    const type = TAB_TO_TYPE[tab];
    if (!type) return;
    try {
      const res = await fetch(`/api/portfolio/public?type=${type}`);
      const data = await res.json();
      setItems(data.data || []);
    } catch { setItems([]); }
  }, [tab]);

  useEffect(() => {
    if (tab === 'projects') fetchMarketplaceProjects();
    else if (CATALOG_VALUES.has(tab)) fetchItems();
  }, [tab, fetchItems, fetchMarketplaceProjects]);

  const filtered = items.filter((i: any) =>
    !search || i.title?.toLowerCase().includes(search.toLowerCase())
  );

  // --- Gallery ---
  const openGallery = async (item: any, e: React.MouseEvent) => {
    e.stopPropagation();

    if (item.source_type === 'project' && !item.images) {
      if (!item.image_count) {
        toast.info('Este proyecto no tiene imagenes');
        return;
      }
      setGalleryTitle(item.title || '');
      setGalleryImages([]);
      setGalleryIndex(0);
      setGalleryLoading(true);
      setGalleryOpen(true);
      try {
        const res = await fetch(`/api/marketplace/projects/${item.id}`);
        const data = await res.json();
        const imgs: string[] = data?.data?.images || [];
        if (imgs.length === 0) {
          toast.info('Este proyecto no tiene imagenes');
          setGalleryOpen(false);
          return;
        }
        setGalleryImages(imgs);
      } catch {
        toast.error('No se pudieron cargar las imagenes');
        setGalleryOpen(false);
      } finally {
        setGalleryLoading(false);
      }
      return;
    }

    const imgs: string[] = [];
    if (item.images?.length > 0) {
      imgs.push(...item.images);
    } else if (item.image_url) {
      imgs.push(item.image_url);
    }
    if (imgs.length === 0) {
      toast.info('Este registro no tiene imagenes');
      return;
    }
    setGalleryImages(imgs);
    setGalleryIndex(0);
    setGalleryTitle(item.title || '');
    setGalleryOpen(true);
  };

  // --- Image count helper ---
  const imageCount = (item: any) => {
    if (item.images?.length > 0) return item.images.length;
    if (typeof item.image_count === 'number') return item.image_count;
    return item.image_url ? 1 : 0;
  };

  const tabLabel = tab === 'projects' ? 'proyectos' : tab === 'products' ? 'productos' : 'automatizaciones';

  // Clear the detail panel when switching catalog tab.
  useEffect(() => { setSelected(null); setPanelImages([]); }, [tab]);

  const selectItem = async (item: any) => {
    setSelected(item);
    setPanelImages([]);
    if (item.images?.length) { setPanelImages(item.images); return; }
    if (item.image_url) { setPanelImages([item.image_url]); return; }
    if (item.source_type === 'project' && item.image_count) {
      setPanelImgLoading(true);
      try {
        const res = await fetch(`/api/marketplace/projects/${item.id}`);
        const data = await res.json();
        setPanelImages(data?.data?.images || []);
      } catch { setPanelImages([]); }
      finally { setPanelImgLoading(false); }
    }
  };

  const openGalleryFromPanel = (k: number) => {
    if (!panelImages.length) return;
    setGalleryImages(panelImages); setGalleryIndex(k); setGalleryTitle(selected?.title || ''); setGalleryOpen(true);
  };

  const firstImage = (item: any): string | null =>
    (Array.isArray(item.images) && item.images[0]) || item.image_url || item.cover_image || null;

  const CardMembers = ({ item }: { item: any }) => {
    const team: any[] = item.team || [];
    const avatar = (photo: string | null, name: string, key: any) =>
      photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={key} src={photo} alt={name} title={name} className="w-5 h-5 rounded-full object-cover border border-digi-border -ml-1 first:ml-0" />
      ) : (
        <div key={key} title={name} className="w-5 h-5 rounded-full bg-accent-light border border-accent/20 flex items-center justify-center -ml-1 first:ml-0">
          <span className="text-[10px] font-semibold text-accent" style={mf}>{(name || '?').charAt(0).toUpperCase()}</span>
        </div>
      );
    if (team.length) return (
      <div className="flex items-center min-w-0">
        <div className="flex items-center pl-1">{team.slice(0, 3).map((m, i) => avatar(m.photo_url, m.name, i))}</div>
        <span className="text-[11px] text-digi-muted truncate ml-1.5" style={mf}>{team.length > 1 ? `${team.length} miembros` : team[0]?.name}</span>
      </div>
    );
    if (item.member_name) return (
      <div className="flex items-center gap-1.5 min-w-0">
        {avatar(item.member_photo, item.member_name, 'm')}
        <span className="text-[11px] text-digi-muted truncate" style={mf}>{item.member_name}</span>
      </div>
    );
    return <span className="text-[11px] text-digi-muted/60" style={mf}>Sin miembro</span>;
  };

  const renderCard = (item: any) => {
    const isProject = item.source_type === 'project';
    const price = Number(item.final_cost ?? item.price ?? 0);
    const img = firstImage(item);
    const count = imageCount(item);
    const active = selected?.id === item.id && selected?.source_type === item.source_type;
    const CatIcon = isProject ? FolderKanban : tab === 'automations' ? Workflow : Package;
    const catLabel = isProject ? 'Proyecto' : tab === 'automations' ? 'Automatización' : 'Producto';
    const tags: string[] = Array.isArray(item.tags) ? item.tags : [];
    return (
      <div
        key={`${item.source_type || tab}-${item.id}`}
        onClick={() => selectItem(item)}
        className={`group cursor-pointer flex flex-col bg-digi-card border rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md ${
          active ? 'border-accent ring-1 ring-accent/30' : 'border-digi-border hover:border-accent/40'
        }`}
      >
        {/* media */}
        <div className="relative aspect-[16/9] bg-digi-darker overflow-hidden">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={item.title} className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><CatIcon className="w-9 h-9 text-digi-muted/30" /></div>
          )}
          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-digi-card/85 text-digi-muted text-[10px] font-medium backdrop-blur-sm">{catLabel}</span>
          {count > 0 && (
            <button onClick={(e) => openGallery(item, e)} title={`Ver ${count} foto(s)`}
              className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/45 text-white text-[11px] backdrop-blur-sm hover:bg-black/65 transition-colors">
              <ImageIcon className="w-3 h-3" /> {count}
            </button>
          )}
        </div>
        {/* body */}
        <div className="p-3 flex flex-col flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[13.5px] font-semibold text-digi-text leading-snug line-clamp-2 flex-1" style={mf}>{item.title}</h3>
            <span className="text-[15px] font-bold text-accent tabular-nums shrink-0" style={mf}>${fmt2(price)}</span>
          </div>
          {item.description && <p className="text-[12px] text-digi-muted mt-1 line-clamp-2 leading-relaxed" style={mf}>{item.description}</p>}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.slice(0, 3).map((t) => <PixelBadge key={t}>{t}</PixelBadge>)}
            </div>
          )}
          <div className="flex items-center justify-between gap-2 mt-auto pt-2.5 border-t border-digi-border/60">
            <CardMembers item={item} />
            {isProject && item.requirements_count != null && (
              <span className="inline-flex items-center gap-1 text-[11px] text-digi-muted shrink-0" style={mf}><ListChecks className="w-3.5 h-3.5" /> {item.requirements_count}</span>
            )}
          </div>
          <button onClick={(e) => { e.stopPropagation(); onPrimaryAction(item); }} className={`${BTN_PRIMARY} w-full mt-3`}>
            {isProject ? 'Solicitar proyecto' : 'Comprar'}
          </button>
        </div>
      </div>
    );
  };

  const renderMarketplacePanel = () => {
    if (!selected) {
      return (
        <div className="bg-digi-card border border-digi-border rounded-lg p-6 text-center lg:sticky lg:top-4">
          <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2">
            <FolderKanban className="w-5 h-5 text-digi-muted" />
          </div>
          <p className="text-[12px] text-digi-muted" style={mf}>Selecciona un elemento para ver sus detalles e imágenes.</p>
        </div>
      );
    }
    const t = selected;
    const isProject = t.source_type === 'project';
    const price = Number(t.final_cost ?? t.price ?? 0);
    const docsUrl = t.public_docs_token ? `${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.grupocc.org'}/docs/${t.public_docs_token}` : null;
    const rows: [string, React.ReactNode][] = [
      ['Precio', <span key="p" className="text-accent font-semibold tabular-nums" style={mf}>${fmt2(price)}</span>],
    ];
    if (t.member_name) rows.push(['Miembro', t.member_name]);
    if (isProject && t.requirements_count != null) rows.push(['Requerimientos', String(t.requirements_count)]);
    if (Array.isArray(t.tags) && t.tags.length) rows.push(['Tags', t.tags.slice(0, 4).join(', ')]);
    return (
      <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm overflow-hidden lg:sticky lg:top-4">
        <div className="flex items-start gap-3 p-4 border-b border-digi-border">
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold text-digi-text leading-tight" style={mf}>{t.title}</h3>
            <p className="text-[11px] text-digi-muted mt-0.5 capitalize" style={mf}>{isProject ? 'Proyecto' : tabLabel.replace(/s$/, '')}</p>
          </div>
          <button onClick={() => setSelected(null)} className="text-digi-muted hover:text-digi-text shrink-0" aria-label="Cerrar"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <ImageGallery key={t.id + (isProject ? '-p' : '')} images={panelImages} loading={panelImgLoading} alt={t.title} onOpen={openGalleryFromPanel} />
          {t.description && <p className="text-[12px] text-digi-text leading-relaxed" style={mf}>{t.description}</p>}
          <dl className="space-y-2">
            {rows.map(([k, v], i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-[12px]">
                <dt className="text-digi-muted" style={mf}>{k}</dt>
                <dd className="text-digi-text text-right" style={mf}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="space-y-2 pt-1">
            <button onClick={() => onPrimaryAction(t)} className={`${BTN_PRIMARY} w-full`}>
              {isProject ? 'Solicitar proyecto' : 'Comprar'}
            </button>
            {docsUrl && (
              <a href={docsUrl} target="_blank" rel="noreferrer" className={`${BTN_SECONDARY} w-full`}>
                <FileText className="w-4 h-4" /> Ver documentación <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  const cards = tab === 'projects'
    ? marketplaceProjects.filter((p: any) => !search || p.title?.toLowerCase().includes(search.toLowerCase()))
    : filtered;

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      {/* ── Left rail: categorías ── */}
      <aside className="w-full lg:w-[220px] shrink-0 bg-digi-card border border-digi-border rounded-lg p-2">
        <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-2 pt-1 pb-2" style={df}>Catálogo</p>
        <div className="space-y-0.5">
          {tabs.map((t) => {
            const active = tab === t.value;
            return (
              <button key={t.value} onClick={() => setTab(t.value)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors border-l-2 ${
                  active ? 'bg-accent-light border-accent text-accent' : 'border-transparent text-digi-text hover:bg-black/[0.03]'
                }`}>
                <t.Icon className={`w-4 h-4 shrink-0 ${active ? 'text-accent' : 'text-digi-muted'}`} />
                <span className="flex-1 min-w-0 text-[12.5px] font-medium truncate" style={mf}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Right region: command bar + contenido ── */}
      <div className="flex-1 min-w-0 w-full">
        {isCatalog && (
          <div className="relative w-full sm:max-w-xs mb-3">
            <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..."
              className="field-control w-full pl-8 pr-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none"
              style={mf} />
          </div>
        )}

        {!isCatalog ? (
          renderExtra?.(tab)
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
            <div className="min-w-0">
              {!cards.length ? (() => {
                const EmptyIcon = tab === 'projects' ? FolderKanban : tab === 'automations' ? Workflow : Package;
                return (
                  <div className="bg-digi-card border border-digi-border rounded-xl py-16 text-center">
                    <div className="w-12 h-12 rounded-xl bg-black/[0.03] flex items-center justify-center mx-auto mb-3"><EmptyIcon className="w-6 h-6 text-digi-muted" /></div>
                    <p className="text-sm font-medium text-digi-text" style={mf}>Sin {tabLabel}</p>
                    <p className="text-[13px] text-digi-muted mt-1" style={mf}>No hay {tabLabel} publicados por ahora.</p>
                  </div>
                );
              })() : (
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">{cards.map(renderCard)}</div>
              )}
            </div>

            <aside className="w-full xl:w-[360px]">
              {renderMarketplacePanel()}
            </aside>
          </div>
        )}
      </div>

      {/* ========== IMAGE GALLERY MODAL ========== */}
      <PixelModal open={galleryOpen} onClose={() => setGalleryOpen(false)} title={galleryTitle || 'Galeria'} size="lg">
        {galleryLoading && galleryImages.length === 0 && (
          <div className="flex items-center justify-center min-h-[200px]">
            <span className="text-[10px] text-digi-muted animate-pulse" style={mf}>Cargando imagenes...</span>
          </div>
        )}
        {galleryImages.length > 0 && (
          <div className="space-y-3">
            <div className="relative border-2 border-digi-border bg-black/20 flex items-center justify-center min-h-[200px]">
              <img
                src={galleryImages[galleryIndex]}
                alt={`Foto ${galleryIndex + 1}`}
                className="max-w-full max-h-[50vh] object-contain"
              />
              {galleryImages.length > 1 && (
                <>
                  <button
                    onClick={() => setGalleryIndex((p) => (p - 1 + galleryImages.length) % galleryImages.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-digi-darker/80 border border-digi-border text-digi-text hover:border-accent hover:text-accent font-medium transition-colors"
                    style={pf}
                  >
                    &lt;
                  </button>
                  <button
                    onClick={() => setGalleryIndex((p) => (p + 1) % galleryImages.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-digi-darker/80 border border-digi-border text-digi-text hover:border-accent hover:text-accent font-medium transition-colors"
                    style={pf}
                  >
                    &gt;
                  </button>
                </>
              )}
            </div>
            <div className="text-center">
              <span className="text-[10px] text-digi-muted" style={mf}>
                {galleryIndex + 1} / {galleryImages.length}
              </span>
            </div>
            {galleryImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {galleryImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setGalleryIndex(i)}
                    className={`flex-shrink-0 w-16 h-16 border-2 overflow-hidden transition-colors ${
                      i === galleryIndex ? 'border-accent' : 'border-digi-border/50 hover:border-digi-border'
                    }`}
                  >
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
