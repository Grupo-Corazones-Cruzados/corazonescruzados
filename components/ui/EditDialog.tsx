'use client';

import React from 'react';
import PixelModal from './PixelModal';
import { BTN_PRIMARY, BTN_SECONDARY } from './Button';

/**
 * Superficies de EDICIÓN del dashboard — definición única.
 *
 * REGLA DEL SISTEMA (decisión del usuario, 2026-07-31): **nunca se edita "por encima"**
 * (inline, sustituyendo el contenido que se está viendo). Toda edición aparece en una
 * superficie propia sobre un overlay:
 *
 *  - `EditPanel`      → **panel lateral derecho** (`PixelModal size="md"`). Es el caso por
 *                       defecto: cualquier FORMULARIO (tres campos o más, o campos ricos
 *                       como descripción larga, selectores múltiples, listas…).
 *  - `QuickEditDialog`→ **ventanita centrada** (`PixelModal size="sm"`). Solo cuando lo que
 *                       se rellena NO es un formulario: **uno o dos campos** simples.
 *
 * Ambas comparten el mismo pie: `Cancelar` (secundario) + acción primaria a la derecha.
 */
interface EditSurfaceProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  /** Deshabilita el pie y bloquea el cierre mientras se guarda. */
  saving?: boolean;
  /** `false` deshabilita el botón primario (validación del formulario). */
  canSave?: boolean;
  saveLabel?: string;
  /** Acción destructiva opcional, a la izquierda del pie (patrón Fluent). */
  danger?: { label: string; onClick: () => void };
  children: React.ReactNode;
}

function EditSurface({
  size, open, title, onClose, onSave, saving = false, canSave = true,
  saveLabel = 'Guardar', danger, children,
}: EditSurfaceProps & { size: 'sm' | 'md' }) {
  // Enter guarda cuando el foco está en un input simple (no en textarea, donde Enter
  // debe seguir insertando un salto de línea).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    if ((e.target as HTMLElement)?.tagName !== 'INPUT') return;
    e.preventDefault();
    if (canSave && !saving) onSave();
  };

  return (
    <PixelModal open={open} onClose={onClose} title={title} size={size} busy={saving}>
      <div className="flex flex-col gap-3" onKeyDown={onKeyDown}>
        <div className="space-y-3">{children}</div>
        <div className="flex items-center gap-2 pt-3 border-t border-digi-border">
          {danger && (
            <button type="button" onClick={danger.onClick} disabled={saving}
              className="text-[12px] font-medium text-red-600 hover:underline disabled:opacity-50">
              {danger.label}
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={onClose} disabled={saving} className={BTN_SECONDARY}>Cancelar</button>
            <button type="button" onClick={onSave} disabled={saving || !canSave} className={BTN_PRIMARY}>
              {saving ? 'Guardando…' : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </PixelModal>
  );
}

/** Formulario en **panel lateral derecho** con overlay. Caso por defecto. */
export function EditPanel(props: EditSurfaceProps) {
  return <EditSurface size="md" {...props} />;
}

/** **Ventanita centrada** para uno o dos campos sueltos (no un formulario). */
export function QuickEditDialog(props: EditSurfaceProps) {
  return <EditSurface size="sm" {...props} />;
}

/** Campo con etiqueta + ayuda opcional, con las clases estándar de `.corp`. */
export function EditField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-semibold text-digi-text opacity-70" style={{ fontFamily: 'var(--font-body)' }}>{label}</label>
      {children}
      {hint && <span className="text-[11px] text-digi-muted" style={{ fontFamily: 'var(--font-body)' }}>{hint}</span>}
    </div>
  );
}

/** Clase estándar de los campos dentro de una superficie de edición. */
export const EDIT_INPUT =
  'field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none';
