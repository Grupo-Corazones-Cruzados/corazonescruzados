'use client';

/**
 * FlowPanelUI — definición ÚNICA del lenguaje visual de los editores grandes de
 * Automatizaciones (Email masivo, WhatsApp, Chatbot). Antes cada panel traía su propio
 * overlay, su cabecera, sus pasos y sus botones a mano (y los tres se veían distinto y
 * seguían el lenguaje pixel antiguo: bordes de 2px, textos de 8-9px).
 *
 * Todo lo de aquí es el estándar Fluent `.corp` del dashboard: 1px de borde, radios 4-6px,
 * textos 12-13px, iconos lucide y los botones de `components/ui/Button`.
 * Cambiar un control aquí lo cambia en los tres paneles.
 */

import { ArrowLeft, X, Check, Paperclip, Trash2 } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

/* ─── Clases compartidas de formulario (mismo lenguaje que PixelInput/.corp .field-control) ─── */

/** Campo de texto estándar del panel. Se usa cuando `PixelInput` no encaja (campos en línea). */
export const FIELD =
  'field-control w-full px-3 py-2 bg-digi-darker border border-digi-border rounded text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none';
/** Variante compacta para filas de "agregar" dentro de una lista. */
export const FIELD_SM =
  'field-control px-2.5 py-1.5 bg-digi-darker border border-digi-border rounded text-[13px] text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none';
/** Etiqueta de campo. */
export const LABEL = 'field-label block text-[12px] font-semibold text-digi-text mb-1';

/** Botón pequeño de fila/tabla (neutro). Para acciones dentro de un `PixelDataTable`. */
export const BTN_ROW =
  'inline-flex items-center justify-center gap-1 px-2 py-1 rounded border border-digi-border text-[12px] font-medium text-digi-text hover:border-accent hover:text-accent transition-colors disabled:opacity-50 disabled:pointer-events-none';
/** Botón pequeño de fila, en rojo (eliminar). */
export const BTN_ROW_DANGER =
  'inline-flex items-center justify-center gap-1 px-2 py-1 rounded border border-red-500/40 text-[12px] font-medium text-red-500 hover:bg-red-500/10 transition-colors';

/* ─── Shell del panel (overlay + cabecera) ─── */

/**
 * Overlay a pantalla completa con panel deslizante a la derecha. Es la variante
 * "extra-grande" del panel lateral estándar (`.corp .modal-surface[data-size=lg]` mide
 * 840px): estos editores llevan tablas y asistentes, así que usan 1040px.
 *
 * `z-[70]` a propósito: el banner de Comandos Violeta es `z-[60]` y se comía la cabecera
 * del panel. Los `PixelModal` que se abren desde dentro usan `<dialog showModal>`, que vive
 * en el top layer del navegador, así que siguen quedando por encima de este panel.
 */
export function FlowPanelShell({
  Icon, title, subtitle, onClose, variant = 'overlay', children,
}: {
  Icon: any;
  title: string;
  subtitle: string;
  onClose: () => void;
  /**
   * `page` = el panel se monta dentro de una página que ya tiene su `DetailHeader`
   * (el detalle del flujo): no pinta overlay ni cabecera propia, solo su contenido.
   */
  variant?: 'overlay' | 'page';
  children: React.ReactNode;
}) {
  if (variant === 'page') return <div>{children}</div>;

  return (
    <div className="fixed inset-0 z-[70] flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative ml-auto w-full max-w-[1040px] bg-digi-card border-l border-digi-border overflow-y-auto shadow-2xl animate-[panelSlideInRight_0.27s_cubic-bezier(0.1,0.9,0.2,1)]">
        <div className="sticky top-0 z-10 bg-digi-card border-b border-digi-border px-6 py-3.5 flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-digi-muted hover:bg-black/[0.04] hover:text-digi-text transition-colors shrink-0"
            aria-label="Volver"
            title="Volver a los flujos"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-9 h-9 rounded-md bg-accent-light border border-accent/15 flex items-center justify-center shrink-0">
            <Icon className="w-[18px] h-[18px] text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold text-digi-text leading-tight truncate" style={mf}>{title}</h2>
            <p className="text-[12px] text-digi-muted truncate" style={mf}>{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-digi-muted hover:bg-black/[0.04] hover:text-digi-text transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/**
 * Cabecera de una sub-vista del panel (asistente, estadísticas, detalle): volver + título
 * + acciones opcionales a la derecha. Sustituye los `< Campanas` sueltos de antes.
 */
export function PanelSubHeader({
  onBack, backLabel, title, subtitle, children,
}: {
  onBack: () => void;
  backLabel: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-[12px] font-medium text-digi-muted hover:text-accent transition-colors shrink-0"
        style={mf}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> {backLabel}
      </button>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold text-digi-text truncate" style={mf}>{title}</h3>
        {subtitle && <p className="text-[12px] text-digi-muted truncate" style={mf}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** Barra de sección: título a la izquierda, acciones a la derecha (orden estándar). */
export function SectionBar({ title, hint, children }: { title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-digi-text" style={mf}>{title}</h3>
        {hint && <p className="text-[12px] text-digi-muted" style={mf}>{hint}</p>}
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}

/** Separador + pie de acciones de un formulario (izquierda: volver · derecha: primaria). */
export function PanelFooter({ children, align = 'between' }: { children: React.ReactNode; align?: 'between' | 'end' }) {
  return (
    <div className={`flex items-center gap-2 pt-4 border-t border-digi-border ${align === 'end' ? 'justify-end' : 'justify-between'}`}>
      {children}
    </div>
  );
}

/* ─── Indicador de pasos (una sola definición para los 3 asistentes) ─── */

export function Steps({
  items, current, onGo,
}: {
  items: string[];
  current: number;              // 1-based
  onGo?: (step: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      {items.map((label, i) => {
        const num = i + 1;
        const active = current === num;
        const done = current > num;
        const clickable = !!onGo && (done || active);
        return (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && <div className={`w-8 h-px ${current > i ? 'bg-accent' : 'bg-digi-border'}`} />}
            <button
              type="button"
              onClick={() => clickable && onGo?.(num)}
              disabled={!clickable}
              className="flex items-center gap-2 disabled:cursor-default"
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors ${
                  active ? 'bg-accent text-white'
                    : done ? 'bg-accent-light text-accent border border-accent/30'
                    : 'border border-digi-border text-digi-muted'
                }`}
                style={mf}
              >
                {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : num}
              </span>
              <span className={`text-[12px] font-medium ${active ? 'text-accent' : 'text-digi-muted'}`} style={mf}>{label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Tarjetas de resumen (estadísticas) ─── */

export type StatTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger';

const STAT_TONE: Record<StatTone, string> = {
  neutral: 'text-digi-text',
  success: 'text-green-400',
  info: 'text-blue-400',
  warning: 'text-amber-400',
  danger: 'text-red-400',
};

export function StatCards({ items }: { items: { label: string; value: number; tone?: StatTone }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-4">
      {items.map((s) => (
        <div key={s.label} className="bg-digi-darker border border-digi-border rounded-lg px-3 py-2.5 text-center">
          <p className="text-[11px] text-digi-muted mb-0.5" style={mf}>{s.label}</p>
          <p className={`text-[20px] font-semibold tabular-nums ${STAT_TONE[s.tone || 'neutral']}`} style={mf}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── Fila de archivo (adjuntos, conocimiento) ─── */

export function FileRow({ name, meta, onRemove }: { name: string; meta?: string; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-digi-border bg-digi-darker/40">
      <Paperclip className="w-3.5 h-3.5 text-digi-muted shrink-0" />
      <span className="flex-1 text-[12.5px] text-digi-text truncate" style={mf}>{name}</span>
      {meta && <span className="text-[11px] text-digi-muted tabular-nums shrink-0" style={mf}>{meta}</span>}
      {onRemove && (
        <button onClick={onRemove} className="text-digi-muted/70 hover:text-red-500 transition-colors shrink-0" aria-label="Quitar">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/** Estado vacío dentro del panel (mismo cuadrito que el resto del dashboard). */
export function PanelEmpty({ Icon, title, desc }: { Icon: any; title: string; desc?: string }) {
  return (
    <div className="bg-digi-darker border border-digi-border rounded-lg text-center py-8 px-4">
      <div className="w-10 h-10 rounded-lg bg-black/[0.04] flex items-center justify-center mx-auto mb-2">
        <Icon className="w-5 h-5 text-digi-muted" />
      </div>
      <p className="text-[13px] font-medium text-digi-text" style={mf}>{title}</p>
      {desc && <p className="text-[12px] text-digi-muted mt-0.5" style={mf}>{desc}</p>}
    </div>
  );
}

/** Formatea bytes de forma consistente en los tres paneles. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
