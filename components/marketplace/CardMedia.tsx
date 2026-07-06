'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Media (portada) de una tarjeta del marketplace. La lista NO trae imágenes, así
 * que el registro se pinta al instante y la portada se carga aparte:
 *  - Ítems de portafolio: ya traen su portada (`images[0]` / `image_url`) → se
 *    muestra directo, con spinner hasta que la imagen decodifica.
 *  - Proyectos del marketplace: sin portada en la lista → se pide de forma
 *    perezosa (cuando la tarjeta entra al viewport) a `/…/[id]/cover`.
 * Mientras algo carga (fetch o decodificación) se muestra un indicador de carga
 * SOBRE ese registro, para distinguir que ahí se está cargando algo.
 */
export default function CardMedia({
  item,
  placeholder,
  children,
}: {
  item: any;
  /** Icono de categoría a mostrar cuando el registro no tiene imagen. */
  placeholder: React.ReactNode;
  /** Overlays (badge de categoría, contador de fotos…). */
  children?: React.ReactNode;
}) {
  const initial: string | null =
    (Array.isArray(item.images) && item.images[0]) || item.image_url || item.cover_image || null;
  const isProject = item.source_type === 'project';
  const needsFetch = !initial && isProject && Number(item.image_count) > 0;

  const [src, setSrc] = useState<string | null>(initial);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [fetching, setFetching] = useState(needsFetch);
  const ref = useRef<HTMLDivElement>(null);

  // Carga perezosa de la portada de proyectos: solo al entrar (o acercarse) al
  // viewport, para no disparar decenas de peticiones de golpe.
  useEffect(() => {
    if (!needsFetch) return;
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        io.disconnect();
        (async () => {
          try {
            const res = await fetch(`/api/marketplace/projects/${item.id}/cover`);
            const data = await res.json();
            if (cancelled) return;
            if (data?.cover) setSrc(data.cover);
            else { setFetching(false); setFailed(true); }
          } catch {
            if (!cancelled) { setFetching(false); setFailed(true); }
          }
        })();
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => { cancelled = true; io.disconnect(); };
  }, [needsFetch, item.id]);

  const showImage = !!src && !failed;
  const showPlaceholder = !showImage && !fetching;
  const showSpinner = fetching || (showImage && !loaded);

  return (
    <div ref={ref} className="relative aspect-[16/9] bg-digi-darker overflow-hidden">
      {showImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={item.title}
          loading="lazy"
          decoding="async"
          onLoad={() => { setLoaded(true); setFetching(false); }}
          onError={() => { setFailed(true); setLoaded(true); setFetching(false); }}
          className={`w-full h-full object-cover transition-[opacity,transform] duration-300 group-hover:scale-[1.03] ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}

      {showPlaceholder && (
        <div className="absolute inset-0 flex items-center justify-center">{placeholder}</div>
      )}

      {showSpinner && (
        <div className="absolute inset-0 flex items-center justify-center bg-digi-darker/60">
          <span
            className="w-6 h-6 rounded-full border-2 border-digi-border border-t-accent animate-spin"
            role="status"
            aria-label="Cargando imagen"
          />
        </div>
      )}

      {children}
    </div>
  );
}
