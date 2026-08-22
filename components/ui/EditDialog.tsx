'use client';

import React from 'react';
import PixelModal from './PixelModal';
import { BTN_PRIMARY, BTN_SECONDARY } from './Button';
import BotonAyuda from './BotonAyuda';

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
}: EditSurfaceProps & { size: 'sm' | 'md' | 'lg' | 'xl' }) {
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

/**
 * Panel lateral derecho **EXTRA ANCHO** (1040px). Variante nombrada de `EditPanel`, no una
 * excepción: sigue siendo la superficie de edición estándar, solo que ancha.
 *
 * **Cuándo:** el formulario lleva dentro una **tabla** o una rejilla que en 644px se parte.
 * Hoy: el panel de un talento en Admin → Soluciones (descripción + la tabla de sus
 * conceptos, con sus cuatro acciones por fila). Es el mismo ancho que `FlowPanelShell` usa
 * para los editores de Automatizaciones, así que no hay dos «extra grandes» distintos.
 *
 * Si dentro no hay una tabla, **no** es esta: un formulario de campos sueltos a 1040px deja
 * los campos flotando en medio metro de vacío.
 */
export function WideEditPanel(props: EditSurfaceProps) {
  return <EditSurface size="xl" {...props} />;
}

/** **Ventanita centrada** para uno o dos campos sueltos (no un formulario). */
export function QuickEditDialog(props: EditSurfaceProps) {
  return <EditSurface size="sm" {...props} />;
}

/**
 * **Ventanita centrada ANCHA** para UN solo campo de texto largo: un prompt, una plantilla,
 * un fragmento de código.
 *
 * Variante nombrada de `QuickEditDialog`, no una excepción. Sigue siendo centrada porque lo
 * que se rellena **no es un formulario**, que es lo que decide la superficie; pero
 * `max-w-sm` (384 px) es inservible para un texto de miles de caracteres — con esa anchura
 * cada línea se parte tres veces y no se puede leer lo que se está escribiendo.
 *
 * Si lo que vas a poner dentro tiene **más de un campo**, esta no es tu superficie: usa
 * `EditPanel` (panel lateral).
 */
export function LongTextDialog(props: EditSurfaceProps) {
  return <EditSurface size="lg" {...props} />;
}

/** Campo con etiqueta + ayuda opcional, con las clases estándar de `.corp`. */
/**
 * Campo de una superficie de edición.
 *
 * ⚠️ REGLA DEL PROYECTO (Fernando, 2026-08-01): **en un formulario solo se ve el título del
 * campo y el campo**. Toda explicación —para qué sirve, rangos, recomendaciones, avisos—
 * va detrás del (?). Antes `hint` se pintaba como una línea gris debajo del campo; con
 * cinco o seis campos, eso duplica el alto del formulario con texto que se lee una vez.
 *
 * El `hint` NO se ha quitado: se ha movido. Sigue estando a un clic, y quien ya lo sabe
 * no lo ve. Como esta es la definición única, el cambio llega a los siete sitios que la
 * usan sin tocar ninguno.
 */
export function EditField({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 min-h-6">
        {hint && <BotonAyuda titulo={label} lado="derecha">{hint}</BotonAyuda>}
        <label className="text-[12px] font-semibold text-digi-text opacity-70" style={{ fontFamily: 'var(--font-body)' }}>{label}</label>
      </div>
      {children}
    </div>
  );
}

/** Clase estándar de los campos dentro de una superficie de edición. */
export const EDIT_INPUT =
  'field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none';
