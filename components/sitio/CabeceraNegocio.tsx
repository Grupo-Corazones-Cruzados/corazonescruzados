/**
 * LA CABECERA DE `/negocio` — definición ÚNICA, compartida por la portada de la sección y
 * por las cinco páginas de detalle.
 *
 * Titular, subtítulo y las cinco puertas. Las seis rutas la pintan igual; lo único que
 * cambia es **qué tarjeta va marcada**.
 *
 * ── POR QUÉ NO ES UN `layout.tsx` ──────────────────────────────────────────────
 * Sería lo natural, pero un layout de `negocio/` **no recibe los parámetros del segmento
 * hijo**: no sabría si está abierta `requerimientos` o `marketplace`, y habría que
 * averiguarlo con `usePathname`, que obliga a convertirlo en componente de cliente.
 * Pasándole `activa` desde cada página, esto sigue siendo **Server Component puro**: las
 * cinco frases y el titular salen en el HTML crudo, sin depender de que se ejecute nada.
 *
 * ── EL TITULAR CAMBIA DE ETIQUETA, NO DE ASPECTO ───────────────────────────────
 * En `/negocio` el nombre del grupo es el `<h1>`. En una página de detalle **no puede
 * serlo**: su `<h1>` tiene que ser el título de esa página, o las cinco competirían en el
 * buscador con el mismo encabezado y ninguna diría de qué va. Así que ahí baja a `<p>` —se
 * ve exactamente igual, pero deja el `<h1>` libre para el detalle.
 */

import { ACCESOS } from '@/lib/sitio/contenido';
import { SITIO } from '@/lib/sitio/contenido';
import { Contenedor, FondoHeroe, RejillaAccesos } from './piezas';

const CLASES_TITULAR =
  'text-[38px] sm:text-[54px] leading-[1.08] font-semibold text-white tracking-tight';

export default function CabeceraNegocio({ activa }: { activa?: string }) {
  return (
    <section className="relative overflow-hidden">
      <FondoHeroe />
      <Contenedor className="relative pt-20 pb-14 sm:pt-24 sm:pb-16">
        <div className="text-center">
          {activa
            ? <p className={CLASES_TITULAR}>{SITIO.nombre}</p>
            : <h1 className={CLASES_TITULAR}>{SITIO.nombre}</h1>}
          {/* Texto de Fernando, palabra por palabra (2026-08-04). Solo se corrigió la tilde
              de «unión», que venía como «únion». */}
          <p className="mt-5 text-[17px] sm:text-[18.5px] leading-relaxed text-white/55 max-w-3xl mx-auto">
            Proyecto de desarrollo humano que ofrece soluciones para las necesidades
            individuales y grupales de sus colaboradores, en función de resolver
            determinadas problemáticas sociales, teniendo como meta final la unión del mundo.
          </p>
        </div>
        <div className="mt-10 sm:mt-12">
          <RejillaAccesos
            accesos={ACCESOS}
            etiqueta="Lo que puedes hacer en GCC World"
            activa={activa}
          />
        </div>
      </Contenedor>
    </section>
  );
}
