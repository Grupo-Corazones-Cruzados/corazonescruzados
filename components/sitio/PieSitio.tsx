/**
 * PIE DEL SITIO PÚBLICO.
 *
 * ── QUÉ LLEVA Y QUÉ NO, Y POR QUÉ ──────────────────────────────────────────────
 * Lleva la navegación, los enlaces legales y el copyright. **NO lleva la identidad legal.**
 *
 * La llevó durante un tiempo, puesta a raíz del rechazo de Meta: razón social, RUC,
 * dirección y contacto en el pie de todas las páginas. Fue pasarse por dos motivos que
 * salieron de preguntas de Fernando: **esa dirección es su casa** —al ser persona natural,
 * el domicilio tributario es el particular—, y **Meta no la busca en el pie**, la busca en
 * la página que se le declara.
 *
 * Dónde sí va, porque hace falta:
 *   · `/legal` — la **LOPDP exige** que el responsable del tratamiento sea identificable
 *     con su dirección. Ahí no es opcional.
 *   · `/negocio` y `/contacto` — son las páginas que se declaran a Meta y las que abre
 *     quien quiere contratar. Desde aquí se llega con un clic.
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
        <div className="mt-12 pt-8 border-t border-white/[0.07] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/*
            ── AQUÍ YA NO VA LA IDENTIDAD LEGAL, Y ES DELIBERADO ────────────────────
            Estuvo aquí a raíz del rechazo de Meta —razón social, RUC, ciudad y correo en
            todas las páginas— y no hacía falta: Meta no la busca en el pie, la busca en la
            página que se le declara. Sigue completa donde sí cuenta:

              · /negocio y /contacto  — las que se declaran a Meta y las que abre un cliente
              · /legal y /legal/whatsapp — donde la LOPDP EXIGE que el responsable del
                tratamiento sea identificable con su dirección

            Lo que sí se queda es el `itemProp="name"` del microdato de Organization: sin él
            el marcado se queda sin nombre, y eso lo leen los buscadores.
          */}
          <p className="text-[12.5px] text-white/30">
            © {new Date().getFullYear()} <span itemProp="name">{SITIO.nombre}</span>
          </p>
          <Link
            href="/contacto"
            className="text-[12.5px] text-white/30 hover:text-white transition-colors"
          >
            Datos del negocio y contacto
          </Link>
        </div>
      </Contenedor>
    </footer>
  );
}
