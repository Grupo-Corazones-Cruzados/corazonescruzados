'use client';

/**
 * LOS PAGOS POR TRANSFERENCIA QUE ESPERAN CONFIRMACIÓN — definición ÚNICA.
 *
 * «la confirmación solo la puede hacer el usuario que recibirá el pago desde la página de
 * detalle de lo que se esté ofreciendo» (Fernando, 2026-08-26). Este archivo ES esa
 * confirmación, en dos formas que comparten datos, detalle y decisión:
 *
 *  - `CobrosEnEspera` (default) — la tarjeta del ticket y de la suscripción.
 *  - `VentanaTransferencia` — la ventanita centrada que abre el icono de la etapa en el
 *    detalle del proyecto (Fernando, 2026-10-01: la confirmación vive DENTRO de Pagos, en la
 *    etapa que se pagó, no en una tarjeta encima).
 *
 * Si cada módulo tuviera la suya, el día que cambie algo del cobro habría tres sitios que
 * arreglar y solo se arreglarían dos.
 *
 * ⚠️ CONFIRMAR NO ES UN TRÁMITE: es decir «este dinero está en mi banco». Por eso la pantalla
 * empuja a mirar antes —el comprobante se abre en una pestaña, el importe va en grande— y por
 * eso rechazar **exige escribir un motivo**, que es lo que el cliente va a leer.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FileText, Check, X, Loader2 } from 'lucide-react';
import { fmt2 } from '@/lib/format';
import PixelModal from '@/components/ui/PixelModal';
import { BTN_DANGER, BTN_SECONDARY } from '@/components/ui/Button';

export type CobroEnEspera = {
  id: number;
  /** La etapa del plan que paga, o `null` si cobra el origen entero. */
  stage_id: number | string | null;
  charge_amount: string;
  net_amount: string;
  fee_amount: string;
  payer_email: string | null;
  proof_at: string | null;
  proof_bank: string | null;
  proof_reference: string | null;
  billing_snapshot: any;
};

type Tipo = 'project' | 'ticket' | 'subscription' | 'product';

/** Los cobros en espera de un origen. Quien no puede confirmar recibe una lista vacía. */
export function useCobrosEnEspera(tipo: Tipo, id: string | number) {
  const [cobros, setCobros] = useState<CobroEnEspera[]>([]);
  const recargar = useCallback(() => {
    fetch(`/api/pagos/en-espera?tipo=${tipo}&id=${id}`)
      .then(r => r.json())
      .then(d => setCobros(d.data || []))
      // Silencioso a propósito: quien no puede confirmar tampoco tiene que ver un error por
      // ello. Simplemente no le sale nada que confirmar.
      .catch(() => setCobros([]));
  }, [tipo, id]);
  useEffect(() => { recargar(); }, [recargar]);
  return { cobros, recargar };
}

/** Confirma o rechaza un cobro. Devuelve `true` si se completó. */
async function decidirCobro(cobroId: number, accion: 'confirmar' | 'rechazar', motivo: string): Promise<boolean> {
  if (accion === 'rechazar' && motivo.trim().length < 4) {
    toast.error('Escribe por qué se rechaza: el cliente lo va a leer.');
    return false;
  }
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
    return true;
  } catch (e: any) {
    toast.error(e.message);
    return false;
  }
}

/** Quién pagó, por qué banco, cuánto y el comprobante. */
function DetalleCobro({ c }: { c: CobroEnEspera }) {
  const quien = c.billing_snapshot?.name || c.payer_email || 'Cliente';
  return (
    <>
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
    </>
  );
}

/**
 * La transferencia de UNA etapa, en ventanita centrada con overlay (Fernando, 2026-10-01).
 * Se monta solo con un cobro elegido —ver «Un <dialog> escondido bloquea toda la página»—.
 * La X la pone `PixelModal`: cerrar sin responder deja el cobro esperando, como estaba.
 */
export function VentanaTransferencia({ cobro, onClose, alDecidir }: {
  cobro: CobroEnEspera;
  onClose: () => void;
  /** Para que el detalle recargue: la factura, la etapa y la lista acaban de cambiar. */
  alDecidir: () => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');

  const decidir = async (accion: 'confirmar' | 'rechazar') => {
    if (accion === 'rechazar' && !rechazando) { setRechazando(true); return; }
    setOcupado(true);
    const ok = await decidirCobro(cobro.id, accion, motivo);
    setOcupado(false);
    if (ok) { alDecidir(); onClose(); }
  };

  return (
    <PixelModal open onClose={onClose} title="Transferencia" size="sm" busy={ocupado}>
      <div className="flex flex-col gap-3">
        <div className="rounded border border-digi-border bg-digi-darker p-3">
          <DetalleCobro c={cobro} />
        </div>

        {rechazando && (
          <input value={motivo} onChange={e => setMotivo(e.target.value)} autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && !ocupado) decidir('rechazar'); }}
            placeholder="¿Por qué se rechaza? El cliente lo va a leer"
            className="field-control w-full px-2.5 py-1.5 bg-digi-card border border-digi-border text-[12px] text-digi-text focus:outline-none" />
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-digi-border">
          {rechazando ? (
            <>
              <button type="button" onClick={() => { setRechazando(false); setMotivo(''); }} disabled={ocupado} className={BTN_SECONDARY}>
                Volver
              </button>
              <button type="button" onClick={() => decidir('rechazar')} disabled={ocupado} className={BTN_DANGER}>
                {ocupado ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Rechazando…</> : 'Rechazar'}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => decidir('confirmar')} disabled={ocupado}
                title="Confirma solo si ya viste el dinero en tu banco: la factura electrónica no se deshace sin una nota de crédito."
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-11 sm:min-h-0 rounded bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50">
                {ocupado
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Emitiendo…</>
                  : <><Check className="w-3.5 h-3.5" /> Confirmar y facturar</>}
              </button>
              <button type="button" onClick={() => decidir('rechazar')} disabled={ocupado} className={BTN_DANGER}>
                Rechazar
              </button>
            </>
          )}
        </div>
      </div>
    </PixelModal>
  );
}

/** La tarjeta del ticket y de la suscripción: todos los cobros en espera, uno debajo de otro. */
export default function CobrosEnEspera({ tipo, id, alConfirmar }: {
  tipo: Tipo;
  id: string | number;
  /** Para que el detalle recargue sus propios datos: la factura y la etapa acaban de cambiar. */
  alConfirmar?: () => void;
}) {
  const { cobros, recargar } = useCobrosEnEspera(tipo, id);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [rechazando, setRechazando] = useState<number | null>(null);
  const [motivo, setMotivo] = useState('');

  if (cobros.length === 0) return null;

  const decidir = async (cobroId: number, accion: 'confirmar' | 'rechazar') => {
    setOcupado(cobroId);
    const ok = await decidirCobro(cobroId, accion, motivo);
    setOcupado(null);
    if (!ok) return;
    setRechazando(null);
    setMotivo('');
    recargar();
    alConfirmar?.();
  };

  return (
    <div className="bg-digi-card border-2 border-amber-400 rounded-lg p-4 shadow-sm">
      <h3 className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-2">
        {cobros.length === 1 ? 'Transferencia' : `${cobros.length} transferencias`}
      </h3>

      <div className="space-y-3">
        {cobros.map((c) => (
          <div key={c.id} className="rounded border border-digi-border bg-digi-darker p-3">
            <DetalleCobro c={c} />

            {rechazando === c.id ? (
              <div className="mt-3 space-y-2">
                <input value={motivo} onChange={e => setMotivo(e.target.value)} autoFocus
                  placeholder="¿Por qué se rechaza? El cliente lo va a leer"
                  className="field-control w-full px-2.5 py-1.5 bg-digi-card border border-digi-border text-[12px] text-digi-text focus:outline-none" />
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
        ))}
      </div>

      <p className="mt-3 text-[10.5px] text-digi-muted leading-relaxed">
        Confirma solo si ya viste el dinero en tu banco. Al confirmar se emite la factura
        electrónica, que no se puede deshacer sin una nota de crédito.
      </p>
    </div>
  );
}
