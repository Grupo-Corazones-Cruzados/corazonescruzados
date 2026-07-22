'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Bot, X, Send } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

type Msg = { role: 'user' | 'bot'; text: string };

/**
 * Chat flotante "GCC Bot" para una COTIZACIÓN. Reanuda la sesión del agente (worker) y
 * permite pedir cambios (agregar/quitar requerimientos, reprecio, cambiar alcance…). Cuando
 * el agente reformula la cotización, se versiona en el backend y se refresca el detalle.
 */
export default function GccBotChat({ projectId, onChanged, chatUrl, extraBody }: {
  projectId: number | string; onChanged?: () => void;
  /** Endpoint del chat (interno por defecto; en la vista pública se pasa el endpoint por token). */
  chatUrl?: string;
  /** Campos extra en el body (p. ej. { token } para la vista pública). */
  extraBody?: Record<string, any>;
}) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{
    role: 'bot',
    text: 'Hola, soy GCC Bot. Puedo ajustar esta cotización: agregar o quitar requerimientos, cambiar precios, el alcance o la infraestructura. ¿Qué necesitas?',
  }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput(''); setMsgs((m) => [...m, { role: 'user', text }]); setBusy(true);
    try {
      const r = await fetch(chatUrl || `/api/quotes/${projectId}/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, ...(extraBody || {}) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      setMsgs((m) => [...m, { role: 'bot', text: d.data.reply || (d.data.changed ? 'Listo, actualicé la cotización.' : 'Ok.') }]);
      if (d.data.changed) { toast.success(`Cotización actualizada${d.data.version ? ` (v${d.data.version})` : ''}`); onChanged?.(); }
    } catch (e: any) {
      setMsgs((m) => [...m, { role: 'bot', text: '⚠️ ' + (e.message || 'Error') }]);
    } finally { setBusy(false); }
  };

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-11 right-3 z-[92] inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-accent text-white shadow-lg hover:bg-accent-hover transition-colors" style={mf}>
          <Bot className="w-4 h-4" /> GCC Bot
        </button>
      )}
      {open && (
        <div className="fixed bottom-11 right-3 z-[92] w-[92vw] max-w-sm h-[70vh] max-h-[560px] flex flex-col bg-digi-card border border-digi-border rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-digi-border bg-accent text-white">
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold" style={mf}><Bot className="w-4 h-4" /> GCC Bot · Cotización</span>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white" aria-label="Cerrar"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-1.5 rounded-lg text-[12.5px] whitespace-pre-wrap ${m.role === 'user' ? 'bg-accent text-white' : 'bg-digi-darker border border-digi-border text-digi-text'}`} style={mf}>{m.text}</div>
              </div>
            ))}
            {busy && <div className="flex justify-start"><div className="px-3 py-1.5 rounded-lg bg-digi-darker border border-digi-border text-digi-muted text-[12px]" style={mf}>Pensando…</div></div>}
            <div ref={endRef} />
          </div>
          <div className="p-2.5 border-t border-digi-border flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }} disabled={busy}
              placeholder="Pide un cambio o pregunta…" className="field-control flex-1 px-3 py-2 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
            <button onClick={send} disabled={busy || !input.trim()} className="inline-flex items-center justify-center px-3 rounded bg-accent text-white disabled:opacity-50 hover:bg-accent-hover transition-colors" aria-label="Enviar"><Send className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </>
  );
}
