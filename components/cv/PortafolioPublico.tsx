'use client';

/**
 * Portafolio del CV público: rejilla de tarjetas + visor a pantalla completa.
 *
 * ── LAS IMÁGENES SE PIDEN, NO SE MANDAN ───────────────────────────────────────
 * En la base viven como base64 dentro de la fila (PNG de hasta ~2 MB). Aquí solo
 * llega el CONTADOR y se construye la URL del endpoint de miniaturas: `w=480` para
 * la tarjeta y `w=1600` solo al abrir el visor. Mandar el base64 repetiría el fallo
 * que dejó la lista del marketplace en 4,8 MB.
 *
 * ── EL VISOR ES UN `<dialog>` NATIVO ──────────────────────────────────────────
 * Trae hecho lo que un diálogo casero olvida: atrapa el foco, cierra con Escape,
 * vive en la capa superior del navegador —ningún `z-index` lo tapa— y deja el resto
 * de la página inerte. ⚠️ Necesita `m-auto` para centrarse: el reajuste de Tailwind
 * le pone `margin: 0` y lo deja pegado arriba a la izquierda.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Images, X } from 'lucide-react';
import type { ItemPortafolio } from '@/lib/members/cv-share';

const TIPO: Record<string, string> = {
  project: 'Proyecto',
  product: 'Producto',
  automation: 'Automatización',
};

export default function PortafolioPublico({ token, items }: { token: string; items: ItemPortafolio[] }) {
  const [abierto, setAbierto] = useState<{ item: ItemPortafolio; i: number } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const src = useCallback(
    (itemId: number, i: number, w: number) => `/api/cv/${token}/imagen?item=${itemId}&i=${i}&w=${w}`,
    [token],
  );

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (abierto && !d.open) {
      d.showModal();
      document.body.style.overflow = 'hidden';
    } else if (!abierto && d.open) {
      d.close();
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [abierto]);

  const mover = useCallback((paso: number) => {
    setAbierto((a) => (a ? { ...a, i: (a.i + paso + a.item.imagenes) % a.item.imagenes } : a));
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') mover(1);
      if (e.key === 'ArrowLeft') mover(-1);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [abierto, mover]);

  return (
    <>
      <div className="cv-cascada grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((item) => (
          <article key={item.id} className="cv-tarjeta overflow-hidden flex flex-col">
            {item.imagenes > 0 ? (
              <button
                type="button"
                onClick={() => setAbierto({ item, i: 0 })}
                className="relative block w-full aspect-[16/10] overflow-hidden bg-white/[0.03] group"
                aria-label={`Ver las ${item.imagenes} imágenes de ${item.titulo}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src(item.id, 0, 480)}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
                {item.imagenes > 1 && (
                  <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/65 px-2 py-1 text-[11px] text-white/85 backdrop-blur-sm">
                    <Images className="w-3.5 h-3.5" /> {item.imagenes}
                  </span>
                )}
              </button>
            ) : (
              <div className="w-full aspect-[16/10] bg-white/[0.02] flex items-center justify-center">
                <Images className="w-6 h-6 text-white/15" aria-hidden />
              </div>
            )}

            <div className="p-5 flex flex-col gap-2 flex-1">
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-[#a78bfa]">
                {TIPO[item.tipo] || item.tipo}
              </span>
              <h3 className="text-[17px] font-semibold text-white leading-snug">{item.titulo}</h3>
              {item.descripcion && (
                <p className="text-[13.5px] text-white/50 leading-relaxed">{item.descripcion}</p>
              )}
              {item.etiquetas.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {item.etiquetas.map((t) => (
                    <span key={t} className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-white/45">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {item.enlace && (
                // `mt-auto`: sin esto, la única tarjeta con enlace lo deja a otra
                // altura y la fila se ve descuadrada.
                <a
                  href={item.enlace}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mt-auto pt-2 inline-flex items-center gap-1.5 text-[12.5px] text-[#a78bfa] hover:text-[#c4b5fd] transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Ver el proyecto
                </a>
              )}
            </div>
          </article>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setAbierto(null)}
        onClick={(e) => {
          // Cerrar al pulsar fuera se compara con el RECTÁNGULO del panel:
          // `e.target === dialog` falla cuando el diálogo tiene relleno.
          const r = e.currentTarget.getBoundingClientRect();
          const fuera = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
          if (fuera) setAbierto(null);
        }}
        className="m-auto w-[min(96vw,1100px)] max-h-[92vh] rounded-xl border border-white/10 bg-[#0e111a] p-0 text-white/80 backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      >
        {abierto && (
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
              <h4 className="truncate text-[15px] font-semibold text-white">{abierto.item.titulo}</h4>
              <button type="button" onClick={() => setAbierto(null)} aria-label="Cerrar"
                className="rounded-md p-1.5 text-white/50 hover:bg-white/5 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative flex items-center justify-center bg-black/40 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src(abierto.item.id, abierto.i, 1600)}
                alt={`${abierto.item.titulo} — imagen ${abierto.i + 1}`}
                className="max-h-[68vh] w-auto max-w-full rounded-md object-contain"
              />
              {abierto.item.imagenes > 1 && (
                <>
                  <button type="button" onClick={() => mover(-1)} aria-label="Imagen anterior"
                    className="absolute left-4 rounded-full bg-black/60 p-2 text-white/80 hover:bg-black/80 transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button type="button" onClick={() => mover(1)} aria-label="Imagen siguiente"
                    className="absolute right-4 rounded-full bg-black/60 p-2 text-white/80 hover:bg-black/80 transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
            {abierto.item.imagenes > 1 && (
              <p className="px-5 py-2.5 text-center text-[12px] text-white/40 tabular-nums">
                {abierto.i + 1} / {abierto.item.imagenes}
              </p>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
