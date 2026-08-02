'use client';

/**
 * LA RANURA DE ACCIONES DEL PIE — definición ÚNICA.
 *
 * ── QUÉ RESUELVE ───────────────────────────────────────────────────────────────
 * Los lanzadores de chat, notificaciones y el bot de cotizaciones flotaban sobre el
 * contenido, justo encima de la barra de ruta. Tres problemas:
 *
 *  1. **Tapaban contenido.** Píldoras de 40 px de alto con sombra, ancladas abajo a la
 *     derecha, encima de tablas y botones.
 *  2. **Se coordinaban midiéndose entre ellos.** `NotificationsDock` era el ancla y los
 *     otros dos leían su `getBoundingClientRect()` para colocarse a su izquierda. Frágil:
 *     si el ancla no se pintaba —y no se pinta siempre—, los demás caían a un valor por
 *     defecto escrito a mano.
 *  3. **No se sabía cuántos había.** Cada uno decidía su sitio por su cuenta.
 *
 * Ahora los tres **se portan a una ranura de la barra de ruta**, que ya está anclada abajo
 * y ya reserva su alto. El orden lo da un `flex`, no una medición. Y el contenido deja de
 * tener nada encima.
 *
 * ── CÓMO SE USA ────────────────────────────────────────────────────────────────
 *   // En la barra de ruta, una sola vez:
 *   <RanuraAcciones />
 *
 *   // En cualquier componente que quiera un botón ahí:
 *   <EnElPie orden={20}><button …/></EnElPie>
 *
 * `orden` fija la posición de izquierda a derecha y evita que dependa del orden de montaje,
 * que cambia según qué página se abra.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const ID_RANURA = 'pie-acciones';

/** El contenedor. Lo pinta la barra de ruta, y solo ella. */
export function RanuraAcciones() {
  return <div id={ID_RANURA} className="ml-auto flex items-center gap-1 shrink-0 pl-3" />;
}

/**
 * Porta su contenido a la ranura del pie.
 *
 * Si la ranura no existe —una página fuera del panel, o el primer render antes de que la
 * barra monte— **no pinta nada** en vez de caer a una posición flotante: un botón que
 * aparece un instante en una esquina y salta al pie se ve peor que uno que aparece ya en
 * su sitio.
 */
export function EnElPie({ children, orden = 50 }: { children: ReactNode; orden?: number }) {
  const [ranura, setRanura] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // La barra de ruta puede montarse después que quien pinta el botón, así que si no está
    // se reintenta en el siguiente fotograma en vez de rendirse.
    let cancelado = false;
    const buscar = () => {
      if (cancelado) return;
      const el = document.getElementById(ID_RANURA);
      if (el) setRanura(el);
      else requestAnimationFrame(buscar);
    };
    buscar();
    return () => { cancelado = true; };
  }, []);

  if (!ranura) return null;
  return createPortal(<div style={{ order: orden }} className="flex items-center">{children}</div>, ranura);
}

/**
 * Botón estándar de la barra de ruta.
 *
 * Alto 26 px para caber en los 36 px del pie sin apretarlo. **Sin sombra y sin relleno de
 * color**: aquí ya no flota sobre el contenido, forma parte de la barra, y una píldora
 * morada con sombra dentro de una barra fina se ve como un parche. El acento aparece al
 * pasar por encima y cuando está abierto.
 */
export function BotonPie({
  Icon, label, activo, sinLeer, cuenta, onClick, tono = 'normal',
}: {
  Icon: any;
  label: string;
  activo?: boolean;
  /** Puntito rojo con el número. Sin leer = pide atención. */
  sinLeer?: number;
  /** Número neutro a la derecha del texto (p. ej. cuántos chats hay). */
  cuenta?: number;
  onClick: () => void;
  /** `acento` para el que es una acción de marca, como el bot de IA. */
  tono?: 'normal' | 'acento';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={activo ? `Cerrar ${label}` : `Abrir ${label}${sinLeer ? `, ${sinLeer} sin leer` : ''}`}
      aria-expanded={!!activo}
      title={label}
      className={`relative inline-flex items-center gap-1.5 h-[26px] px-2 rounded transition-colors
        ${activo
          ? 'bg-accent-light text-accent'
          : tono === 'acento'
            ? 'text-accent hover:bg-accent-light'
            : 'text-digi-muted hover:text-accent hover:bg-accent-light'}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {/* La etiqueta se esconde en pantallas estrechas: el icono ya identifica el botón y
          la barra de ruta necesita su sitio. */}
      <span className="hidden sm:inline text-[12px] font-medium">{label}</span>
      {cuenta != null && cuenta > 0 && (
        <span className="text-[11px] opacity-70 tabular-nums">{cuenta}</span>
      )}
      {!activo && !!sinLeer && sinLeer > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 flex items-center justify-center
                     rounded-full bg-red-600 text-white text-[9.5px] font-bold tabular-nums border border-digi-card"
        >
          {sinLeer > 99 ? '99+' : sinLeer}
        </span>
      )}
    </button>
  );
}
