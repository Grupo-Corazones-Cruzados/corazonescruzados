'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import PageHeader from '@/components/ui/PageHeader';
import ImageGallery from '@/components/ui/ImageGallery';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { FolderKanban, Package, Workflow, ShoppingBag, Search, X, Users, ListChecks, FileText, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { fmt2 } from '@/lib/format';

const TABS = [
  { value: 'projects', label: 'Proyectos', Icon: FolderKanban },
  { value: 'products', label: 'Productos', Icon: Package },
  { value: 'automations', label: 'Automatizaciones', Icon: Workflow },
  { value: 'orders', label: 'Mis pedidos', Icon: ShoppingBag },
];

const ORDER_STATUS: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning',
  confirmed: 'info',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'error',
};
const ORDER_LABEL: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmado', in_progress: 'En progreso',
  completed: 'Completado', cancelled: 'Cancelado',
};

// Dashboard es Fluent (.corp): --font-display y --font-body resuelven a Segoe UI.
const pf = { fontFamily: 'var(--font-body)' } as const;
const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

// Map tab value to API item_type
const TAB_TO_TYPE: Record<string, string> = {
  projects: 'project',
  products: 'product',
  automations: 'automation',
};

export default function MarketplacePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('projects');
  const [items, setItems] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  // Purchase modal
  const [buyModal, setBuyModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState('1');
  const [purchasing, setPurchasing] = useState(false);

  // Image gallery modal
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryTitle, setGalleryTitle] = useState('');
  const [galleryLoading, setGalleryLoading] = useState(false);

  // Order detail modal
  const [orderModal, setOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // Right detail panel
  const [selected, setSelected] = useState<any>(null);
  const [panelImages, setPanelImages] = useState<string[]>([]);
  const [panelImgLoading, setPanelImgLoading] = useState(false);

  // Marketplace published projects
  const [marketplaceProjects, setMarketplaceProjects] = useState<any[]>([]);
  const [requestModal, setRequestModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [requesting, setRequesting] = useState(false);

  const fetchMarketplaceProjects = useCallback(async () => {
    try {
      // Fetch both: published completed projects + portfolio project items
      const [mpRes, pfRes] = await Promise.all([
        fetch(`/api/marketplace/projects${search ? `?search=${encodeURIComponent(search)}` : ''}`),
        fetch(`/api/portfolio/public?type=project`),
      ]);
      const mpData = await mpRes.json();
      const pfData = await pfRes.json();

      // Normalize portfolio items to have a source_type marker
      const portfolioItems = (pfData.data || []).map((p: any) => ({
        ...p, source_type: 'portfolio', final_cost: p.price, team: [], requirements_count: 0, member_photo: p.member_photo,
      }));
      // Marketplace projects
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

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      setOrders(data.data || []);
    } catch { setOrders([]); }
  }, []);

  useEffect(() => {
    if (tab === 'orders') fetchOrders();
    else if (tab === 'projects') fetchMarketplaceProjects();
    else fetchItems();
  }, [tab, fetchItems, fetchOrders, fetchMarketplaceProjects]);

  const filtered = items.filter((i: any) =>
    !search || i.title?.toLowerCase().includes(search.toLowerCase())
  );

  // --- Gallery ---
  const openGallery = async (item: any, e: React.MouseEvent) => {
    e.stopPropagation();

    // Proyectos de marketplace: la lista solo trae metadatos (image_count).
    // Las imágenes se cargan recién aquí, solo del proyecto seleccionado.
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

    // Portfolio / otros: las imágenes ya vienen en el item.
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

  // --- Purchase ---
  const openBuyModal = (item: any) => {
    setSelectedItem(item);
    setQuantity('1');
    setBuyModal(true);
  };

  const handlePurchase = async () => {
    if (!selectedItem) return;
    const price = Number(selectedItem.price || 0);
    if (price <= 0) {
      toast.error('Este producto no tiene precio definido');
      return;
    }
    setPurchasing(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: selectedItem.id,
          quantity: selectedItem.allow_quantities ? Math.max(1, Math.floor(Number(quantity))) : 1,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al comprar');
      }
      toast.success('Pedido creado exitosamente');
      setBuyModal(false);
      setSelectedItem(null);
      setTab('orders');
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar compra');
    } finally {
      setPurchasing(false);
    }
  };

  const total = selectedItem
    ? Number(selectedItem.price || 0) * (selectedItem.allow_quantities ? Math.max(1, Math.floor(Number(quantity) || 1)) : 1)
    : 0;

  // --- Image count helper ---
  const imageCount = (item: any) => {
    if (item.images?.length > 0) return item.images.length;
    if (typeof item.image_count === 'number') return item.image_count;
    return item.image_url ? 1 : 0;
  };

  // --- Tab label for empty state ---
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

  const primaryAction = (item: any) => {
    if (item.source_type === 'project') { setSelectedProject(item); setRequestModal(true); }
    else openBuyModal(item);
  };

  const firstImage = (item: any): string | null =>
    (Array.isArray(item.images) && item.images[0]) || item.image_url || null;

  // Avatares de miembro/equipo para la tarjeta
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
          <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-digi-border/60">
            <CardMembers item={item} />
            {isProject && item.requirements_count != null && (
              <span className="inline-flex items-center gap-1 text-[11px] text-digi-muted shrink-0" style={mf}><ListChecks className="w-3.5 h-3.5" /> {item.requirements_count}</span>
            )}
          </div>
          <button onClick={(e) => { e.stopPropagation(); primaryAction(item); }} className={`${BTN_PRIMARY} w-full mt-3`}>
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
            <button onClick={() => primaryAction(t)} className={`${BTN_PRIMARY} w-full`}>
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

  return (
    <div>
      <PageHeader title="Marketplace" description="Proyectos, productos y automatizaciones del grupo" />

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* ── Left rail: categorías ── */}
        <aside className="w-full lg:w-[220px] shrink-0 bg-digi-card border border-digi-border rounded-lg p-2">
          <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-2 pt-1 pb-2" style={df}>Catálogo</p>
          <div className="space-y-0.5">
            {TABS.map((t) => {
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

        {/* ── Right region: command bar + tabla ── */}
        <div className="flex-1 min-w-0 w-full">
          {tab !== 'orders' && (
            <div className="relative w-full sm:max-w-xs mb-3">
              <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..."
                className="field-control w-full pl-8 pr-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none"
                style={mf} />
            </div>
          )}

          <div className={tab === 'orders' ? '' : 'grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start'}>
            <div className="min-w-0">
      {/* ========== MIS PEDIDOS (tabla) ========== */}
      {tab === 'orders' ? (
        <PixelDataTable
          singleLine
          columns={[
            { key: 'id', header: 'ID', width: '60px', render: (o: any) => <span className="tabular-nums text-digi-muted">#{o.id}</span> },
            { key: 'items', header: 'Productos', render: (o: any) => (o.items?.length ? (o.items.map((i: any) => i.product_title).filter(Boolean).join(', ') || '—') : '—') },
            { key: 'total', header: 'Total', width: '100px', render: (o: any) => <span className="text-accent tabular-nums">${fmt2(Number(o.total || 0))}</span> },
            { key: 'status', header: 'Estado', width: '120px', render: (o: any) => (
              <PixelBadge variant={ORDER_STATUS[o.status] || 'default'}>{ORDER_LABEL[o.status] || o.status}</PixelBadge>
            ) },
            { key: 'date', header: 'Fecha', width: '110px', render: (o: any) => <span className="text-digi-muted">{o.created_at ? new Date(o.created_at).toLocaleDateString('es-EC') : '—'}</span> },
          ]}
          data={orders}
          onRowClick={(o: any) => { setSelectedOrder(o); setOrderModal(true); }}
          emptyTitle="Sin pedidos"
          emptyDesc="No has realizado ningún pedido aún."
        />
      ) : (() => {
        const cards = tab === 'projects'
          ? marketplaceProjects.filter((p: any) => !search || p.title?.toLowerCase().includes(search.toLowerCase()))
          : filtered;
        if (!cards.length) {
          const EmptyIcon = tab === 'projects' ? FolderKanban : tab === 'automations' ? Workflow : Package;
          return (
            <div className="bg-digi-card border border-digi-border rounded-xl py-16 text-center">
              <div className="w-12 h-12 rounded-xl bg-black/[0.03] flex items-center justify-center mx-auto mb-3"><EmptyIcon className="w-6 h-6 text-digi-muted" /></div>
              <p className="text-sm font-medium text-digi-text" style={mf}>Sin {tabLabel}</p>
              <p className="text-[13px] text-digi-muted mt-1" style={mf}>No hay {tabLabel} publicados por ahora.</p>
            </div>
          );
        }
        return <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">{cards.map(renderCard)}</div>;
      })()}
            </div>

            {tab !== 'orders' && (
              <aside className="w-full xl:w-[360px]">
                {renderMarketplacePanel()}
              </aside>
            )}
          </div>
        </div>
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
            {/* Main image */}
            <div className="relative border-2 border-digi-border bg-black/20 flex items-center justify-center min-h-[200px]">
              <img
                src={galleryImages[galleryIndex]}
                alt={`Foto ${galleryIndex + 1}`}
                className="max-w-full max-h-[50vh] object-contain"
              />

              {/* Navigation arrows */}
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

            {/* Counter */}
            <div className="text-center">
              <span className="text-[10px] text-digi-muted" style={mf}>
                {galleryIndex + 1} / {galleryImages.length}
              </span>
            </div>

            {/* Thumbnails */}
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

      {/* ========== PURCHASE MODAL ========== */}
      <PixelModal open={buyModal} onClose={() => setBuyModal(false)} title="Confirmar Compra">
        {selectedItem && (
          <div className="space-y-4">
            {selectedItem.image_url && (
              <img
                src={selectedItem.image_url}
                alt={selectedItem.title}
                className="w-full h-40 object-cover border-2 border-digi-border"
              />
            )}

            <div>
              <h3 className="text-xs text-digi-text mb-1" style={pf}>{selectedItem.title}</h3>
              <p className="text-[10px] text-digi-muted" style={mf}>{selectedItem.description}</p>
            </div>

            {selectedItem.member_name && (
              <div className="flex justify-between text-[10px] py-1 border-b border-digi-border/30" style={mf}>
                <span className="text-digi-muted">Vendedor</span>
                <span className="text-digi-text">{selectedItem.member_name}</span>
              </div>
            )}

            <div className="flex justify-between text-[10px] py-1 border-b border-digi-border/30" style={mf}>
              <span className="text-digi-muted">Precio unitario</span>
              <span className="text-digi-text">${fmt2(Number(selectedItem.price || 0))}</span>
            </div>

            {selectedItem.allow_quantities && (
              <PixelInput
                label="Cantidad"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min={1}
              />
            )}

            <div className="bg-accent-light border border-accent/30 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-accent font-medium" style={pf}>Total a pagar</span>
                <span className="text-sm text-digi-text font-bold" style={mf}>${fmt2(total)}</span>
              </div>
            </div>

            <div className="text-[11px] text-digi-muted" style={mf}>
              Al confirmar, se creara un pedido pendiente. El miembro del equipo revisara y confirmara tu solicitud.
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setBuyModal(false)}
                className="flex-1 py-2 text-[10px] text-digi-muted border border-digi-border hover:bg-digi-darker transition-colors"
                style={pf}
              >
                Cancelar
              </button>
              <button
                onClick={handlePurchase}
                disabled={purchasing || total <= 0}
                className="flex-1 pixel-btn pixel-btn-primary disabled:opacity-50"
              >
                {purchasing ? 'Procesando...' : 'Confirmar Compra'}
              </button>
            </div>
          </div>
        )}
      </PixelModal>

      {/* ========== PROJECT REQUEST MODAL ========== */}
      <PixelModal open={requestModal} onClose={() => !requesting && setRequestModal(false)} title="Solicitar Proyecto">
        {selectedProject && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xs text-digi-text mb-1" style={pf}>{selectedProject.title}</h3>
              {selectedProject.description && (
                <p className="text-[10px] text-digi-muted" style={mf}>{selectedProject.description}</p>
              )}
            </div>

            {selectedProject.team?.length > 0 && (
              <div>
                <span className="text-[11px] text-digi-muted block mb-1.5" style={pf}>Equipo asignado</span>
                <div className="flex flex-wrap gap-2">
                  {selectedProject.team.map((m: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 px-2 py-1 border border-digi-border bg-digi-darker">
                      {m.photo_url ? (
                        <img src={m.photo_url} alt={m.name} className="w-4 h-4 rounded-full object-cover" />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-accent-light flex items-center justify-center">
                          <span className="text-[6px] text-accent font-medium" style={pf}>{m.name?.charAt(0)}</span>
                        </div>
                      )}
                      <span className="text-[11px] text-digi-text" style={mf}>{m.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between text-[10px] py-1 border-b border-digi-border/30" style={mf}>
              <span className="text-digi-muted">Requerimientos</span>
              <span className="text-digi-text">{selectedProject.requirements_count}</span>
            </div>

            <div className="bg-accent-light border border-accent/30 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-accent font-medium" style={pf}>Costo del proyecto</span>
                <span className="text-sm text-digi-text font-bold" style={mf}>${fmt2(Number(selectedProject.final_cost || 0))}</span>
              </div>
            </div>

            <div className="text-[11px] text-digi-muted" style={mf}>
              Se creara un proyecto privado con los mismos requerimientos y se invitara al equipo original.
              Si algun miembro no acepta, podras asignar otros profesionales.
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setRequestModal(false)}
                disabled={requesting}
                className="flex-1 py-2 text-[10px] text-digi-muted border border-digi-border hover:bg-digi-darker transition-colors"
                style={pf}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setRequesting(true);
                  try {
                    const res = await fetch('/api/marketplace/projects/purchase', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ source_project_id: selectedProject.id }),
                    });
                    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
                    const data = await res.json();
                    toast.success('Proyecto solicitado exitosamente');
                    setRequestModal(false);
                    window.location.href = `/dashboard/projects/${data.data.project_id}`;
                  } catch (e: any) { toast.error(e.message || 'Error al solicitar'); }
                  finally { setRequesting(false); }
                }}
                disabled={requesting}
                className="flex-1 pixel-btn pixel-btn-primary disabled:opacity-50"
              >
                {requesting ? 'Procesando...' : 'Confirmar Solicitud'}
              </button>
            </div>
          </div>
        )}
      </PixelModal>

      {/* ========== ORDER DETAIL MODAL ========== */}
      <PixelModal open={orderModal} onClose={() => setOrderModal(false)} title={`Pedido #${selectedOrder?.id || ''}`}>
        {selectedOrder && (
          <div className="space-y-3">
            <div className="flex justify-between text-[10px] py-1 border-b border-digi-border/30" style={mf}>
              <span className="text-digi-muted">Estado</span>
              <PixelBadge variant={ORDER_STATUS[selectedOrder.status] || 'default'}>{selectedOrder.status}</PixelBadge>
            </div>
            <div className="flex justify-between text-[10px] py-1 border-b border-digi-border/30" style={mf}>
              <span className="text-digi-muted">Total</span>
              <span className="text-digi-text">${fmt2(Number(selectedOrder.total || 0))}</span>
            </div>
            <div className="flex justify-between text-[10px] py-1 border-b border-digi-border/30" style={mf}>
              <span className="text-digi-muted">Fecha</span>
              <span className="text-digi-text">{selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleDateString() : '-'}</span>
            </div>

            {selectedOrder.items && selectedOrder.items.length > 0 && (
              <div>
                <h4 className="text-[10px] text-accent font-medium mb-2" style={pf}>Items</h4>
                <div className="space-y-2">
                  {selectedOrder.items.map((item: any) => (
                    <div key={item.id} className="bg-digi-card border border-digi-border rounded-lg py-2 px-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] text-digi-text" style={pf}>{item.product_title || `Producto #${item.product_id}`}</p>
                          {item.member_name && (
                            <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>por {item.member_name}</p>
                          )}
                          <p className="text-[11px] text-digi-muted" style={mf}>
                            {item.quantity}x ${fmt2(Number(item.unit_price || 0))}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-digi-text" style={mf}>${fmt2(Number(item.subtotal || 0))}</p>
                          {item.member_confirmed === true && <PixelBadge variant="success">Confirmado</PixelBadge>}
                          {item.member_confirmed === false && <PixelBadge variant="error">Rechazado</PixelBadge>}
                          {item.member_confirmed === null && <PixelBadge variant="warning">Pendiente</PixelBadge>}
                        </div>
                      </div>
                      {item.member_message && (
                        <p className="text-[11px] text-digi-muted mt-1 border-t border-digi-border/30 pt-1" style={mf}>
                          {item.member_message}
                        </p>
                      )}
                      {item.delivery_date && (
                        <p className="text-[11px] text-accent mt-0.5" style={mf}>
                          Entrega: {new Date(item.delivery_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </PixelModal>
    </div>
  );
}
