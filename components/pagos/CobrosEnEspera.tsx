'use client';

/**
 * LOS PAGOS POR TRANSFERENCIA QUE ESPERAN CONFIRMACIÓN — definición ÚNICA.
 *
 * «la confirmación solo la puede hacer el usuario que recibirá el pago desde la página de
 * detalle de lo que se esté ofreciendo» (Fernando, 2026-08-26). Este componente ES esa
 * confirmación, y se monta igual en el detalle del proyecto, del ticket y de la suscripción:
 * si cada módulo tuviera el suyo, el día que cambie algo del cobro habría tres sitios que
 * arreglar y solo se arreglarían dos.
 *
 * ⚠️ CONFIRMAR NO ES UN TRÁMITE: es decir «este dinero está en mi banco». Por eso la pantalla
 * empuja a mirar antes —el comprobante se abre en una pestaña, el importe va en grande— y por
 * eso rechazar **exige escribir un motivo**, que es lo que el cliente va a leer.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Landmark, FileText, Check, X, Loader2 } from 'lucide-react';
import { fmt2 } from '@/lib/format';

type Cobro = {
  id: number;
  charge_amount: string;
  net_amount: string;
  fee_amount: string;
  payer_email: string | null;
  proof_at: string | null;
  proof_bank: string | null;
  proof_reference: string | null;
  billing_snapshot: any;
};

export default function CobrosEnEspera({ tipo, id, alConfirmar }: {
  tipo: 'project' | 'ticket' | 'subscription' | 'product';
  id: string | number;
  /** Para que el detalle recargue sus propios datos: la factura y la etapa acaban de cambiar. */
  alConfirmar?: () => void;
}) {
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [rechazando, setRechazando] = useState<number | null>(null);
  const [motivo, setMotivo] = useState('');

  const cargar = useCallback(() => {
    fetch(`/api/pagos/en-espera?tipo=${tipo}&id=${id}`)
      .then(r => r.json())
      .then(d => setCobros(d.data || []))
      // Silencioso a propósito: quien no puede confirmar tampoco tiene que ver un error por
      // ello. Simplemente no le sale el bloque.
      .catch(() => setCobros([]));
  }, [tipo, id]);

  useEffect(() => { cargar(); }, [cargar]);

  if (cobros.length === 0) return null;

  const decidir = async (cobroId: number, accion: 'confirmar' | 'rechazar') => {
    if (accion === 'rechazar' && motivo.trim().length < 4) {
      toast.error('Escribe por qué se rechaza: el cliente lo va a leer.');
      return;
    }
    setOcupado(cobroId);
    try {
      const res = await fetch(`/api/pagos/${cobroId}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, motivo }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'No se pudo completar');

      if (accion === 'confirmar') {
        toast[d.aviso ? 'warning' : 'success'](
          d.aviso || (d.facturaAutorizada ? 'Pago confirmado y factura emitida' : 'Pago confirmado'),
        );
      } else {
        toast.success('Comprobante rechazado');
      }
      setRechazando(null);
      setMotivo('');
      cargar();
      alConfirmar?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="bg-digi-card border-2 border-amber-400 rounded-lg p-4 shadow-sm">
      <h3 className="flex items-center gap-2 text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-2">
        <Landmark className="w-3.5 h-3.5" />
        {cobros.length === 1 ? 'Pago por transferencia sin confirmar' : `${cobros.length} pagos sin confirmar`}
      </h3>

      <div className="space-y-3">
        {cobros.map((c) => {
          const quien = c.billing_snapshot?.name || c.payer_email || 'Cliente';
          return (
            <div key={c.id} className="rounded border border-digi-border bg-digi-darker p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-digi-text truncate">{quien}</div>
                  <div className="text-[11.5px] text-digi-muted">
                    {c.proof_bank === 'guayaquil' ? 'Banco Guayaquil' : c.proof_bank === 'pichincha' ? 'Banco Pichincha' : 'Transferencia'}
                    {c.proof_reference ? ` · Nº ${c.proof_reference}` : ''}
                    {c.proof_at ? ` · ${new Date(c.proof_at).toLocaleDateString('es-EC')}` : ''}
                  </div>
                </div>
                <div className="text-[16px] font-semibold tabular-nums text-digi-text shrink-0">
                  ${fmt2(Number(c.charge_amount))}
                </div>
              </div>

              {/* Mirar el comprobante ANTES de decidir es el trabajo entero, así que va
                  primero y en grande, no escondido en un icono. */}
              <a href={`/api/pagos/${c.id}/comprobante`} target="_blank" rel="noopener noreferrer"
                className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-accent hover:underline">
                <FileText className="w-3.5 h-3.5" /> Ver el comprobante
              </a>

              {rechazando === c.id ? (
                <div className="mt-3 space-y-2">
                  <input value={motivo} onChange={e => setMotivo(e.target.value)} autoFocus
                    placeholder="¿Por qué se rechaza? El cliente lo va a leer"
                    className="field-control w-full px-2.5 py-1.5 bg-digi-card border border-digi-border text-[12px] text-digi-text focus:border-accent focus:outline-none" />
                  <div className="flex gap-2">
                    <button onClick={() => decidir(c.id, 'rechazar')} disabled={ocupado === c.id}
                      className="flex-1 px-3 py-1.5 text-[12px] font-medium rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                      Rechazar
                    </button>
                    <button onClick={() => { setRechazando(null); setMotivo(''); }}
                      className="px-3 py-1.5 text-[12px] rounded border border-digi-border text-digi-muted hover:text-digi-text">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => decidir(c.id, 'confirmar')} disabled={ocupado === c.id}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                    {ocupado === c.id
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Emitiendo…</>
                      : <><Check className="w-3.5 h-3.5" /> Confirmar y facturar</>}
                  </button>
                  <button onClick={() => setRechazando(c.id)} disabled={ocupado === c.id}
                    className="px-3 py-1.5 text-[12px] rounded border border-digi-border text-digi-muted hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-50">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[10.5px] text-digi-muted leading-relaxed">
        Confirma solo si ya viste el dinero en tu banco. Al confirmar se emite la factura
        electrónica, que no se puede deshacer sin una nota de crédito.
      </p>
    </div>
  );
}
