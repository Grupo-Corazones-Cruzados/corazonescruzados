/**
 * NEGOCIO — la página comercial. Qué hacemos y para quién.
 *
 * ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────────
 * Meta rechazó la verificación (2026-08-02) con «no puede determinar que pertenezca a un
 * negocio real». El certificado de RUC era correcto; lo que fallaba era que un revisor
 * abría `app.grupocc.org` y encontraba la portada de captación de candidatos —pixel art,
 * creador de personaje—, que no se lee como una empresa que presta servicios.
 *
 * ── LAS REGLAS ─────────────────────────────────────────────────────────────────
 * 1. **Server Component, sin `use client`.** Tiene que estar en el HTML crudo: un buscador
 *    y un revisor pueden no ejecutar JavaScript. Solo el alta de cliente es una isla.
 * 2. **Nada que no sea verificable.** Sin cifras de clientes ni años de experiencia. Un
 *    dato que no cuadra hace más daño que un dato que falta.
 * 3. **El texto vive en `lib/sitio/contenido.ts`**, no aquí.
 */

import type { Metadata } from 'next';
import { ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { SITIO, SERVICIOS, CLIENTES, PUBLICOS } from '@/lib/sitio/contenido';
import {
  Contenedor, Seccion, TituloSeccion, Tarjeta, IconoCuadro, FondoHeroe,
  BotonPrimario, BotonSecundario, conNegritas,
} from '@/components/sitio/piezas';
import AltaCliente from './AltaCliente';

export const metadata: Metadata = {
  title: 'Qué hacemos — un proyecto de desarrollo humano y sus servicios',
  description:
    'Grupo Corazones Cruzados es un proyecto de desarrollo humano de Guayaquil, Ecuador. De ahí nacen sus servicios: plataformas de gestión a medida, agentes de atención con IA en WhatsApp, automatización de la comunicación y facturación electrónica ante el SRI.',
  keywords: [
    'agente de IA WhatsApp Ecuador', 'WhatsApp Business API Ecuador', 'chatbot WhatsApp Guayaquil',
    'desarrollo de software Guayaquil', 'facturación electrónica SRI', 'automatización WhatsApp',
    'proveedor de tecnología WhatsApp',
  ],
  alternates: { canonical: '/negocio' },
  openGraph: {
    title: `${SITIO.nombre} — Servicios para empresas`,
    description:
      'Agentes de atención con IA en WhatsApp, plataformas de gestión a medida y facturación electrónica ante el SRI.',
    url: `${SITIO.url}/negocio`,
    type: 'website',
    locale: 'es_EC',
  },
};

export default function NegocioPage() {
  return (
    <>
      {/* ── HÉROE ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <FondoHeroe />
        <Contenedor className="relative py-24 sm:py-32 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#7B5FBF]/30 bg-[#7B5FBF]/10 px-3.5 py-1.5 text-[12.5px] text-[#c4b5fd]">
            <ShieldCheck className="w-3.5 h-3.5" />
            Un proyecto de desarrollo humano · Guayaquil, Ecuador
          </p>
          <h1 className="mt-7 text-[38px] sm:text-[56px] leading-[1.08] font-semibold text-white tracking-tight max-w-3xl mx-auto">
            Primero las personas.
            <br className="hidden sm:block" /> Lo demás sale de ahí.
          </h1>
          <p className="mt-6 text-[17px] sm:text-[18.5px] leading-relaxed text-white/55 max-w-2xl mx-auto">
            {SITIO.nombre} es un proyecto de desarrollo humano. Los sistemas que hoy
            ofrecemos a empresas nacieron primero como herramientas para nuestra propia
            gente — y por eso están hechos para usarse, no para venderse.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <BotonPrimario href="#crear-cuenta">
              Crear cuenta de cliente <ArrowRight className="w-4 h-4" />
            </BotonPrimario>
            <BotonSecundario href="#servicios">Ver los servicios</BotonSecundario>
          </div>
          <p className="mt-5 text-[13px] text-white/35">
            Abrir la cuenta no cuesta nada y no compromete a nada.
          </p>
        </Contenedor>
      </section>

      {/* ── SERVICIOS ───────────────────────────────────────────────────────── */}
      <Seccion id="servicios" tono="realce">
        <TituloSeccion
          etiqueta="Todo lo que ofrecemos"
          titulo="Tres públicos, no uno"
          entradilla="Un cliente que contrata, un miembro que crece y alguien que acaba de llegar necesitan cosas distintas. Estas son todas."
        />

        {PUBLICOS.map((pub) => {
          const suyos = SERVICIOS.filter((s) => s.publico === pub.id);
          if (!suyos.length) return null;
          return (
            <div key={pub.id} id={pub.id} className="mt-16 first:mt-12 scroll-mt-24">
              <h3 className="text-[22px] font-semibold text-white tracking-tight">{pub.label}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-white/45 max-w-2xl">{pub.entradilla}</p>
              <div className="mt-7 grid gap-5 md:grid-cols-2">
                {suyos.map((s) => (
                  <Tarjeta key={s.id} id={s.id}>
                    <IconoCuadro nombre={s.icono} />
                    <h4 className="mt-5 text-[18px] font-semibold text-white leading-snug">{s.titulo}</h4>
                    <p className="mt-2.5 text-[14.5px] leading-relaxed text-white/55">{s.resumen}</p>
                    <ul className="mt-5 space-y-2.5">
                      {s.detalle.map((d, i) => (
                        <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-white/50">
                          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-[#7B5FBF]" />
                          <span>{conNegritas(d)}</span>
                        </li>
                      ))}
                    </ul>
                  </Tarjeta>
                ))}
              </div>
            </div>
          );
        })}
      </Seccion>

      {/* ── CLIENTES ────────────────────────────────────────────────────────── */}
      {/* Si la lista está vacía la sección NO se pinta: no queda un hueco ni un
          «próximamente». Ver la nota en `lib/sitio/contenido.ts`. */}
      {CLIENTES.length > 0 && (
        <Seccion id="clientes">
          <TituloSeccion
            etiqueta="Clientes"
            titulo="Empresas que trabajan con nosotros"
            centrado
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CLIENTES.map((c) => (
              <Tarjeta key={c.nombre}>
                <p className="text-[17px] font-semibold text-white">{c.nombre}</p>
                <p className="mt-1 text-[13px] text-[#a78bfa]">{c.sector}</p>
                <p className="mt-3 text-[14px] leading-relaxed text-white/50">{c.que}</p>
                {c.url && (
                  <a href={c.url} target="_blank" rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] text-white/60 hover:text-white transition-colors">
                    Visitar <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                )}
              </Tarjeta>
            ))}
          </div>
        </Seccion>
      )}

      {/* ── PRECIOS ─────────────────────────────────────────────────────────── */}
      <Seccion id="precios" tono="realce">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <TituloSeccion
            etiqueta="Precios"
            titulo="No publicamos tarifas, y hay un motivo"
            entradilla="No cuesta lo mismo conectar un número de WhatsApp con su conocimiento cargado que desarrollar un sistema de gestión a medida. Una tarifa fija para las dos cosas sería falsa en alguna de ellas."
          />
          <Tarjeta>
            <p className="text-[15.5px] font-semibold text-white">Cómo funciona</p>
            <ol className="mt-4 space-y-4">
              {[
                ['Creas tu cuenta', 'Gratis, y no te compromete a nada.'],
                ['Describes lo que necesitas', 'Desde tu espacio de cliente, dentro de la plataforma.'],
                ['Recibes la propuesta', 'Con su alcance y su precio, y queda registrada ahí para consultarla o revisarla.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3.5">
                  <span className="shrink-0 w-6 h-6 rounded-full border border-[#7B5FBF]/40 bg-[#7B5FBF]/10 text-[#c4b5fd] text-[12px] font-semibold inline-flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block text-[14.5px] font-medium text-white/90">{t}</span>
                    <span className="block mt-0.5 text-[13.5px] leading-relaxed text-white/45">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Tarjeta>
        </div>
      </Seccion>

      {/* ── PAPEL ANTE WHATSAPP ─────────────────────────────────────────────── */}
      <Seccion>
        <TituloSeccion
          etiqueta="Tratamiento de datos"
          titulo="Si contratas el agente de WhatsApp, tu número y tus conversaciones siguen siendo tuyos"
          entradilla="Es uno de los servicios, y el que más dudas genera. Así queda claro."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <Tarjeta>
            <p className="text-[15.5px] font-semibold text-white">Conservas tu cuenta</p>
            <p className="mt-2.5 text-[14.5px] leading-relaxed text-white/55">
              Conectas <strong className="text-white font-semibold">tu propio número</strong> de
              WhatsApp Business y mantienes su titularidad. Tu equipo sigue usando la aplicación
              en el teléfono y WhatsApp Web como siempre.
            </p>
          </Tarjeta>
          <Tarjeta>
            <p className="text-[15.5px] font-semibold text-white">Tú decides, nosotros ejecutamos</p>
            <p className="mt-2.5 text-[14.5px] leading-relaxed text-white/55">
              Sobre los datos de esas conversaciones tú eres el{' '}
              <strong className="text-white font-semibold">responsable</strong> y {SITIO.nombre} es{' '}
              <strong className="text-white font-semibold">encargado del tratamiento</strong>: los
              tratamos solo por cuenta tuya y siguiendo tus instrucciones.
            </p>
            <a href="/legal/whatsapp"
              className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] text-[#a78bfa] hover:text-white transition-colors">
              Leer la política del servicio <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </Tarjeta>
        </div>
      </Seccion>

      {/* ── ALTA ────────────────────────────────────────────────────────────── */}
      <Seccion id="crear-cuenta" tono="realce">
        <div className="max-w-2xl mx-auto text-center">
          <TituloSeccion titulo="Empieza por abrir tu cuenta" centrado
            entradilla="Tendrás tu espacio para pedir una cotización y ver su alcance y su precio, el estado de tus proyectos, tus tickets de soporte y tus facturas." />
          <div className="mt-9 flex justify-center">
            <AltaCliente />
          </div>
        </div>
      </Seccion>

      {/* Datos estructurados: le dan al buscador —y a quien revise— la lectura de que esto
          es una organización real con dirección, teléfono e identificador fiscal. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ProfessionalService',
            name: SITIO.nombre,
            legalName: SITIO.razonSocial,
            taxID: SITIO.ruc,
            url: `${SITIO.url}/negocio`,
            email: SITIO.correo,
            telephone: SITIO.telefonoPlano,
            address: {
              '@type': 'PostalAddress',
              streetAddress: SITIO.direccion,
              addressLocality: SITIO.ciudad,
              addressCountry: 'EC',
            },
            areaServed: 'EC',
            description:
              'Agentes de atención con inteligencia artificial en WhatsApp, plataformas de gestión a medida, automatización de la comunicación y facturación electrónica ante el SRI.',
            hasOfferCatalog: {
              '@type': 'OfferCatalog',
              name: 'Servicios',
              itemListElement: SERVICIOS.map((s) => ({
                '@type': 'Offer',
                itemOffered: { '@type': 'Service', name: s.titulo, description: s.resumen },
              })),
            },
          }),
        }}
      />
    </>
  );
}
