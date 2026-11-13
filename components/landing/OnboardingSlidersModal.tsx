'use client';

/**
 * OnboardingSlidersModal
 * -----------------------
 * Modal de bienvenida (estilo "deslizados"/carrusel) que se muestra a los
 * visitantes NUEVOS al pulsar "Entrar" en la landing, ANTES de ingresar al
 * juego/mundo. Su objetivo es dar a conocer el proyecto (Grupo Corazones
 * Cruzados) en una serie de sliders informativos y, al final, recoger la
 * postulación del candidato con la pregunta:
 *   "¿Por qué quieres ser candidato de este proyecto?"
 *
 * Es data-driven: la lista `SLIDES` crecerá hasta 8 sliders. Por ahora están
 * desarrollados los 7 primeros; el 8.º se agregará cuando el usuario aporte su
 * contenido.
 *
 * DISEÑO (2026-07-25): usa el **diseño del dashboard** (Fluent) en vez del pixelart
 * de la landing, en su variante **MODO OSCURO** (pedido del usuario). La estructura
 * es la del patrón "Explorador Azure": **rail de pasos** (izquierda, con iconos
 * lucide y marca de completado) · **contenido** (derecha, con cabecera, cuerpo con
 * scroll, franja de aceptación y footer de navegación). El overlay lleva
 * `corp dark corp-overlay`: isla de tokens Fluent oscuros (`.corp.dark`) sin fondo
 * de página (ver globals.css). Para pasarlo a claro, quitar la clase `dark`.
 *
 * FUENTE ÚNICA DE ESTILO de este modal: las constantes del final del archivo
 * (`pStyle`, `cardBase`, `cardTitle`, `cardDesc`,
 * …) — todas apuntan a los **tokens** `--color-digi-*` / `--color-accent*`,
 * así que cambiarlas (o cambiar los tokens de `.corp`) retematiza los 8 pasos y
 * funciona igual en claro y oscuro. NO usar hex crudos en los sliders.
 */

import Captcha from '@/components/landing/Captcha';
import { horaDeReanudacion, useEstadoRegistro } from '@/components/landing/estadoRegistro';
import { AuthDialog, BotonAuth } from '@/components/landing/AuthSurface';
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Modelo4P, { PasosCondiciologia, ReglasModelo4P } from '@/components/landing/Modelo4P';
import { HERRAMIENTAS, HERRAMIENTAS_INTRO, MODELO_PROYECTO, MODELO_4P_INTRO, trozosNegrita } from '@/lib/sitio/modeloGcc';
import {
  AlertTriangle,
  Clock,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  Crown,
  FlaskConical,
  Flag,
  Globe2,
  Mountain,
  ShieldCheck,
  Sparkles,
  Sprout,
  Users,
  Workflow,
  ChevronDown,
  Gavel,
  Grid3x3,
  Heart,
  Info,
  Layers3,
  Lock,
  Send,
  TrendingUp,
  Wrench,
  X,
} from 'lucide-react';
import { tituloDePaso, type PasoPostulacionId } from '@/lib/sitio/pasosPostulacion';
import { sonarInterruptor } from '@/lib/sitio/sonidoSeleccion';
import LogoGirando from '@/components/ui/LogoGirando';
import MiembrosGaleria from '@/components/landing/MiembrosGaleria';
import AnimacionPaso from '@/components/landing/AnimacionPaso';
import PixelInput from '@/components/ui/PixelInput';
import BotonCerrar from '@/components/ui/BotonCerrar';

/** Los dos nombres y los dos apellidos: de ellos sale el correo corporativo al aceptarlo (2026-11-12). */
export type NombresPostulante = { primerNombre: string; segundoNombre: string; primerApellido: string; segundoApellido: string };

export type PostulacionData = NombresPostulante & {
  email: string;
  reason: string;
  /** Consentimiento OPCIONAL para recibir publicidad/novedades del proyecto. */
  marketing: boolean;
  /** La solución del captcha «No soy un robot» (ALTCHA, 2026-10-29). */
  altcha: string;
};

type IconType = React.ComponentType<{ className?: string }>;

/** Un paso del formulario (ver `PasoVentana`). */
type Slide = PasoVentana;

/* ------------------------------------------------------------------ */
/* Slider 1 — Modelo de Grupo (Modelo 4P)                             */
/* ------------------------------------------------------------------ */

function SlideModelo() {
  return (
    <div data-cuento-hijos style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
      <p style={pStyle}><Negritas texto={MODELO_PROYECTO} /></p>
      {/* Quiénes ya forman parte (Fernando, 2026-11-12). */}
      <MiembrosGaleria />
    </div>
  );
}

/** El Modelo 4P en su propio paso (Fernando, 2026-11-11): su entrada, la tabla y sus reglas. */
function SlideModelo4P() {
  return (
    <div data-cuento-hijos style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <p style={pStyle}><Negritas texto={MODELO_4P_INTRO} /></p>

      <Modelo4P />

      <ReglasModelo4P />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slider 2 — Herramientas                                            */
/* ------------------------------------------------------------------ */

// Textos de Fernando (2026-10-29), literales, en `lib/sitio/modeloGcc.ts`: los comparten las
// página Candidatos. La Metodología lleva su recorrido tras el primer párrafo.
// Las animaciones de Blender de cada herramienta (2026-11-12): escenas en `scripts/animaciones/<id>.py`.
const ANIMACION_HERRAMIENTA: Record<string, { id: string; alt: string }> = {
  'Metodología Condiciológica': { id: 'herramienta-metodologia', alt: 'Seis pasos en ciclo, recorridos por un pulso de luz' },
  'Sistema de Control Psicosocial': { id: 'herramienta-control', alt: 'Una ciudad bajo una cúpula que recoge las señales de sus casas' },
  'Proyecto Centralizado': { id: 'herramienta-centralizado', alt: 'Las áreas de un negocio unidas a un centro por el que va y viene el trabajo' },
  Violeta: { id: 'herramienta-violeta', alt: 'El logo del grupo envuelto en aros de luz violeta' },
};

const TOOLS: AccordionItem[] = HERRAMIENTAS.map((h) => ({
  name: h.nombre,
  summary: h.resumen,
  body: () => {
    const anim = ANIMACION_HERRAMIENTA[h.nombre];
    return (
      <>
        {h.parrafos.map((texto, i) => (
          <Fragment key={i}>
            <p style={pStyle}><Negritas texto={texto} /></p>
            {h.conPasos && i === 0 && <PasosCondiciologia />}
          </Fragment>
        ))}
        {anim && <AnimacionPaso src={`/animaciones/${anim.id}.webp`} alt={anim.alt} />}
      </>
    );
  },
}));

/** Los `**dobles asteriscos**` de los textos compartidos, en la negrita del formulario. */
function Negritas({ texto }: { texto: string }) {
  return (
    <>
      {trozosNegrita(texto).map((x, i) => (x.negrita ? <strong key={i} style={strong}>{x.t}</strong> : <Fragment key={i}>{x.t}</Fragment>))}
    </>
  );
}

function SlideHerramientas() {
  return (
    <div data-cuento-hijos style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={pStyle}><Negritas texto={HERRAMIENTAS_INTRO} /></p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slider 3 — Motivos                                                 */
/* ------------------------------------------------------------------ */

const MOTIVOS: AccordionItem[] = [
  {
    name: 'Un corazón puede cruzar el mundo',
    summary: 'Los valores que de verdad importan son los mismos en todo el mundo.',
    body: () => (
      <>
        <p style={pStyle}>
          Vivimos en sociedades separadas por fronteras y representadas por símbolos que, con el
          tiempo, nos han enseñado a mirarnos como distintos. Es cierto que crecemos en entornos
          diferentes, pero los valores que de verdad importan son los mismos en todas partes.
        </p>
        {/* Texto de Fernando (editor de textos, 2026-11-10), literal. */}
        <p style={pStyle}>
          Creemos que un corazón  y una organización puede representar esa{' '}
          <strong style={strong}>alianza que ya existe</strong>, silenciosa, en el fondo de la
          humanidad. El Grupo Corazones Cruzados nace para unir al mundo a través de sus valores y
          de un sistema que represente lo que de verdad necesitamos. Y lo que más necesitamos hoy
          es una <strong style={strong}>razón para trabajar juntos</strong> por un futuro mejor.
        </p>
        {/* Blender (2026-11-12): el logo cruza el mundo y une los puntos. Escena: scripts/animaciones/motivos-1.py */}
        <AnimacionPaso
          src="/animaciones/motivos-1.webp"
          alt="El logo del Grupo Corazones Cruzados cruza el mundo y une sus puntos"
        />
      </>
    ),
  },
  {
    name: 'Una realidad imposible, frente a una disciplina centralizada',
    summary: 'Frente a lo que parece imposible, un sueño compartido y disciplinado.',
    body: () => (
      <>
        <p style={pStyle}>
          Sueño con un futuro en el que la humanidad trabaje unida por objetivos más grandes; un
          mundo donde las próximas generaciones no tengan que crecer entre la corrupción y las
          mafias que dañan, sin reparo, a quienes tienen el potencial de cambiarlo todo.
        </p>
        <p style={pStyle}>
          Demasiadas veces los más jóvenes heredamos las consecuencias de problemas que otros
          prefirieron ignorar, convencidos de que era más fácil llamarlos imposibles que intentar
          resolverlos. Esa <strong style={strong}>realidad imposible</strong> donde los valores se
          unen y la organización se fortalece por encima de la separación, solo puede cumplirse
          mediante una <strong style={strong}>disciplina centralizada</strong> en trabajar cada día por
          resolver las problemáticas sociales paso a paso hasta limpiar nuestras calles y el mundo,
          de aquello que está mal.
        </p>
        <AnimacionPaso src="/animaciones/motivos-2.webp" alt="Una luz sube una escalera paso a paso y limpia los problemas hasta llegar al logo" />
      </>
    ),
  },
  {
    // Texto de Fernando (editor de textos, 2026-11-11), literal; quitó el cuarto párrafo.
    name: 'El poder por convicción, y no por decisión',
    summary: 'El liderazgo legítimo se gana con acciones, no con votos.',
    body: () => (
      <>
        <p style={pStyle}>
          Crecimos creyendo que la democracia, a través del voto, era la mejor forma de elegir a
          quienes nos gobiernan, pero con demasiada frecuencia esa forma ha terminado en corrupción
          y en entregar el poder a quien no se lo ha merecido, creando una clase política que es
          capaz de todo por convencer a las masas, mientras ignoramos todas las incompetencias que
          éstos tienen para transformar la realidad que vivimos.
        </p>
        <p style={pStyle}>
          Debemos cambiar lo que siempre se ha hecho, empezando por el poder, ya que éste no se debe
          entregar ni por convencimiento, ni por retórica. Los líderes se deben ganar su posición
          mediante lo que realmente son capaces de <strong style={strong}>hacer</strong> y{' '}
          <strong style={strong}>construir</strong> según sus logros, su propósito, y el impacto
          real que han tenido en la sociedad sin depender de los recursos de otros. &quot;Porque sino
          puede cambiar su vida, peor va a poder cambiar la vida de otras personas&quot;. Así que
          tener o no tener recursos, solo es una excusa y una mentira que no podemos volver a
          aceptar.
        </p>
        <p style={pStyle}>
          Hoy vivimos algo completamente diferente e incoherente con lo que necesitamos, porque
          nuestros gobernantes nacen de cúpula de poder que se mueve e interesa por la política con
          el fin de obtener más poder. El pueblo a causa de la incompetencia natural que vivimos,
          aceptamos y nos conformamos  cada vez más con lo poco que nos dan, sin tener manera de
          tomar acciones inmediatas para cambiar lo que nos afecta. Un verdadero líder no necesita
          una posición para imponerse, porque alguien que es capaz de movilizar a personas, y
          habitar su corazón mediante su ejemplo y sacrificio; entonces ése es un líder nato; caso
          contrario, simplemente no lo es.
        </p>
        <AnimacionPaso src="/animaciones/motivos-3.webp" alt="El logo en el centro y anillos de personas que giran unidas a él" />
      </>
    ),
  },
];

const MOTIVOS_ENTRADA = [
  '¡Cuando era pequeño me encantaba soñar! Soñar, soñar y solo soñar... ¡cuánto me encantaba soñar! Para mí, el sueño era la cuna de los retorcidos, el lugar más cálido, el lugar más cómodo, el mundo del cual jamás quería escapar.',
  'Pero la realidad siempre volvía en forma de responsabilidad. Y vivir se convirtió en recordar aquello que no me gustaba y que sentía que no podía cambiar. Esa confrontación entre mi sueño y la realidad es lo que he revivido tantas veces, arrastrando una frustración intolerable que hunde mi pecho como si no tuviese otra forma de estar.',
  '¡Porque soy incapaz de aceptar este mundo! Y me aferro aquí, usando la promesa de aquel día que en profundo dolor, decidí dejar de soñar para empezar a vivir una realidad, dispuesto a cambiar todo lo que he visto y que jamás voy a olvidar.',
  'No tengo otra opción. Prefiero morir antes que seguir observando todo lo que está mal en este mundo. Así que esto es todo lo que tengo, lo que me mueve y por lo que estoy dispuesto a darlo todo. No voy a aceptar jamás un futuro en el que mis hijos vivan en un mundo diferente al que quiero construir. No importa lo difícil o imposible que parezca; voy a cambiar este mundo, aunque me cueste la vida.',
];

function SlideMotivos() {
  return (
    <div data-cuento-hijos style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Texto de Fernando (2026-11-01, 2.ª versión), literal y en sus cuatro párrafos. Sustituye a
          la entrada genérica («Más allá del cómo, importa el porqué…»). */}
      {MOTIVOS_ENTRADA.map((t, i) => <p key={i} style={pStyle}>{t}</p>)}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slider 4 — Onboarding (3 reglas)                                   */
/* ------------------------------------------------------------------ */

// Cada valor se asocia a un compromiso (el "no" que lo encarna).
const VALORES: { valor: string; compromiso: string }[] = [
  { valor: 'Determinación', compromiso: 'Insiste hasta el cansancio, o levántate y no te rindas.' },
  { valor: 'Coraje', compromiso: 'Confronta todo lo que está mal, y descubre un motivo para superar tus miedos.' },
  { valor: 'Pureza', compromiso: 'Nunca olvides tus raíces y quien realmente eres.' },
  { valor: 'Fe', compromiso: 'Confía en ti, y convierte en real esos sueños que pueden parecer imposibles.' },
  { valor: 'Paciencia', compromiso: 'Hay tantas cosas que puedes valorar en esta vida, antes de que te dejes llevar por la desesperación.' },
  {
    valor: 'Seriedad',
    compromiso: 'Prioriza tus necesidades, y céntrate en hacerte responsable para aprender a solucionar tus problemas.',
  },
  { valor: 'Espontaneidad', compromiso: 'Explora lo que sientes, y sin arrepentimientos a equivocarte.' },
  { valor: 'Autonomía', compromiso: 'Tu futuro, depende únicamente de ti.' },
  { valor: 'Empatía', compromiso: 'Recuerda valorar el corazón de quienes sí valen la pena.' },
];

const REGLAS: AccordionItem[] = [
  {
    name: 'Regla #1 · ¿Quiénes somos?',
    summary: 'Representamos lo que somos.',
    body: () => (
      <>
        {/* Texto de Fernando (editor de textos, 2026-11-11), literal. */}
        <p style={pStyle}>
          El proyecto del Grupo Corazones Cruzados es una organización que incluye en sus filas, solo
          candidatos y miembros que tienen la prospección a representarnos. Aquellos que caigan de
          delincuentes, mentirosos, o realicen cualquier mala intención u acción por mínima que sea, o
          incluso olviden trabajar y sostener en sus relaciones sociales y en su vida diaria nuestros
          valores organizacionales, serán des-agrupados del proyecto.
        </p>
        <p style={pStyle}>
          A continuación te presento los valores que deberás trabajar para representar nuestra
          organización:
        </p>
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2 my-3 text-left">
          {VALORES.map((v) => (
            <div key={v.valor} className="flex items-start gap-2.5">
              <span
                aria-hidden
                className="shrink-0 mt-[7px] w-1.5 h-1.5 rounded-full bg-accent"
              />
              <span style={pStyle}>
                <strong style={strong}>{v.valor}:</strong> {v.compromiso}
              </span>
            </div>
          ))}
        </div>
        <AnimacionPaso src="/animaciones/regla-1.webp" alt="Nueve valores alrededor del logo que se encienden uno a uno" />
      </>
    ),
  },
  {
    name: 'Regla 2 · Comandos',
    summary: 'Los comandos de la estrategia organizacional se cumplen.',
    body: () => (
      <>
        <p style={pStyle}>
          La gobernanza del Grupo Corazones Cruzados{' '}
          <strong style={strong}>escucha, decide y analiza correcciones</strong> por cada estrategia
          organizacional que se implementa  con el fin de progresar, y enfrentar una problemática.
        </p>
        <p style={pStyle}>
          Antes de decidirse por una estrategia organizacional, el líder tuvo que escuchar las
          propuestas y discusiones asociadas a esa problemática para que según las alternativas
          posibles, se desarrolle un  mapa visual del proyecto, y luego se presente la opción más
          viable a ejecutar y medir sus efectos.
        </p>
        <p style={pStyle}>
          La relación entre el líder, los miembros o los candidatos se sostiene principalmente a
          través de los comandos que se solicitan ejecutar para cumplir el planteamiento de la
          estrategia organizacional decidida.
        </p>
        <p style={pStyle}>
          Cualquier miembro o candidato que no se acata o afecta el cálculo de la estrategia, queda
          fuera del proyecto en el acto, ya que los comandos se ejecutan sin cuestionamiento, y solo
          se analizan y corrigen durante la etapa de corrección en donde todos sin excepción tienen la
          obligación de votar y participar.
        </p>
        <AnimacionPaso src="/animaciones/regla-2.webp" alt="Desde el logo bajan los comandos a los miembros y sube la corrección" />
      </>
    ),
  },
  {
    name: 'Regla 3 · Opciones de crecimiento',
    summary: 'La confianza se entrega, y no se traiciona.',
    body: () => (
      <>
        <p style={pStyle}>
          El Grupo Corazones Cruzados ofrece un sistema de &quot;Desarrollo Humano&quot; que permite
          impulsar a los candidatos y miembros de la organización, y acceder a oportunidades para
          avanzar en su progreso sin excepciones ni condiciones.
        </p>
        <p style={pStyle}>
          La confianza que ofrecemos y el acceso a mayores recursos y beneficios, depende de la{' '}
          <strong style={strong}>prospección</strong> y de los{' '}
          <strong style={strong}>resultados</strong> o logros obtenidos. Esa confianza se entrega{' '}
          <strong style={strong}>una sola vez</strong>, y si una opción de crecimiento se usa de forma
          abusiva o para fines distintos a los acordados, la decisión es la destitución.
        </p>
        <p style={pStyle}>
          Para esta organización, la confianza no se recupera tras una traición, además que nosotros
          abordamos todas las necesidades aunque no sean de interés personal o progreso, así que no
          hay excusa para mentir o abusar de los recursos. Les pedimos mantener siempre las buenas
          intenciones, y las opciones de crecimiento llegarán.
        </p>
        <AnimacionPaso src="/animaciones/regla-3.webp" alt="Un árbol por el que sube la energía hasta abrir sus brotes" />
      </>
    ),
  },
];

function SlideOnboarding() {
  return (
    <div data-cuento-hijos style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={pStyle}>Reglas del proyecto para todos los Candidatos y Miembros</p>
      <Aviso tono="peligro" titulo="Advertencia">
        Cualquier intento de faltar a una sola de estas reglas implica la{' '}
        <strong style={strong}>destitución</strong> del candidato y aplica igual a todos
        los miembros en cualquier rol. Quien es destituido del proyecto no tiene otra oportunidad para
        unirse; solo los fallos <em>no intencionales</em> se evalúan y pueden no llevar a la destitución.
      </Aviso>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slider 5 — Método de crecimiento (pirámide jerárquica)            */
/* ------------------------------------------------------------------ */

// Textos de Fernando (editor de textos, 2026-11-11), literales; cada nivel puede tener varios párrafos.
const CRECIMIENTO: { n: number; title: string; tag: string; text: () => React.ReactNode }[] = [
  {
    n: 1,
    title: 'Talento',
    tag: 'El origen de todo',
    text: () => (
      <>
        <p style={pStyle}>
          El talento es justo lo que hace de este proyecto una realidad, cuando una persona puede traer
          a este mundo un valor agregado con su esfuerzo y capacidad, se convierte en una herramienta de
          altísimo valor para el progreso del proyecto que lo requiera.
        </p>
        <p style={pStyle}>
          Nosotros queremos descubrir ese talento, y generar oportunidades en donde podamos sacar
          beneficios por posicionarte dentro de una estrategia organizacional, donde cada movimiento va a
          desarrollar tu talento y causar mayor interés en nuevos clientes que deseen tus servicios.
        </p>
      </>
    ),
  },
  {
    n: 2,
    title: 'Valores',
    tag: 'Fortaleza ante el mundo',
    text: () => (
      <>
        <p style={pStyle}>
          La confianza de los clientes se mide en tus valores, cuando una persona no sostiene sus
          valores puede tomar un requerimiento como algo sin importancia, y limitando incluso el
          desarrollo de su talento; debido a eso, exigimos los valores organizacionales ya que son la
          fuente principal para obtener oportunidades.
        </p>
        <p style={pStyle}>
          La lógica es la siguiente, según al nivel de confianza que tenga un cliente, se arriesga a
          invertir su tiempo y dinero en cualquiera de nuestros servicios, talentos, y productos que
          ofrecemos. Si demostramos alta calidad humana sin importar el tipo de cliente o el lugar en
          donde estemos, nos podemos convertir en una organización ideal para encontrar personas que
          puedan trabajar en un proyecto en donde van a representar bien lo que estamos dispuestos a
          hacer por solucionar un problema.
        </p>
      </>
    ),
  },
  {
    n: 3,
    title: 'Dimensiones de desarrollo humano',
    tag: 'Laboral · Corporal · Social · Mental',
    text: () => (
      <>
        <p style={pStyle}>
          Evaluamos las cuatro dimensiones del desarrollo humano ({' '}
          <strong style={strong}>laboral, corporal, social y mental</strong> ), cada una representa
          un conjunto de problemas que al no ser abordados, aumentan el riesgo de tomar malas
          decisiones, intenciones y malos comportamientos que terminen perjudicando a uno mismo, y a
          los demás.
        </p>
        <p style={pStyle}>
          Estos riesgos se sostienen mediante los valores, y cuando el talento es muy competente,
          aumenta las posibilidades de resolver sus problemas haciendo uso de los recursos que puede
          obtener. Sin embargo existen problemas que se deben trabajar mediante estrategias
          personalizadas que logren mejorar la calidad de vida. Si estos problemas son abordados
          entonces el sujeto impulsará sus valores y talento en su entorno de trabajo.
        </p>
      </>
    ),
  },
  {
    n: 4,
    title: 'Red de apoyo',
    tag: 'El complemento vital',
    text: () => (
      <>
        <p style={pStyle}>
          En la actualidad, cuando las dimensiones de desarrollo humano se ven muy afectadas por
          problemas difíciles de resolver, la red de apoyo suele ser un factor vital para impulsar la
          solución de problemas, además de ser un buen referente para sostener los valores, y así
          obtener fuerzas para buscar oportunidades que, en caso de tener suerte, te permiten
          aprovechar tu talento y mejorar tu situación.
        </p>
        <p style={pStyle}>
          Sin embargo para esta organización este factor vital tiene menor importancia porque los
          valores organizacionales te enseñan que no necesitas una red de apoyo para abordar tus
          problemas, sino que su importancia debe ser para nosotros un complemento que apoya nuestra
          condición, y por lo tanto no podemos depender de ella para estar bien.
        </p>
      </>
    ),
  },
];

/**
 * La prospección se lee en cinco pasos (Fernando, 2026-11-12: que ningún texto quede escondido): la
 * entrada con la pirámide, y un paso por nivel con la pirámide marcando ese nivel y su texto debajo.
 */
function SlideMetodoCrecimiento() {
  return (
    <div data-cuento-hijos style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Texto de Fernando (editor de textos, 2026-11-11), literal. */}
      <p style={pStyle}>
        La prospección de cada persona, es un indicador que mide su intención de crecimiento según 4
        aspectos  ordenados por la importancia que tienen para transformar su vida.
      </p>
      <p style={pStyle}>
        A continuación te presento el método de evaluación continua del Grupo Corazones Cruzados:
      </p>
      <Piramide />
    </div>
  );
}

function NivelCrecimiento({ i }: { i: number }) {
  return (
    <div data-cuento-hijos style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Piramide activo={i} />
      <div data-cuento-hijos style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{CRECIMIENTO[i].text()}</div>
    </div>
  );
}

/** La pirámide de los 4 niveles; sin botones: el paso decide cuál se marca. */
export function Piramide({ activo = -1 }: { activo?: number }) {
  const widths = ['58%', '72%', '86%', '100%'];
  return (
    <div data-cuento-hijos className="flex flex-col items-center gap-2 text-left">
      <GrowthCaption>Mayor importancia</GrowthCaption>
      {CRECIMIENTO.map((s, i) => {
        const on = activo === i;
        return (
          <div
            key={s.title}
            aria-current={on ? 'step' : undefined}
            style={{ width: widths[i] }}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-colors ${
              on ? 'bg-accent border-accent' : 'bg-digi-card border-digi-border'
            } ${activo >= 0 && !on ? 'opacity-60' : ''}`}
          >
            <span
              className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[11px] font-semibold ${
                on ? 'bg-white text-accent' : 'bg-accent-light text-accent'
              }`}
            >
              {s.n}
            </span>
            <span className="flex-1 min-w-0">
              <span className={`block text-[13px] font-semibold leading-tight ${on ? 'text-white' : 'text-digi-text'}`}>
                {s.title}
              </span>
              <span className={`block text-[11.5px] mt-0.5 ${on ? 'text-white/80' : 'text-digi-muted'}`}>{s.tag}</span>
            </span>
          </div>
        );
      })}
      <GrowthCaption dim>Menor importancia</GrowthCaption>
    </div>
  );
}

function GrowthCaption({ children, dim = false }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${
        dim ? 'text-digi-muted/70' : 'text-accent'
      }`}
    >
      {dim ? <ChevronDown className="w-3 h-3" /> : <ChevronDown className="w-3 h-3 rotate-180" />}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slider 7 — Afiliación (indicaciones del proceso)                  */
/* ------------------------------------------------------------------ */

// Fernando, 2026-11-11: fuera la pulsera gris y la pizarra; «Demuestra los valores» pasa a la
// prospección (lo que mide Reclutamiento: `ProspeccionBar` / `CriteriaSections`).
const AFIL_STEPS: { n: string; name: string; desc: () => React.ReactNode }[] = [
  {
    n: '01',
    name: 'Postúlate',
    desc: () => (
      <>
        Envía tu propuesta en el formulario de postulación. Si eres elegido como candidato,
        recibirás un <strong style={strong}>correo de confirmación</strong>.
      </>
    ),
  },
  {
    n: '02',
    name: 'Recibe tu acceso',
    desc: () => (
      <>
        Como candidato recibirás una invitación y acceso al sitio web como{' '}
        <strong style={strong}>usuario candidato</strong>. Desde ese momento puedes usar las
        herramientas del grupo para tu desarrollo humano; encontrarás todos sus detalles dentro del
        sitio web.
      </>
    ),
  },
  {
    n: '03',
    name: 'Asiste a las reuniones semanales',
    desc: () => (
      <>
        Allí recibirás todas las indicaciones sobre <strong style={strong}>cómo demostrar tu
        afiliación</strong> y los comandos que deberás ejecutar.
      </>
    ),
  },
  {
    n: '04',
    name: 'Eleva tu prospección',
    desc: () => (
      <>
        Tu avance se mide con la <strong style={strong}>evaluación continua de la
        prospección</strong>: cada tarea que cumples suma y cada una que no cumples resta en el
        valor al que corresponde, y además se evalúan tus talentos, tus cuatro dimensiones de
        desarrollo humano y tu red de apoyo. Cuando tu prospección alcanza un nivel alto, tu caso
        se revisa para convertirte en miembro.
      </>
    ),
  },
  {
    n: '05',
    name: 'Conviértete en miembro',
    desc: () => (
      <>
        Cuando cumplas con la demostración, un miembro <strong style={strong}>Global</strong> del
        paso de <strong style={strong}>Implementación</strong> realizará tu afiliación como nuevo
        miembro.
      </>
    ),
  },
];

function SlideAfiliacion() {
  return (
    <div data-cuento-hijos style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={pStyle}>
        La <strong style={strong}>afiliación</strong> es el proceso por el que un candidato se
        convierte en miembro, demostrando y representando los valores esperados. Sigue estas
        indicaciones:
      </p>

      {/* Indicaciones como línea de tiempo numerada (6 pasos, en orden) */}
      <ol data-cuento-hijos className="flex flex-col">
        {AFIL_STEPS.map((s, i) => (
          <li key={s.name} className="relative flex gap-3 pb-3 last:pb-0">
            {i < AFIL_STEPS.length - 1 && (
              <span aria-hidden className="absolute left-4 top-9 bottom-0 w-px bg-digi-border" />
            )}
            <span className="relative z-10 w-8 h-8 shrink-0 rounded-full bg-accent text-white text-[11px] font-semibold flex items-center justify-center">
              {s.n}
            </span>
            <div className="min-w-0 flex-1 rounded-lg border border-digi-border bg-digi-card p-3.5">
              <div style={cardTitle}>{s.name}</div>
              <p style={{ ...cardDesc, marginTop: 3 }}>{s.desc()}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lista de sliders (crecerá hasta 8)                                 */
/* ------------------------------------------------------------------ */

/** Convierte el cuerpo de un texto en el componente de su propio paso. */
function pasoDeTexto(cuerpo: () => React.ReactNode): React.FC {
  function PasoTexto() {
    return <div data-cuento-hijos style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{cuerpo()}</div>;
  }
  return PasoTexto;
}

/**
 * Un apartado con varios textos: su entrada y luego UN PASO POR TEXTO (Fernando, 2026-11-12: «prefiero
 * que se conviertan en otros pasos adicionales del formulario para asegurarme que lean cada texto»).
 * Antes iban plegados en una lista y se podía aceptar el apartado sin abrirlos.
 */
function apartado(
  id: PasoPostulacionId,
  Icon: IconType,
  Entrada: React.FC,
  textos: { title: string; resumen?: string; Component: React.FC }[],
  /** El icono de cada texto en el desglose de la entrada; sin iconos, la entrada no lleva desglose. */
  iconos?: IconType[],
): Slide[] {
  const grupo = tituloDePaso(id);
  // La entrada enseña el desglose de lo que viene (Fernando, 2026-11-12: «para que esta parte no se
  // vea vacía»); con «Siguiente» se entra a cada uno.
  const items = iconos ? textos.map((t, i) => ({ title: t.title, resumen: t.resumen, Icon: iconos[i] ?? Icon })) : null;
  function EntradaConDesglose() {
    return (
      <div data-cuento-hijos style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
        <Entrada />
        {items && <Desglose items={items} />}
      </div>
    );
  }
  return [
    { id, title: grupo, Icon, Component: items ? EntradaConDesglose : Entrada, centrado: true },
    ...textos.map((t, i) => ({
      id: `${id}-${i + 1}`,
      title: t.title,
      resumen: t.resumen,
      Icon,
      Component: t.Component,
      sub: { grupo, n: i + 1, de: textos.length },
      centrado: true,
    })),
  ];
}

const deLista = (items: AccordionItem[]) =>
  items.map((t) => ({ title: t.name, resumen: t.summary, Component: pasoDeTexto(t.body) }));

const NIVELES = CRECIMIENTO.map((c, i) => {
  function Nivel() {
    return <NivelCrecimiento i={i} />;
  }
  return { title: c.title, resumen: c.tag, Component: Nivel };
});

export const SLIDES: Slide[] = [
  { id: 'modelo', title: tituloDePaso('modelo'), Icon: Layers3, Component: SlideModelo, centrado: true },
  { id: 'modelo-4p', title: tituloDePaso('modelo-4p'), Icon: Grid3x3, Component: SlideModelo4P, centrado: true },
  ...apartado('herramientas', Wrench, SlideHerramientas, deLista(TOOLS), [FlaskConical, ShieldCheck, Workflow, Sparkles]),
  ...apartado('motivos', Heart, SlideMotivos, deLista(MOTIVOS), [Globe2, Mountain, Crown]),
  ...apartado('onboarding', Gavel, SlideOnboarding, deLista(REGLAS), [Users, Flag, Sprout]),
  ...apartado('metodo-crecimiento', TrendingUp, SlideMetodoCrecimiento, NIVELES),
  { id: 'afiliacion', title: tituloDePaso('afiliacion'), Icon: BadgeCheck, Component: SlideAfiliacion },
];

/**
 * EL DESGLOSE de un apartado: sus textos como un camino de nodos unidos por una línea que se dibuja, cada
 * uno con su icono, número, título y resumen. En escritorio, en fila; en el teléfono, en columna.
 */
function Desglose({ items }: { items: { title: string; resumen?: string; Icon: IconType }[] }) {
  return (
    <div data-cuento-hijos className="onb-desglose" style={{ '--n': items.length } as React.CSSProperties}>
      {items.map((t, i) => (
        <div key={t.title} className="onb-desglose-item">
          <span className="onb-desglose-icono" aria-hidden>
            <t.Icon />
          </span>
          <span className="onb-desglose-texto">
            <span className="onb-desglose-num">{String(i + 1).padStart(2, '0')}</span>
            <span className="onb-desglose-titulo">{t.title}</span>
            {t.resumen && <span className="onb-desglose-resumen">{t.resumen}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Componente principal                                               */
/* ------------------------------------------------------------------ */

/**
 * Los pasos de la postulación, en orden: los sliders y el formulario final. Lo usan el raíl
 * de este diálogo y la tarjeta «Soy nuevo» de la portada (`RolesMundo`), que enseña el camino
 * antes de empezarlo.
 */
export const PASOS_POSTULACION: { label: string; Icon: IconType }[] = [
  ...SLIDES.filter((s) => !s.sub).map((s) => ({ label: s.title, Icon: s.Icon })),
  { label: 'Postulación', Icon: Send },
];

export default function OnboardingSlidersModal({
  onComplete,
  onClose,
}: {
  /**
   * El mundo elegido en la portada. YA NO CAMBIA EL ASPECTO (Fernando, 2026-10-29: «el mismo
   * estilo de formulario que al iniciar sesión»): el formulario es siempre la isla `.corp dark`
   * de los diálogos de acceso. Se conserva la prop para no tocar a quien la pasa.
   */
  tema?: 'aventura' | 'progreso';
  /**
   * Se llama al enviar la postulación. Devuelve el MENSAJE DE ERROR si el servidor la rechazó
   * (captcha caducado, pausa de 24 h…), que se enseña aquí mismo sin cerrar; `null` si salió bien.
   */
  onComplete: (data: PostulacionData) => Promise<string | null>;
  /** Cancela el onboarding y vuelve a la landing. */
  onClose: () => void;
}) {
  // Postulación: correo + motivación + aceptaciones. (El resto de datos
  // personales se piden luego, en el formulario de creación de cuenta.)
  const [email, setEmail] = useState('');
  const [nombres, setNombres] = useState<NombresPostulante>({ primerNombre: '', segundoNombre: '', primerApellido: '', segundoApellido: '' });
  const nombresOk = Object.values(nombres).every((v) => v.trim().length >= 2);
  const [reason, setReason] = useState('');
  const [marketing, setMarketing] = useState(false);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  // Aceptación final de términos y condiciones en el formulario de postulación.
  const [finalAccepted, setFinalAccepted] = useState(false);
  // «No soy un robot» (Fernando, 2026-10-29): sin la casilla resuelta no se envía.
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [reinicioCaptcha, setReinicioCaptcha] = useState(0);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const registro = useEstadoRegistro();
  const formOk = nombresOk && emailOk && reason.trim().length >= 10 && finalAccepted && !!captcha && !enviando;
  const enviar = async () => {
    if (!formOk || !captcha) return;
    setEnviando(true);
    setErrorEnvio(null);
    const error = await onComplete({
      primerNombre: nombres.primerNombre.trim(), segundoNombre: nombres.segundoNombre.trim(),
      primerApellido: nombres.primerApellido.trim(), segundoApellido: nombres.segundoApellido.trim(),
      email: email.trim(), reason: reason.trim(), marketing, altcha: captcha,
    });
    setEnviando(false);
    if (error) {
      setErrorEnvio(error);
      // La solución ya se gastó en el servidor: hay que marcar la casilla otra vez.
      setReinicioCaptcha((n) => n + 1);
    }
  };

  // La pausa de 24 h se mira AL ABRIR (Fernando, 2026-10-29): si desde este equipo ya se creó un
  // registro, no se recorre la postulación para acabar rechazada al enviar.
  if (registro?.bloqueado) {
    return (
      <AuthDialog
        Icon={Clock}
        titulo="Postulación: en pausa"
        subtitulo="Desde este equipo ya se creó un registro hace poco."
        onClose={onClose}
        ancho="sm"
        pie={<BotonAuth onClick={onClose}>Entendido</BotonAuth>}
      >
        <p className="text-[13.5px] leading-relaxed text-digi-text">
          Para evitar registros en cadena, cada equipo puede crear un registro cada 24 horas. Podrás
          postularte a partir del{' '}
          <strong className="font-semibold text-digi-text">{horaDeReanudacion(registro.hasta)}</strong>.
        </p>
      </AuthDialog>
    );
  }

  return (
    <VentanaRecorrido
      marca="Postulación de candidato"
      ariaLabel="Conoce el proyecto y postúlate"
      pasos={SLIDES}
      textoUltimoPaso="Postularme"
      onClose={onClose}
      final={{
        label: 'Postulación',
        Icon: Send,
        titulo: '¿Por qué quieres ser candidato de este proyecto?',
        contenido: (
          <>
            <CandidateForm
              nombres={nombres}
              setNombres={setNombres}
              email={email}
              setEmail={setEmail}
              emailOk={emailOk}
              reason={reason}
              setReason={setReason}
              termsAccepted={finalAccepted}
              onToggleTerms={() => setFinalAccepted((v) => !v)}
              marketing={marketing}
              onToggleMarketing={() => setMarketing((v) => !v)}
            />
            <div className="mt-5">
              <Captcha onCambio={setCaptcha} reinicio={reinicioCaptcha} tema="oscuro" />
              {errorEnvio && (
                <p role="alert" className="mt-3 text-[13px] leading-relaxed text-red-300 onb-error">
                  {errorEnvio}
                </p>
              )}
            </div>
          </>
        ),
        boton: (
          <button type="button" onClick={enviar} disabled={!formOk} className="onb-boton onb-boton-avanzar">
            <Send />
            Comenzar mi aventura
          </button>
        ),
      }}
    />
  );
}

/** Un paso informativo de la ventana: se lee y se marca «Entendido» para seguir. */
export type PasoVentana = {
  id: string;
  /** El título tema del paso: se escribe centrado arriba del contenido. */
  title: string;
  Icon: IconType;
  Component: React.FC;
  /** La línea bajo el título (p. ej. el resumen de un motivo). */
  resumen?: string;
  /** Si es uno de los textos de un apartado: en el camino va colgado de él, más pequeño. */
  sub?: { grupo: string; n: number; de: number };
  /** Texto centrado (Fernando, 2026-11-12); los pasos con listas o formularios no lo llevan. */
  centrado?: boolean;
};

/**
 * «LA TRAVESÍA» — LA VENTANA DE PASOS (Fernando, 2026-10-26; extraída el 2026-11-11 para que la usen
 * la postulación de candidatos y el alta de clientes, la misma pieza y no una copia):
 * · a la izquierda, el CAMINO: los pasos como nodos unidos por una línea (hecho = visto, actual =
 *   brilla, bloqueado = candado), con un anillo de progreso arriba;
 * · a la derecha, en su propia tarjeta, el contenido del paso y abajo una barra con «Atrás», la
 *   aceptación «Entendido» como interruptor y «Siguiente»;
 * · el último paso es el formulario (`final`), con su propio botón de envío (o dentro del
 *   contenido, si `final.boton` no se pasa).
 * Estilo `.corp dark` del inicio de sesión: `.onb-*` en globals.css.
 */
export function VentanaRecorrido({
  marca, ariaLabel, pasos, final, textoUltimoPaso = 'Siguiente', onClose,
}: {
  /** La línea bajo «GCC World» en el camino (p. ej. «Postulación de candidato»). */
  marca: string;
  ariaLabel: string;
  pasos: PasoVentana[];
  final: { label: string; Icon: IconType; titulo: string; contenido: React.ReactNode; boton?: React.ReactNode };
  /** El texto del botón en el último paso informativo («Postularme», «Crear mi cuenta»…). */
  textoUltimoPaso?: string;
  onClose: () => void;
}) {
  // index 0..N-1 => pasos informativos; index === N => formulario.
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  // Aceptación por paso; no se puede avanzar sin aceptar.
  const [accepted, setAccepted] = useState<boolean[]>(() => pasos.map(() => false));

  const total = pasos.length;
  const isForm = index === total;
  const current = pasos[index];
  const steps = total + 1;
  const nodos = [
    ...pasos.map((s) => ({ label: s.title, Icon: s.Icon, sub: s.sub })),
    { label: final.label, Icon: final.Icon, sub: undefined },
  ];
  // «Paso N» cuenta los apartados; los textos de un apartado cuelgan de él sin número propio.
  const numeros = nodos.reduce<number[]>((acc, n, i) => [...acc, (acc[i - 1] ?? 0) + (n.sub ? 0 : 1)], []);
  /*
   * COMO QUIEN CUENTA UN CUENTO (Fernando, 2026-11-12): el contenido del paso no aparece de golpe. Va
   * pieza por pieza —el título, luego cada párrafo, cada nodo del desglose—, y cada párrafo se descubre
   * de arriba abajo, más despacio cuanto más largo es, como si se fuera contando. Lo que lleva
   * `data-cuento-hijos` se reparte en sus hijos; lo demás entra como una pieza. Antes de pintar, para
   * que nada parpadee; sin movimiento si el sistema pide reducirlo.
   */
  const cuentoRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const raiz = cuentoRef.current;
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let t = 0.1;
    const recorrer = (el: HTMLElement) => {
      el.style.setProperty('--cuento-retardo', `${t.toFixed(2)}s`);
      for (const h of Array.from(el.children)) {
        if (!(h instanceof HTMLElement)) continue;
        if (h.hasAttribute('data-cuento-hijos')) { recorrer(h); continue; }
        const texto = h.tagName === 'P';
        const duracion = texto ? Math.min(2, Math.max(0.8, (h.textContent?.length ?? 0) / 240)) : 0.75;
        h.style.setProperty('--cuento-retardo', `${t.toFixed(2)}s`);
        h.style.setProperty('--cuento-duracion', `${duracion.toFixed(2)}s`);
        h.classList.add(texto ? 'onb-cuento-texto' : 'onb-cuento-pieza');
        t += texto ? duracion * 0.7 : 0.25;
      }
    };
    recorrer(raiz);
  }, [index]);

  // Con tantos pasos el camino se desplaza: el actual siempre a la vista.
  const caminoRef = useRef<HTMLElement>(null);
  useEffect(() => {
    caminoRef.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [index]);
  const acceptedHere = isForm ? true : accepted[index];

  const toggleAccept = () =>
    setAccepted((prev) => {
      const copy = [...prev];
      copy[index] = !copy[index];
      return copy;
    });

  const go = (next: number, d: 1 | -1) => {
    setDir(d);
    setIndex(next);
  };
  const next = () => { if (index < total) go(index + 1, 1); };
  const back = () => { if (index > 0) go(index - 1, -1); };

  /** Un paso es alcanzable si ya se visitó o si todos los anteriores están aceptados. */
  const canGoTo = (i: number) => i <= index || pasos.slice(0, i).every((_, k) => accepted[k]);

  const animName = dir === 1 ? 'onbInRight' : 'onbInLeft';
  const SlideComponent = isForm ? null : current.Component;
  const title = isForm ? final.titulo : current.title;
  const porcentaje = Math.round(((index + (acceptedHere && !isForm ? 1 : 0)) / steps) * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className={`corp dark corp-overlay onboarding-portada fixed inset-0 z-[250] flex items-center justify-center p-0 sm:p-5 sm:pt-[max(1.25rem,var(--seguro-arriba))]`}
      style={{ animation: 'pixelFadeIn 0.35s ease-out' }}
    >
      <style>{KEYFRAMES}</style>

      <div className="onboarding-panel w-full max-w-[1120px] h-full sm:max-h-[min(94vh,880px)] flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 grid lg:grid-cols-[288px_minmax(0,1fr)]">
          {/* ── El camino ── */}
          <aside className="onb-camino hidden lg:flex flex-col min-h-0">
            <div className="flex items-center gap-3 px-6 pt-6">
              <LogoGirando tamano={30} />
              <div className="min-w-0">
                <div className="onb-marca">GCC World</div>
                <div className="onb-marca-sub">{marca}</div>
              </div>
            </div>

            <div className="onb-anillo-bloque">
              <svg viewBox="0 0 64 64" className="onb-anillo" aria-hidden="true">
                <circle cx="32" cy="32" r="27" className="onb-anillo-fondo" />
                <circle
                  cx="32"
                  cy="32"
                  r="27"
                  className="onb-anillo-valor"
                  style={{ strokeDashoffset: 169.6 * (1 - porcentaje / 100) }}
                />
              </svg>
              <div>
                <div className="onb-anillo-cifra">{porcentaje}%</div>
                <div className="onb-anillo-texto">
                  {isForm ? 'Último paso' : `Paso ${index + 1} de ${steps}`}
                </div>
              </div>
            </div>

            <nav ref={caminoRef} className="onb-nodos flex-1 min-h-0 overflow-y-auto" aria-label="Pasos">
              {nodos.map((s, i) => {
                const actual = i === index;
                const hecho = i < total ? accepted[i] : false;
                const enabled = canGoTo(i);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!enabled}
                    aria-current={actual ? 'step' : undefined}
                    onClick={() => enabled && go(i, i > index ? 1 : -1)}
                    className={`onb-nodo ${s.sub ? 'es-sub' : ''} ${actual ? 'es-actual' : ''} ${hecho ? 'es-hecho' : ''} ${!enabled ? 'es-bloqueado' : ''}`}
                  >
                    <span className="onb-nodo-punto">
                      {hecho && !actual ? <Check /> : !enabled ? <Lock /> : s.sub ? s.sub.n : <s.Icon />}
                    </span>
                    <span className="onb-nodo-texto">
                      {!s.sub && <span className="onb-nodo-num">Paso {numeros[i]}</span>}
                      <span className="onb-nodo-nombre">{s.label}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* ── El paso ── */}
          <section className="onb-paso flex flex-col min-h-0">
            {/* La cabecera es solo la «×»: el título tema va centrado arriba del contenido. */}
            <header className="onb-cabecera es-sin-titulo">
              <BotonCerrar onClick={onClose} />
            </header>

            <div className="onb-cuerpo flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
              <div key={index} style={{ animation: `${animName} 0.45s cubic-bezier(0.22,1,0.36,1)` }}>
                <div ref={cuentoRef} data-cuento-hijos>
                <div className="onb-tema" data-cuento-hijos>
                  {!isForm && current.sub && (
                    <p className="onb-tema-grupo">
                      {current.sub.grupo} · {current.sub.n} de {current.sub.de}
                    </p>
                  )}
                  <h2 className="onb-tema-titulo">{title}</h2>
                  {!isForm && current.resumen && <p className="onb-tema-resumen">{current.resumen}</p>}
                </div>
                <div data-cuento-hijos className={!isForm && current.centrado ? 'onb-centrado' : undefined}>
                  {isForm || !SlideComponent ? final.contenido : <SlideComponent />}
                </div>
                </div>
              </div>
            </div>

            <footer className="onb-pie">
              {!isForm && (
                <AcceptTerms
                  mode="ack"
                  checked={!!acceptedHere}
                  onToggle={toggleAccept}
                />
              )}
              <div className="onb-acciones">
                <button type="button" onClick={back} disabled={index === 0} className="onb-boton onb-boton-atras">
                  <ArrowLeft />
                  Atrás
                </button>
                {isForm ? (
                  final.boton ?? null
                ) : (
                  <button
                    type="button"
                    onClick={() => acceptedHere && next()}
                    disabled={!acceptedHere}
                    title={acceptedHere ? undefined : 'Marca la casilla de este apartado para continuar'}
                    className="onb-boton onb-boton-avanzar"
                  >
                    {index === total - 1 ? textoUltimoPaso : 'Siguiente'}
                    <ArrowRight />
                  </button>
                )}
              </div>
            </footer>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Envío de la postulación (portada y página Candidatos)              */
/* ------------------------------------------------------------------ */

/**
 * Registra la propuesta (queda en espera de aprobación del admin global). Lleva el captcha y puede
 * rechazarse (captcha caducado, un registro cada 24 h por equipo): devuelve el MENSAJE DE ERROR, o
 * `null` si salió bien. 409 = ese correo ya se postuló → igualmente en espera.
 */
export async function enviarPostulacion(postulacion: PostulacionData): Promise<string | null> {
  try {
    const r = await fetch('/api/candidate/proposal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postulacion),
    });
    if (!r.ok && r.status !== 409) {
      const j = await r.json().catch(() => null);
      return (j?.error as string) || 'No pudimos enviar tu postulación. Inténtalo de nuevo.';
    }
    return null;
  } catch {
    return 'No pudimos enviar tu postulación. Revisa tu conexión e inténtalo de nuevo.';
  }
}

/* ------------------------------------------------------------------ */
/* Aceptación de términos (por slider)                                */
/* ------------------------------------------------------------------ */

function AcceptTerms({
  mode,
  checked,
  onToggle,
  inline = false,
}: {
  mode: 'ack' | 'final' | 'marketing';
  checked: boolean;
  onToggle: () => void;
  inline?: boolean;
}) {
  // Con sonido (Fernando, 2026-10-29): «clic» que sube al marcar, que baja al desmarcar.
  const alternar = () => {
    sonarInterruptor(!checked);
    onToggle();
  };
  return (
    <div
      onClick={alternar}
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          alternar();
        }
      }}
      // El interruptor de aceptación (2026-10-26): una pieza con borde que se enciende al
      // marcarla, con un interruptor en vez de una casilla.
      className={`onb-aceptar ${inline ? 'es-en-linea' : ''} ${checked ? 'es-marcado' : ''}`}
    >
      <span aria-hidden className="onb-interruptor">
        <span>{checked && <Check />}</span>
      </span>
      <span className="text-[12.5px] leading-relaxed text-digi-muted">
        {mode === 'final' ? (
          <>
            Acepto los{' '}
            <a
              href="/legal"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-accent-glow underline"
            >
              términos y condiciones y la política de privacidad
            </a>{' '}
            del proyecto, y autorizo el tratamiento de los datos que proporcione conforme a ella.
            Entiendo que los permisos otorgados{' '}
            <strong className="font-semibold text-digi-text">no podrán ser revocados</strong>, salvo
            que solicite voluntariamente mi desafiliación del grupo, o que esta se produzca por
            incumplimiento de las reglas; en cualquiera de los dos casos, los permisos previamente
            aceptados serán retirados.
          </>
        ) : mode === 'marketing' ? (
          <>
            Quiero recibir información sobre publicidad, productos y novedades del proyecto. Si no
            marcas esta casilla, no te enviaremos ese tipo de comunicaciones, y de todos modos
            puedes continuar.
          </>
        ) : (
          <>
            <strong className="font-semibold text-digi-text">Entendido.</strong> He leído y
            comprendido la información de este apartado.
          </>
        )}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formulario de postulación                                          */
/* ------------------------------------------------------------------ */

export function CandidateForm({
  nombres,
  setNombres,
  email,
  setEmail,
  emailOk,
  reason,
  setReason,
  termsAccepted,
  onToggleTerms,
  marketing,
  onToggleMarketing,
  enfocar = true,
}: {
  nombres: NombresPostulante;
  setNombres: (v: NombresPostulante) => void;
  email: string;
  setEmail: (v: string) => void;
  emailOk: boolean;
  reason: string;
  setReason: (v: string) => void;
  termsAccepted: boolean;
  onToggleTerms: () => void;
  marketing: boolean;
  onToggleMarketing: () => void;
  /** En el diálogo, el cursor va al motivo; en la página Candidatos no (movería la pantalla). */
  enfocar?: boolean;
}) {
  const max = 1000;
  const short = reason.trim().length < 10;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={pStyle}>
        Ya conoces las bases del proyecto. Para iniciar tu postulación al{' '}
        <strong style={strong}>Grupo Corazones Cruzados</strong>, cuéntanos, con sinceridad, qué te
        mueve a formar parte de esto.
      </p>

      <div className="rounded-lg border border-digi-border bg-digi-card p-4 flex flex-col gap-4">
        {/* Los dos nombres y los dos apellidos, obligatorios: con ellos se forma el correo corporativo. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            ['primerNombre', 'Primer nombre', 'given-name'],
            ['segundoNombre', 'Segundo nombre', 'additional-name'],
            ['primerApellido', 'Primer apellido', 'family-name'],
            ['segundoApellido', 'Segundo apellido', 'family-name'],
          ] as const).map(([clave, rotulo, auto]) => (
            <PixelInput key={clave} label={rotulo} name={clave} value={nombres[clave]} autoComplete={auto}
              onChange={(e) => setNombres({ ...nombres, [clave]: e.target.value.slice(0, 60) })} />
          ))}
        </div>
        <PixelInput
          label="Correo electrónico"
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tucorreo@ejemplo.com"
          autoComplete="email"
          error={email.length > 0 && !emailOk ? 'Introduce un correo válido.' : undefined}
        />

        <div className="flex flex-col gap-1">
          <label
            htmlFor="postulacion-motivo"
            className="field-label text-[10px] text-accent-glow opacity-70"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            ¿Qué te mueve a formar parte de esto?
          </label>
          <textarea
            id="postulacion-motivo"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, max))}
            placeholder="Escribe aquí qué te mueve a formar parte de esto..."
            autoFocus={enfocar}
            rows={7}
            className="field-control w-full resize-y min-h-[150px] px-3 py-2.5 bg-digi-darker border border-digi-border rounded text-sm text-digi-text placeholder:text-digi-muted/60 focus:border-accent focus:outline-none transition-colors"
            style={{ fontFamily: 'var(--font-body)', lineHeight: 1.6 }}
          />
          <div className="flex justify-between text-[11.5px] text-digi-muted">
            <span>{short ? 'Mínimo 10 caracteres.' : 'Listo para postular.'}</span>
            <span className="tabular-nums">
              {reason.length}/{max}
            </span>
          </div>
        </div>
      </div>

      <AcceptTerms mode="final" inline checked={termsAccepted} onToggle={onToggleTerms} />
      <AcceptTerms mode="marketing" inline checked={marketing} onToggle={onToggleMarketing} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Subcomponentes y estilos                                           */
/* ------------------------------------------------------------------ */

/** Un texto de un apartado: su título, la línea de resumen y su cuerpo (cada uno es un paso). */
type AccordionItem = { name: string; summary: string; body: () => React.ReactNode };

/** Encabezado de sub-sección dentro de un slider (icono/barra accent + título). */
/** Aviso de advertencia (rojo corp) — reusa los literales semánticos del dashboard. */
/**
 * Un aviso (advertencia o «importante») SIN caja: Fernando, 2026-11-11, rechazó el fondo rojo con borde
 * rojo («se ve feísimo»). Lo distingue un rótulo con icono en el color del aviso; el texto va en el
 * color normal del párrafo. Estilos en `globals.css` (`.aviso-gcc`).
 */
function Aviso({ tono, titulo, children }: { tono: 'peligro' | 'info'; titulo: string; children: React.ReactNode }) {
  const Icono = tono === 'peligro' ? AlertTriangle : Info;
  return (
    <div role="note" className="aviso-gcc" data-tono={tono}>
      <p className="aviso-gcc-titulo"><Icono aria-hidden />{titulo}</p>
      <p className="aviso-gcc-texto">{children}</p>
    </div>
  );
}

/* --- Tokens de estilo del modal (fuente única; todos apuntan a `.corp`) --- */


const pStyle: React.CSSProperties = {
  fontSize: '0.9375rem',
  lineHeight: 1.65,
  color: 'var(--color-digi-text)',
  margin: 0,
};

const strong: React.CSSProperties = { color: 'var(--color-digi-text)', fontWeight: 600 };

// «La travesía» (2026-10-26): títulos de tarjeta en Space Grotesk, números y avisos con el
// degradado de la portada. Las piezas de los 8 pasos salen de aquí: cambiarlas aquí cambia
// todo el contenido a la vez.
const cardTitle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-display)',
  fontSize: '0.98rem',
  fontWeight: 700,
  letterSpacing: '-0.01em',
  color: 'var(--color-digi-text)',
};

const cardDesc: React.CSSProperties = {
  fontSize: '0.8125rem',
  lineHeight: 1.6,
  color: 'var(--color-digi-muted)',
  margin: 0,
};


// Solo color de texto: sin relleno ni borde (Fernando, 2026-10-29: las etiquetas con fondo y
// borde «no me gustan y no las quiero ver en otras partes»).
const KEYFRAMES = `
@keyframes onbInRight { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: translateX(0); } }
@keyframes onbInLeft { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: translateX(0); } }
@keyframes onbFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;
