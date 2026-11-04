'use client';

import { useState } from 'react';

/**
 * Media (portada) de una tarjeta del marketplace. El registro se pinta al instante
 * y la portada se carga aparte: los proyectos usan una **miniatura WebP** servida por
 * `/api/marketplace/projects/[id]/image?w=…` (no el base64 original); los ítems de
 * portafolio ya traen su portada. La imagen usa `loading="lazy"` (el navegador solo
 * la pide al acercarse al viewport) y se muestra un spinner sobre el registro hasta
 * que decodifica.
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

export default function CardMedia({
  src,
  placeholder,
  children,
}: {
  /** URL de la portada (ya dimensionada) o null si el registro no tiene imagen. */
  src: string | null;
  /** Icono de categoría a mostrar cuando el registro no tiene imagen. */
  placeholder: React.ReactNode;
  /** Overlays (badge de categoría, contador de fotos…). */
  children?: React.ReactNode;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const showImage = !!src && !failed;

  return (
    <div className="relative aspect-[16/9] bg-digi-darker overflow-hidden">
      {showImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => { setFailed(true); setLoaded(true); }}
          className={`w-full h-full object-cover transition-[opacity,transform] duration-300 group-hover:scale-[1.03] ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}

      {!showImage && (
        <div className="absolute inset-0 flex items-center justify-center">{placeholder}</div>
      )}

      {showImage && !loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-digi-darker/60"><Spinner /></div>
      )}

      {children}
    </div>
  );
}
