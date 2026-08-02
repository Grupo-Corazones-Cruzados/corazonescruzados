/**
 * RECURSOS — qué ofrece el proyecto a las personas, no a las empresas.
 *
 * Es la otra mitad de `/negocio`: allí se habla a empresas que contratan un servicio, aquí
 * a personas que quieren participar, crecer o simplemente entender qué es esto.
 *
 * Server Component: en el HTML crudo, como el resto del sitio público.
 */

import type { Metadata } from 'next';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { SITIO, RECURSOS } from '@/lib/sitio/contenido';
import {
  Contenedor, Seccion, TituloSeccion, Tarjeta, IconoCuadro, FondoHeroe,
  BotonPrimario, BotonSecundario, conNegritas,
} from '@/components/sitio/piezas';

export const metadata: Metadata = {
  title: 'Recursos — desarrollo humano, proyectos y el videojuego',
  description:
    'Grupo Corazones Cruzados ofrece una plataforma de desarrollo humano, participación en proyectos, un marketplace de talento y GCC World, un videojuego 2D donde el proyecto se explica jugando.',
  keywords: [
    'desarrollo humano Ecuador', 'condiciología', 'proyecto colaborativo Guayaquil',
    'GCC World videojuego', 'participar en proyectos', 'marketplace de talento',
  ],
  alternates: { canonical: '/recursos' },
  openGraph: {
    title: `Recursos — ${SITIO.nombre}`,
    description: 'Desarrollo humano, participación en proyectos, marketplace de talento y un videojuego.',
    url: `${SITIO.url}/recursos`,
    type: 'website',
    locale: 'es_EC',
  },
};

/** Los cuatro pisos y los cuatro pasos, que es cómo se organiza todo el grupo. */
const PISOS = [
  ['Global', 'Decide sobre los sistemas fundamentales de un paso.'],
  ['Pilar', 'Crea y gestiona los proyectos aprobados.'],
  ['Controlador', 'Asigna las tareas del desarrollo.'],
  ['Colaborador', 'Ejecuta las tareas asignadas.'],
];
const PASOS = [
  ['Fundamentación', 'Respalda el porqué y la base de conocimiento.'],
  ['Creación', 'Crea el planteamiento ya fundamentado.'],
  ['Implementación', 'Lo implanta dentro de la organización.'],
  ['Gestión', 'Publicación, marketing y monetización.'],
];

export default function RecursosPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <FondoHeroe />
        <Contenedor className="relative py-24 sm:py-32 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#7B5FBF]/30 bg-[#7B5FBF]/10 px-3.5 py-1.5 text-[12.5px] text-[#c4b5fd]">
            Un proyecto de desarrollo humano
          </p>
          <h1 className="mt-7 text-[38px] sm:text-[56px] leading-[1.08] font-semibold text-white tracking-tight max-w-3xl mx-auto">
            Lo que ofrecemos a
            <br className="hidden sm:block" /> las personas
          </h1>
          <p className="mt-6 text-[17px] sm:text-[18.5px] leading-relaxed text-white/55 max-w-2xl mx-auto">
            {SITIO.nombre} no es solo una empresa de software. Es una organización que
            desarrolla proyectos, personas y sistemas bajo una misma filosofía.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <BotonPrimario href="/">Entrar en GCC World</BotonPrimario>
            <BotonSecundario href="#organizacion">Cómo nos organizamos</BotonSecundario>
          </div>
        </Contenedor>
      </section>

      <Seccion tono="realce">
        <TituloSeccion
          etiqueta="Recursos"
          titulo="Cuatro formas de participar"
          entradilla="Cada una tiene su público. No hay que pasar por todas."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {RECURSOS.map((r) => (
            <Tarjeta key={r.id} id={r.id}>
              <IconoCuadro nombre={r.icono} />
              <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#a78bfa]">{r.para}</p>
              <h3 className="mt-1.5 text-[19px] font-semibold text-white leading-snug">{r.titulo}</h3>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-white/55">{r.resumen}</p>
              <ul className="mt-5 space-y-2.5">
                {r.detalle.map((d, i) => (
                  <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-white/50">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-[#7B5FBF]" />
                    <span>{conNegritas(d)}</span>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          ))}
        </div>
      </Seccion>

      {/* ── EL MODELO 4P ────────────────────────────────────────────────────── */}
      <Seccion id="organizacion">
        <TituloSeccion
          etiqueta="Modelo 4P"
          titulo="Cuatro pisos y cuatro pasos"
          entradilla="Cada uno de los cuatro pasos contiene los cuatro pisos: cada piso resuelve con su rol la necesidad de ese paso para hacer avanzar el proyecto."
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {[['Los 4 pisos', 'Los roles. Siempre expertos en su área.', PISOS],
            ['Los 4 pasos', 'Las etapas, en este orden.', PASOS]].map(([titulo, sub, filas]) => (
            <Tarjeta key={titulo as string}>
              <p className="text-[15.5px] font-semibold text-white">{titulo as string}</p>
              <p className="mt-1 text-[13.5px] text-white/45">{sub as string}</p>
              <ol className="mt-5 space-y-3.5">
                {(filas as string[][]).map(([n, d], i) => (
                  <li key={n} className="flex gap-3.5">
                    <span className="shrink-0 w-6 h-6 rounded-full border border-[#7B5FBF]/40 bg-[#7B5FBF]/10 text-[#c4b5fd] text-[12px] font-semibold inline-flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span>
                      <span className="block text-[14.5px] font-medium text-white/90">{n}</span>
                      <span className="block mt-0.5 text-[13.5px] leading-relaxed text-white/45">{d}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Tarjeta>
          ))}
        </div>
      </Seccion>

      {/* ── VIOLETA ─────────────────────────────────────────────────────────── */}
      <Seccion tono="realce">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <TituloSeccion
            etiqueta="Violeta"
            titulo="Por qué el violeta"
            entradilla="El violeta resulta de combinar dos colores distintos. Es decir: une lo distinto en uno solo para alcanzar algo más grande. Es el color que representa al grupo, y está en todos sus proyectos."
          />
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {[
              ['Marca', 'El violeta está en todos los proyectos del grupo, sin importar de quién sean, para que se reconozcan como parte de él.'],
              ['Filosofía', 'Cada persona debe sentirse afín a ese sentimiento de unión. No es obligatorio sentirlo, pero sí creer en él.'],
              ['Acción', 'Ayudar y esperar ser ayudado. El apoyo de hoy se devuelve mañana, y el conocimiento se comparte entre proyectos.'],
            ].map(([t, d]) => (
              <Tarjeta key={t} className="!p-5">
                <p className="text-[14.5px] font-semibold text-white">{t}</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/50">{d}</p>
              </Tarjeta>
            ))}
          </div>
        </div>
      </Seccion>

      <Seccion>
        <div className="max-w-2xl mx-auto text-center">
          <TituloSeccion titulo="¿Quieres formar parte?" centrado
            entradilla="La postulación se hace desde la portada. Si te eligen, recibes acceso a la plataforma y a las herramientas del grupo." />
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <BotonPrimario href="/">Postularme <ArrowRight className="w-4 h-4" /></BotonPrimario>
            <BotonSecundario href="/contacto">Hablar con alguien</BotonSecundario>
          </div>
        </div>
      </Seccion>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Recursos de Grupo Corazones Cruzados',
            itemListElement: RECURSOS.map((r, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              item: { '@type': 'Service', name: r.titulo, description: r.resumen, provider: { '@type': 'Organization', name: SITIO.nombre } },
            })),
          }),
        }}
      />
    </>
  );
}
