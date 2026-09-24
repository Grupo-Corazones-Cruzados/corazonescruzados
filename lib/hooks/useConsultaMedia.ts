'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * ¿SE CUMPLE ESTA CONSULTA DE MEDIOS? — PREGUNTADO EN JAVASCRIPT, NO EN CSS.
 *
 * ── POR QUÉ HIZO FALTA (2026-09-23) ──────────────────────────────────────────────
 * Esconder algo con `xl:hidden` lo quita de la VISTA, pero lo deja **montado**. Con la
 * mayoría de las cosas da igual; con un `<dialog>` no, porque su `showModal()` no
 * depende de que se vea: **deja inerte el resto de la página**. Así, en escritorio, un
 * modal de teléfono que nadie veía estaba bloqueando todos los clics del dashboard —el
 * ratón no hacía nada y no había nada que mirar—.
 *
 * Cuando lo que cambia con el tamaño no es el aspecto sino **qué se monta**, la decisión
 * tiene que estar en el código, no en una clase de CSS.
 *
 * ── SE PREGUNTA EN `rem`, COMO TAILWIND ──────────────────────────────────────────
 * Los cortes de Tailwind v4 van en `rem` (`xl` = `80rem`), no en píxeles. Escribir
 * `1280px` aquí sería correcto solo mientras nadie cambie el tamaño de letra del
 * navegador; con la letra a 20px, `80rem` son 1600px y las dos mitades dejarían de
 * coincidir justo en los tamaños intermedios. Se usa la MISMA unidad.
 */

/** `xl` de Tailwind. Encima de esto se usa el panel lateral; debajo, el modal. */
export const PANTALLA_XL = '(min-width: 80rem)';

export function useConsultaMedia(consulta: string): boolean {
  const suscribir = useCallback(
    (avisar: () => void) => {
      const mq = window.matchMedia(consulta);
      mq.addEventListener('change', avisar);
      return () => mq.removeEventListener('change', avisar);
    },
    [consulta],
  );

  return useSyncExternalStore(
    suscribir,
    () => window.matchMedia(consulta).matches,
    // En el servidor no hay ventana. `false` es la respuesta prudente: en la primera
    // pintada se monta el modal (que empieza cerrado y por tanto no molesta) y en cuanto
    // hidrata se corrige. Al revés —suponer escritorio— un teléfono se quedaría sin la
    // pantalla de detalle hasta que React hidratara.
    () => false,
  );
}
