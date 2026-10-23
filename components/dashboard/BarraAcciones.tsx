'use client';

/**
 * LA BARRA DE ACCIONES PRINCIPALES DEL TELÉFONO — definición ÚNICA (Fernando, 2026-10-22,
 * llevada a GCC World el 2026-10-23).
 *
 * Textual: *«los botones en móvil no deben mostrarse con textos completos y fijos en una parte
 * superior […] los botones principales tipo aprobar y rechazar se puedan ver en el centro
 * inferior de la pantalla pero que no tape o esté sobrepuesto sobre un texto o campo»*.
 *
 * ── CÓMO NO TAPA NADA ──────────────────────────────────────────────────────────────────
 * El hueco (`HuecoBarraAcciones`) es el ÚLTIMO hijo del `main` y **ocupa en el flujo** el
 * alto de la barra; la barra en sí es `fixed`, justo encima del pie de la ruta
 * (`--pie-panel`). Al final de la página el último campo queda por encima del hueco, y
 * mientras se baja la barra se queda en su sitio. Vacío (ninguna página ha portado nada),
 * el hueco no ocupa nada (`empty:hidden`).
 *
 * ⚠️ No es `sticky` como en los productos: aquí el `main` lleva `overflow-auto` (media app
 * depende de eso, ver el layout), y un `sticky` dentro de un contenedor con `overflow` se
 * pega a ESE contenedor, que crece con la página — nunca a la ventana.
 *
 * Desde `lg` no existe: las acciones se quedan en su cabecera.
 *
 *   <EnBarraAcciones>
 *     <button className={BTN_SECONDARY}>Rechazar</button>
 *     <button className={BTN_PRIMARY}>Aprobar</button>
 *   </EnBarraAcciones>
 *
 * Orden: la peligrosa a la izquierda, la afirmativa a la derecha. Todos los botones del mismo
 * ancho.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const ID_BARRA_ACCIONES = 'barra-acciones-movil';

/** El hueco. Lo pinta el layout del panel, y solo él, como último hijo del `main`. */
export function HuecoBarraAcciones() {
  return <div id={ID_BARRA_ACCIONES} className="lg:hidden print:hidden empty:hidden h-16 mt-4 -mb-2" />;
}

/** Porta sus botones a la barra de abajo. Solo en el teléfono: desde `lg` no pinta nada. */
export function EnBarraAcciones({ children }: { children: ReactNode }) {
  const [hueco, setHueco] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let cancelado = false;
    const buscar = () => {
      if (cancelado) return;
      const el = document.getElementById(ID_BARRA_ACCIONES);
      if (el) setHueco(el);
      else requestAnimationFrame(buscar);
    };
    buscar();
    return () => { cancelado = true; };
  }, []);

  if (!hueco) return null;
  return createPortal(
    <div className="fixed inset-x-0 bottom-[var(--pie-panel)] z-[25] border-t border-digi-border bg-digi-card px-4 py-2.5">
      <div className="mx-auto flex max-w-md items-center gap-2 [&>*]:flex-1 [&>*]:min-w-0 [&_button]:w-full [&_a]:w-full">
        {children}
      </div>
    </div>,
    hueco,
  );
}
