'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import PixelConfirm from '@/components/ui/PixelConfirm';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { Flame, Plus, CalendarDays, Trash2, Pencil, X, Check, Clock } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;
const nf = new Intl.NumberFormat('es-ES');

interface Razon { id: number; content: string; charCount: number; day: string; createdAt: string; updatedAt: string; }
interface DayBucket { day: string; count: number; chars: number; }

const fmtDayLong = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil' });
const todayLocal = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date());
// Intensidad por longitud (local, NO es clasificación por IA).
const intensityOf = (n: number) => n < 120 ? { label: 'Breve', color: '#6b7280' } : n < 500 ? { label: 'Media', color: '#7c6cf5' } : { label: 'Extensa', color: '#22c55e' };

/**
 * Panel "Razones": cuaderno del administrador para registrar motivos de lucha y sucesos
 * que quiere recordar. Misma interfaz que "Pensamientos" pero SIN análisis por IA.
 */
export default function RazonesPanel() {
  const [days, setDays] = useState<DayBucket[]>([]);
  const [razones, setRazones] = useState<Razon[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{ id: number; content: string } | null>(null);
  const [confirm, setConfirm] = useState<{ text: string; onOk: () => void } | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async (day?: string | null) => {
    setLoading(true);
    try {
      const qs = day ? `?day=${day}` : '';
      const res = await fetch(`/api/razones${qs}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      setDays(j.data.days || []);
      setRazones(j.data.razones || []);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(selectedDay); }, [load, selectedDay]);

  const save = async () => {
    const content = draft.trim();
    if (!content) return;
    setSaving(true);
    try {
      const res = await fetch('/api/razones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      setDraft('');
      const today = todayLocal();
      if (selectedDay && selectedDay !== today) setSelectedDay(today);
      else await load(selectedDay);
      taRef.current?.focus();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const content = editing.content.trim();
    if (!content) return;
    try {
      const res = await fetch(`/api/razones/${editing.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      setEditing(null);
      await load(selectedDay);
      toast.success('Razón actualizada.');
    } catch (e: any) { toast.error(e.message); }
  };

  const remove = (t: Razon) => setConfirm({
    text: '¿Eliminar esta razón? No se puede deshacer.',
    onOk: async () => {
      try {
        const res = await fetch(`/api/razones/${t.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error || 'Error');
        await load(selectedDay);
      } catch (e: any) { toast.error(e.message); }
    },
  });

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); save(); }
  };

  const totals = useMemo(() => days.reduce((a, d) => ({ count: a.count + d.count, chars: a.chars + d.chars }), { count: 0, chars: 0 }), [days]);
  const draftIntensity = intensityOf(draft.trim().length);

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      {/* Izquierda: fechas con razones */}
      <aside className="w-full lg:w-[230px] shrink-0 bg-digi-card border border-digi-border rounded-lg p-2">
        <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-2 pt-1 pb-2" style={df}>Fechas</p>
        <div className="space-y-0.5 lg:max-h-[70vh] overflow-y-auto">
          <button onClick={() => setSelectedDay(null)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors border-l-2 ${selectedDay === null ? 'bg-accent-light border-accent text-accent' : 'border-transparent text-digi-text hover:bg-black/[0.03]'}`}>
            <CalendarDays className={`w-4 h-4 shrink-0 ${selectedDay === null ? 'text-accent' : 'text-digi-muted'}`} />
            <span className="flex-1 min-w-0 text-[12.5px] font-medium truncate" style={mf}>Recientes</span>
            {totals.count > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${selectedDay === null ? 'bg-accent/15 text-accent' : 'bg-black/[0.05] text-digi-muted'}`}>{totals.count}</span>}
          </button>
          {days.map((d) => {
            const active = selectedDay === d.day;
            return (
              <button key={d.day} onClick={() => setSelectedDay(d.day)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors border-l-2 ${active ? 'bg-accent-light border-accent text-accent' : 'border-transparent text-digi-text hover:bg-black/[0.03]'}`}>
                <span className="flex-1 min-w-0 text-[12.5px] font-medium truncate" style={mf}>{fmtDayLong(d.day)}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${active ? 'bg-accent/15 text-accent' : 'bg-black/[0.05] text-digi-muted'}`}>{d.count}</span>
              </button>
            );
          })}
          {days.length === 0 && !loading && <p className="px-3 py-3 text-[11.5px] text-digi-muted/60" style={mf}>Todavía no has escrito nada.</p>}
        </div>
      </aside>

      {/* Centro: compositor + razones del día */}
      <div className="flex-1 min-w-0 w-full">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-4 h-4 text-accent shrink-0" />
          <p className="text-[13px] font-semibold text-digi-text" style={df}>{selectedDay ? fmtDayLong(selectedDay) : 'Razones recientes'}</p>
        </div>

        <div className="bg-digi-card border border-digi-border rounded-lg p-3 mb-3">
          <AutoGrowTextarea ref={taRef} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} minRows={4}
            placeholder="¿Por qué luchas en este proyecto? Un suceso, un motivo, algo que quieras recordar…"
            className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {draft.trim().length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-digi-muted tabular-nums" style={mf}>
                <span className="w-2 h-2 rounded-full" style={{ background: draftIntensity.color }} />
                {draftIntensity.label} · {nf.format(draft.trim().length)} caracteres
              </span>
            )}
            <span className="text-[11px] text-digi-muted/60 hidden sm:inline" style={mf}>⌘/Ctrl + Enter para guardar</span>
            <button className={`${BTN_PRIMARY} ml-auto`} onClick={save} disabled={saving || !draft.trim()} style={mf}><Plus className="w-4 h-4" /> Guardar</button>
          </div>
        </div>

        {loading ? (
          <p className="py-10 text-center text-[13px] text-digi-muted" style={mf}>Cargando…</p>
        ) : razones.length === 0 ? (
          <div className="bg-digi-card border border-digi-border rounded-xl py-12 text-center">
            <Flame className="w-8 h-8 text-digi-muted mx-auto mb-2" />
            <p className="text-[13px] text-digi-text font-medium" style={mf}>Sin razones {selectedDay ? 'este día' : 'todavía'}</p>
            <p className="text-[12px] text-digi-muted mt-1" style={mf}>Escribe arriba para empezar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {razones.map((t) => (
              <RazonCard key={t.id} t={t}
                editing={editing?.id === t.id ? editing.content : null}
                onEditChange={(content) => setEditing({ id: t.id, content })}
                onStartEdit={() => setEditing({ id: t.id, content: t.content })}
                onCancelEdit={() => setEditing(null)}
                onSaveEdit={saveEdit}
                onDelete={() => remove(t)} />
            ))}
          </div>
        )}
      </div>

      <PixelConfirm open={!!confirm} message={confirm?.text || ''} danger
        onCancel={() => setConfirm(null)} onConfirm={() => { const c = confirm; setConfirm(null); c?.onOk(); }} />
    </div>
  );
}

function RazonCard({ t, editing, onEditChange, onStartEdit, onCancelEdit, onSaveEdit, onDelete }: {
  t: Razon; editing: string | null;
  onEditChange: (v: string) => void; onStartEdit: () => void; onCancelEdit: () => void; onSaveEdit: () => void; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const intensity = intensityOf(t.charCount);
  const long = t.charCount > 420;

  if (editing !== null) {
    return (
      <div className="rounded-lg border border-accent bg-digi-card p-3">
        <AutoGrowTextarea value={editing} onChange={(e) => onEditChange(e.target.value)} minRows={6}
          className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
        <div className="flex justify-end gap-2 mt-2">
          <button className={BTN_SECONDARY} onClick={onCancelEdit} style={mf}><X className="w-4 h-4" /> Cancelar</button>
          <button className={BTN_PRIMARY} onClick={onSaveEdit} style={mf}><Check className="w-4 h-4" /> Guardar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-digi-border bg-digi-card p-3 group">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[11px] text-digi-muted tabular-nums" style={mf}><Clock className="w-3 h-3" /> {fmtTime(t.createdAt)}</span>
        <span className="inline-flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded-full border border-digi-border" style={{ ...mf, color: intensity.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: intensity.color }} /> {intensity.label}
        </span>
        <span className="text-[11px] text-digi-muted/60 tabular-nums ml-auto" style={mf}>{nf.format(t.charCount)} car.</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button onClick={onStartEdit} className="text-digi-muted hover:text-accent" aria-label="Editar razón"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} className="text-digi-muted hover:text-red-500" aria-label="Eliminar razón"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <p className={`text-[13px] text-digi-text whitespace-pre-wrap leading-relaxed ${!expanded && long ? 'line-clamp-4' : ''}`} style={mf}>{t.content}</p>
      {long && (
        <button onClick={() => setExpanded((v) => !v)} className="mt-1 text-[11.5px] text-accent hover:underline" style={mf}>{expanded ? 'Ver menos' : 'Ver todo'}</button>
      )}
    </div>
  );
}
