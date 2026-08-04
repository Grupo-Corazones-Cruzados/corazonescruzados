/**
 * CONTACTO — cómo hablar con una persona, y el contenido en vídeo del proyecto.
 *
 * Los datos de contacto salen de `lib/sitio/contenido.ts`, que viene del certificado del
 * SRI. Los vídeos también viven ahí: **si la lista está vacía, la sección no se pinta**.
 * No se inventan enlaces — uno roto en la web que revisa Meta es peor que no tener sección.
 */

import type { Metadata } from 'next';
import { Mail, Phone, MapPin, Youtube, ArrowRight } from 'lucide-react';
import { SITIO, VIDEOS, CANAL_YOUTUBE, REDES } from '@/lib/sitio/contenido';
import {
  Contenedor, Seccion, TituloSeccion, Tarjeta, FondoHeroe, BotonPrimario,
} from '@/components/sitio/piezas';

export const metadata: Metadata = {
  // Sin el nombre del negocio: la plantilla de `app/layout.tsx` ya lo añade con «·».
  title: 'Contacto — Guayaquil, Ecuador',
  description: `Contacta con ${SITIO.nombre}: ${SITIO.correo} · ${SITIO.telefono}. ${SITIO.ciudad}, ${SITIO.pais}. RUC ${SITIO.ruc}.`,
  keywords: ['contacto Grupo Corazones Cruzados', 'agencia software Guayaquil contacto', 'WhatsApp Business Ecuador contacto'],
  alternates: { canonical: '/contacto' },
  openGraph: {
    title: `Contacto — ${SITIO.nombre}`,
    description: `${SITIO.correo} · ${SITIO.telefono} · ${SITIO.ciudad}, ${SITIO.pais}`,
    url: `${SITIO.url}/contacto`,
    type: 'website',
    locale: 'es_EC',
  },
};

const VIAS = [
  {
    Icono: Mail,
    titulo: 'Correo',
    valor: SITIO.correo,
    href: `mailto:${SITIO.correo}`,
    nota: 'Para contratar un servicio, resolver una duda o ejercer derechos sobre datos personales.',
  },
  {
    Icono: Phone,
    titulo: 'Teléfono y WhatsApp',
    valor: SITIO.telefono,
    href: `https://wa.me/${SITIO.telefonoPlano.replace('+', '')}`,
    nota: `Desde Ecuador: ${SITIO.telefonoLocal}.`,
  },
  {
    Icono: MapPin,
    titulo: 'Dónde estamos',
    valor: `${SITIO.ciudad}, ${SITIO.pais}`,
    href: null,
    nota: SITIO.direccion,
  },
];

export default function ContactoPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <FondoHeroe />
        <Contenedor className="relative py-24 sm:py-28 text-center">
          <h1 className="text-[38px] sm:text-[52px] leading-[1.1] font-semibold text-white tracking-tight">
            Hablemos
          </h1>
          <p className="mt-6 text-[17px] leading-relaxed text-white/55 max-w-xl mx-auto">
            Escribe, llama o manda un WhatsApp. Contesta una persona.
          </p>
        </Contenedor>
      </section>

      <Seccion tono="realce">
        <div className="grid gap-5 md:grid-cols-3">
          {VIAS.map(({ Icono, titulo, valor, href, nota }) => (
            <Tarjeta key={titulo}>
              <span className="inline-flex items-center justify-center w-11 h-11 rounded-lg border border-[#7B5FBF]/30 bg-[#7B5FBF]/10">
                <Icono className="w-5 h-5 text-[#a78bfa]" />
              </span>
              <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/35">{titulo}</p>
              {href ? (
                <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer"
                  className="mt-1.5 block text-[17px] font-medium text-white hover:text-[#c4b5fd] transition-colors break-words">
                  {valor}
                </a>
              ) : (
                <p className="mt-1.5 text-[17px] font-medium text-white">{valor}</p>
              )}
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-white/45">{nota}</p>
            </Tarjeta>
          ))}
        </div>
      </Seccion>

      {/* ── VÍDEO ───────────────────────────────────────────────────────────── */}
      {/* Se pinta solo si hay contenido de verdad. Ver la nota en `contenido.ts`. */}
      {(CANAL_YOUTUBE || VIDEOS.length > 0) && (
        <Seccion id="videos">
          <TituloSeccion
            etiqueta="En vídeo"
            titulo="El proyecto, contado"
            entradilla="Lo que hacemos, por qué lo hacemos y cómo va avanzando."
          />
          {VIDEOS.length > 0 && (
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {VIDEOS.map((v) => (
                <a key={v.url} href={v.url} target="_blank" rel="noopener noreferrer"
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 transition-colors hover:border-white/[0.16] group">
                  <Youtube className="w-6 h-6 text-[#a78bfa]" />
                  <p className="mt-4 text-[16px] font-semibold text-white leading-snug group-hover:text-[#c4b5fd] transition-colors">
                    {v.titulo}
                  </p>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-white/45">{v.descripcion}</p>
                </a>
              ))}
            </div>
          )}
          {CANAL_YOUTUBE && (
            <div className="mt-10">
              <BotonPrimario href={CANAL_YOUTUBE}>
                <Youtube className="w-4 h-4" /> Ver el canal <ArrowRight className="w-4 h-4" />
              </BotonPrimario>
            </div>
          )}
        </Seccion>
      )}

      {/* ── IDENTIDAD VERIFICABLE ───────────────────────────────────────────── */}
      <Seccion tono="realce">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <TituloSeccion
            etiqueta="Identidad legal"
            titulo="Quién está detrás de esto"
            entradilla="Somos un negocio registrado en Ecuador, y puedes comprobarlo tú mismo."
          />
          <Tarjeta>
            <dl className="space-y-3.5">
              {[
                ['Razón social', SITIO.razonSocial],
                ['Nombre comercial', SITIO.nombre],
                ['RUC', SITIO.ruc],
                ['Domicilio', SITIO.direccion],
              ].map(([k, v]) => (
                <div key={k} className="grid sm:grid-cols-[130px_1fr] gap-1 sm:gap-3">
                  <dt className="text-[13px] text-white/35">{k}</dt>
                  <dd className="text-[13.5px] text-white/75 leading-relaxed">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 pt-5 border-t border-white/[0.07] text-[13px] leading-relaxed text-white/45">
              El registro es <strong className="text-white/70 font-semibold">público y sin clave</strong>:
              en la{' '}
              <a href="https://srienlinea.sri.gob.ec/sri-en-linea/SriRucWeb/ConsultaRuc/Consultas/consultaRuc"
                target="_blank" rel="noopener noreferrer"
                className="text-[#a78bfa] hover:text-white underline transition-colors">
                Consulta de RUC del SRI
              </a>{' '}
              introduces <strong className="text-white/70 font-semibold">{SITIO.ruc}</strong> y aparecen
              la razón social, el estado del contribuyente y el establecimiento con su nombre comercial.
            </p>
          </Tarjeta>
        </div>
      </Seccion>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ContactPage',
            mainEntity: {
              '@type': 'Organization',
              name: SITIO.nombre,
              legalName: SITIO.razonSocial,
              taxID: SITIO.ruc,
              url: SITIO.url,
              sameAs: [...REDES],
              email: SITIO.correo,
              telephone: SITIO.telefonoPlano,
              address: {
                '@type': 'PostalAddress',
                streetAddress: SITIO.direccion,
                addressLocality: SITIO.ciudad,
                addressCountry: 'EC',
              },
              contactPoint: {
                '@type': 'ContactPoint',
                contactType: 'customer service',
                email: SITIO.correo,
                telephone: SITIO.telefonoPlano,
                availableLanguage: ['es'],
              },
            },
          }),
        }}
      />
    </>
  );
}
