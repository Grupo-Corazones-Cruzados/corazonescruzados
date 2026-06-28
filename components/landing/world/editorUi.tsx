'use client';

/**
 * editorUi — sistema de diseño del EDITOR DEL MUNDO (estilo Microsoft Fluent).
 * Fuente única de estilo: tokens + controles reusables. Cambiar aquí propaga a
 * Escenas, NPCs y Capas. Documentado en Diseño.md.
 */
import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';

// Ancho ÚNICO del panel de cada sección (Escenas / NPCs / Capas). Cambiar aquí
// ajusta las tres a la vez.
export const PANEL_WIDTH = 220;

// ── Tokens (fuente única de color/tipografía del editor) ──────────────
export const E = {
  font: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  accent: '#0078d4',
  accentHover: '#106ebe',
  accentSoft: '#f3f9fd',
  accentBorder: 'rgba(0,120,212,0.30)',
  surface: '#ffffff',
  canvas: '#faf9f8',
  subtle: '#f3f2f1',
  selected: '#deecf9',
  border: '#edebe9',
  borderStrong: '#d1d1d1',
  text: '#323130',
  textSoft: '#605e5c',
  textMuted: '#a19f9d',
  danger: '#a4262c',
  dangerSoft: '#fde7e9',
  radius: 4,
} as const;

// ── Encabezado de panel (título de sección — idéntico en todas) ───────
export function PanelHeader({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        padding: '14px 12px 10px',
        borderBottom: `1px solid ${E.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span
          style={{
            fontSize: '0.78rem',
            letterSpacing: '0.14em',
            color: E.accent,
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          {title}
        </span>
        {actions}
      </div>
      {children}
    </div>
  );
}

// ── Botón primario / secundario / peligro (Fluent) ────────────────────
export function EditorButton({
  children,
  icon,
  onClick,
  variant = 'primary',
  disabled = false,
  title,
  style,
  type = 'button',
}: {
  children?: ReactNode;
  icon?: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  title?: string;
  style?: CSSProperties;
  type?: 'button' | 'submit';
}) {
  const [hover, setHover] = useState(false);
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '7px 12px',
    borderRadius: E.radius,
    fontFamily: E.font,
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    transition: 'background 0.12s ease, border-color 0.12s ease',
    border: '1px solid transparent',
  };
  const variants: Record<string, CSSProperties> = {
    primary: {
      background: hover && !disabled ? E.accentHover : E.accent,
      color: '#ffffff',
      borderColor: hover && !disabled ? E.accentHover : E.accent,
    },
    secondary: {
      background: hover && !disabled ? E.subtle : E.surface,
      color: E.text,
      borderColor: E.borderStrong,
    },
    danger: {
      background: hover && !disabled ? E.dangerSoft : E.surface,
      color: E.danger,
      borderColor: 'rgba(164,38,44,0.4)',
    },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {icon}
      {children}
    </button>
  );
}

// ── Pestañas segmentadas (filtros: TILES/ITEMS/… o lo que sea) ────────
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              padding: '6px 8px',
              background: active ? E.accent : E.surface,
              color: active ? '#ffffff' : E.textSoft,
              border: `1px solid ${active ? E.accent : E.borderStrong}`,
              borderRadius: E.radius,
              fontFamily: E.font,
              fontSize: '0.66rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {t.icon}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Input de búsqueda ─────────────────────────────────────────────────
export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '8px 10px',
        background: E.subtle,
        border: `1px solid ${E.borderStrong}`,
        borderRadius: E.radius,
        color: E.text,
        fontFamily: E.font,
        fontSize: '0.84rem',
        outline: 'none',
      }}
    />
  );
}

// ── Fila de lista (item seleccionable: escena, NPC, capa…) ────────────
export function ListRow({
  active = false,
  onClick,
  icon,
  title,
  subtitle,
  right,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  icon?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '8px 10px 8px 12px',
        margin: '1px 0',
        background: active ? E.selected : hover ? E.subtle : 'transparent',
        borderLeft: `3px solid ${active ? E.accent : 'transparent'}`,
        borderRadius: 4,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {(icon || title || right) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon && (
            <span style={{ display: 'grid', placeItems: 'center', color: active ? E.accent : E.textSoft }}>
              {icon}
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {title && (
              <div
                style={{
                  fontSize: '0.82rem',
                  color: E.text,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {title}
              </div>
            )}
            {subtitle && (
              <div
                style={{
                  fontSize: '0.72rem',
                  color: E.textSoft,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

// ── Botón de ícono (ghost cuadrado: editar/mover/ocultar/borrar) ──────
export function IconButton({
  icon,
  title,
  onClick,
  disabled = false,
  active = false,
  danger = false,
}: {
  icon: ReactNode;
  title: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 30,
        height: 28,
        display: 'grid',
        placeItems: 'center',
        padding: 0,
        background: disabled
          ? E.surface
          : active
            ? E.selected
            : hover
              ? danger
                ? E.dangerSoft
                : E.subtle
              : E.surface,
        color: disabled ? E.textMuted : danger ? E.danger : active ? E.accent : E.textSoft,
        border: `1px solid ${E.borderStrong}`,
        borderRadius: E.radius,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.12s ease, color 0.12s ease',
      }}
    >
      {icon}
    </button>
  );
}

// ── Estado vacío ──────────────────────────────────────────────────────
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: '0.74rem',
        color: E.textMuted,
        padding: '16px 10px',
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  );
}
