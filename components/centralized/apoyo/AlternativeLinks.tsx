'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Ticket, FolderKanban, Plus, X, Check, Link2, Search } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

interface Ref { id: string; title: string; status: string | null }
interface Linked { kind: 'ticket' | 'project'; id: string; title: string; status: string | null }
interface Data { available: { tickets: Ref[]; projects: Ref[] }; linked: Linked | null }

const BUBBLE_W = 340;

/**
 * Asociación EXCLUSIVA de una alternativa con UN ticket O UN proyecto del sujeto (creado
 * o donde participa). El botón "Asociar" abre una BURBUJA flotante a su izquierda
 * (renderizada por portal para no quedar recortada por el panel). Selección única.
 */
export default function AlternativeLinks({ subjectKind, subjectId, alternativeId }: { subjectKind: string; subjectId: string; alternativeId: number }) {
  const [data, setData] = useState<Data>({ available: { tickets: [], projects: [] }, linked: null });
  const [loading, setLoading] = useState(true);
  const [pos, setPos] = useState<{ left: number; top: number; maxH: number } | null>(null);
  const [tq, setTq] = useState('');
  const [pq, setPq] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/centralized/apoyo/associations?subject_kind=${subjectKind}&subject_id=${subjectId}&alternative_id=${alternativeId}`);
      const d = await res.json();
      setData(d.data || { available: { tickets: [], projects: [] }, linked: null });
    } catch { /* deja lo que haya */ }
    finally { setLoading(false); }
  }, [subjectKind, subjectId, alternativeId]);

  useEffect(() => { setPos(null); load(); }, [load]);
  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPos(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pos]);

  const linked = data.linked;
  const isSelected = (kind: 'ticket' | 'project', id: string) => !!linked && linked.kind === kind && linked.id === id;

  const openBubble = () => {
    const el = btnRef.current;
    const vw = window.innerWidth, vh = window.innerHeight;
    const maxH = Math.min(440, vh - 96);
    if (!el) { setPos({ left: Math.max(8, vw - BUBBLE_W - 8), top: 24, maxH }); return; }
    const r = el.getBoundingClientRect();
    let left = r.left - 10 - BUBBLE_W;            // a la IZQUIERDA del botón
    if (left < 8) left = Math.min(r.right + 10, vw - BUBBLE_W - 8);
    // Centrada verticalmente respecto al botón (sube el formulario) con margen inferior amplio.
    let top = r.top + r.height / 2 - maxH / 2;
    top = Math.max(16, Math.min(top, vh - maxH - 24));
    setPos({ left, top, maxH });
  };

  const select = async (kind: 'ticket' | 'project', ref: Ref) => {
    const connect = !isSelected(kind, ref.id);
    setData((d) => ({ ...d, linked: connect ? { kind, id: ref.id, title: ref.title, status: ref.status } : null }));
    try {
      const res = await fetch('/api/centralized/apoyo/associations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alternativeId, kind, id: ref.id, connect }) });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
    } catch (e: any) { toast.error(e.message || 'Error'); load(); }
  };

  const availableCount = data.available.tickets.length + data.available.projects.length;
  const LinkedIcon = linked?.kind === 'project' ? FolderKanban : Ticket;
  const filterBy = (items: Ref[], q: string) => { const s = q.trim().toLowerCase(); return s ? items.filter((r) => r.title.toLowerCase().includes(s)) : items; };
  const fTickets = filterBy(data.available.tickets, tq);
  const fProjects = filterBy(data.available.projects, pq);

  return (
    <div className="pt-1">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50 inline-flex items-center gap-1.5" style={df}><Link2 className="w-3 h-3" /> Proyecto o ticket</p>
        <button ref={btnRef} onClick={openBubble} className="inline-flex items-center gap-1 text-[11px] text-accent hover:text-white transition-colors" style={mf}>
          <Plus className="w-3 h-3" /> Asociar
        </button>
      </div>

      {linked ? (
        <div className="inline-flex items-center gap-1.5 max-w-full px-2 py-1 rounded-full bg-accent/20 border border-accent/40 text-[11.5px] text-white" style={mf}>
          <LinkedIcon className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[190px]">{linked.title}</span>
          <button onClick={() => select(linked.kind, { id: linked.id, title: linked.title, status: linked.status })} title="Quitar asociación" className="opacity-70 hover:opacity-100"><X className="w-3 h-3" /></button>
        </div>
      ) : (
        <p className="text-[11.5px] text-white/45" style={mf}>Sin proyecto ni ticket asociado.</p>
      )}

      {/* Burbuja flotante: portal al shell `.corp` (hereda tokens/fuente Fluent, claro/oscuro);
          escapa del blur/overflow del panel glass sin caer en el tema pixel de <body>. */}
      {pos && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0" onClick={() => setPos(null)} />
          <div className="absolute rounded-xl bg-digi-card border border-digi-border shadow-2xl flex flex-col overflow-hidden animate-[pixelFadeIn_0.15s_ease-out]" style={{ left: pos.left, top: pos.top, width: BUBBLE_W, maxHeight: pos.maxH }}>
            <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-digi-border shrink-0">
              <Link2 className="w-4 h-4 text-accent shrink-0" />
              <p className="text-[13px] font-semibold text-digi-text leading-tight min-w-0 flex-1" style={mf}>Asociar proyecto o ticket</p>
              <button onClick={() => setPos(null)} className="w-8 h-8 flex items-center justify-center rounded-md text-digi-muted hover:text-digi-text hover:bg-black/[0.05] transition-colors shrink-0" aria-label="Cerrar"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
              {loading ? (
                <p className="text-[12px] text-digi-muted text-center py-6" style={mf}>Cargando…</p>
              ) : availableCount === 0 ? (
                <p className="text-[12px] text-digi-muted text-center py-6" style={mf}>Este usuario no creó ni participa en proyectos/tickets.</p>
              ) : (
                <>
                  {data.available.tickets.length > 0 && (
                    <Section title="Tickets" Icon={Ticket} query={tq} setQuery={setTq} placeholder="Buscar ticket…">
                      {fTickets.length === 0 ? (
                        <p className="text-[11.5px] text-digi-muted px-1 py-1" style={mf}>Sin coincidencias.</p>
                      ) : fTickets.map((t) => <Row key={`t-${t.id}`} Icon={Ticket} refItem={t} on={isSelected('ticket', t.id)} onClick={() => select('ticket', t)} />)}
                    </Section>
                  )}
                  {data.available.projects.length > 0 && (
                    <Section title="Proyectos" Icon={FolderKanban} query={pq} setQuery={setPq} placeholder="Buscar proyecto…">
                      {fProjects.length === 0 ? (
                        <p className="text-[11.5px] text-digi-muted px-1 py-1" style={mf}>Sin coincidencias.</p>
                      ) : fProjects.map((p) => <Row key={`p-${p.id}`} Icon={FolderKanban} refItem={p} on={isSelected('project', p.id)} onClick={() => select('project', p)} />)}
                    </Section>
                  )}
                </>
              )}
            </div>
          </div>
        </div>,
        (document.querySelector('.corp') as HTMLElement | null) ?? document.body,
      )}
    </div>
  );
}

function Section({ title, Icon, query, setQuery, placeholder, children }: { title: string; Icon: any; query: string; setQuery: (v: string) => void; placeholder: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-digi-text mb-1.5 inline-flex items-center gap-1.5" style={mf}><Icon className="w-3.5 h-3.5 text-digi-muted" /> {title}</p>
      <div className="relative mb-1.5">
        <Search className="w-3.5 h-3.5 text-digi-muted absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder}
          className="w-full pl-7 pr-2 py-1.5 bg-digi-card border border-digi-border rounded-md text-[12px] text-digi-text placeholder:text-digi-muted focus:border-accent focus:outline-none" style={mf} />
      </div>
      <div className="space-y-1 max-h-[150px] overflow-y-auto pr-0.5">{children}</div>
    </div>
  );
}

function Row({ Icon, refItem, on, onClick }: { Icon: any; refItem: Ref; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-[12.5px] transition-colors border-l-2 ${on ? 'bg-accent-light text-accent border-accent' : 'text-digi-text border-transparent hover:bg-black/[0.03]'}`} style={mf}>
      <span className={`w-4 h-4 shrink-0 rounded-full border flex items-center justify-center ${on ? 'bg-accent border-accent text-white' : 'border-digi-border'}`}>{on && <Check className="w-3 h-3" />}</span>
      <Icon className={`w-3.5 h-3.5 shrink-0 ${on ? 'text-accent' : 'text-digi-muted'}`} />
      <span className="truncate flex-1">{refItem.title}</span>
      {refItem.status && <span className="text-[10px] text-digi-muted shrink-0">{refItem.status}</span>}
    </button>
  );
}
