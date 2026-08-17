/**
 * LA CABECERA DE `/soluciones` — definición ÚNICA, compartida por la portada de la sección
 * y por las cinco páginas de detalle.
 *
 * Titular, subtítulo y las cinco puertas. Las seis rutas la pintan igual; lo único que
 * cambia es **qué tarjeta va marcada**.
 *
 * ── POR QUÉ NO ES UN `layout.tsx` ──────────────────────────────────────────────
 * Sería lo natural, pero un layout de `soluciones/` **no recibe los parámetros del segmento
 * hijo**: no sabría si está abierta `requerimientos` o `marketplace`, y habría que
 * averiguarlo con `usePathname`, que obliga a convertirlo en componente de cliente.
 * Pasándole `activa` desde cada página, esto sigue siendo **Server Component puro**: las
 * cinco frases y el titular salen en el HTML crudo, sin depender de que se ejecute nada.
 *
 * ── EL TITULAR ES «SOLUCIONES», NO EL NOMBRE DEL GRUPO (Fernando, 2026-08-17) ───
 * Antes decía «Grupo Corazones Cruzados». Fernando lo reconsideró: el titular dice **de qué
 * va la página**, y el nombre del grupo ya está en la barra de arriba, en el pie y en el
 * sufijo de la pestaña. La palabra vive aquí y en `NAVEGACION` (`lib/sitio/contenido.ts`),
 * que es la etiqueta del menú — son dos sitios porque son dos cosas distintas, pero tienen
 * que decir lo mismo.
 *
 * ── EL TITULAR CAMBIA DE ETIQUETA, NO DE ASPECTO ───────────────────────────────
 * En `/soluciones` el titular es el `<h1>`. En una página de detalle **no puede serlo**: su
 * `<h1>` tiene que ser el título de esa página, o las cinco competirían en el buscador con
 * el mismo encabezado y ninguna diría de qué va. Así que ahí baja a `<p>` —se ve exactamente
 * igual, pero deja el `<h1>` libre para el detalle.
 */

import { ACCESOS } from '@/lib/sitio/contenido';
import { Contenedor, FondoHeroe, RejillaAccesos } from './piezas';

const CLASES_TITULAR =
  'text-[38px] sm:text-[54px] leading-[1.08] font-semibold text-[var(--texto)] tracking-tight';

/** El titular de la sección. Dictado por Fernando el 2026-08-17. */
const TITULAR = 'Soluciones';

export default function CabeceraSoluciones({ activa }: { activa?: string }) {
  return (
    <section className="relative overflow-hidden">
      <FondoHeroe />
      <Contenedor className="relative pt-20 pb-14 sm:pt-24 sm:pb-16">
        <div className="text-center">
          {activa
            ? <p className={CLASES_TITULAR}>{TITULAR}</p>
            : <h1 className={CLASES_TITULAR}>{TITULAR}</h1>}

          {/* «Clientes» — a quién habla esta sección (Fernando, 2026-08-04; confirmado el
              2026-08-17, al cambiar el titular).
              Va como `<p>` y no como `<h2>` por la misma razón que el nombre de las
              tarjetas: en las cinco páginas de detalle el `<h1>` está MÁS ABAJO —es el
              título de la puerta—, así que un `<h2>` aquí quedaría por encima de él y
              dejaría la jerarquía del revés para quien lee el documento. El peso visual es
              el que pidió; la señal para el buscador se mantiene limpia. */}
          <p className="mt-3 text-[20px] sm:text-[24px] font-semibold tracking-tight text-[var(--violeta-txt)]">
            Clientes
          </p>
          {/* Texto de Fernando, palabra por palabra (2026-08-04). Solo se corrigió la tilde
              de «unión», que venía como «únion». */}
          <p className="mt-5 text-[17px] sm:text-[18.5px] leading-relaxed text-[var(--suave)] max-w-3xl mx-auto">
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
