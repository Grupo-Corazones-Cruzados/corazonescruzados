'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Ticket, FolderKanban, Plus, X, Check, Link2 } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

interface Ref { id: string; title: string; status: string | null }
interface Data { available: { tickets: Ref[]; projects: Ref[] }; linked: { tickets: Ref[]; projects: Ref[] } }

/**
 * Asociación de una ALTERNATIVA con proyectos/tickets del sujeto (creados o donde
 * participa). Solo para consulta desde Apoyo: muestra los asociados y permite
 * enlazar/desenlazar desde un selector. Panel oscuro (vidrio) del grafo.
 */
export default function AlternativeLinks({ subjectKind, subjectId, alternativeId }: { subjectKind: string; subjectId: string; alternativeId: number }) {
  const [data, setData] = useState<Data>({ available: { tickets: [], projects: [] }, linked: { tickets: [], projects: [] } });
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/centralized/apoyo/associations?subject_kind=${subjectKind}&subject_id=${subjectId}&alternative_id=${alternativeId}`);
      const d = await res.json();
      setData(d.data || { available: { tickets: [], projects: [] }, linked: { tickets: [], projects: [] } });
    } catch { /* deja lo que haya */ }
    finally { setLoading(false); }
  }, [subjectKind, subjectId, alternativeId]);

  useEffect(() => { setShowPicker(false); load(); }, [load]);

  const linkedTicketIds = useMemo(() => new Set(data.linked.tickets.map((t) => t.id)), [data.linked.tickets]);
  const linkedProjectIds = useMemo(() => new Set(data.linked.projects.map((p) => p.id)), [data.linked.projects]);
  const isLinked = (kind: 'ticket' | 'project', id: string) => (kind === 'ticket' ? linkedTicketIds : linkedProjectIds).has(id);

  const toggle = async (kind: 'ticket' | 'project', ref: Ref) => {
    const connect = !isLinked(kind, ref.id);
    setData((d) => {
      const linked = { tickets: [...d.linked.tickets], projects: [...d.linked.projects] };
      if (kind === 'ticket') linked.tickets = connect ? [ref, ...linked.tickets] : linked.tickets.filter((t) => t.id !== ref.id);
      else linked.projects = connect ? [ref, ...linked.projects] : linked.projects.filter((p) => p.id !== ref.id);
      return { ...d, linked };
    });
    try {
      const res = await fetch('/api/centralized/apoyo/associations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alternativeId, kind, id: ref.id, connect }) });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
    } catch (e: any) { toast.error(e.message || 'Error'); load(); }
  };

  const linkedCount = data.linked.tickets.length + data.linked.projects.length;
  const availableCount = data.available.tickets.length + data.available.projects.length;

  const Chip = ({ kind, ref, on }: { kind: 'ticket' | 'project'; ref: Ref; on: boolean }) => {
    const Icon = kind === 'ticket' ? Ticket : FolderKanban;
    return (
      <button onClick={() => toggle(kind, ref)} title={on ? 'Quitar asociación' : 'Asociar'}
        className={`inline-flex items-center gap-1.5 max-w-full px-2 py-1 rounded-full border text-[11.5px] transition-colors ${on ? 'bg-accent/20 border-accent/40 text-white' : 'bg-white/[0.06] border-white/12 text-white/85 hover:bg-white/[0.14]'}`} style={mf}>
        <Icon className="w-3 h-3 shrink-0" />
        <span className="truncate max-w-[150px]">{ref.title}</span>
        {on ? <X className="w-3 h-3 shrink-0 opacity-70" /> : <Plus className="w-3 h-3 shrink-0 opacity-70" />}
      </button>
    );
  };

  return (
    <div className="pt-1">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50 inline-flex items-center gap-1.5" style={df}><Link2 className="w-3 h-3" /> Proyectos y tickets</p>
        <button onClick={() => setShowPicker((v) => !v)} className="inline-flex items-center gap-1 text-[11px] text-accent hover:text-white transition-colors" style={mf}>
          <Plus className="w-3 h-3" /> Asociar
        </button>
      </div>

      {/* Asociados */}
      {linkedCount === 0 ? (
        <p className="text-[11.5px] text-white/45" style={mf}>Sin proyectos ni tickets asociados.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {data.linked.tickets.map((t) => <Chip key={`t-${t.id}`} kind="ticket" ref={t} on />)}
          {data.linked.projects.map((p) => <Chip key={`p-${p.id}`} kind="project" ref={p} on />)}
        </div>
      )}

      {/* Selector de participaciones */}
      {showPicker && (
        <div className="mt-2 rounded-lg border border-white/12 bg-black/30 p-2 max-h-56 overflow-y-auto space-y-2">
          {loading ? (
            <p className="text-[11.5px] text-white/50 text-center py-2" style={mf}>Cargando…</p>
          ) : availableCount === 0 ? (
            <p className="text-[11.5px] text-white/50 text-center py-2" style={mf}>Este usuario no creó ni participa en proyectos/tickets.</p>
          ) : (
            <>
              {data.available.tickets.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-white/40 mb-1" style={mf}>Tickets</p>
                  <div className="space-y-1">
                    {data.available.tickets.map((t) => <PickRow key={`at-${t.id}`} Icon={Ticket} ref={t} on={isLinked('ticket', t.id)} onClick={() => toggle('ticket', t)} />)}
                  </div>
                </div>
              )}
              {data.available.projects.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-white/40 mb-1" style={mf}>Proyectos</p>
                  <div className="space-y-1">
                    {data.available.projects.map((p) => <PickRow key={`ap-${p.id}`} Icon={FolderKanban} ref={p} on={isLinked('project', p.id)} onClick={() => toggle('project', p)} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PickRow({ Icon, ref, on, onClick }: { Icon: any; ref: Ref; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[12px] transition-colors ${on ? 'bg-accent/20 text-white' : 'text-white/85 hover:bg-white/[0.08]'}`} style={mf}>
      <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${on ? 'bg-accent border-accent text-white' : 'border-white/25'}`}>{on && <Check className="w-3 h-3" />}</span>
      <Icon className="w-3.5 h-3.5 shrink-0 text-white/60" />
      <span className="truncate flex-1">{ref.title}</span>
      {ref.status && <span className="text-[10px] text-white/40 shrink-0">{ref.status}</span>}
    </button>
  );
}
