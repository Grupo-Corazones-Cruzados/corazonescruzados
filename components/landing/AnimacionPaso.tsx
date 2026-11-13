'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** Cada WebP se descarga una sola vez por visita; cada vez que se muestra, una URL nueva del mismo blob. */
const blobs = new Map<string, Promise<Blob>>();
const blobDe = (src: string) => {
  if (!blobs.has(src)) blobs.set(src, fetch(src).then((r) => r.blob()));
  return blobs.get(src)!;
};

/**
 * EL ESCENARIO DEL PASO (Fernando, 2026-11-13: la animación al final del texto obligaba a desplazarse, y pegada
 * abajo tapaba el texto). Si la ventana de pasos ofrece un escenario —un hueco bajo el título—, la animación se
 * pinta ahí, como portada del paso, y el texto sigue debajo sin que nada lo tape. Sin escenario (el libro), se
 * pinta donde está.
 */
export const EscenarioAnimacion = createContext<HTMLElement | null>(null);

/**
 * UNA ANIMACIÓN HECHA EN BLENDER dentro de un paso del formulario (Fernando, 2026-11-12: «llenar esos
 * huecos»). Es un WebP animado con transparencia EN BUCLE (la escena empalma su último cuadro con el
 * primero). Arranca cuando le toca en el «cuento» del paso (el `animationstart` de su entrada) y empieza
 * desde el principio cada vez que se entra al paso: un navegador comparte la animación entre imágenes de
 * la misma URL, por eso cada vez se le da una URL propia del mismo blob, sin volver a descargarlo.
 * Las escenas viven en `scripts/animaciones/<id>.py` y se renderizan con `renderizar.mjs`.
 */
export default function AnimacionPaso({ src, alt }: { src: string; alt: string }) {
  const [turno, setTurno] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const escenario = useContext(EscenarioAnimacion);

  useEffect(() => {
    blobDe(src).catch(() => blobs.delete(src));
  }, [src]);

  useEffect(() => {
    if (!turno) return;
    let vivo = true;
    let propia: string | null = null;
    blobDe(src)
      .then((b) => {
        if (!vivo) return;
        propia = URL.createObjectURL(b);
        setUrl(propia);
      })
      .catch(() => vivo && setUrl(src));
    return () => {
      vivo = false;
      if (propia) URL.revokeObjectURL(propia);
    };
  }, [turno, src]);

  const animacion = (
    <div
      className="onb-animacion"
      onAnimationStart={() => setTurno(true)}
      // Sin «cuento» (movimiento reducido) no hay animación de entrada: arranca al montarse.
      // (la clase la pone la ventana justo después de montar: se mira un cuadro más tarde).
      ref={(el) => {
        if (el) requestAnimationFrame(() => { if (!el.classList.contains('onb-cuento-pieza')) setTurno(true); });
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt={alt} />}
    </div>
  );
  return escenario ? createPortal(animacion, escenario) : animacion;
}
