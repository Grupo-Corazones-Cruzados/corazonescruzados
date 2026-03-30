'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import PixelTabs from '@/components/ui/PixelTabs';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';

const TABS = [
  { value: 'projects', label: 'Proyectos' },
  { value: 'products', label: 'Productos' },
  { value: 'automations', label: 'Automatizaciones' },
  { value: 'orders', label: 'Mis Pedidos' },
];

const ORDER_STATUS: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning',
  confirmed: 'info',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'error',
};

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

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

  // Order detail modal
  const [orderModal, setOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

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
  const openGallery = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
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
    return item.image_url ? 1 : 0;
  };

  // --- Tab label for empty state ---
  const tabLabel = tab === 'projects' ? 'proyectos' : tab === 'products' ? 'productos' : 'automatizaciones';

  return (
    <div>
      <PageHeader title="Marketplace" description="Explora servicios y productos" />

      <div className="mb-4">
        <input
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none w-full max-w-xs"
          style={mf}
        />
      </div>

      <PixelTabs tabs={TABS} active={tab} onChange={setTab} />

      {/* ========== ORDERS TAB ========== */}
      {tab === 'orders' ? (
        <PixelDataTable
          columns={[
            { key: 'id', header: 'ID', render: (o: any) => `#${o.id}`, width: '60px' },
            {
              key: 'items', header: 'Productos', render: (o: any) => {
                if (!o.items?.length) return '-';
                return o.items.map((i: any) => i.product_title).filter(Boolean).join(', ') || '-';
              },
            },
            { key: 'total', header: 'Total', render: (o: any) => `$${Number(o.total || 0).toFixed(2)}`, width: '100px' },
            {
              key: 'status', header: 'Estado', render: (o: any) => (
                <PixelBadge variant={ORDER_STATUS[o.status] || 'default'}>{o.status}</PixelBadge>
              ), width: '110px',
            },
            {
              key: 'date', header: 'Fecha', render: (o: any) =>
                o.created_at ? new Date(o.created_at).toLocaleDateString() : '-',
              width: '100px',
            },
          ]}
          data={orders}
          onRowClick={(o: any) => { setSelectedOrder(o); setOrderModal(true); }}
          emptyTitle="Sin pedidos"
          emptyDesc="No has realizado ningun pedido aun."
        />
      ) : tab === 'projects' ? (
        /* ========== MARKETPLACE PROJECTS TABLE ========== */
        <PixelDataTable
          columns={[
            {
              key: 'images', header: 'Fotos', width: '70px',
              render: (p: any) => {
                const imgs = p.images || [];
                return (
                  <button
                    onClick={(e) => openGallery(p, e)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 border transition-colors ${
                      imgs.length > 0 ? 'border-accent/40 text-accent-glow hover:bg-accent/10' : 'border-digi-border/30 text-digi-muted/40 cursor-default'
                    }`}
                    disabled={imgs.length === 0}
                    title={imgs.length > 0 ? `Ver ${imgs.length} foto(s)` : 'Sin fotos'}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="1" y="3" width="14" height="10" rx="1" /><circle cx="5.5" cy="7" r="1.5" /><path d="M14 13L10.5 9L7.5 12L5.5 10.5L2 13" />
                    </svg>
                    <span className="text-[9px]" style={mf}>{imgs.length}</span>
                  </button>
                );
              },
            },
            { key: 'title', header: 'Proyecto', render: (p: any) => (
              <span className="text-white">{p.title}</span>
            )},
            { key: 'team', header: 'Equipo', render: (p: any) => {
              const team = p.team || [];
              if (team.length === 0 && p.member_name) return (
                <div className="flex items-center gap-1" title={p.member_name}>
                  {p.member_photo ? (
                    <img src={p.member_photo} alt={p.member_name} className="w-5 h-5 rounded-full object-cover border border-digi-border" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-accent/30 border border-accent/50 flex items-center justify-center">
                      <span className="text-[7px] text-accent-glow" style={pf}>{p.member_name?.charAt(0)}</span>
                    </div>
                  )}
                </div>
              );
              if (team.length === 0) return <span className="text-digi-muted">-</span>;
              return (
                <div className="flex items-center gap-1">
                  {team.slice(0, 3).map((m: any, i: number) => (
                    m.photo_url ? (
                      <img key={i} src={m.photo_url} alt={m.name} className="w-5 h-5 rounded-full object-cover border border-digi-border" title={m.name} />
                    ) : (
                      <div key={i} className="w-5 h-5 rounded-full bg-accent/30 border border-accent/50 flex items-center justify-center" title={m.name}>
                        <span className="text-[7px] text-accent-glow" style={pf}>{m.name?.charAt(0)}</span>
                      </div>
                    )
                  ))}
                  {team.length > 3 && <span className="text-[9px] text-digi-muted" style={mf}>+{team.length - 3}</span>}
                </div>
              );
            }, width: '120px' },
            { key: 'reqs', header: 'Reqs', render: (p: any) => (
              <span className="text-digi-muted" style={mf}>{p.requirements_count}</span>
            ), width: '60px' },
            { key: 'price', header: 'Precio', width: '100px', render: (p: any) => (
              <span className="text-accent-glow" style={mf}>${Number(p.final_cost || 0).toFixed(2)}</span>
            )},
            { key: 'actions', header: '', width: '90px', render: (p: any) => (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (p.source_type === 'project') { setSelectedProject(p); setRequestModal(true); }
                  else { openBuyModal(p); }
                }}
                className="text-[9px] text-accent-glow border border-accent/40 px-2 py-0.5 hover:bg-accent/10 transition-colors"
                style={pf}
              >
                {p.source_type === 'project' ? 'Solicitar' : 'Comprar'}
              </button>
            )},
          ]}
          data={marketplaceProjects.filter((p: any) => !search || p.title?.toLowerCase().includes(search.toLowerCase()))}
          emptyTitle="Sin proyectos"
          emptyDesc="No hay proyectos publicados en el marketplace aun."
        />
      ) : (
        /* ========== ITEMS TABLE (Products / Automations) ========== */
        <PixelDataTable
          columns={[
            { key: 'id', header: 'ID', render: (item: any) => `#${item.id}`, width: '60px' },
            {
              key: 'images', header: 'Fotos', width: '70px',
              render: (item: any) => {
                const count = imageCount(item);
                return (
                  <button
                    onClick={(e) => openGallery(item, e)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 border transition-colors ${
                      count > 0
                        ? 'border-accent/40 text-accent-glow hover:bg-accent/10'
                        : 'border-digi-border/30 text-digi-muted/40 cursor-default'
                    }`}
                    disabled={count === 0}
                    title={count > 0 ? `Ver ${count} foto(s)` : 'Sin fotos'}
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
            { key: 'title', header: 'Titulo', render: (item: any) => (
              <span className="text-white">{item.title}</span>
            )},
            {
              key: 'tags', header: 'Tags', render: (item: any) => (
                <div className="flex flex-wrap gap-1">
                  {(item.tags || []).slice(0, 3).map((t: string) => (
                    <PixelBadge key={t}>{t}</PixelBadge>
                  ))}
                </div>
              ),
            },
            { key: 'member', header: 'Miembro', render: (item: any) => item.member_name || '-', width: '120px' },
            {
              key: 'price', header: 'Precio', width: '100px',
              render: (item: any) => (
                <span className="text-accent-glow">${Number(item.price || 0).toFixed(2)}</span>
              ),
            },
            {
              key: 'actions', header: '', width: '80px',
              render: (item: any) => Number(item.price || 0) > 0 ? (
                <button
                  onClick={(e) => { e.stopPropagation(); openBuyModal(item); }}
                  className="text-[9px] text-accent-glow border border-accent/40 px-2 py-0.5 hover:bg-accent/10 transition-colors"
                  style={pf}
                >
                  Comprar
                </button>
              ) : null,
            },
          ]}
          data={filtered}
          emptyTitle={`Sin ${tabLabel}`}
          emptyDesc={`No hay ${tabLabel} registrados aun.`}
        />
      )}

      {/* ========== IMAGE GALLERY MODAL ========== */}
      <PixelModal open={galleryOpen} onClose={() => setGalleryOpen(false)} title={galleryTitle || 'Galeria'} size="lg">
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
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-digi-darker/80 border border-digi-border text-digi-text hover:border-accent hover:text-accent-glow transition-colors"
                    style={pf}
                  >
                    &lt;
                  </button>
                  <button
                    onClick={() => setGalleryIndex((p) => (p + 1) % galleryImages.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-digi-darker/80 border border-digi-border text-digi-text hover:border-accent hover:text-accent-glow transition-colors"
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
              <h3 className="text-xs text-white mb-1" style={pf}>{selectedItem.title}</h3>
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
              <span className="text-digi-text">${Number(selectedItem.price || 0).toFixed(2)}</span>
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

            <div className="pixel-card !bg-accent/5 !border-accent/30">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-accent-glow" style={pf}>Total a pagar</span>
                <span className="text-sm text-white font-bold" style={mf}>${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="text-[9px] text-digi-muted" style={mf}>
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
              <h3 className="text-xs text-white mb-1" style={pf}>{selectedProject.title}</h3>
              {selectedProject.description && (
                <p className="text-[10px] text-digi-muted" style={mf}>{selectedProject.description}</p>
              )}
            </div>

            {selectedProject.team?.length > 0 && (
              <div>
                <span className="text-[9px] text-digi-muted block mb-1.5" style={pf}>Equipo asignado</span>
                <div className="flex flex-wrap gap-2">
                  {selectedProject.team.map((m: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 px-2 py-1 border border-digi-border bg-digi-darker">
                      {m.photo_url ? (
                        <img src={m.photo_url} alt={m.name} className="w-4 h-4 rounded-full object-cover" />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-accent/30 flex items-center justify-center">
                          <span className="text-[6px] text-accent-glow" style={pf}>{m.name?.charAt(0)}</span>
                        </div>
                      )}
                      <span className="text-[9px] text-digi-text" style={mf}>{m.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between text-[10px] py-1 border-b border-digi-border/30" style={mf}>
              <span className="text-digi-muted">Requerimientos</span>
              <span className="text-digi-text">{selectedProject.requirements_count}</span>
            </div>

            <div className="pixel-card !bg-accent/5 !border-accent/30">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-accent-glow" style={pf}>Costo del proyecto</span>
                <span className="text-sm text-white font-bold" style={mf}>${Number(selectedProject.final_cost || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="text-[9px] text-digi-muted" style={mf}>
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
              <span className="text-white">${Number(selectedOrder.total || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[10px] py-1 border-b border-digi-border/30" style={mf}>
              <span className="text-digi-muted">Fecha</span>
              <span className="text-digi-text">{selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleDateString() : '-'}</span>
            </div>

            {selectedOrder.items && selectedOrder.items.length > 0 && (
              <div>
                <h4 className="text-[10px] text-accent-glow mb-2" style={pf}>Items</h4>
                <div className="space-y-2">
                  {selectedOrder.items.map((item: any) => (
                    <div key={item.id} className="pixel-card !py-2 !px-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] text-white" style={pf}>{item.product_title || `Producto #${item.product_id}`}</p>
                          {item.member_name && (
                            <p className="text-[9px] text-digi-muted mt-0.5" style={mf}>por {item.member_name}</p>
                          )}
                          <p className="text-[9px] text-digi-muted" style={mf}>
                            {item.quantity}x ${Number(item.unit_price || 0).toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-white" style={mf}>${Number(item.subtotal || 0).toFixed(2)}</p>
                          {item.member_confirmed === true && <PixelBadge variant="success">Confirmado</PixelBadge>}
                          {item.member_confirmed === false && <PixelBadge variant="error">Rechazado</PixelBadge>}
                          {item.member_confirmed === null && <PixelBadge variant="warning">Pendiente</PixelBadge>}
                        </div>
                      </div>
                      {item.member_message && (
                        <p className="text-[9px] text-digi-muted mt-1 border-t border-digi-border/30 pt-1" style={mf}>
                          {item.member_message}
                        </p>
                      )}
                      {item.delivery_date && (
                        <p className="text-[9px] text-accent-glow mt-0.5" style={mf}>
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
