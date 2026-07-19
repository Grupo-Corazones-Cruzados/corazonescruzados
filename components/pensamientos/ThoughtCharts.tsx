'use client';

import { useMemo, useState } from 'react';
import { DIMENSIONS, DIMENSION_LABEL, DIMENSION_COLOR } from '@/lib/centralized/apoyo';
import { DIMENSION_ICON, DIMENSION_SHAPE, type MarkShape } from '@/components/centralized/dimensionIcons';
import { BarChart3, Table2 } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

export interface DayBucket { day: string; count: number; chars: number }
export interface MonthBucket { month: string; byCategory: Record<string, number>; chars: number; count: number }

/* ── Geometría común ─────────────────────────────────────────────────────────── */
const W = 720, H = 240;
const PAD = { t: 14, r: 16, b: 30, l: 38 };
const PW = W - PAD.l - PAD.r;
const PH = H - PAD.t - PAD.b;

/** Escala de radio para la INTENSIDAD (nº de caracteres). El área ∝ valor, por eso √. */
const radiusFor = (chars: number, max: number) => {
  if (max <= 0) return 3.5;
  return 3.5 + Math.sqrt(Math.max(0, chars) / max) * 5.5; // 3.5–9 px
};

/** Ticks "bonitos" para el eje Y (siempre desde 0, enteros). */
function yTicks(max: number): number[] {
  const top = Math.max(1, max);
  const step = Math.max(1, Math.ceil(top / 4));
  const out: number[] = [];
  for (let v = 0; v <= step * 4; v += step) out.push(v);
  return out;
}

const fmtDay = (d: string) => { const [, m, dd] = d.split('-'); return `${dd}/${m}`; };
const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const fmtMonth = (m: string) => { const [y, mm] = m.split('-'); return `${MONTHS_ES[Number(mm) - 1]} ${y.slice(2)}`; };
const nf = new Intl.NumberFormat('es-ES');

/** Marcador con FORMA propia: 2º canal de identidad además del color (ver dimensionIcons). */
function Mark({ shape, cx, cy, r, fill }: { shape: MarkShape; cx: number; cy: number; r: number; fill: string }) {
  const common = { fill, stroke: 'var(--color-digi-card)', strokeWidth: 2 };
  if (shape === 'square') return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} rx={1.5} {...common} />;
  if (shape === 'triangle') return <polygon points={`${cx},${cy - r * 1.15} ${cx + r * 1.1},${cy + r * 0.85} ${cx - r * 1.1},${cy + r * 0.85}`} {...common} />;
  if (shape === 'diamond') return <polygon points={`${cx},${cy - r * 1.25} ${cx + r * 1.2},${cy} ${cx},${cy + r * 1.25} ${cx - r * 1.2},${cy}`} {...common} />;
  return <circle cx={cx} cy={cy} r={r} {...common} />;
}

/** Rejilla + eje Y + etiquetas del eje X. Recesivos a propósito (el dato manda). */
function Axes({ ticks, yMax, xLabels }: { ticks: number[]; yMax: number; xLabels: { x: number; label: string }[] }) {
  return (
    <g>
      {ticks.map((t) => {
        const y = PAD.t + PH - (t / yMax) * PH;
        return (
          <g key={t}>
            <line x1={PAD.l} y1={y} x2={PAD.l + PW} y2={y} stroke="var(--color-digi-border)" strokeWidth={1} opacity={0.5} />
            <text x={PAD.l - 7} y={y + 3.5} textAnchor="end" fontSize={10} fill="var(--color-digi-muted)" style={mf}>{t}</text>
          </g>
        );
      })}
      {xLabels.map((l, i) => (
        <text key={i} x={l.x} y={H - 10} textAnchor="middle" fontSize={10} fill="var(--color-digi-muted)" style={mf}>{l.label}</text>
      ))}
    </g>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-[12px] text-digi-muted/60 text-center py-10" style={mf}>{text}</p>;
}

/* ── Gráfico 1 · Pensamientos por día (intensidad = tamaño del punto) ─────────── */

export function DailyChart({ days }: { days: DayBucket[] }) {
  const [hover, setHover] = useState<number | null>(null);
  // El API devuelve los días de más nuevo a más viejo; el eje temporal va al revés.
  const data = useMemo(() => [...days].reverse().slice(-45), [days]);

  if (data.length === 0) return <Empty text="Aún no hay pensamientos que graficar." />;

  const yMax = Math.max(...yTicks(Math.max(...data.map((d) => d.count))));
  const maxChars = Math.max(...data.map((d) => d.chars));
  const x = (i: number) => PAD.l + (data.length === 1 ? PW / 2 : (i / (data.length - 1)) * PW);
  const y = (v: number) => PAD.t + PH - (v / yMax) * PH;

  const step = Math.max(1, Math.ceil(data.length / 8));
  const xLabels = data.map((d, i) => ({ x: x(i), label: fmtDay(d.day), i })).filter((_, i) => i % step === 0);
  const h = hover != null ? data[hover] : null;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
        aria-label={`Pensamientos por día. ${data.length} días, máximo ${yMax} en un día.`}>
        <Axes ticks={yTicks(yMax)} yMax={yMax} xLabels={xLabels} />

        {/* Zonas de hover: más anchas que el punto, para que apuntar sea fácil */}
        {data.map((d, i) => (
          <rect key={`hit-${d.day}`} x={x(i) - PW / data.length / 2} y={PAD.t}
            width={Math.max(10, PW / data.length)} height={PH} fill="transparent"
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}

        {hover != null && <line x1={x(hover)} y1={PAD.t} x2={x(hover)} y2={PAD.t + PH} stroke="var(--color-accent)" strokeWidth={1} opacity={0.4} />}

        <polyline
          points={data.map((d, i) => `${x(i)},${y(d.count)}`).join(' ')}
          fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
        />
        {data.map((d, i) => (
          <Mark key={d.day} shape="circle" cx={x(i)} cy={y(d.count)} r={radiusFor(d.chars, maxChars)} fill="var(--color-accent)" />
        ))}
      </svg>

      <div className="flex items-center justify-between gap-3 mt-1 flex-wrap">
        <p className="text-[11px] text-digi-muted" style={mf}>
          El <strong className="text-digi-text">tamaño del punto</strong> es la intensidad: cuánto texto escribiste ese día.
        </p>
        {h && (
          <p className="text-[11.5px] text-digi-text tabular-nums" style={mf}>
            {fmtDay(h.day)} · <strong>{h.count}</strong> pensamiento(s) · {nf.format(h.chars)} caracteres
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Gráfico 2 · Pensamientos por mes según tipo ──────────────────────────────── */

export function CategoryChart({ months }: { months: MonthBucket[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const data = useMemo(() => months.slice(-12), [months]);

  if (data.length === 0) return <Empty text="Aún no hay pensamientos que graficar." />;

  const maxCount = Math.max(1, ...data.flatMap((m) => DIMENSIONS.map((d) => m.byCategory[d.key] || 0)));
  const ticks = yTicks(maxCount);
  const yMax = Math.max(...ticks);
  const x = (i: number) => PAD.l + (data.length === 1 ? PW / 2 : (i / (data.length - 1)) * PW);
  const y = (v: number) => PAD.t + PH - (v / yMax) * PH;
  const xLabels = data.map((m, i) => ({ x: x(i), label: fmtMonth(m.month) }));
  const anyTagged = data.some((m) => Object.keys(m.byCategory).length > 0);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
        aria-label="Pensamientos por mes según su tipo: laboral, corporal, mental y social.">
        <Axes ticks={ticks} yMax={yMax} xLabels={xLabels} />

        {data.map((m, i) => (
          <rect key={`hit-${m.month}`} x={x(i) - PW / data.length / 2} y={PAD.t}
            width={Math.max(10, PW / data.length)} height={PH} fill="transparent"
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
        {hover != null && <line x1={x(hover)} y1={PAD.t} x2={x(hover)} y2={PAD.t + PH} stroke="var(--color-accent)" strokeWidth={1} opacity={0.4} />}

        {DIMENSIONS.map((dim) => {
          const pts = data.map((m, i) => ({ x: x(i), y: y(m.byCategory[dim.key] || 0) }));
          return (
            <g key={dim.key}>
              <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none"
                stroke={DIMENSION_COLOR[dim.key]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p, i) => (
                <Mark key={i} shape={DIMENSION_SHAPE[dim.key]} cx={p.x} cy={p.y} r={4} fill={DIMENSION_COLOR[dim.key]} />
              ))}
            </g>
          );
        })}
      </svg>

      {/* Leyenda: color + FORMA + icono. La identidad nunca depende solo del color. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1">
        {DIMENSIONS.map((dim) => {
          const Icon = DIMENSION_ICON[dim.key];
          const total = data.reduce((s, m) => s + (m.byCategory[dim.key] || 0), 0);
          return (
            <span key={dim.key} className="inline-flex items-center gap-1.5 text-[11.5px] text-digi-text" style={mf}>
              <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden>
                <Mark shape={DIMENSION_SHAPE[dim.key]} cx={7} cy={7} r={4.5} fill={DIMENSION_COLOR[dim.key]} />
              </svg>
              <Icon className="w-3.5 h-3.5 text-digi-muted" />
              {DIMENSION_LABEL[dim.key]}
              <span className="text-digi-muted tabular-nums">({total})</span>
            </span>
          );
        })}
      </div>

      {hover != null && (
        <p className="text-[11.5px] text-digi-text mt-1.5 tabular-nums" style={mf}>
          {fmtMonth(data[hover].month)} ·{' '}
          {DIMENSIONS.map((d) => `${DIMENSION_LABEL[d.key]} ${data[hover].byCategory[d.key] || 0}`).join(' · ')}
        </p>
      )}
      {!anyTagged && (
        <p className="text-[11px] text-digi-muted mt-1.5" style={mf}>
          Todavía no hay pensamientos etiquetados. La IA los clasifica cada noche a la 01:00.
        </p>
      )}
    </div>
  );
}

/* ── Gráfico 3 · Intensidad por mes ───────────────────────────────────────────
 * Va SEPARADO en vez de como segundo eje del gráfico anterior: dos escalas distintas
 * en un mismo plot inventan correlaciones que no están en los datos.
 */
export function IntensityChart({ months }: { months: MonthBucket[] }) {
  const data = useMemo(() => months.slice(-12), [months]);
  if (data.length === 0) return <Empty text="Sin datos de intensidad." />;

  const max = Math.max(1, ...data.map((m) => m.chars));
  const bw = Math.min(38, (PW / data.length) * 0.55);

  return (
    <div>
      <svg viewBox={`0 0 ${W} 150`} className="w-full h-auto" role="img"
        aria-label="Intensidad por mes, medida en caracteres escritos.">
        <line x1={PAD.l} y1={110} x2={PAD.l + PW} y2={110} stroke="var(--color-digi-border)" strokeWidth={1} />
        {data.map((m, i) => {
          const cx = PAD.l + (data.length === 1 ? PW / 2 : (i / (data.length - 1)) * PW);
          const h = Math.max(2, (m.chars / max) * 88);
          return (
            <g key={m.month}>
              <rect x={cx - bw / 2} y={110 - h} width={bw} height={h} rx={4} fill="var(--color-accent)" opacity={0.85} />
              <text x={cx} y={128} textAnchor="middle" fontSize={10} fill="var(--color-digi-muted)" style={mf}>{fmtMonth(m.month)}</text>
              <text x={cx} y={110 - h - 5} textAnchor="middle" fontSize={9.5} fill="var(--color-digi-muted)" style={mf}>
                {m.chars >= 1000 ? `${Math.round(m.chars / 1000)}k` : m.chars}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-[11px] text-digi-muted" style={mf}>Caracteres escritos en cada mes.</p>
    </div>
  );
}

/* ── Vista de tabla ───────────────────────────────────────────────────────────
 * Obligatoria, no opcional: dos de los colores de dimensión quedan por debajo de 3:1
 * de contraste sobre fondo claro, y el par mental/corporal no supera la separación
 * para daltonismo. La tabla garantiza que el dato siempre se pueda leer sin color.
 */
function MonthTable({ months }: { months: MonthBucket[] }) {
  const data = [...months].slice(-12).reverse();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]" style={mf}>
        <thead>
          <tr className="text-digi-muted border-b border-digi-border">
            <th className="text-left font-medium py-1.5 pr-3">Mes</th>
            {DIMENSIONS.map((d) => <th key={d.key} className="text-right font-medium py-1.5 px-2">{DIMENSION_LABEL[d.key]}</th>)}
            <th className="text-right font-medium py-1.5 px-2">Total</th>
            <th className="text-right font-medium py-1.5 pl-2">Caracteres</th>
          </tr>
        </thead>
        <tbody>
          {data.map((m) => (
            <tr key={m.month} className="border-b border-digi-border/50">
              <td className="py-1.5 pr-3 text-digi-text">{fmtMonth(m.month)}</td>
              {DIMENSIONS.map((d) => (
                <td key={d.key} className="text-right py-1.5 px-2 tabular-nums text-digi-text">
                  {m.byCategory[d.key] || <span className="text-digi-muted/50">—</span>}
                </td>
              ))}
              <td className="text-right py-1.5 px-2 tabular-nums text-digi-text font-medium">{m.count}</td>
              <td className="text-right py-1.5 pl-2 tabular-nums text-digi-muted">{nf.format(m.chars)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Panel completo (el contenido del modal) ─────────────────────────────────── */

export default function ThoughtCharts({ days, months, totals }: {
  days: DayBucket[]; months: MonthBucket[];
  totals: { count: number; chars: number; uncategorized: number };
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');

  return (
    <div className="space-y-5">
      {/* Cifras de cabecera: el número ES el dato, no hace falta gráfico para esto */}
      <div className="flex flex-wrap gap-3">
        <Stat label="Pensamientos" value={nf.format(totals.count)} />
        <Stat label="Caracteres escritos" value={nf.format(totals.chars)} />
        <Stat label="Días con actividad" value={nf.format(days.length)} />
        {totals.uncategorized > 0 && <Stat label="Sin etiquetar" value={nf.format(totals.uncategorized)} muted />}
      </div>

      <div className="flex items-center gap-2">
        <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide" style={df}>Actividad por día</p>
        <div className="ml-auto flex items-center gap-1">
          <ViewBtn active={view === 'chart'} onClick={() => setView('chart')} Icon={BarChart3} label="Gráficos" />
          <ViewBtn active={view === 'table'} onClick={() => setView('table')} Icon={Table2} label="Tabla" />
        </div>
      </div>

      {view === 'chart' ? (
        <>
          <DailyChart days={days} />
          <div>
            <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide mb-1" style={df}>Tipo de pensamiento por mes</p>
            <CategoryChart months={months} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide mb-1" style={df}>Intensidad por mes</p>
            <IntensityChart months={months} />
          </div>
        </>
      ) : (
        <MonthTable months={months} />
      )}
    </div>
  );
}

function Stat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex-1 min-w-[130px] rounded-lg border border-digi-border bg-digi-darker/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-digi-muted" style={df}>{label}</p>
      <p className={`text-[18px] font-semibold tabular-nums ${muted ? 'text-digi-muted' : 'text-digi-text'}`} style={mf}>{value}</p>
    </div>
  );
}

function ViewBtn({ active, onClick, Icon, label }: { active: boolean; onClick: () => void; Icon: any; label: string }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] border transition-colors ${
        active ? 'bg-accent-light border-accent/30 text-accent' : 'border-digi-border text-digi-muted hover:text-digi-text'
      }`} style={mf}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}
