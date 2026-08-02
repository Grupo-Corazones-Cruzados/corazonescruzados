/**
 * PIE DEL SITIO PÚBLICO.
 *
 * ── QUÉ LLEVA Y QUÉ NO, Y POR QUÉ ──────────────────────────────────────────────
 * Lleva lo que **identifica** al negocio —razón social, RUC, ciudad y contacto— y NO la
 * dirección postal completa.
 *
 * La primera versión la llevaba, puesta a raíz del rechazo de Meta. Fue pasarse, y lo
 * preguntó Fernando: **esa dirección es su casa**. Al ser persona natural, el domicilio
 * tributario es el particular, y el pie aparece en todas las páginas — incluida la portada,
 * que abre cualquiera que llegue al juego.
 *
 * Dónde sí va completa, porque hace falta:
 *   · `/legal` — la **LOPDP exige** que el responsable del tratamiento sea identificable
 *     con su dirección. Ahí no es opcional.
 *   · `/negocio` y `/contacto` — son las páginas que se declaran a Meta y las que abre
 *     quien quiere contratar. Un clic desde aquí.
 *
 * Los datos salen de `lib/sitio/contenido.ts`, que viene del certificado del SRI.
 */

import Link from 'next/link';
import { SITIO, NAVEGACION } from '@/lib/sitio/contenido';
import { Contenedor } from './piezas';

export default function PieSitio() {
  return (
    <footer
      className="border-t border-white/[0.07] bg-[#080a10] py-14"
      itemScope
      itemType="https://schema.org/Organization"
    >
      <Contenedor>
        {/*
          Sin el bloque de marca, las dos listas se colocan seguidas en vez de
          repartirse en una rejilla de 4: con `grid-cols-4` ocupaban solo las dos
          últimas columnas y dejaban medio pie vacío a la izquierda.
        */}
        <div className="flex flex-wrap gap-x-20 gap-y-8">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/35 mb-3">Sitio</p>
            <ul className="space-y-2">
              {NAVEGACION.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="text-[13.5px] text-white/55 hover:text-white transition-colors">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/35 mb-3">Legal</p>
            <ul className="space-y-2">
              <li>
                <Link href="/legal" className="text-[13.5px] text-white/55 hover:text-white transition-colors">
                  Términos y privacidad
                </Link>
              </li>
              <li>
                <Link href="/legal/whatsapp" className="text-[13.5px] text-white/55 hover:text-white transition-colors">
                  Agente IA en WhatsApp
                </Link>
              </li>
              <li>
                <Link href="/legal/whatsapp#eliminar-datos" className="text-[13.5px] text-white/55 hover:text-white transition-colors">
                  Eliminar mis datos
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* La identidad verificable. En todas las páginas, a propósito. */}
        <div className="mt-12 pt-8 border-t border-white/[0.07] flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div className="text-[12.5px] leading-relaxed text-white/40">
            <p>
              <span itemProp="legalName">{SITIO.razonSocial}</span> · RUC{' '}
              <span itemProp="taxID">{SITIO.ruc}</span>
            </p>
            {/* Solo la ciudad. La dirección completa vive en /contacto y en /legal. */}
            <p itemProp="address" itemScope itemType="https://schema.org/PostalAddress">
              <span itemProp="addressLocality">{SITIO.ciudad}</span>,{' '}
              <span itemProp="addressCountry">{SITIO.pais}</span>
              {' · '}
              <Link href="/contacto" className="hover:text-white transition-colors underline underline-offset-2">
                Dirección y contacto
              </Link>
            </p>
            <p className="mt-1">
              <a href={`mailto:${SITIO.correo}`} itemProp="email" className="hover:text-white transition-colors">
                {SITIO.correo}
              </a>
            </p>
          </div>
          {/*
            `itemProp="name"` vivía en el bloque de marca que se quitó. Sin él, el
            microdato de Organization se queda sin nombre (lo leen Google y Meta),
            así que viaja aquí: mismo texto visible, marcado conservado.
          */}
          <p className="text-[12.5px] text-white/30">
            © {new Date().getFullYear()} <span itemProp="name">{SITIO.nombre}</span>
          </p>
        </div>
      </Contenedor>
    </footer>
  );
}
