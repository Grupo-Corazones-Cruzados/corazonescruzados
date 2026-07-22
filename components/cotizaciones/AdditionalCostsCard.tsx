'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import PixelModal from '@/components/ui/PixelModal';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { Plus, Trash2 } from 'lucide-react';
import { fmt2 } from '@/lib/format';

const mf = { fontFamily: 'var(--font-body)' } as const;
const pf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

type Cost = { label: string; description?: string; amount: number };

/**
 * Tarjeta "Costos adicionales" (servicios de proveedores externos) del proyecto. Muestra la
 * lista y su total; al editar abre un PANEL LATERAL DERECHO (PixelModal md) para agregar/
 * quitar/editar costos manualmente. Se guarda en `projects.additional_costs`.
 */
export default function AdditionalCostsCard({ projectId, costs, canEdit, onSaved }: {
  projectId: number | string; costs: Cost[]; canEdit?: boolean; onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Cost[]>([]);
  const [saving, setSaving] = useState(false);

  const list = Array.isArray(costs) ? costs : [];
  const total = list.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  const openEdit = () => { setItems(list.map((c) => ({ label: c.label, description: c.description || '', amount: Number(c.amount) || 0 }))); setOpen(true); };
  const add = () => setItems((i) => [...i, { label: '', description: '', amount: 0 }]);
  const upd = (idx: number, patch: Partial<Cost>) => setItems((i) => i.map((c, k) => (k === idx ? { ...c, ...patch } : c)));
  const del = (idx: number) => setItems((i) => i.filter((_, k) => k !== idx));

  const save = async () => {
    setSaving(true);
    try {
      const clean = items.map((c) => ({ label: c.label.trim(), description: (c.description || '').trim(), amount: Number(c.amount) || 0 })).filter((c) => c.label);
      const r = await fetch(`/api/quotes/${projectId}/additional-costs`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ additional_costs: clean }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      toast.success('Costos adicionales actualizados');
      setOpen(false); onSaved?.();
    } catch (e: any) { toast.error(e.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const editTotal = items.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  return (
    <div className="bg-digi-card border border-digi-border rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide" style={pf}>Costos adicionales</h3>
        {canEdit && <button onClick={openEdit} className="text-[11px] text-accent border border-accent/30 px-1.5 py-0.5 rounded hover:bg-accent/10 transition-colors" style={pf}>Editar</button>}
      </div>

      {list.length === 0 ? (
        <p className="text-[12px] text-digi-muted" style={mf}>Sin costos adicionales de proveedores.</p>
      ) : (
        <div className="space-y-1.5">
          {list.map((c, i) => (
            <div key={i} className="flex items-start justify-between gap-2 text-[12px]">
              <div className="min-w-0">
                <p className="text-digi-text font-medium" style={mf}>{c.label}</p>
                {c.description && <p className="text-digi-muted text-[11px]" style={mf}>{c.description}</p>}
              </div>
              <span className="text-digi-text tabular-nums shrink-0" style={mf}>${fmt2(Number(c.amount))}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 border-t border-digi-border text-[12px] font-semibold" style={mf}>
            <span className="text-digi-muted">Total adicionales</span>
            <span className="text-accent tabular-nums">${fmt2(total)}</span>
          </div>
        </div>
      )}

      {/* Panel derecho de edición */}
      <PixelModal open={open} onClose={() => setOpen(false)} title="Costos adicionales" size="md">
        <div className="space-y-3">
          <p className="text-[12px] text-digi-muted" style={mf}>Servicios de proveedores externos que el cliente debe adquirir (hosting, dominio, pasarela de pago, APIs, licencias…). Se incluyen en la cotización compartida.</p>
          <div className="space-y-2">
            {items.map((c, i) => (
              <div key={i} className="rounded-lg border border-digi-border p-2.5 bg-digi-darker/30">
                <div className="flex items-center gap-2">
                  <input value={c.label} onChange={(e) => upd(i, { label: e.target.value })} placeholder="Servicio (ej. Hosting anual)"
                    className="field-control flex-1 px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                  <div className="relative w-28 shrink-0">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-digi-muted text-[12px]">$</span>
                    <input type="number" value={c.amount} onChange={(e) => upd(i, { amount: Number(e.target.value) })} placeholder="0.00" min="0"
                      className="field-control w-full pl-5 pr-2 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                  </div>
                  <button onClick={() => del(i)} aria-label="Quitar" className="shrink-0 p-1.5 rounded text-digi-muted hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                <input value={c.description || ''} onChange={(e) => upd(i, { description: e.target.value })} placeholder="Descripción (opcional)"
                  className="field-control w-full mt-1.5 px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[12px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
              </div>
            ))}
          </div>
          <button onClick={add} className="w-full inline-flex items-center justify-center gap-1.5 py-2 border border-dashed border-digi-border rounded-lg text-[12px] text-digi-muted hover:border-accent hover:text-accent transition-colors" style={mf}>
            <Plus className="w-4 h-4" /> Agregar costo
          </button>

          {items.length > 0 && (
            <div className="flex justify-between text-[13px] font-semibold pt-1" style={mf}>
              <span className="text-digi-muted">Total adicionales</span>
              <span className="text-accent tabular-nums">${fmt2(editTotal)}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-digi-border">
            <button onClick={() => setOpen(false)} className={`${BTN_SECONDARY} flex-1`}>Cancelar</button>
            <button onClick={save} disabled={saving} className={`${BTN_PRIMARY} flex-1 disabled:opacity-50`}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </div>
      </PixelModal>
    </div>
  );
}
