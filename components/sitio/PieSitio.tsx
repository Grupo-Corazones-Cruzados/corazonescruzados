/**
 * PIE DEL SITIO PÚBLICO — compacto, de una sola fila.
 *
 * ── QUÉ LLEVA Y QUÉ NO ─────────────────────────────────────────────────────────
 * Navegación, enlaces legales y copyright. **NO lleva la identidad legal.**
 *
 * La llevó durante un tiempo, puesta a raíz del rechazo de verificación de Meta: razón
 * social, RUC, dirección y contacto en el pie de todas las páginas. Fue pasarse, por dos
 * motivos que salieron de preguntas de Fernando: **esa dirección es su casa** —al ser
 * persona natural, el domicilio tributario es el particular— y **Meta no la busca en el
 * pie**, la busca en la página que se le declara.
 *
 * Dónde sí va, porque hace falta:
 *   · `/negocio` y `/contacto` — las que se declaran a Meta y las que abre quien quiere
 *     contratar. Desde aquí se llega con un clic.
 *   · `/legal` y `/legal/whatsapp` — la **LOPDP exige** que el responsable del tratamiento
 *     sea identificable con su dirección. Ahí no es opcional.
 *
 * ── POR QUÉ UNA FILA Y NO COLUMNAS ─────────────────────────────────────────────
 * La versión anterior era la retícula clásica —listas con su encabezado y franja inferior—
 * y medía **363 px**. Es el patrón por defecto de casi cualquier web, y tiene sentido
 * cuando hay veinte destinos que agrupar. Aquí hay **siete**: agruparlos en columnas gasta
 * más alto en los encabezados que en los propios enlaces.
 *
 * Comprimido a una fila: marca a la izquierda, los siete enlaces en línea, copyright a la
 * derecha. **Sin quitar un solo destino.** En móvil se apila solo.
 *
 * Los datos salen de `lib/sitio/contenido.ts`, que viene del certificado del SRI.
 */

import Image from 'next/image';
import Link from 'next/link';
import { SITIO, NAVEGACION } from '@/lib/sitio/contenido';
import { Contenedor } from './piezas';

/**
 * Los legales van junto a los de navegación, separados solo por un punto medio. Antes
 * tenían lista propia con encabezado, y el encabezado ocupaba más que los tres enlaces.
 */
const LEGALES = [
  { href: '/legal', label: 'Términos y privacidad' },
  { href: '/legal/whatsapp', label: 'Agente IA en WhatsApp' },
  { href: '/legal/whatsapp#eliminar-datos', label: 'Eliminar mis datos' },
];

export default function PieSitio() {
  return (
    <footer
      className="border-t border-white/[0.07] bg-[#080a10] py-6"
      itemScope
      itemType="https://schema.org/Organization"
    >
      <Contenedor className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        {/* La marca. El logo hace de ancla visual y ahorra la línea de descripción que
            llevaba la versión anterior. */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <Image src="/logo-gcc.png" alt="" width={24} height={24} className="rounded-full shrink-0" />
          <span
            className="text-[13px] font-semibold text-white/75 group-hover:text-white transition-colors"
            itemProp="name"
          >
            {SITIO.nombre}
          </span>
        </Link>

        {/* Los siete destinos, en línea. Al envolverse en pantallas medias, `gap-y` evita
            que las filas se peguen. */}
        <nav
          // `gap-x-4` y 12 px: con `gap-x-5` y 12,5 px los siete enlaces se partían en dos
          // líneas a 1440 px y el pie subía de 72 a 100 px. Medido, no estimado.
          className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:justify-end lg:flex-1"
          aria-label="Pie de página"
        >
          {[...NAVEGACION, ...LEGALES].map((n, i) => (
            <span key={n.href} className="flex items-center gap-x-4">
              {/* Separador entre navegación y legales: se leen como dos grupos sin gastar
                  dos encabezados en decirlo. */}
              {i === NAVEGACION.length && (
                <span aria-hidden className="hidden sm:inline text-white/15 select-none">·</span>
              )}
              <Link
                href={n.href}
                className="text-[12px] text-white/45 hover:text-white transition-colors whitespace-nowrap"
              >
                {n.label}
              </Link>
            </span>
          ))}
        </nav>

        {/* Solo el año en pantallas grandes: el nombre ya está a la izquierda, y
            repetirlo costaba los 200 px que impedían que los enlaces cupieran en una fila. */}
        <p className="text-[12px] text-white/25 shrink-0 whitespace-nowrap">
          © {new Date().getFullYear()}
        </p>
      </Contenedor>
    </footer>
  );
}
