'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import UsersList, { type SelectedUser } from '@/components/centralized/UsersList';
import FilterRail, { type FilterRailItem } from '@/components/ui/FilterRail';
import MultiSelectSearch from '@/components/ui/MultiSelectSearch';
import PixelModal from '@/components/ui/PixelModal';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { DIMENSIONS, DIMENSION_LABEL, DIMENSION_COLOR } from '@/lib/centralized/apoyo';
import { DIMENSION_ICON } from '@/components/centralized/dimensionIcons';
import { VALORES, VALOR_LABEL } from '@/lib/centralized/valores';
import { TALENTOS } from '@/lib/centralized/talentos';
import { intensityOf } from '@/lib/centralized/pensamientos';
import {
  Layers, BrainCircuit, Gem, Sparkles, Star, Clock, X, Save, AlertCircle, UserRound,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;
const API = '/api/centralized/gestion-social/recursos';
const nf = new Intl.NumberFormat('es-ES');

const VALOR_OPTIONS = VALORES.map((v) => ({ value: v.key, label: v.label }));
const TALENTO_OPTIONS = TALENTOS.map((t) => ({ value: t, label: t }));

interface Thought {
  id: number; content: string; charCount: number;
  category: string | null; day: string; createdAt: string;
}
interface Assessment {
  talents: { itemKey: string; points: number }[];
  values: { itemKey: string; points: number }[];
  updatedAt: string | null; updatedBy: string | null;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil' });

/**
 * Pestaña RECURSOS de Gestión Social: leer los pensamientos de un candidato o miembro y
 * asignarle una VALORACIÓN de talentos y valores.
 *
 * Tres paneles, de izquierda a derecha: personas → tipo de pensamiento → sus pensamientos.
 * Al pulsar un pensamiento se abre completo.
 *
 * ⚠️ La puntuación es FIJA, no acumulativa: lo que se guarda REEMPLAZA a lo anterior (hoy 5
 * puntos, mañana 3 → el perfil pasa a mostrar 3, no 8). Y no se mezcla con los puntos que
 * salen del cumplimiento de tareas: aparece como su propia sección en el perfil.
 */
export default function RecursosTab() {
  const [user, setUser] = useState<SelectedUser | null>(null);
  const [cat, setCat] = useState('_todas');
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reading, setReading] = useState<Thought | null>(null);

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [scoreOpen, setScoreOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setThoughts([]); setCounts({}); setAssessment(null); return; }
    setLoading(true);
    try {
      const qs = `kind=${user.kind}&id=${encodeURIComponent(user.id)}`;
      const catQs = cat === '_todas' ? '' : `&categoria=${cat}`;
      const [tRes, aRes] = await Promise.all([
        fetch(`${API}/pensamientos?${qs}${catQs}`),
        fetch(`${API}/valoracion?${qs}`),
      ]);
      const t = await tRes.json();
      const a = await aRes.json();
      if (!tRes.ok) throw new Error(t.error || 'Error');
      if (!aRes.ok) throw new Error(a.error || 'Error');
      setThoughts(t.data.thoughts || []);
      setCounts(t.data.counts || {});
      setAssessment(a.data);
      setErr(null);
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }, [user, cat]);

  useEffect(() => { load(); }, [load]);
  // Al cambiar de persona se vuelve a "Todas" para no arrastrar un filtro sin resultados.
  useEffect(() => { setCat('_todas'); }, [user?.kind, user?.id]);

  const railItems: FilterRailItem<string>[] = useMemo(() => ([
    { value: '_todas', label: 'Todas', Icon: Layers, count: counts._todas },
    ...DIMENSIONS.map((d) => ({ value: d.key, label: DIMENSION_LABEL[d.key], Icon: DIMENSION_ICON[d.key], count: counts[d.key] || 0 })),
    { value: '_sin', label: 'Sin etiquetar', Icon: BrainCircuit, count: counts._sin || 0 },
  ]), [counts]);

  const totalPoints = useMemo(() => {
    if (!assessment) return { t: 0, v: 0 };
    return {
      t: assessment.talents.reduce((s, x) => s + x.points, 0),
      v: assessment.values.reduce((s, x) => s + x.points, 0),
    };
  }, [assessment]);

  const shown = cat === '_sin' ? thoughts.filter((t) => !t.category) : thoughts;

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      {/* 1) Personas */}
      <div className="w-full lg:w-[210px] shrink-0">
        <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-1 pb-1.5" style={df}>Personas</p>
        <UsersList selected={user} onSelect={setUser} className="max-h-[70vh] overflow-y-auto" />
      </div>

      {!user ? (
        <div className="flex-1 bg-digi-card border border-digi-border rounded-xl py-16 text-center">
          <UserRound className="w-8 h-8 text-digi-muted mx-auto mb-2" />
          <p className="text-[13px] text-digi-text font-medium" style={mf}>Elige una persona</p>
          <p className="text-[12px] text-digi-muted mt-1" style={mf}>Verás sus pensamientos y podrás valorar sus talentos y valores.</p>
        </div>
      ) : (
        <>
          {/* 2) Tipo de pensamiento */}
          <FilterRail title="Tipo" items={railItems} value={cat} onChange={setCat} />

          {/* 3) Pensamientos + valoración */}
          <div className="flex-1 min-w-0 w-full">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <p className="text-[13px] font-semibold text-digi-text" style={df}>{user.name}</p>
              <span className="text-[10.5px] px-2 py-0.5 rounded-full border border-digi-border text-digi-muted" style={mf}>
                {user.kind === 'member' ? 'Miembro' : 'Candidato'}
              </span>
              <button className={`${BTN_PRIMARY} ml-auto`} onClick={() => setScoreOpen(true)} style={mf}>
                <Star className="w-4 h-4" /> Valorar
              </button>
            </div>

            {/* Resumen de la valoración vigente */}
            {assessment && (assessment.talents.length > 0 || assessment.values.length > 0) && (
              <div className="mb-3 rounded-lg border border-accent/30 bg-accent-light/40 p-3">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Star className="w-3.5 h-3.5 text-accent" />
                  <p className="text-[11.5px] font-semibold text-accent" style={df}>Valoración vigente</p>
                  <span className="text-[10.5px] text-digi-muted tabular-nums" style={mf}>
                    talentos {totalPoints.t >= 0 ? '+' : ''}{totalPoints.t} · valores {totalPoints.v >= 0 ? '+' : ''}{totalPoints.v}
                  </span>
                  {assessment.updatedAt && (
                    <span className="text-[10.5px] text-digi-muted ml-auto inline-flex items-center gap-1" style={mf}>
                      <Clock className="w-3 h-3" /> {fmtDate(assessment.updatedAt)}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {assessment.talents.map((x) => (
                    <Chip key={`t-${x.itemKey}`} icon={<Sparkles className="w-3 h-3" />} label={x.itemKey} points={x.points} tone="sky" />
                  ))}
                  {assessment.values.map((x) => (
                    <Chip key={`v-${x.itemKey}`} icon={<Gem className="w-3 h-3" />} label={VALOR_LABEL[x.itemKey] || x.itemKey} points={x.points} tone="violet" />
                  ))}
                </div>
              </div>
            )}

            {err && (
              <div className="mb-3 px-3 py-2 rounded-md border border-red-400/40 bg-red-500/10 text-[12px] text-red-600 flex items-center gap-2" style={mf}>
                <AlertCircle className="w-4 h-4 shrink-0" /> {err}
              </div>
            )}

            {loading ? (
              <p className="py-12 text-center text-[13px] text-digi-muted" style={mf}>Cargando…</p>
            ) : shown.length === 0 ? (
              <div className="bg-digi-card border border-digi-border rounded-xl py-14 text-center">
                <BrainCircuit className="w-8 h-8 text-digi-muted mx-auto mb-2" />
                <p className="text-[13px] text-digi-text font-medium" style={mf}>Sin pensamientos {cat !== '_todas' ? 'de este tipo' : ''}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {shown.map((t) => (
                  <button key={t.id} onClick={() => setReading(t)}
                    className="w-full text-left rounded-lg border border-digi-border bg-digi-card p-3 hover:border-accent transition-colors">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[11px] text-digi-muted tabular-nums" style={mf}>{fmtDate(t.createdAt)}</span>
                      {t.category ? <CategoryChip cat={t.category} /> : (
                        <span className="text-[10.5px] text-digi-muted/60" style={mf}>Sin etiquetar</span>
                      )}
                      <span className="text-[10.5px] text-digi-muted/70 ml-auto tabular-nums" style={mf}>
                        {intensityOf(t.charCount).label} · {nf.format(t.charCount)} car.
                      </span>
                    </div>
                    <p className="text-[12.5px] text-digi-text line-clamp-3 whitespace-pre-wrap" style={mf}>{t.content}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Lectura completa */}
      <PixelModal open={!!reading} onClose={() => setReading(null)} title="Pensamiento" size="md">
        {reading && (
          <div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-[11.5px] text-digi-muted tabular-nums" style={mf}>{fmtDate(reading.createdAt)}</span>
              {reading.category && <CategoryChip cat={reading.category} />}
              <span className="text-[11px] text-digi-muted/70 tabular-nums" style={mf}>
                {intensityOf(reading.charCount).label} · {nf.format(reading.charCount)} caracteres
              </span>
            </div>
            <p className="text-[13px] text-digi-text whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto" style={mf}>
              {reading.content}
            </p>
          </div>
        )}
      </PixelModal>

      {user && (
        <ScoreModal
          open={scoreOpen}
          onClose={() => setScoreOpen(false)}
          user={user}
          initial={assessment}
          onSaved={() => { setScoreOpen(false); load(); }}
        />
      )}
    </div>
  );
}

/* ── Piezas ──────────────────────────────────────────────────────────────────── */

function CategoryChip({ cat }: { cat: string }) {
  const Icon = DIMENSION_ICON[cat];
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded-full border"
      style={{ ...mf, color: DIMENSION_COLOR[cat], borderColor: `${DIMENSION_COLOR[cat]}55`, background: `${DIMENSION_COLOR[cat]}18` }}>
      {Icon && <Icon className="w-3 h-3" />} {DIMENSION_LABEL[cat] || cat}
    </span>
  );
}

function Chip({ icon, label, points, tone }: { icon: React.ReactNode; label: string; points: number; tone: 'sky' | 'violet' }) {
  const cls = tone === 'sky'
    ? 'bg-sky-500/15 border-sky-400/30 text-sky-600'
    : 'bg-violet-500/15 border-violet-400/30 text-violet-500';
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10.5px] ${cls}`} style={mf}>
      {icon} {label}
      <strong className="tabular-nums">{points >= 0 ? `+${points}` : points}</strong>
    </span>
  );
}

/* ── Modal de valoración ─────────────────────────────────────────────────────── */

type Row = { itemKey: string; points: number };

function ScoreModal({ open, onClose, user, initial, onSaved }: {
  open: boolean; onClose: () => void; user: SelectedUser; initial: Assessment | null; onSaved: () => void;
}) {
  const [talents, setTalents] = useState<Row[]>([]);
  const [values, setValues] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTalents(initial?.talents.map((x) => ({ ...x })) || []);
    setValues(initial?.values.map((x) => ({ ...x })) || []);
    setErr(null);
  }, [open, initial]);

  // El multi-select gobierna QUÉ ítems hay; los que ya existían conservan su puntuación.
  const syncTalents = (keys: string[]) =>
    setTalents(keys.map((k) => talents.find((x) => x.itemKey === k) || { itemKey: k, points: 0 }));
  const syncValues = (keys: string[]) =>
    setValues(keys.map((k) => values.find((x) => x.itemKey === k) || { itemKey: k, points: 0 }));

  const save = async () => {
    setSaving(true);
    try {
      const items = [
        ...talents.map((x) => ({ kind: 'talent' as const, itemKey: x.itemKey, points: x.points })),
        ...values.map((x) => ({ kind: 'value' as const, itemKey: x.itemKey, points: x.points })),
      ];
      const res = await fetch(`${API}/valoracion?kind=${user.kind}&id=${encodeURIComponent(user.id)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      onSaved();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <PixelModal open={open} onClose={onClose} title={`Valorar a ${user.name}`} size="md" busy={saving}>
      <div className="space-y-4">
        <p className="text-[11.5px] text-digi-muted bg-black/[0.03] border border-digi-border rounded-md px-2.5 py-2" style={mf}>
          La puntuación <strong className="text-digi-text">reemplaza</strong> a la anterior: no se acumula.
          Si hoy asignas 5 puntos y mañana 3, en el perfil quedan 3.
        </p>

        <Section
          title="Talentos" icon={<Sparkles className="w-3.5 h-3.5 text-sky-500" />}
          options={TALENTO_OPTIONS} rows={talents}
          onSync={syncTalents} onPoints={(k, p) => setTalents((r) => r.map((x) => (x.itemKey === k ? { ...x, points: p } : x)))}
          labelOf={(k) => k} placeholder="Buscar talento…"
        />

        <Section
          title="Valores" icon={<Gem className="w-3.5 h-3.5 text-violet-500" />}
          options={VALOR_OPTIONS} rows={values}
          onSync={syncValues} onPoints={(k, p) => setValues((r) => r.map((x) => (x.itemKey === k ? { ...x, points: p } : x)))}
          labelOf={(k) => VALOR_LABEL[k] || k} placeholder="Buscar valor…"
        />

        {err && (
          <p className="text-[12px] text-red-600 flex items-center gap-1.5" style={mf}>
            <AlertCircle className="w-4 h-4 shrink-0" /> {err}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-digi-border">
          <button className={BTN_SECONDARY} onClick={onClose} style={mf}><X className="w-4 h-4" /> Cancelar</button>
          <button className={BTN_PRIMARY} onClick={save} disabled={saving} style={mf}><Save className="w-4 h-4" /> Guardar valoración</button>
        </div>
      </div>
    </PixelModal>
  );
}

function Section({ title, icon, options, rows, onSync, onPoints, labelOf, placeholder }: {
  title: string; icon: React.ReactNode;
  options: { value: string; label: string }[];
  rows: Row[];
  onSync: (keys: string[]) => void;
  onPoints: (key: string, points: number) => void;
  labelOf: (key: string) => string;
  placeholder: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-digi-muted uppercase tracking-wide mb-1.5" style={df}>
        {icon} {title}
      </p>
      <MultiSelectSearch
        options={options}
        selected={rows.map((r) => r.itemKey)}
        onChange={onSync}
        placeholder={placeholder}
      />
      {rows.length > 0 && (
        <div className="mt-2 space-y-1">
          {rows.map((r) => (
            <div key={r.itemKey} className="flex items-center gap-2 rounded-md border border-digi-border bg-digi-darker/40 px-2.5 py-1.5">
              <span className="flex-1 min-w-0 text-[12.5px] text-digi-text truncate" style={mf}>{labelOf(r.itemKey)}</span>
              <input
                type="number" min={-100} max={100} value={r.points}
                onChange={(e) => onPoints(r.itemKey, Math.max(-100, Math.min(100, Number(e.target.value) || 0)))}
                className="w-20 px-2 py-1 bg-digi-card border border-digi-border rounded text-[12.5px] text-digi-text text-right tabular-nums focus:border-accent focus:outline-none"
                style={mf}
                aria-label={`Puntos para ${labelOf(r.itemKey)}`}
              />
              <span className="text-[11px] text-digi-muted w-8" style={mf}>pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
