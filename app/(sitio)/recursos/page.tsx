/**
 * RECURSOS — el proyecto por dentro: por qué existe, cómo se organiza y en qué cree.
 *
 * ── EL REPARTO CON `/negocio` ──────────────────────────────────────────────────
 * `/negocio` dice **qué ofrecemos** —a clientes, a miembros y a candidatos—. Esta dice
 * **qué somos**, que es de donde sale todo lo anterior.
 *
 * Corrección de Fernando (2026-08-02): la primera versión del sitio presentaba al GCC como
 * proveedor de tecnología porque se escribió mirando a un revisor de Meta. Está del revés.
 * El GCC es **un proyecto de desarrollo humano**, y los servicios a clientes nacen de él.
 *
 * Server Component: en el HTML crudo, como el resto del sitio público.
 */

import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { SITIO } from '@/lib/sitio/contenido';
import {
  Contenedor, Seccion, TituloSeccion, Tarjeta, FondoHeroe, BotonPrimario, BotonSecundario,
} from '@/components/sitio/piezas';

export const metadata: Metadata = {
  title: 'El proyecto — desarrollo humano, condiciología y Modelo 4P',
  description:
    'Grupo Corazones Cruzados es un proyecto de desarrollo humano de Guayaquil, Ecuador: por qué existe, cómo se organiza con el Modelo 4P, qué es la Condiciología y qué significa el violeta.',
  keywords: [
    'desarrollo humano Ecuador', 'condiciología', 'Modelo 4P', 'proyecto colaborativo Guayaquil',
    'GCC World', 'crecimiento personal Guayaquil',
  ],
  alternates: { canonical: '/recursos' },
  openGraph: {
    title: `El proyecto — ${SITIO.nombre}`,
    description: 'Por qué existe, cómo se organiza y en qué cree un proyecto de desarrollo humano.',
    url: `${SITIO.url}/recursos`,
    type: 'website',
    locale: 'es_EC',
  },
};

const MOTIVOS = [
  {
    n: '01',
    titulo: 'Un corazón puede cruzar el mundo',
    texto:
      'Crecemos en entornos diferentes, pero los valores deben ser compartidos. Una organización debe representar la alianza única que existe en la humanidad. Y lo que más necesitamos es una razón para trabajar juntos por un futuro mejor.',
  },
  {
    n: '02',
    titulo: 'Una realidad imposible, contra una disciplina centralizada',
    texto:
      'Los jóvenes heredan las consecuencias de adultos que ignoraron las problemáticas sociales y prefirieron creerlas imposibles antes que intentarlo. La forma de confrontar esa realidad imposible es una disciplina centralizada: un sueño único y compartido, trabajado a diario.',
  },
  {
    n: '03',
    titulo: 'El poder se construye, no se decide',
    texto:
      'Tener acceso a recursos no ganados es poder ilegítimo. El poder se construye y se obtiene cuando la gente reconoce a su líder, no cuando elige entre opciones que no la representan. Quien logra movilizar a las personas es líder nato.',
  },
];

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

const VALORES = [
  'Determinación', 'Coraje', 'Pureza', 'Fe', 'Paciencia',
  'Seriedad', 'Espontaneidad', 'Autonomía', 'Empatía',
];

const CONDICIOLOGIA = [
  ['Reconocer', 'Identificar las condiciones que intervienen.'],
  ['Controlar', 'Establecer control sobre ellas.'],
  ['Predecir', 'Anticipar cómo se comportarán.'],
  ['Experimentar', 'Probar sobre ellas.'],
  ['Convertir', 'Transformarlas.'],
  ['Cambiar', 'Cambiar la condición, y con ella el resultado.'],
];

export default function ProyectoPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <FondoHeroe />
        <Contenedor className="relative py-24 sm:py-32 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#7B5FBF]/30 bg-[#7B5FBF]/10 px-3.5 py-1.5 text-[12.5px] text-[#c4b5fd]">
            El proyecto
          </p>
          <h1 className="mt-7 text-[38px] sm:text-[56px] leading-[1.08] font-semibold text-white tracking-tight max-w-3xl mx-auto">
            Un proyecto de
            <br className="hidden sm:block" /> desarrollo humano
          </h1>
          <p className="mt-6 text-[17px] sm:text-[18.5px] leading-relaxed text-white/55 max-w-2xl mx-auto">
            {SITIO.nombre} desarrolla proyectos, personas y sistemas bajo una misma
            filosofía. Todo lo que ofrecemos —también a nuestros clientes— sale de aquí.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <BotonPrimario href="/">Entrar en GCC World</BotonPrimario>
            <BotonSecundario href="/negocio#servicios">Ver todo lo que ofrecemos</BotonSecundario>
          </div>
        </Contenedor>
      </section>

      {/* ── POR QUÉ ─────────────────────────────────────────────────────────── */}
      <Seccion id="motivos" tono="realce">
        <TituloSeccion
          etiqueta="Por qué existe"
          titulo="Tres motivos"
          entradilla="No son eslóganes: son las razones que dan origen al proyecto y de las que sale todo lo demás."
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {MOTIVOS.map((m) => (
            <Tarjeta key={m.n}>
              <span className="text-[13px] font-semibold tracking-[0.14em] text-[#7B5FBF]">{m.n}</span>
              <h3 className="mt-3 text-[18px] font-semibold text-white leading-snug">{m.titulo}</h3>
              <p className="mt-3 text-[14.5px] leading-relaxed text-white/50">{m.texto}</p>
            </Tarjeta>
          ))}
        </div>
      </Seccion>

      {/* ── CONDICIOLOGÍA ───────────────────────────────────────────────────── */}
      <Seccion id="condiciologia">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <TituloSeccion
            etiqueta="El método"
            titulo="Condiciología"
            entradilla="Una condición es el conjunto de factores que se manifiestan en una instancia de la realidad. Lo que no se ha estudiado no es una condición: se convierte en una cuando se reconoce por qué ocurrió. Se aplica a personas, a proyectos y a ideas."
          />
          <Tarjeta>
            <p className="text-[15.5px] font-semibold text-white">Los seis pasos</p>
            <ol className="mt-5 space-y-3.5">
              {CONDICIOLOGIA.map(([n, d], i) => (
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
        </div>
      </Seccion>

      {/* ── MODELO 4P ───────────────────────────────────────────────────────── */}
      <Seccion id="organizacion" tono="realce">
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

      {/* ── VALORES ─────────────────────────────────────────────────────────── */}
      <Seccion id="valores">
        <TituloSeccion
          etiqueta="Valores"
          titulo="Nueve, y no son decorativos"
          entradilla="Candidatos y miembros representan lo que el grupo es. Por eso los valores no son un cartel en la pared: son el criterio con el que se entra y con el que se sigue."
        />
        <div className="mt-10 flex flex-wrap gap-2.5">
          {VALORES.map((v) => (
            <span key={v}
              className="inline-flex items-center rounded-full border border-white/[0.12] bg-white/[0.03] px-4 py-2 text-[14px] text-white/70">
              {v}
            </span>
          ))}
        </div>
      </Seccion>

      {/* ── VIOLETA ─────────────────────────────────────────────────────────── */}
      <Seccion id="violeta" tono="realce">
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
            entradilla="La postulación se hace desde la portada. Si te eligen, recibes acceso a la plataforma, tu pulsera y tu pizarra de visión personal." />
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
            '@type': 'AboutPage',
            mainEntity: {
              '@type': 'Organization',
              name: SITIO.nombre,
              legalName: SITIO.razonSocial,
              taxID: SITIO.ruc,
              url: SITIO.url,
              description:
                'Proyecto de desarrollo humano que desarrolla proyectos, personas y sistemas bajo una misma filosofía.',
              address: {
                '@type': 'PostalAddress',
                streetAddress: SITIO.direccion,
                addressLocality: SITIO.ciudad,
                addressCountry: 'EC',
              },
            },
          }),
        }}
      />
    </>
  );
}
