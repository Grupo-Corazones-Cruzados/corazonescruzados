/**
 * EL DETALLE DE UNA PUERTA — `/negocio/<id>`.
 *
 * Una sola plantilla para las cinco páginas. Todas pintan **la misma cabecera con las mismas
 * tarjetas**, con la suya marcada, y debajo su detalle. Así, pulsar una tarjeta no cambia de
 * escenario: cambia lo que hay debajo, y las otras cuatro puertas siguen a la vista.
 *
 * ── CÓMO SE COMPORTA ───────────────────────────────────────────────────────────
 * · **Se llega pulsando o escribiendo la URL**, indistintamente. No hay estado que
 *   sincronizar: la ruta ES el estado.
 * · **Al pulsar desde `/negocio`, la página baja sola hasta el detalle.** Lo hace el
 *   `#detalle` del enlace de la tarjeta, no JavaScript. El `scroll-mt-24` deja aire para que
 *   el título no quede tapado por la cabecera fija.
 * · **Aparece con una transición.** La clase `.aparece-detalle` (en `app/globals.css`) y un
 *   `key` con el `id`, que fuerza a React a volver a montar el bloque al cambiar de puerta —
 *   sin `key`, React reaprovecha el nodo y la animación no se repetiría.
 *
 * ── SEO ────────────────────────────────────────────────────────────────────────
 * · El `<h1>` de esta página es **el título del detalle**, no el nombre del grupo. Si las
 *   cinco compartieran encabezado, ninguna diría de qué va (por eso `CabeceraNegocio` baja
 *   su titular a `<p>` cuando hay una puerta abierta).
 * · `generateStaticParams` deja las cinco **prerenderizadas**: se sirven como HTML estático.
 * · Un tramo que no exista responde **404 de verdad**, no una página vacía.
 *
 * ⚠️ El contenido de cada página está **por escribir**: Fernando dio los títulos y dijo que
 * luego dictaría qué va dentro. Hasta entonces, cada una muestra su título y su frase.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { SITIO, ACCESOS, OG_IMAGEN, accesoPorId } from '@/lib/sitio/contenido';
import CabeceraNegocio from '@/components/sitio/CabeceraNegocio';
import { Contenedor } from '@/components/sitio/piezas';

type Props = { params: Promise<{ necesidad: string }> };

export function generateStaticParams() {
  return ACCESOS.map((a) => ({ necesidad: a.id }));
}

/** Un tramo inventado no debe existir: nada fuera de `ACCESOS` se renderiza. */
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { necesidad } = await params;
  const acceso = accesoPorId(necesidad);
  if (!acceso) return {};

  return {
    title: acceso.titulo,
    description: acceso.texto,
    alternates: { canonical: `/negocio/${acceso.id}` },
    openGraph: {
      title: `${acceso.titulo} — ${SITIO.nombre}`,
      description: acceso.texto,
      url: `${SITIO.url}/negocio/${acceso.id}`,
      type: 'website',
      locale: 'es_EC',
      images: [OG_IMAGEN],
    },
  };
}

export default async function DetalleNecesidadPage({ params }: Props) {
  const { necesidad } = await params;
  const acceso = accesoPorId(necesidad);
  if (!acceso) notFound();

  return (
    <>
      <CabeceraNegocio activa={acceso.id} />

      <section
        id="detalle"
        key={acceso.id}
        className="aparece-detalle scroll-mt-24 border-t border-white/[0.07] bg-white/[0.02] py-16 sm:py-20"
      >
        <Contenedor>
          <h1 className="text-[30px] sm:text-[40px] leading-[1.12] font-semibold text-white tracking-tight">
            {acceso.titulo}
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-white/60 max-w-3xl">
            {acceso.texto}
          </p>

          {acceso.enlaceExterno && (
            <a
              href={acceso.enlaceExterno.href}
              className="mt-8 inline-flex items-center justify-center gap-2 h-11 px-6 rounded-lg
                         bg-[#7B5FBF] hover:bg-[#6b4faf] text-white text-[15px] font-medium transition-colors"
            >
              {acceso.enlaceExterno.etiqueta} <ArrowRight className="w-4 h-4" />
            </a>
          )}
        </Contenedor>
      </section>

      {/* Migas de pan para el buscador: le dicen que esta página cuelga de `/negocio` y no
          es una URL suelta. Es lo que hace que en los resultados salga la ruta en vez de
          una dirección pelada. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: SITIO.nombre, item: SITIO.url },
              { '@type': 'ListItem', position: 2, name: 'Negocios', item: `${SITIO.url}/negocio` },
              {
                '@type': 'ListItem', position: 3, name: acceso.titulo,
                item: `${SITIO.url}/negocio/${acceso.id}`,
              },
            ],
          }),
        }}
      />
    </>
  );
}
