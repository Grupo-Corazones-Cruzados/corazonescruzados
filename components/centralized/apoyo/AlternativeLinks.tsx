'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Ticket, FolderKanban, Plus, X, Check, Link2 } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

interface Ref { id: string; title: string; status: string | null }
interface Linked { kind: 'ticket' | 'project'; id: string; title: string; status: string | null }
interface Data { available: { tickets: Ref[]; projects: Ref[] }; linked: Linked | null }

/**
 * Asociación EXCLUSIVA de una alternativa con UN ticket O UN proyecto del sujeto (creado
 * o donde participa). El botón "Asociar" abre un panel lateral izquierdo con overlay para
 * elegir uno solo. Al asociar uno se reemplaza cualquier asociación previa.
 */
export default function AlternativeLinks({ subjectKind, subjectId, alternativeId }: { subjectKind: string; subjectId: string; alternativeId: number }) {
  const [data, setData] = useState<Data>({ available: { tickets: [], projects: [] }, linked: null });
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/centralized/apoyo/associations?subject_kind=${subjectKind}&subject_id=${subjectId}&alternative_id=${alternativeId}`);
      const d = await res.json();
      setData(d.data || { available: { tickets: [], projects: [] }, linked: null });
    } catch { /* deja lo que haya */ }
    finally { setLoading(false); }
  }, [subjectKind, subjectId, alternativeId]);

  useEffect(() => { setDrawer(false); load(); }, [load]);

  const linked = data.linked;
  const isSelected = (kind: 'ticket' | 'project', id: string) => !!linked && linked.kind === kind && linked.id === id;

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
        <button onClick={() => setDrawer(true)} className="inline-flex items-center gap-1 text-[11px] text-accent hover:text-white transition-colors" style={mf}>
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

      {/* Panel lateral izquierdo con overlay */}
      {drawer && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <aside className="absolute left-0 top-0 h-full w-full max-w-[380px] bg-digi-darker border-r border-white/12 shadow-2xl flex flex-col">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/12 shrink-0">
              <Link2 className="w-4 h-4 text-accent" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-white leading-tight" style={df}>Asociar proyecto o ticket</p>
                <p className="text-[11px] text-white/50" style={mf}>Solo uno (un ticket o un proyecto)</p>
              </div>
              <button onClick={() => setDrawer(false)} className="text-white/60 hover:text-white" aria-label="Cerrar"><X className="w-4 h-4" /></button>
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
          </aside>
        </div>
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
