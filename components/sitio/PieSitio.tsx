/**
 * PIE DEL SITIO PÚBLICO — la identidad legal, en todas las páginas.
 *
 * Va en todas a propósito. Meta rechazó la verificación del negocio porque «no puede
 * determinar que pertenezca a un negocio real», y un revisor puede aterrizar en cualquier
 * página: si la identidad solo estuviera en una, depende de la suerte que la encuentre.
 *
 * Los datos salen de `lib/sitio/contenido.ts`, que a su vez viene del certificado del SRI.
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
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <p className="text-[15px] font-semibold text-white" itemProp="name">{SITIO.nombre}</p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-white/45 max-w-sm">
              Un proyecto de desarrollo humano. De ahí nacen los sistemas que desarrollamos
              y operamos para nuestros clientes. {SITIO.ciudad}, {SITIO.pais}.
            </p>
          </div>

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
            <p itemProp="address" itemScope itemType="https://schema.org/PostalAddress">
              <span itemProp="streetAddress">{SITIO.direccion}</span>
            </p>
            <p className="mt-1">
              <a href={`mailto:${SITIO.correo}`} itemProp="email" className="hover:text-white transition-colors">
                {SITIO.correo}
              </a>
              {' · '}
              <a href={`tel:${SITIO.telefonoPlano}`} itemProp="telephone" className="hover:text-white transition-colors">
                {SITIO.telefono}
              </a>
            </p>
          </div>
          <p className="text-[12.5px] text-white/30">© {new Date().getFullYear()} {SITIO.nombre}</p>
        </div>
      </Contenedor>
    </footer>
  );
}
