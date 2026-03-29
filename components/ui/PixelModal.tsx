'use client';

import { useEffect, useRef } from 'react';

interface PixelModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

export default function PixelModal({ open, onClose, title, size = 'md', children }: PixelModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
      className="fixed inset-0 z-50 m-0 w-full h-full bg-transparent backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center justify-center min-h-full p-4">
        <div
          className={`pixel-card w-full ${SIZES[size]} animate-[pixelFadeIn_0.2s_ease-out]`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-digi-border">
            <h2
              className="pixel-heading text-sm text-white"
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-digi-muted hover:text-white border-2 border-digi-border hover:border-accent transition-colors"
              style={{ fontFamily: "'Silkscreen', cursive" }}
            >
              X
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[70vh] overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </dialog>
  );
}
