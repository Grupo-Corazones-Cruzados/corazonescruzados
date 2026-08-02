/**
 * PIE DEL SITIO PÚBLICO — solo lo que es suyo.
 *
 * ── QUÉ LLEVA ──────────────────────────────────────────────────────────────────
 * Los **enlaces legales** y el **copyright**. Nada más.
 *
 * ── QUÉ NO LLEVA, Y POR QUÉ ────────────────────────────────────────────────────
 * · **La navegación.** La versión anterior repetía Inicio · Negocios · Desarrollo Humano ·
 *   Contacto, que es **exactamente** lo que hay en la cabecera — y la cabecera está fija
 *   arriba, siempre visible. Repetir cuatro enlaces a sesenta píxeles del original no ayuda
 *   a nadie: solo hace el pie más alto. Lo vio Fernando en una captura donde las dos filas
 *   quedaban una encima de otra, casi idénticas.
 *
 * · **El logo y el nombre.** Mismo caso: ya presiden la cabecera.
 *
 * · **La identidad legal** —razón social, RUC, dirección—. Estuvo aquí a raíz del rechazo
 *   de verificación de Meta y no hacía falta: **esa dirección es la casa de Fernando** —al
 *   ser persona natural, el domicilio tributario es el particular— y **Meta no la busca en
 *   el pie**, la busca en la página que se le declara.
 *
 * Dónde sí va la identidad, porque hace falta:
 *   · `/negocio` y `/contacto` — las declaradas a Meta y las que abre quien quiere contratar.
 *   · `/legal` y `/legal/whatsapp` — la **LOPDP exige** que el responsable del tratamiento
 *     sea identificable con su dirección. Ahí no es opcional.
 *
 * El resultado: una sola línea. La cabecera lleva a cualquier sitio; el pie solo tiene que
 * cerrar la página y dejar a mano lo legal, que no cabe arriba.
 */

import Link from 'next/link';
import { SITIO } from '@/lib/sitio/contenido';
import { Contenedor } from './piezas';

const LEGALES = [
  { href: '/legal', label: 'Términos y privacidad' },
  { href: '/legal/whatsapp', label: 'Agente IA en WhatsApp' },
  { href: '/legal/whatsapp#eliminar-datos', label: 'Eliminar mis datos' },
  { href: '/contacto', label: 'Datos del negocio' },
];

export default function PieSitio() {
  return (
    <footer
      className="border-t border-white/[0.07] bg-[#080a10] py-5"
      itemScope
      itemType="https://schema.org/Organization"
    >
      <Contenedor className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between sm:gap-6">
        {/* El `itemProp="name"` viaja aquí: sin él, el microdato de Organization se queda
            sin nombre, y eso lo leen los buscadores. */}
        <p className="text-[12px] text-white/25 whitespace-nowrap">
          © {new Date().getFullYear()} <span itemProp="name">{SITIO.nombre}</span>
        </p>

        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2" aria-label="Enlaces legales">
          {LEGALES.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[12px] text-white/40 hover:text-white transition-colors whitespace-nowrap"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </Contenedor>
    </footer>
  );
}
