'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import GccBotChat from '@/components/cotizaciones/GccBotChat';
import { Check, X, Calculator, ListChecks, CalendarDays, MessageSquare, Send, Wallet } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

function money(n: number) { return `$${Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

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

  if (loading) return <div className="corp min-h-screen flex items-center justify-center bg-digi-dark"><p className="text-digi-muted" style={mf}>Cargando cotización…</p></div>;
  if (error) return (
    <div className="corp min-h-screen flex items-center justify-center bg-digi-dark px-4">
      <div className="bg-digi-card border border-digi-border rounded-xl p-8 text-center max-w-md">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3"><X className="w-6 h-6 text-red-500" /></div>
        <p className="text-[15px] font-semibold text-digi-text" style={mf}>No se pudo abrir la cotización</p>
        <p className="text-[13px] text-digi-muted mt-1" style={mf}>{error}</p>
      </div>
    </div>
  );

  const decided = quote.quoteStatus === 'accepted' || quote.quoteStatus === 'rejected';

  return (
    <div className="corp min-h-screen bg-digi-dark py-6 px-4 md:px-8">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Encabezado */}
        <div className="bg-digi-card border border-digi-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-accent-light border border-accent/15 flex items-center justify-center"><Calculator className="w-5 h-5 text-accent" /></div>
            <span className="text-[11px] font-semibold text-accent uppercase tracking-wide" style={df}>Cotización · GCC World</span>
          </div>
          <h1 className="text-[22px] font-bold text-digi-text leading-tight" style={df}>{quote.title}</h1>
          {quote.summary && <p className="text-[13px] text-digi-muted mt-1.5 leading-relaxed" style={mf}>{quote.summary}</p>}
          <div className="flex flex-wrap gap-4 mt-3 text-[12px]" style={mf}>
            {quote.deadline && <span className="inline-flex items-center gap-1.5 text-digi-text"><CalendarDays className="w-4 h-4 text-digi-muted" /> Entrega estimada: {new Date(quote.deadline).toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}</span>}
            {quote.service?.name && <span className="text-digi-muted">Servicio: {quote.service.name}</span>}
          </div>
        </div>

        {/* Estado si ya decidió */}
        {quote.quoteStatus === 'accepted' && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
            <p className="text-[14px] font-semibold text-green-600 inline-flex items-center gap-2" style={mf}><Check className="w-5 h-5" /> Aceptaste esta cotización. ¡Gracias! El equipo se pondrá en marcha.</p>
          </div>
        )}
        {quote.quoteStatus === 'rejected' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
            <p className="text-[14px] font-semibold text-red-500 inline-flex items-center gap-2" style={mf}><X className="w-5 h-5" /> Rechazaste esta cotización. Puedes pedir cambios al asistente y volver a revisarla.</p>
          </div>
        )}

        {/* Requerimientos */}
        <div className="bg-digi-card border border-digi-border rounded-xl p-5 shadow-sm">
          <h2 className="text-[15px] font-semibold text-digi-text mb-3 inline-flex items-center gap-2" style={df}><ListChecks className="w-4 h-4 text-accent" /> Detalle ({quote.requirements.length})</h2>
          <div className="space-y-3">
            {quote.requirements.map((r: any) => (
              <div key={r.id} className="border border-digi-border rounded-lg p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[14px] font-medium text-digi-text" style={mf}>{r.title}</h3>
                  <span className="text-[14px] font-semibold text-accent tabular-nums shrink-0" style={mf}>{money(r.cost)}</span>
                </div>
                {r.description && <p className="text-[12.5px] text-digi-muted mt-1 leading-relaxed" style={mf}>{r.description}</p>}
                {r.subtasks?.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {r.subtasks.map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-1.5 text-[12px] text-digi-text" style={mf}><Check className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" /> {s}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-digi-border">
            <span className="text-[14px] font-semibold text-digi-text" style={mf}>Total</span>
            <span className="text-[20px] font-bold text-accent tabular-nums" style={df}>{money(quote.total)}</span>
          </div>
        </div>

        {/* Aceptar / Rechazar / Modificar presupuesto (grandes) */}
        {!decided && (
          <div className="bg-digi-card border border-digi-border rounded-xl p-5 shadow-sm">
            <p className="text-[13px] text-digi-muted text-center mb-3" style={mf}>¿Aceptas esta cotización? Si quieres ajustes, pídelos al asistente (abajo) o indica tu presupuesto para que la ajusten.</p>
            {quote.clientBudget != null && (
              <p className="text-[12px] text-center text-accent mb-3" style={mf}>Indicaste un presupuesto de <strong>{money(quote.clientBudget)}</strong>. El responsable ajustará la cotización.</p>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => decide('reject')} disabled={deciding}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 rounded-lg border-2 border-red-400 text-red-500 text-[15px] font-semibold hover:bg-red-500/10 transition-colors disabled:opacity-50" style={mf}>
                <X className="w-5 h-5" /> Rechazar
              </button>
              <button onClick={() => { setBudgetInput(quote.clientBudget != null ? String(quote.clientBudget) : ''); setShowBudget((v) => !v); }} disabled={deciding}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 rounded-lg border-2 border-accent text-accent text-[15px] font-semibold hover:bg-accent-light transition-colors disabled:opacity-50" style={mf}>
                <Wallet className="w-5 h-5" /> Modificar presupuesto
              </button>
              <button onClick={() => decide('accept')} disabled={deciding}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 rounded-lg bg-green-600 text-white text-[15px] font-semibold hover:bg-green-700 transition-colors disabled:opacity-50" style={mf}>
                <Check className="w-5 h-5" /> Aceptar cotización
              </button>
            </div>
            {showBudget && (
              <div className="mt-4 pt-4 border-t border-digi-border">
                <label className="text-[12px] font-medium text-digi-text" style={mf}>¿Cuál es tu presupuesto para este proyecto?</label>
                <div className="flex gap-2 mt-1.5">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-digi-muted text-sm" style={mf}>$</span>
                    <input type="number" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} placeholder="0.00" min="0"
                      className="field-control w-full pl-7 pr-3 py-2.5 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none" style={mf} />
                  </div>
                  <button onClick={submitBudget} disabled={savingBudget || !budgetInput.trim()} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors disabled:opacity-50" style={mf}>
                    <Send className="w-4 h-4" /> Enviar
                  </button>
                </div>
                <p className="text-[11px] text-digi-muted mt-1.5" style={mf}>No cambia la cotización: le avisamos al responsable para que la ajuste a tu presupuesto y te la comparta de nuevo.</p>
              </div>
            )}
          </div>
        )}

        {/* Observaciones */}
        <div className="bg-digi-card border border-digi-border rounded-xl p-5 shadow-sm">
          <h2 className="text-[15px] font-semibold text-digi-text mb-3 inline-flex items-center gap-2" style={df}><MessageSquare className="w-4 h-4 text-accent" /> Observaciones</h2>
          <div className="flex flex-col gap-2">
            <input value={obsName} onChange={(e) => setObsName(e.target.value)} placeholder="Tu nombre (opcional)"
              className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none" style={mf} />
            <textarea value={obsText} onChange={(e) => setObsText(e.target.value)} rows={3} placeholder="Deja una observación o comentario para el equipo…"
              className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none resize-y" style={mf} />
            <button onClick={sendObs} disabled={sendingObs || !obsText.trim()} className="self-end inline-flex items-center gap-1.5 px-3 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors disabled:opacity-50" style={mf}>
              <Send className="w-4 h-4" /> Enviar observación
            </button>
          </div>
          {obs.length > 0 && (
            <div className="mt-4 space-y-2">
              {obs.map((o) => (
                <div key={o.id} className="border border-digi-border rounded-lg px-3 py-2 bg-digi-darker/40">
                  <p className="text-[12px] text-digi-text whitespace-pre-wrap" style={mf}>{o.body}</p>
                  <p className="text-[10.5px] text-digi-muted mt-1" style={mf}>{o.author_name || 'Cliente'} · {new Date(o.created_at).toLocaleString('es-EC')}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-digi-muted pb-4" style={mf}>GCC World · Esta cotización es de solo lectura. Para cambios, usa el asistente GCC Bot.</p>
      </div>

      {/* GCC Bot (chat por token) — única vía para pedir cambios */}
      {!decided && <GccBotChat projectId={String(id)} chatUrl={`/api/quotes/${id}/public/chat`} extraBody={{ token }} onChanged={() => { load(); }} />}
    </div>
  );
}
