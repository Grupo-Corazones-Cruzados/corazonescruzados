'use client';

/**
 * SUPERFICIE DE AUTENTICACIÓN — definición ÚNICA de los diálogos de acceso y alta.
 *
 * ── QUÉ RESUELVE ───────────────────────────────────────────────────────────────
 * Los cinco diálogos de la portada —alta de cliente, acceso de cliente, acceso de miembro,
 * recuperación de cuenta y cuenta de candidato— estaban escritos cada uno con su propio
 * pixel art: `Silkscreen` en las etiquetas, bordes de 2 px, botones en mayúsculas. Cinco
 * formularios parecidos pero no iguales, y ninguno se parecía al panel al que llevan.
 *
 * Fernando (2026-08-02): que sean del estilo del panel, y que el alta de cliente sea
 * **el mismo** desde la portada y desde la página de negocio.
 *
 * ── CÓMO ───────────────────────────────────────────────────────────────────────
 * Con el patrón que el proyecto ya tenía documentado: **isla `.corp dark`** sobre la
 * portada. `corp-overlay` (en `globals.css`) hereda los tokens y la tipografía del panel
 * **sin** imponer el fondo de página ni el `min-height:100vh` de `.corp` — el velo lo pone
 * el propio overlay. Ver `Diseño.md` → «Modales de la landing en tema del dashboard».
 *
 * Aquí solo vive el ARMAZÓN y los campos. Cada diálogo pone su contenido y su lógica.
 */

import { useEffect, type ReactNode } from 'react';
import { X, Loader2 } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * El armazón: velo, tarjeta, cabecera y pie.
 *
 * Cierra con **Escape** y con clic en el velo, como el resto de diálogos del proyecto.
 */
export function AuthDialog({
  Icon, titulo, subtitulo, onClose, ancho = 'md', children, pie,
}: {
  Icon: any;
  titulo: string;
  subtitulo?: string;
  onClose: () => void;
  /** `md` para un acceso; `lg` para un alta con campos en dos columnas. */
  ancho?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  pie?: ReactNode;
}) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', alTeclear);
    // Se bloquea el desplazamiento del fondo: si no, la portada se mueve detrás del
    // diálogo al usar la rueda y da la sensación de que algo se ha roto.
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = previo;
    };
  }, [onClose]);

  const max = ancho === 'lg' ? 'max-w-[680px]' : ancho === 'sm' ? 'max-w-[400px]' : 'max-w-[480px]';

  return (
    <div
      className="corp dark corp-overlay fixed inset-0 z-[120] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(6,7,12,0.72)', backdropFilter: 'blur(6px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div className={`w-full ${max} my-auto bg-digi-card border border-digi-border rounded-lg shadow-2xl overflow-hidden`}>
        {/* Cabecera: chip de icono + título + cerrar de 32×32, como los diálogos del panel. */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-digi-border">
          <span className="w-9 h-9 rounded-md bg-accent-light text-accent flex items-center justify-center shrink-0">
            <Icon className="w-[18px] h-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold text-digi-text leading-tight" style={mf}>{titulo}</h2>
            {subtitulo && <p className="mt-0.5 text-[12.5px] text-digi-muted leading-relaxed" style={mf}>{subtitulo}</p>}
          </div>
          <button
            type="button" onClick={onClose} aria-label="Cerrar"
            className="w-8 h-8 rounded-md flex items-center justify-center text-digi-muted hover:text-digi-text hover:bg-black/[0.05] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo con el fondo de página, para que los campos se separen de la tarjeta. */}
        <div className="bg-digi-darker px-5 py-5 max-h-[70vh] overflow-y-auto">{children}</div>

        {pie && <div className="px-5 py-3.5 border-t border-digi-border">{pie}</div>}
      </div>
    </div>
  );
}

/* ═══════════════════════ CAMPOS ═══════════════════════ */

export const INPUT =
  'field-control w-full px-3 py-2 bg-digi-card border border-digi-border rounded text-[13.5px] text-digi-text ' +
  'placeholder:text-digi-muted/45 focus:border-accent focus:outline-none transition-colors';

export function Campo({
  label, hint, requerido, children,
}: { label: string; hint?: string; requerido?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-digi-text mb-1" style={mf}>
        {label}
        {requerido && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11.5px] text-digi-muted" style={mf}>{hint}</p>}
    </div>
  );
}

/** Casilla de aceptación. Se tiñe al marcarse, como en el asistente de postulación. */
export function Casilla({
  checked, onChange, children,
}: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label
      className={`flex items-start gap-2.5 rounded-md border p-3 cursor-pointer transition-colors ${
        checked ? 'border-accent bg-accent-light' : 'border-digi-border hover:border-accent/50'
      }`}
    >
      <input
        type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-[15px] h-[15px] shrink-0 accent-[var(--color-accent)]"
      />
      <span className="text-[12.5px] leading-relaxed text-digi-text" style={mf}>{children}</span>
    </label>
  );
}

/** Aviso de error del formulario. Un tono, no cinco. */
export function ErrorAuth({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2.5">
      <p className="text-[12.5px] leading-relaxed text-red-400" style={mf}>{children}</p>
    </div>
  );
}

/** Botón primario a ancho completo. Con su estado de carga, que nunca es un spinner pixel. */
export function BotonAuth({
  children, onClick, cargando, deshabilitado, tipo = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  cargando?: boolean;
  deshabilitado?: boolean;
  tipo?: 'button' | 'submit';
}) {
  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={cargando || deshabilitado}
      className="w-full h-10 inline-flex items-center justify-center gap-2 rounded bg-accent hover:bg-accent-hover
                 text-white text-[13.5px] font-medium transition-colors
                 disabled:opacity-45 disabled:pointer-events-none"
      style={mf}
    >
      {cargando && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

/** Enlace del pie: «¿ya tienes cuenta?», «he olvidado la contraseña»… */
export function EnlaceAuth({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button" onClick={onClick}
      className="w-full text-center text-[12.5px] text-digi-muted hover:text-accent transition-colors"
      style={mf}
    >
      {children}
    </button>
  );
}
