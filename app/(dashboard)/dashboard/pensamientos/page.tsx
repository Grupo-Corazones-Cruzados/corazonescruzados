'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import PixelModal from '@/components/ui/PixelModal';
import PixelConfirm from '@/components/ui/PixelConfirm';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import ThoughtCharts, { type DayBucket, type MonthBucket } from '@/components/pensamientos/ThoughtCharts';
import { DIMENSION_LABEL, DIMENSION_COLOR } from '@/lib/centralized/apoyo';
import { DIMENSION_ICON } from '@/components/centralized/dimensionIcons';
import { intensityOf } from '@/lib/centralized/pensamientos';
import {
  BrainCircuit, Plus, LineChart, CalendarDays, Trash2, Pencil, X, Check, Clock,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;
const nf = new Intl.NumberFormat('es-ES');

interface Thought {
  id: number; content: string; charCount: number;
  category: string | null; day: string; createdAt: string; updatedAt: string;
}
interface Stats { days: DayBucket[]; months: MonthBucket[]; totals: { count: number; chars: number; uncategorized: number }; lastRun: any }

const fmtDayLong = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil' });
const todayLocal = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date()); // YYYY-MM-DD

/**
 * Módulo "Pensamientos": cuaderno personal de captura rápida para miembros y candidatos.
 *
 * Izquierda: las fechas en las que se escribió, con su conteo. Derecha: el compositor
 * (siempre visible, para que capturar sea inmediato) y los pensamientos del día elegido.
 * El botón "Gráficos" abre el modal con la evolución y el desglose por tipo.
 *
 * Los pensamientos son PRIVADOS: cada petición resuelve el sujeto del usuario logueado y
 * el servidor filtra por fila; no hay forma de pedir los de otra persona desde aquí.
 */
export default function PensamientosPage() {
  const [days, setDays] = useState<DayBucket[]>([]);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{ id: number; content: string } | null>(null);
  const [confirm, setConfirm] = useState<{ text: string; onOk: () => void } | null>(null);
  const [chartsOpen, setChartsOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async (day?: string | null) => {
    setLoading(true);
    try {
      const qs = day ? `?day=${day}` : '';
      const res = await fetch(`/api/pensamientos${qs}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      setDays(j.data.days || []);
      setThoughts(j.data.thoughts || []);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(selectedDay); }, [load, selectedDay]);

  const openCharts = async () => {
    setChartsOpen(true);
    try {
      const res = await fetch('/api/pensamientos/stats');
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      setStats(j.data);
    } catch (e: any) { toast.error(e.message); }
  };

  const save = async () => {
    const content = draft.trim();
    if (!content) return;
    setSaving(true);
    try {
      const res = await fetch('/api/pensamientos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      setDraft('');
      // Al guardar, saltamos al día de hoy para que el pensamiento recién escrito se vea.
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
      const res = await fetch(`/api/pensamientos/${editing.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      setEditing(null);
      await load(selectedDay);
      toast.success('Pensamiento actualizado. La IA lo volverá a etiquetar esta noche.');
    } catch (e: any) { toast.error(e.message); }
  };

  const remove = (t: Thought) => setConfirm({
    text: '¿Eliminar este pensamiento? No se puede deshacer.',
    onOk: async () => {
      try {
        const res = await fetch(`/api/pensamientos/${t.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error || 'Error');
        await load(selectedDay);
      } catch (e: any) { toast.error(e.message); }
    },
  });

  // Ctrl/Cmd + Enter guarda: la captura no debería obligar a soltar el teclado.
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); save(); }
  };

  const totals = useMemo(() => days.reduce((a, d) => ({ count: a.count + d.count, chars: a.chars + d.chars }), { count: 0, chars: 0 }), [days]);
  const draftIntensity = intensityOf(draft.trim().length);

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      {/* Panel izquierdo: fechas con pensamientos */}
      <aside className="w-full lg:w-[230px] shrink-0 bg-digi-card border border-digi-border rounded-lg p-2">
        <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-2 pt-1 pb-2" style={df}>Fechas</p>
        <div className="space-y-0.5 lg:max-h-[70vh] overflow-y-auto">
          <button
            onClick={() => setSelectedDay(null)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors border-l-2 ${
              selectedDay === null ? 'bg-accent-light border-accent text-accent' : 'border-transparent text-digi-text hover:bg-black/[0.03]'
            }`}
          >
            <CalendarDays className={`w-4 h-4 shrink-0 ${selectedDay === null ? 'text-accent' : 'text-digi-muted'}`} />
            <span className="flex-1 min-w-0 text-[12.5px] font-medium truncate" style={mf}>Recientes</span>
            {totals.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${selectedDay === null ? 'bg-accent/15 text-accent' : 'bg-black/[0.05] text-digi-muted'}`}>{totals.count}</span>
            )}
          </button>

          {days.map((d) => {
            const active = selectedDay === d.day;
            return (
              <button key={d.day} onClick={() => setSelectedDay(d.day)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors border-l-2 ${
                  active ? 'bg-accent-light border-accent text-accent' : 'border-transparent text-digi-text hover:bg-black/[0.03]'
                }`}>
                <span className="flex-1 min-w-0 text-[12.5px] font-medium truncate" style={mf}>{fmtDayLong(d.day)}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${active ? 'bg-accent/15 text-accent' : 'bg-black/[0.05] text-digi-muted'}`}>{d.count}</span>
              </button>
            );
          })}
          {days.length === 0 && !loading && (
            <p className="px-3 py-3 text-[11.5px] text-digi-muted/60" style={mf}>Todavía no has escrito nada.</p>
          )}
        </div>
      </aside>

      {/* Centro: compositor + pensamientos del día */}
      <div className="flex-1 min-w-0 w-full">
        <div className="flex items-center gap-2 mb-3">
          <BrainCircuit className="w-4 h-4 text-accent shrink-0" />
          <p className="text-[13px] font-semibold text-digi-text" style={df}>
            {selectedDay ? fmtDayLong(selectedDay) : 'Pensamientos recientes'}
          </p>
          <button className={`${BTN_SECONDARY} ml-auto`} onClick={openCharts} style={mf}>
            <LineChart className="w-4 h-4" /> Gráficos
          </button>
        </div>

        {/* Compositor: siempre visible, la captura tiene que ser inmediata */}
        <div className="bg-digi-card border border-digi-border rounded-lg p-3 mb-3">
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            rows={4}
            placeholder="Escribe un pensamiento… puede ser una línea o una lectura larga."
            className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none resize-y"
            style={mf}
          />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {draft.trim().length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-digi-muted tabular-nums" style={mf}>
                <span className="w-2 h-2 rounded-full" style={{ background: draftIntensity.color }} />
                {draftIntensity.label} · {nf.format(draft.trim().length)} caracteres
              </span>
            )}
            <span className="text-[11px] text-digi-muted/60 hidden sm:inline" style={mf}>⌘/Ctrl + Enter para guardar</span>
            <button className={`${BTN_PRIMARY} ml-auto`} onClick={save} disabled={saving || !draft.trim()} style={mf}>
              <Plus className="w-4 h-4" /> Guardar
            </button>
          </div>
        </div>

        {loading ? (
          <p className="py-10 text-center text-[13px] text-digi-muted" style={mf}>Cargando…</p>
        ) : thoughts.length === 0 ? (
          <div className="bg-digi-card border border-digi-border rounded-xl py-12 text-center">
            <BrainCircuit className="w-8 h-8 text-digi-muted mx-auto mb-2" />
            <p className="text-[13px] text-digi-text font-medium" style={mf}>Sin pensamientos {selectedDay ? 'este día' : 'todavía'}</p>
            <p className="text-[12px] text-digi-muted mt-1" style={mf}>Escribe arriba para empezar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {thoughts.map((t) => (
              <ThoughtCard
                key={t.id}
                t={t}
                editing={editing?.id === t.id ? editing.content : null}
                onEditChange={(content) => setEditing({ id: t.id, content })}
                onStartEdit={() => setEditing({ id: t.id, content: t.content })}
                onCancelEdit={() => setEditing(null)}
                onSaveEdit={saveEdit}
                onDelete={() => remove(t)}
              />
            ))}
          </div>
        )}
      </div>

      <PixelModal open={chartsOpen} onClose={() => setChartsOpen(false)} title="Tus pensamientos en gráficos" size="lg">
        {stats
          ? <ThoughtCharts days={stats.days} months={stats.months} totals={stats.totals} />
          : <p className="py-10 text-center text-[13px] text-digi-muted" style={mf}>Cargando…</p>}
      </PixelModal>

      <PixelConfirm
        open={!!confirm}
        message={confirm?.text || ''}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => { const c = confirm; setConfirm(null); c?.onOk(); }}
      />
    </div>
  );
}

/** Tarjeta de un pensamiento. Los largos se recortan y se expanden al pulsar. */
function ThoughtCard({ t, editing, onEditChange, onStartEdit, onCancelEdit, onSaveEdit, onDelete }: {
  t: Thought; editing: string | null;
  onEditChange: (v: string) => void; onStartEdit: () => void; onCancelEdit: () => void;
  onSaveEdit: () => void; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const intensity = intensityOf(t.charCount);
  const long = t.charCount > 420;
  const Icon = t.category ? DIMENSION_ICON[t.category] : null;

  if (editing !== null) {
    return (
      <div className="rounded-lg border border-accent bg-digi-card p-3">
        <textarea
          value={editing} onChange={(e) => onEditChange(e.target.value)} rows={6}
          className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text focus:border-accent focus:outline-none resize-y"
          style={mf}
        />
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
        <span className="inline-flex items-center gap-1 text-[11px] text-digi-muted tabular-nums" style={mf}>
          <Clock className="w-3 h-3" /> {fmtTime(t.createdAt)}
        </span>
        <span className="inline-flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded-full border border-digi-border" style={{ ...mf, color: intensity.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: intensity.color }} />
          {intensity.label}
        </span>
        {t.category && Icon ? (
          <span className="inline-flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded-full border"
            style={{ ...mf, color: DIMENSION_COLOR[t.category], borderColor: `${DIMENSION_COLOR[t.category]}55`, background: `${DIMENSION_COLOR[t.category]}18` }}>
            <Icon className="w-3 h-3" /> {DIMENSION_LABEL[t.category]}
          </span>
        ) : (
          <span className="text-[10.5px] text-digi-muted/60" style={mf}>Sin etiquetar</span>
        )}
        <span className="text-[11px] text-digi-muted/60 tabular-nums ml-auto" style={mf}>{nf.format(t.charCount)} car.</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button onClick={onStartEdit} className="text-digi-muted hover:text-accent" aria-label="Editar pensamiento"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} className="text-digi-muted hover:text-red-500" aria-label="Eliminar pensamiento"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <p className={`text-[13px] text-digi-text whitespace-pre-wrap leading-relaxed ${!expanded && long ? 'line-clamp-4' : ''}`} style={mf}>
        {t.content}
      </p>
      {long && (
        <button onClick={() => setExpanded((v) => !v)} className="mt-1 text-[11.5px] text-accent hover:underline" style={mf}>
          {expanded ? 'Ver menos' : 'Ver todo'}
        </button>
      )}
    </div>
  );
}
