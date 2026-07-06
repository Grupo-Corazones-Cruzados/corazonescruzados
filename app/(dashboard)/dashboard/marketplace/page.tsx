'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import PageHeader from '@/components/ui/PageHeader';
import MarketplaceCatalog from '@/components/marketplace/MarketplaceCatalog';
import { ShoppingBag } from 'lucide-react';
import { fmt2 } from '@/lib/format';

// Dashboard es Fluent (.corp): --font-display y --font-body resuelven a Segoe UI.
const pf = { fontFamily: 'var(--font-body)' } as const;
const mf = { fontFamily: 'var(--font-body)' } as const;

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

export default function MarketplacePage() {
  const [orders, setOrders] = useState<any[]>([]);

  // Purchase modal
  const [buyModal, setBuyModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState('1');
  const [purchasing, setPurchasing] = useState(false);

  // Order detail modal
  const [orderModal, setOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // Project request modal
  const [requestModal, setRequestModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [requesting, setRequesting] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      setOrders(data.data || []);
    } catch { setOrders([]); }
  }, []);

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
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar compra');
    } finally {
      setPurchasing(false);
    }
  };

  const total = selectedItem
    ? Number(selectedItem.price || 0) * (selectedItem.allow_quantities ? Math.max(1, Math.floor(Number(quantity) || 1)) : 1)
    : 0;

  // El botón principal de cada tarjeta: proyecto → solicitar; producto/automatización → comprar.
  const handlePrimaryAction = (item: any) => {
    if (item.source_type === 'project') { setSelectedProject(item); setRequestModal(true); }
    else openBuyModal(item);
  };

  const renderOrders = () => (
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
  );

  return (
    <div>
      <PageHeader title="Marketplace" description="Proyectos, productos y automatizaciones del grupo" />

      <MarketplaceCatalog
        onPrimaryAction={handlePrimaryAction}
        tabsExtra={[{ value: 'orders', label: 'Mis pedidos', Icon: ShoppingBag }]}
        renderExtra={(v) => (v === 'orders' ? renderOrders() : null)}
        onTabChange={(v) => { if (v === 'orders') fetchOrders(); }}
      />

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
