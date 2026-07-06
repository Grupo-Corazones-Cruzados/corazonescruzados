'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';

/**
 * Galería de imágenes con controles prev/next + indicadores, estilo corp.
 * Se resetea al cambiar de elemento montándola con `key`.
 *
 * Indicador de carga en dos fases: mientras `loading` (se están trayendo las
 * imágenes del registro) muestra un spinner; y al cambiar de imagen, muestra el
 * spinner sobre ella hasta que termina de decodificar (las portadas base64 pesan).
 */
function Spinner() {
  return (
    <span
      className="w-6 h-6 rounded-full border-2 border-digi-border border-t-accent animate-spin"
      role="status"
      aria-label="Cargando imagen"
    />
  );
}

export default function ImageGallery({
  images,
  alt = '',
  loading = false,
  onOpen,
}: {
  images: string[];
  alt?: string;
  loading?: boolean;
  onOpen?: (index: number) => void;
}) {
  const [i, setI] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);

  const idx = images && images.length ? Math.min(i, images.length - 1) : 0;
  const currentSrc = images && images.length ? images[idx] : null;

  // Reinicia el estado "cargada" cada vez que cambia la imagen visible.
  useEffect(() => { setImgLoaded(false); }, [currentSrc]);

  if (loading) {
    return (
      <div className="aspect-video rounded-lg border border-digi-border bg-digi-darker flex items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (!images || images.length === 0) {
    return (
      <div className="aspect-video rounded-lg border border-digi-border bg-digi-darker flex flex-col items-center justify-center gap-1 text-digi-muted">
        <ImageOff className="w-6 h-6" />
        <span className="text-[11px]" style={{ fontFamily: 'var(--font-body)' }}>Sin imágenes</span>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden border border-digi-border bg-digi-darker">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={currentSrc!}
        alt={alt}
        decoding="async"
        onLoad={() => setImgLoaded(true)}
        onError={() => setImgLoaded(true)}
        className={`w-full aspect-video object-contain bg-digi-darker cursor-zoom-in transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
        onClick={() => onOpen?.(idx)}
      />
      {!imgLoaded && (
        <div className="absolute inset-0 flex items-center justify-center"><Spinner /></div>
      )}
      {images.length > 1 && (
        <>
          <button
            onClick={() => setI((idx - 1 + images.length) % images.length)}
            aria-label="Anterior"
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-digi-card/90 border border-digi-border flex items-center justify-center shadow-sm hover:bg-digi-card transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-digi-text" />
          </button>
          <button
            onClick={() => setI((idx + 1) % images.length)}
            aria-label="Siguiente"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-digi-card/90 border border-digi-border flex items-center justify-center shadow-sm hover:bg-digi-card transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-digi-text" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, k) => (
              <button key={k} aria-label={`Imagen ${k + 1}`} onClick={() => setI(k)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${k === idx ? 'bg-accent' : 'bg-digi-card/80 border border-digi-border'}`} />
            ))}
          </div>
          <span className="absolute top-2 right-2 text-[11px] px-1.5 py-0.5 rounded bg-black/60 text-white tabular-nums">{idx + 1}/{images.length}</span>
        </>
      )}
    </div>
  );
}
