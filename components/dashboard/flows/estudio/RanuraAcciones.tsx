'use client';

/**
 * LA RANURA DE ACCIONES DEL PANEL DEL ESTUDIO.
 *
 * ── EL PROBLEMA QUE RESUELVE ──────────────────────────────────────────────────────────
 * Los paneles del Estudio (Conexión, Parámetros…) traen su propia acción principal:
 * «Comprobar contra Meta», «Guardar cambios». Vivían DENTRO del cuerpo del panel, con su
 * propio titulito encima, así que cada panel enseñaba dos cabeceras: la del panel —la que
 * lleva el nombre y la X— y otra debajo, repitiendo casi lo mismo con el botón al lado.
 *
 * Lo natural es que la acción esté en la cabecera que ya existe. Pero el botón no puede
 * subir sin más: **su estado vive en el editor**, no en el panel. «Guardar cambios» sabe
 * si hay algo que guardar y si está guardando; el panel no sabe nada de eso ni debe.
 *
 * ── POR QUÉ UN PORTAL Y NO LEVANTAR EL ESTADO ─────────────────────────────────────────
 * Subir ese estado al panel obligaría a que el panel conociera a cada editor —qué botón
 * pinta cada uno, cuándo se deshabilita, qué hace al pulsarlo— y a cambiarlo cada vez que
 * se añada un panel nuevo. El editor seguiría siendo el dueño de la lógica, pero repartida
 * en dos archivos.
 *
 * Con un portal, el botón **se declara donde vive su estado** y solo se PINTA en otro
 * sitio. El editor no se entera de que ha subido y el panel no se entera de qué subió.
 *
 * Si no hay ranura —un editor usado fuera del Estudio— no se pinta nada y no falla nada.
 */

import { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

/** El nodo de la cabecera del panel donde aterrizan las acciones. `null` = no hay panel. */
export const RanuraAccionesCtx = createContext<HTMLElement | null>(null);

/**
 * Pinta a sus hijos en la cabecera del panel del Estudio.
 *
 * Se usa como un envoltorio normal, dentro del editor:
 *
 *     <AccionesDelPanel>
 *       <button onClick={guardar} disabled={guardando}>Guardar cambios</button>
 *     </AccionesDelPanel>
 */
export function AccionesDelPanel({ children }: { children: React.ReactNode }) {
  const ranura = useContext(RanuraAccionesCtx);
  if (!ranura) return null;
  return createPortal(children, ranura);
}
