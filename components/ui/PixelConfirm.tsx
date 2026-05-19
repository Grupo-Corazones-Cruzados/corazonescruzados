'use client';

import PixelModal from './PixelModal';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

interface Props {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Diálogo de confirmación a nivel de aplicación (reemplaza window.confirm). */
export default function PixelConfirm({
  open,
  title = 'Confirmar',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <PixelModal open={open} onClose={onCancel} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-[12px] text-digi-text leading-relaxed" style={mf}>
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 text-[10px] border-2 border-digi-border text-digi-muted hover:text-digi-text transition-colors"
            style={pf}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-[10px] border-2 transition-colors ${
              danger
                ? 'border-red-500/60 text-red-400 hover:bg-red-950/30'
                : 'border-accent bg-accent/20 text-accent-glow hover:bg-accent/30'
            }`}
            style={pf}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </PixelModal>
  );
}
