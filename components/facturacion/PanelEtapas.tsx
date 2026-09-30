'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { EditPanel, EditField, EDIT_INPUT } from '@/components/ui/EditDialog';
import BotonQuitar from '@/components/ui/BotonQuitar';
import { fmt2 } from '@/lib/format';

const pf = { fontFamily: 'var(--font-body)' } as const;

export type EtapaPlan = {
  id: number | null;
  name: string;
  amount: number | string;
  invoiceNumber?: string | null;
  /** Ya facturada o cobrada: ni se borra ni cambia de importe. */
  cerrada?: boolean;
};

/**
 * EL PLAN DE ETAPAS DE COBRO — definición ÚNICA para proyecto y ticket (2026-09-30).
 *
 * Nació dentro del detalle del proyecto; al llevarlo al ticket se extrajo aquí para que los dos
 * sean el mismo formulario. Reparte `base` —el total del proyecto, o lo consumido del ticket—:
 * se escriben las etapas y la ÚLTIMA recoge el resto (no se escribe). Una etapa cerrada
 * (facturada o cobrada) se ve pero no se toca. `endpoint` recibe `PUT { stages }`.
 */
export default function PanelEtapas({
  open, onClose, endpoint, base, etiquetaBase, etapas, onGuardado, avisoQuitar = 'Plan de etapas eliminado',
}: {
  open: boolean;
  onClose: () => void;
  endpoint: string;
  base: number;
  etiquetaBase: string;
  etapas: EtapaPlan[];
  onGuardado: (etapas: any[]) => void;
  avisoQuitar?: string;
}) {
  const [draft, setDraft] = useState<EtapaPlan[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(etapas.length > 0
      ? etapas.map((e) => ({ ...e, amount: String(e.amount) }))
      : [{ id: null, name: 'Etapa 1', amount: '' }, { id: null, name: 'Etapa 2', amount: '' }]);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const anteriores = draft.slice(0, -1).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const resto = Math.max(0, Math.round((base - anteriores) * 100) / 100);
  const hayCerradas = etapas.some((e) => e.cerrada);

  const enviar = async (stages: EtapaPlan[], ok: string) => {
    setGuardando(true);
    try {
      const r = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stages }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo guardar el plan');
      toast.success(ok);
      onGuardado(d.data || []);
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setGuardando(false); }
  };
  const guardar = () => {
    const limpio = draft.filter((e) => String(e.name).trim());
    if (limpio.length < 2) { toast.error('Define al menos dos etapas'); return; }
    enviar(limpio.map((e, i) => ({ id: e.id, name: String(e.name).trim(), amount: i === limpio.length - 1 && !e.cerrada ? resto : Number(e.amount) || 0 })), 'Etapas guardadas');
  };

  return (
    <EditPanel
      open={open}
      title="Etapas de facturación"
      onClose={() => !guardando && onClose()}
      onSave={guardar}
      saving={guardando}
      canSave={draft.filter((e) => String(e.name).trim()).length >= 2}
      saveLabel="Guardar etapas"
      danger={etapas.length > 0 && !hayCerradas ? { label: 'Quitar plan de etapas', onClick: () => enviar([], avisoQuitar) } : undefined}
    >
      <EditField label={etiquetaBase}>
        <div className={`${EDIT_INPUT} flex items-center justify-between opacity-70`}>
          <span>Base de reparto</span>
          <span className="tabular-nums">${fmt2(base)}</span>
        </div>
      </EditField>

      <div className="space-y-2">
        {draft.map((e, i) => {
          const esUltima = i === draft.length - 1;
          const cerrada = !!e.cerrada;
          return (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <label className="text-[11px] text-digi-muted mb-1 block" style={pf}>Etapa {i + 1}</label>
                <input value={e.name} disabled={cerrada}
                  onChange={(ev) => { const n = [...draft]; n[i] = { ...n[i], name: ev.target.value }; setDraft(n); }}
                  placeholder={`Etapa ${i + 1}`} className={EDIT_INPUT} />
              </div>
              <div className="w-28 shrink-0">
                <label className="text-[11px] text-digi-muted mb-1 block" style={pf}>{esUltima && !cerrada ? 'Resto' : 'Importe'}</label>
                <input
                  value={esUltima && !cerrada ? String(resto) : e.amount}
                  disabled={(esUltima && !cerrada) || cerrada}
                  onChange={(ev) => { const n = [...draft]; n[i] = { ...n[i], amount: ev.target.value }; setDraft(n); }}
                  type="number" min="0" step="0.01" placeholder="0.00"
                  className={`${EDIT_INPUT} tabular-nums ${esUltima || cerrada ? 'opacity-60' : ''}`} />
              </div>
              <BotonQuitar disabled={cerrada || draft.length <= 2} className="mb-1"
                onClick={() => setDraft(draft.filter((_, idx) => idx !== i))}
                etiqueta="Quitar etapa" title={cerrada ? 'Ya facturada o cobrada' : draft.length <= 2 ? 'Un plan necesita al menos dos etapas' : 'Quitar etapa'} />
            </div>
          );
        })}
        <button type="button"
          onClick={() => setDraft([...draft, { id: null, name: `Etapa ${draft.length + 1}`, amount: '' }])}
          className="inline-flex items-center gap-1 text-[12px] text-accent border border-accent/40 rounded px-2.5 py-1 hover:bg-accent-light transition-colors" style={pf}>
          <Plus className="w-3.5 h-3.5" /> Añadir etapa
        </button>
      </div>
    </EditPanel>
  );
}
