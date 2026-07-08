'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Ticket, FolderKanban, Plus, X, Check, Link2 } from 'lucide-react';

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
    const maxH = Math.min(470, vh - 32);
    if (!el) { setPos({ left: Math.max(8, vw - BUBBLE_W - 8), top: 16, maxH }); return; }
    const r = el.getBoundingClientRect();
    let left = r.left - 10 - BUBBLE_W;            // a la IZQUIERDA del botón
    if (left < 8) left = Math.min(r.right + 10, vw - BUBBLE_W - 8);
    const top = Math.max(8, Math.min(r.top - 8, vh - maxH - 8));
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

      {/* Burbuja flotante (portal → escapa del blur/overflow del panel) */}
      {pos && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0" onClick={() => setPos(null)} />
          <div className="absolute rounded-xl bg-digi-darker border border-white/15 shadow-2xl flex flex-col overflow-hidden animate-[pixelFadeIn_0.15s_ease-out]" style={{ left: pos.left, top: pos.top, width: BUBBLE_W, maxHeight: pos.maxH }}>
            <div className="flex items-center gap-2 px-3.5 py-3 border-b border-white/12 shrink-0">
              <Link2 className="w-4 h-4 text-accent shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-white leading-tight" style={df}>Asociar proyecto o ticket</p>
                <p className="text-[11px] text-white/50" style={mf}>Solo uno (un ticket o un proyecto)</p>
              </div>
              <button onClick={() => setPos(null)} className="text-white/60 hover:text-white shrink-0" aria-label="Cerrar"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {loading ? (
                <p className="text-[12px] text-white/50 text-center py-6" style={mf}>Cargando…</p>
              ) : availableCount === 0 ? (
                <p className="text-[12px] text-white/50 text-center py-6" style={mf}>Este usuario no creó ni participa en proyectos/tickets.</p>
              ) : (
                <>
                  {data.available.tickets.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-white/40 mb-1.5" style={df}>Tickets</p>
                      <div className="space-y-1">
                        {data.available.tickets.map((t) => <Row key={`t-${t.id}`} Icon={Ticket} refItem={t} on={isSelected('ticket', t.id)} onClick={() => select('ticket', t)} />)}
                      </div>
                    </div>
                  )}
                  {data.available.projects.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-white/40 mb-1.5" style={df}>Proyectos</p>
                      <div className="space-y-1">
                        {data.available.projects.map((p) => <Row key={`p-${p.id}`} Icon={FolderKanban} refItem={p} on={isSelected('project', p.id)} onClick={() => select('project', p)} />)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function Row({ Icon, refItem, on, onClick }: { Icon: any; refItem: Ref; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-[12.5px] transition-colors ${on ? 'bg-accent/25 text-white' : 'text-white/85 hover:bg-white/[0.08]'}`} style={mf}>
      <span className={`w-4 h-4 shrink-0 rounded-full border flex items-center justify-center ${on ? 'bg-accent border-accent text-white' : 'border-white/25'}`}>{on && <Check className="w-3 h-3" />}</span>
      <Icon className="w-3.5 h-3.5 shrink-0 text-white/55" />
      <span className="truncate flex-1">{refItem.title}</span>
      {refItem.status && <span className="text-[10px] text-white/40 shrink-0">{refItem.status}</span>}
    </button>
  );
}
