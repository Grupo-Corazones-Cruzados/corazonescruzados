'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Check, X, Calculator, ListChecks, CalendarDays, MessageSquare, Send, Wallet } from 'lucide-react';
import MarcoPublico, { AvisoPublico, CargandoPublico } from '@/components/public/MarcoPublico';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import { BTN_ACCENT, BTN_DANGER, BTN_PRIMARY } from '@/components/ui/Button';
import { fmt2 } from '@/lib/format';
import { QUOTE_NOTES } from '@/lib/cotizaciones/notes';

function money(n: number) { return `$${fmt2(Number(n || 0))}`; }

export default function PublicQuotePage() {
  const { id } = useParams();
  const token = useSearchParams().get('token') || '';
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);
  const [obs, setObs] = useState<any[]>([]);
  const [obsText, setObsText] = useState('');
  const [obsName, setObsName] = useState('');
  const [sendingObs, setSendingObs] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/quotes/${id}/public?token=${encodeURIComponent(token)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo cargar la cotización');
      setQuote(d.data);
      setError('');
    } catch (e: any) { setError(e.message || 'Error'); }
    finally { setLoading(false); }
  }, [id, token]);
  useEffect(() => { load(); }, [load]);

  const loadObs = useCallback(async () => {
    try {
      const r = await fetch(`/api/quotes/${id}/observations?token=${encodeURIComponent(token)}`);
      const d = await r.json();
      if (r.ok) setObs(d.data || []);
    } catch { /* ignore */ }
  }, [id, token]);
  useEffect(() => { loadObs(); }, [loadObs]);

  const decide = async (action: 'accept' | 'reject') => {
    if (deciding) return;
    setDeciding(true);
    try {
      const r = await fetch(`/api/quotes/${id}/public/decision`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, action }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      toast.success(action === 'accept' ? '¡Cotización aceptada!' : 'Cotización rechazada');
      load();
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setDeciding(false); }
  };

  const submitBudget = async () => {
    const amount = Number(budgetInput);
    if (!Number.isFinite(amount) || amount <= 0) { toast.error('Ingresa un monto válido'); return; }
    setSavingBudget(true);
    try {
      const r = await fetch(`/api/quotes/${id}/public/budget`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, amount }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      toast.success('Presupuesto enviado al responsable');
      setShowBudget(false); setBudgetInput(''); load();
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setSavingBudget(false); }
  };

  const sendObs = async () => {
    const text = obsText.trim();
    if (!text) return;
    setSendingObs(true);
    try {
      const r = await fetch(`/api/quotes/${id}/observations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, body: text, author_name: obsName.trim() || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      setObs((o) => [d.data, ...o]); setObsText('');
      toast.success('Observación enviada');
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setSendingObs(false); }
  };

  if (loading) return <MarcoPublico ancho="medio"><CargandoPublico texto="Cargando cotización…" /></MarcoPublico>;
  if (error) return (
    <MarcoPublico>
      <AvisoPublico icon={X} titulo="No se pudo abrir la cotización">{error}</AvisoPublico>
    </MarcoPublico>
  );

  const decided = quote.quoteStatus === 'accepted' || quote.quoteStatus === 'rejected';
  const TARJETA = 'bg-digi-card border border-digi-border rounded-xl p-5 sm:p-6';
  const TITULO_SECCION = 'titulo-progreso text-[16px] text-digi-text mb-3 flex items-center gap-2';
  const CAMPO = 'field-control w-full px-3 py-2.5 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/60 focus:outline-none';

  return (
    <MarcoPublico ancho="medio">
      <div className="space-y-4">
        {/* Encabezado */}
        <div className={TARJETA}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--etiqueta)] inline-flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5 text-accent" /> Cotización · {quote.responsibleName || 'GCC World'}
          </p>
          <h1 className="titulo-progreso mt-1.5 text-[22px] sm:text-[24px] text-digi-text leading-tight">{quote.title}</h1>
          {quote.summary && <p className="text-[13.5px] text-digi-muted mt-2 leading-relaxed">{quote.summary}</p>}
          {(quote.deadline || quote.service?.name) && (
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3 text-[12.5px]">
              {quote.deadline && <span className="inline-flex items-center gap-1.5 text-digi-text"><CalendarDays className="w-4 h-4 text-digi-muted" /> Entrega estimada: {new Date(quote.deadline).toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}</span>}
              {quote.service?.name && <span className="text-digi-muted">Servicio: {quote.service.name}</span>}
            </div>
          )}
        </div>

        {/* Estado si ya decidió: texto de color con su icono, sin caja tintada. */}
        {quote.quoteStatus === 'accepted' && (
          <div className={`${TARJETA} flex items-start gap-2.5`}>
            <Check className="w-5 h-5 text-green-400 shrink-0 mt-px" />
            <p className="text-[14px] font-semibold text-green-400">Aceptaste esta cotización. ¡Gracias! El equipo se pondrá en marcha.</p>
          </div>
        )}
        {quote.quoteStatus === 'rejected' && (
          <div className={`${TARJETA} flex items-start gap-2.5`}>
            <X className="w-5 h-5 text-red-400 shrink-0 mt-px" />
            <p className="text-[14px] font-semibold text-red-400">Rechazaste esta cotización. Puedes pedir cambios al asistente y volver a revisarla.</p>
          </div>
        )}

        {/* Requerimientos */}
        <div className={TARJETA}>
          <h2 className={TITULO_SECCION}><ListChecks className="w-4 h-4 text-accent" /> Detalle <span className="text-digi-muted font-normal tabular-nums">{quote.requirements.length}</span></h2>
          <div className="space-y-3">
            {quote.requirements.map((r: any) => (
              <div key={r.id} className="border border-digi-border rounded-lg p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 text-[14px] font-medium text-digi-text">{r.title}</h3>
                  <span className="text-[14px] font-semibold text-digi-text tabular-nums shrink-0">{money(r.cost)}</span>
                </div>
                {r.description && <p className="text-[12.5px] text-digi-muted mt-1 leading-relaxed">{r.description}</p>}
                {r.subtasks?.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {r.subtasks.map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-1.5 text-[12.5px] text-digi-text"><Check className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" /> {s}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {/* Costos adicionales (servicios de proveedores externos) */}
          {(quote.additionalCosts?.length ?? 0) > 0 && (
            <div className="mt-4 pt-4 border-t border-digi-border">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--etiqueta)] mb-2">Servicios externos (proveedores)</p>
              <div className="space-y-1.5">
                {quote.additionalCosts.map((c: any, i: number) => (
                  <div key={i} className="flex items-start justify-between gap-3 text-[13px]">
                    <div className="min-w-0">
                      <span className="text-digi-text">{c.label}</span>
                      {c.description && <span className="block text-[12px] text-digi-muted">{c.description}</span>}
                    </div>
                    <span className="text-digi-text tabular-nums shrink-0">{money(c.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-digi-border">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--etiqueta)]">Total</span>
            <span className="titulo-progreso text-[22px] text-digi-text tabular-nums">{money(quote.total)}</span>
          </div>
        </div>

        {/* Notas adicionales (condiciones estándar de la oferta) */}
        <div className={TARJETA}>
          <h2 className={TITULO_SECCION}><ListChecks className="w-4 h-4 text-accent" /> Notas adicionales</h2>
          <ul className="space-y-2">
            {QUOTE_NOTES.map((note, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px] text-digi-text leading-relaxed">
                <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" strokeWidth={2.5} />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Aceptar / Rechazar / Modificar presupuesto: rechazar a la izquierda, aceptar a la derecha. */}
        {!decided && (
          <div className={TARJETA}>
            <p className="text-[13.5px] text-digi-muted mb-4">¿Aceptas esta cotización? Si el costo no se ajusta a lo que tienes, usa «Modificar presupuesto» e indícanos tu monto; el responsable la ajustará y te la compartirá de nuevo.</p>
            {quote.clientBudget != null && (
              <p className="text-[13px] text-digi-text mb-4">Indicaste un presupuesto de <strong className="tabular-nums">{money(quote.clientBudget)}</strong>. El responsable ajustará la cotización.</p>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={() => decide('reject')} disabled={deciding} className={`${BTN_DANGER} sm:flex-1 whitespace-nowrap`}>
                <X className="w-4 h-4" /> Rechazar
              </button>
              <button onClick={() => { setBudgetInput(quote.clientBudget != null ? String(quote.clientBudget) : ''); setShowBudget((v) => !v); }} disabled={deciding}
                aria-expanded={showBudget} className={`${BTN_ACCENT} sm:flex-1 whitespace-nowrap`}>
                <Wallet className="w-4 h-4" /> Modificar presupuesto
              </button>
              <button onClick={() => decide('accept')} disabled={deciding} className={`${BTN_PRIMARY} sm:flex-1 whitespace-nowrap`}>
                <Check className="w-4 h-4" /> Aceptar cotización
              </button>
            </div>
            {showBudget && (
              <div className="mt-4 pt-4 border-t border-digi-border">
                <label htmlFor="cot-presupuesto" className="text-[12px] font-semibold text-digi-muted">¿Cuál es tu presupuesto para este proyecto?</label>
                <div className="flex gap-2 mt-1.5">
                  <div className="relative flex-1 min-w-0">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-digi-muted text-sm">$</span>
                    <input id="cot-presupuesto" type="number" inputMode="decimal" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} placeholder="0,00" min="0"
                      className={`${CAMPO} pl-7`} />
                  </div>
                  <button onClick={submitBudget} disabled={savingBudget || !budgetInput.trim()} className={`${BTN_PRIMARY} shrink-0`}>
                    <Send className="w-4 h-4" /> Enviar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Observaciones */}
        <div className={TARJETA}>
          <h2 className={TITULO_SECCION}><MessageSquare className="w-4 h-4 text-accent" /> Observaciones</h2>
          <div className="flex flex-col gap-2">
            <input value={obsName} onChange={(e) => setObsName(e.target.value)} placeholder="Tu nombre (opcional)" aria-label="Tu nombre" className={CAMPO} />
            <AutoGrowTextarea value={obsText} onChange={(e) => setObsText(e.target.value)} minRows={3} placeholder="Deja una observación o comentario para el equipo…"
              aria-label="Observación" className={CAMPO} />
            <button onClick={sendObs} disabled={sendingObs || !obsText.trim()} className={`${BTN_PRIMARY} w-full sm:w-auto sm:self-end`}>
              <Send className="w-4 h-4" /> Enviar observación
            </button>
          </div>
          {obs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-digi-border divide-y divide-digi-border">
              {obs.map((o) => (
                <div key={o.id} className="py-2.5 first:pt-0 last:pb-0">
                  <p className="text-[13px] text-digi-text whitespace-pre-wrap break-words">{o.body}</p>
                  <p className="text-[11.5px] text-digi-muted mt-1">{o.author_name || 'Cliente'} · {new Date(o.created_at).toLocaleString('es-EC')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MarcoPublico>
  );
}
