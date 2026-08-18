'use client';

/**
 * LA TRANSICIÓN AL CAMBIAR DE PESTAÑA DEL MENÚ (Fernando, 2026-08-17).
 *
 * Pasar de «Soluciones» a «Desarrollo Humano» era un corte seco: desaparecía una página y
 * aparecía la otra de golpe, sin que nada dijera que había ocurrido algo. Ahora el cuerpo
 * entra subiendo.
 *
 * ── POR QUÉ LA CLAVE ES LA SECCIÓN Y NO LA RUTA ENTERA ────────────────────────
 * Es la decisión que importa aquí. Con `key={pathname}` la transición saltaría **también**
 * al cambiar de puerta dentro de Soluciones —de `/soluciones/progreso` a
 * `/soluciones/automatizacion`—, y ahí ya hay una: `.aparece-detalle`, que desliza el
 * detalle desde el 2026-08-04. Las dos a la vez se suman y el bloque recorre el doble.
 *
 * Con la clave puesta en el **primer tramo** de la ruta, cada cosa anima lo suyo:
 *
 *   · cambiar de pestaña del menú  → esta transición (la página entera)
 *   · cambiar de puerta dentro de una → `.aparece-detalle` (solo el detalle)
 *
 * Y es además lo que pidió, literalmente: *al cambiar de pestañas*.
 *
 * ── POR QUÉ HACE FALTA UN COMPONENTE DE CLIENTE, Y QUÉ NO CAMBIA POR ELLO ─────
 * La animación tiene que **volver a arrancar** en cada navegación, y para eso el nodo debe
 * remontarse. Un layout de Next NO se remonta al ir de una página hermana a otra —ese es su
 * propósito—, así que hace falta un `key` que cambie, y el `key` sale de `usePathname()`,
 * que solo existe en cliente.
 *
 * ⚠️ **`children` sigue siendo Server Component y sigue estando en el HTML crudo.** Llegan
 * ya renderizados desde el layout: este componente no los produce, solo los envuelve. Es
 * justo lo contrario del fallo de `GaleriaTarjetas`, donde el texto viajaba **como prop** a
 * un cliente que no lo pintaba y acababa solo dentro del `<script>` de hidratación.
 * **Comprobado midiendo el HTML servido**, no dando por hecho el comportamiento del
 * framework — que es la lección que ya costó una investigación entera.
 *
 * ── LA ANIMACIÓN, POR TIEMPO ──────────────────────────────────────────────────
 * Es corta, **siempre termina** y no vuelve a ocurrir, así que puede tocar la opacidad sin
 * el riesgo de dejar algo invisible. Es el mismo criterio que ya siguen `.aparece-detalle`
 * y la entrada del CV, y es distinto del de los temas: aquellos van ligados al **scroll** y
 * por eso viven dentro de un `@supports` — si su línea de tiempo no avanzara, el contenido
 * se quedaría oculto. Aquí no puede pasar.
 */

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

export default function TransicionSeccion({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  // `/soluciones/requerimientos` → `soluciones`. La portada no pasa por aquí (tiene su
  // propio marco), pero el `|| 'inicio'` evita una clave vacía si algún día lo hiciera.
  const seccion = pathname.split('/')[1] || 'inicio';

  return (
    // `flex-1 flex flex-col`: este envoltorio está entre el `<main>` y la página, así que
    // si no dejara pasar el alto, ninguna página podría estirarse hasta el pie.
    <div key={seccion} className="transicion-seccion flex-1 flex flex-col">
      {children}
    </div>
  );
}
