'use client';

/**
 * LA VENTANA DE DETALLE DE UNA TARJETA DE LA GALERÍA.
 *
 * Se abre al pulsar una tarjeta: título, de qué se trata, qué gana la empresa y —cuando la
 * haya— una ilustración a la derecha.
 *
 * ── POR QUÉ EL `<dialog>` NATIVO Y NO UN `<div>` CON `position: fixed` ────────
 * El elemento del navegador trae hecho, y bien, todo lo que un diálogo casero olvida:
 * · **Atrapa el foco dentro.** Sin eso, al tabular se sale por detrás de la ventana y se
 *   navega por una página que no se ve.
 * · **Se cierra con Escape**, que es lo que cualquiera intenta primero.
 * · **Vive en la capa superior del navegador**, así que ningún `z-index` de la página puede
 *   taparlo — el problema clásico de los diálogos hechos a mano.
 * · Deja el resto de la página **inerte**: no se puede pulsar por detrás.
 *
 * ── LO QUE SÍ HUBO QUE AÑADIR ────────────────────────────────────────────────
 * · **Cerrar al pulsar fuera.** El `<dialog>` no lo hace solo. Se detecta comparando la
 *   posición del clic con el rectángulo del panel: pulsar el fondo cierra, pulsar dentro no.
 *   Comprobarlo con `e.target === dialog` falla cuando el panel tiene relleno.
 * · **Bloquear el desplazamiento del fondo** mientras está abierta.
 *
 * ── SEO ──────────────────────────────────────────────────────────────────────
 * Es un componente de cliente, pero **el contenido viaja en el HTML** —Next lo renderiza en
 * el servidor—, así que las once descripciones están en la página aunque nadie pulse nada.
 */

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { X, Check } from 'lucide-react';
import type { ItemGaleria } from '@/lib/sitio/contenido';
import { ICONOS } from './piezas';

export default function VentanaTarjeta({
  item, onCerrar,
}: { item: ItemGaleria | null; onCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (item && !d.open) d.showModal();
    if (!item && d.open) d.close();
    // Sin esto, la página de detrás se desplaza al girar la rueda sobre el fondo oscuro.
    document.body.style.overflow = item ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [item]);

  if (!item) return null;
  const Icono = ICONOS[item.icono];

  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      onClick={(e) => {
        // Pulsar FUERA del panel cierra. Se compara con el rectángulo y no con el destino
        // del evento, porque el relleno del diálogo también cuenta como «el diálogo».
        const r = (e.currentTarget as HTMLDialogElement).getBoundingClientRect();
        const fuera =
          e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
        if (fuera) onCerrar();
      }}
      // `m-auto` centra la ventana: el `<dialog>` lo hace solo, pero el reajuste de estilos
      // de Tailwind le pone `margin: 0` y la deja pegada arriba a la izquierda.
      className="ventana-tarjeta m-auto w-[min(58rem,calc(100vw-2rem))] max-h-[min(44rem,calc(100dvh-2rem))]
                 overflow-y-auto rounded-2xl border border-[#7B5FBF]/25 bg-[#0f1119] p-0
                 text-white/75 backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
      aria-labelledby="ventana-tarjeta-titulo"
    >
      {/* El mismo resplandor violeta de los bloques de tema, para que la ventana se lea
          como parte del sitio y no como un cuadro de sistema. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background:
            'radial-gradient(70% 100% at 10% 0%, rgba(123,95,191,0.26) 0%, rgba(123,95,191,0.07) 45%, transparent 72%)',
        }}
      />

      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar"
        className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg
                   border border-white/[0.12] text-white/55 transition-colors
                   hover:border-white/30 hover:text-white
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7B5FBF]/60"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Dos columnas SOLO si hay ilustración. Sin ella, reservar la mitad derecha dejaba
          media ventana vacía. */}
      <div
        className={`relative grid gap-8 p-7 sm:p-10 lg:items-start
                    ${item.imagen ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]' : ''}`}
      >
        <div>
          {Icono && (
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg
                             border border-[#7B5FBF]/30 bg-[#7B5FBF]/10">
              <Icono className="h-5 w-5 text-[#a78bfa]" />
            </span>
          )}

          <h2
            id="ventana-tarjeta-titulo"
            className="mt-5 text-[24px] sm:text-[30px] font-semibold leading-tight tracking-tight text-white"
          >
            {item.titulo}
          </h2>

          <p className="mt-5 text-[15px] leading-relaxed text-white/60">
            {item.descripcion ?? item.texto}
          </p>

          {item.beneficios && item.beneficios.length > 0 && (
            <>
              <p className="mt-8 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#a78bfa]">
                Qué gana tu empresa
              </p>
              <ul className="mt-4 space-y-3">
                {item.beneficios.map((b) => (
                  <li key={b} className="flex gap-3 text-[14.5px] leading-relaxed text-white/65">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7B5FBF]" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* La ilustración, cuando la haya. Sin ella no se pinta ni un recuadro vacío: la
            ventana pasa a una sola columna y ya. Misma regla que el resto del sitio. */}
        {item.imagen && (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
            <Image
              src={item.imagen.src}
              alt=""
              aria-hidden
              width={item.imagen.ancho}
              height={item.imagen.alto}
              className="h-auto w-full object-contain"
            />
          </div>
        )}
      </div>
    </dialog>
  );
}
