/**
 * ÁMBITOS — pestaña nueva (Fernando, 2026-08-17).
 *
 * ── ESTÁ VACÍA A PROPÓSITO ─────────────────────────────────────────────────────
 * Fernando la pidió junto al renombrado de «Inicio» → «Violeta», y dijo: *«luego te iré
 * explicando qué haremos con cada pestaña»*. Así que aquí está **el marco, no el
 * contenido**: la cabecera, el pie, el tema claro y el titular. El texto lo dicta él.
 *
 * No se ha inventado ni una frase de relleno. La regla del sitio público es que **el
 * contenido visible lo decide Fernando** (`Diseño.md` → «El diseño de estas páginas lo
 * decide Fernando, conmigo, ANTES»), y una entradilla puesta «mientras tanto» acaba
 * publicada y nadie recuerda que era provisional.
 *
 * ── ⚠️ MIENTRAS ESTÉ VACÍA, NO SE INDEXA ───────────────────────────────────────
 * `robots: noindex` aquí y **fuera del mapa del sitio** (`app/sitemap.ts`). Una página con
 * solo un titular es lo que Google llama «contenido escaso»: indexarla no aporta nada y
 * ensucia la valoración del dominio entero, que es justo lo que se está intentando
 * levantar. La pestaña sí se ve en el menú: quien navega por el sitio la encuentra.
 *
 * 👉 **AL AÑADIR EL CONTENIDO HAY QUE HACER DOS COSAS**, o la página quedará escrita y
 *    seguirá siendo invisible para Google:
 *      1. quitar el bloque `robots` de aquí abajo y poner su `description`;
 *      2. añadirla a `app/sitemap.ts` con su fecha en `ULTIMO_CAMBIO`.
 *
 * Server Component, como el resto del sitio público: en el HTML crudo.
 */

import type { Metadata } from 'next';
import { Contenedor, FondoHeroe } from '@/components/sitio/piezas';

export const metadata: Metadata = {
  /** Solo el nombre: la plantilla de `app/layout.tsx` añade « · Grupo Corazones Cruzados». */
  title: 'Ámbitos',
  alternates: { canonical: '/ambitos' },
  // ⚠️ TEMPORAL — quitar cuando la página tenga contenido. Ver el aviso de arriba.
  robots: { index: false, follow: true },
};

export default function AmbitosPage() {
  return (
    <section className="relative overflow-hidden">
      <FondoHeroe />
      <Contenedor className="relative py-24 sm:py-32 text-center">
        <h1 className="text-[38px] sm:text-[56px] leading-[1.08] font-semibold text-[var(--texto)] tracking-tight">
          Ámbitos
        </h1>
      </Contenedor>
    </section>
  );
}
