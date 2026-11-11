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
 * (`pStyle`, `cardBase`, `cardTitle`, `cardDesc`, `stepNum`,
 * `kickerStyle`) — todas apuntan a los **tokens** `--color-digi-*` / `--color-accent*`,
 * así que cambiarlas (o cambiar los tokens de `.corp`) retematiza los 8 pasos y
 * funciona igual en claro y oscuro. NO usar hex crudos en los sliders.
 */

import Captcha from '@/components/landing/Captcha';
import { horaDeReanudacion, useEstadoRegistro } from '@/components/landing/estadoRegistro';
import { AuthDialog, BotonAuth } from '@/components/landing/AuthSurface';
import { Fragment, useState } from 'react';
import Modelo4P, { PasosCondiciologia, ReglasModelo4P } from '@/components/landing/Modelo4P';
import { HERRAMIENTAS, HERRAMIENTAS_INTRO, MODELO_INTRO, trozosNegrita } from '@/lib/sitio/modeloGcc';
import {
  AlertTriangle,
  Clock,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronRight,
  Gavel,
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
import PixelInput from '@/components/ui/PixelInput';
import BotonCerrar from '@/components/ui/BotonCerrar';

export type PostulacionData = {
  email: string;
  reason: string;
  /** Consentimiento OPCIONAL para recibir publicidad/novedades del proyecto. */
  marketing: boolean;
  /** La solución del captcha «No soy un robot» (ALTCHA, 2026-10-29). */
  altcha: string;
};

type IconType = React.ComponentType<{ className?: string }>;

type Slide = {
  id: PasoPostulacionId;
  kicker: string;
  title: string;
  /** Icono del paso en el rail y en la cabecera (lucide, estándar del dashboard). */
  Icon: IconType;
  // Componente (no función llamada en render) para que sus hooks corran al nivel
  // superior del propio slider, no anidados dentro del padre.
  Component: React.FC;
  // Todos los pasos se aceptan igual: «Entendido. He leído y comprendido la información de este
  // apartado.» (Fernando, 2026-10-29). Ya no hay pasos con «Acepto lo indicado…: <resumen>».
};

/* ------------------------------------------------------------------ */
/* Slider 1 — Modelo de Grupo (Modelo 4P)                             */
/* ------------------------------------------------------------------ */

function SlideModelo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <p style={pStyle}><Negritas texto={MODELO_INTRO} /></p>

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
const TOOLS: AccordionItem[] = HERRAMIENTAS.map((h) => ({
  name: h.nombre,
  summary: h.resumen,
  body: () => (
    <>
      {h.parrafos.map((texto, i) => (
        <Fragment key={i}>
          <p style={cardDesc}><Negritas texto={texto} /></p>
          {h.conPasos && i === 0 && <PasosCondiciologia />}
        </Fragment>
      ))}
    </>
  ),
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={pStyle}><Negritas texto={HERRAMIENTAS_INTRO} /></p>
      <Accordion items={TOOLS} />
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
        <p style={cardDesc}>
          Vivimos en sociedades separadas por fronteras y representadas por símbolos que, con el
          tiempo, nos han enseñado a mirarnos como distintos. Es cierto que crecemos en entornos
          diferentes, pero los valores que de verdad importan son los mismos en todas partes.
        </p>
        {/* Texto de Fernando (editor de textos, 2026-11-10), literal. */}
        <p style={cardDesc}>
          Creemos que un corazón  y una organización puede representar esa{' '}
          <strong style={strong}>alianza que ya existe</strong>, silenciosa, en el fondo de la
          humanidad. El Grupo Corazones Cruzados nace para unir al mundo a través de sus valores y
          de un sistema que represente lo que de verdad necesitamos. Y lo que más necesitamos hoy
          es una <strong style={strong}>razón para trabajar juntos</strong> por un futuro mejor.
        </p>
      </>
    ),
  },
  {
    name: 'Una realidad imposible, frente a una disciplina centralizada',
    summary: 'Frente a lo que parece imposible, un sueño compartido y disciplinado.',
    body: () => (
      <>
        <p style={cardDesc}>
          Sueño con un futuro en el que la humanidad trabaje unida por objetivos más grandes; un
          mundo donde las próximas generaciones no tengan que crecer entre la corrupción y las
          mafias que dañan, sin reparo, a quienes tienen el potencial de cambiarlo todo.
        </p>
        <p style={cardDesc}>
          Demasiadas veces los más jóvenes heredamos las consecuencias de problemas que otros
          prefirieron ignorar, convencidos de que era más fácil llamarlos imposibles que intentar
          resolverlos. Esa <strong style={strong}>realidad imposible</strong> donde los valores se
          unen y la organización se fortalece por encima de la separación, solo puede cumplirse
          mediante una <strong style={strong}>disciplina centralizada</strong> en trabajar cada día por
          resolver las problemáticas sociales paso a paso hasta limpiar nuestras calles y el mundo,
          de aquello que está mal.
        </p>
      </>
    ),
  },
  {
    // Texto de Fernando (editor de textos, 2026-11-11), literal; quitó el cuarto párrafo.
    name: 'El poder por convicción, y no por decisión',
    summary: 'El liderazgo legítimo se gana con acciones, no con votos.',
    body: () => (
      <>
        <p style={cardDesc}>
          Crecimos creyendo que la democracia, a través del voto, era la mejor forma de elegir a
          quienes nos gobiernan, pero con demasiada frecuencia esa forma ha terminado en corrupción
          y en entregar el poder a quien no se lo ha merecido, creando una clase política que es
          capaz de todo por convencer a las masas, mientras ignoramos todas las incompetencias que
          éstos tienen para transformar la realidad que vivimos.
        </p>
        <p style={cardDesc}>
          Debemos cambiar lo que siempre se ha hecho, empezando por el poder, ya que éste no se debe
          entregar ni por convencimiento, ni por retórica. Los líderes se deben ganar su posición
          mediante lo que realmente son capaces de <strong style={strong}>hacer</strong> y{' '}
          <strong style={strong}>construir</strong> según sus logros, su propósito, y el impacto
          real que han tenido en la sociedad sin depender de los recursos de otros. &quot;Porque sino
          puede cambiar su vida, peor va a poder cambiar la vida de otras personas&quot;. Así que
          tener o no tener recursos, solo es una excusa y una mentira que no podemos volver a
          aceptar.
        </p>
        <p style={cardDesc}>
          Hoy vivimos algo completamente diferente e incoherente con lo que necesitamos, porque
          nuestros gobernantes nacen de cúpula de poder que se mueve e interesa por la política con
          el fin de obtener más poder. El pueblo a causa de la incompetencia natural que vivimos,
          aceptamos y nos conformamos  cada vez más con lo poco que nos dan, sin tener manera de
          tomar acciones inmediatas para cambiar lo que nos afecta. Un verdadero líder no necesita
          una posición para imponerse, porque alguien que es capaz de movilizar a personas, y
          habitar su corazón mediante su ejemplo y sacrificio; entonces ése es un líder nato; caso
          contrario, simplemente no lo es.
        </p>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Texto de Fernando (2026-11-01, 2.ª versión), literal y en sus cuatro párrafos. Sustituye a
          la entrada genérica («Más allá del cómo, importa el porqué…»). */}
      {MOTIVOS_ENTRADA.map((t, i) => <p key={i} style={pStyle}>{t}</p>)}
      <Accordion items={MOTIVOS} />
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
        <p style={cardDesc}>
          El proyecto del Grupo Corazones Cruzados es una organización que incluye en sus filas, solo
          candidatos y miembros que tienen la prospección a representarnos. Aquellos que caigan de
          delincuentes, mentirosos, o realicen cualquier mala intención u acción por mínima que sea, o
          incluso olviden trabajar y sostener en sus relaciones sociales y en su vida diaria nuestros
          valores organizacionales, serán des-agrupados del proyecto.
        </p>
        <p style={cardDesc}>
          A continuación te presento los valores que deberás trabajar para representar nuestra
          organización:
        </p>
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2 my-3">
          {VALORES.map((v) => (
            <div key={v.valor} className="flex items-start gap-2.5">
              <span
                aria-hidden
                className="shrink-0 mt-[7px] w-1.5 h-1.5 rounded-full bg-accent"
              />
              <span style={cardDesc}>
                <strong style={strong}>{v.valor}:</strong> {v.compromiso}
              </span>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    name: 'Regla 2 · Comandos',
    summary: 'Los comandos de la estrategia organizacional se cumplen.',
    body: () => (
      <>
        <p style={cardDesc}>
          La gobernanza del Grupo Corazones Cruzados{' '}
          <strong style={strong}>escucha, decide y analiza correcciones</strong> por cada estrategia
          organizacional que se implementa  con el fin de progresar, y enfrentar una problemática.
        </p>
        <p style={cardDesc}>
          Antes de decidirse por una estrategia organizacional, el líder tuvo que escuchar las
          propuestas y discusiones asociadas a esa problemática para que según las alternativas
          posibles, se desarrolle un  mapa visual del proyecto, y luego se presente la opción más
          viable a ejecutar y medir sus efectos.
        </p>
        <p style={cardDesc}>
          La relación entre el líder, los miembros o los candidatos se sostiene principalmente a
          través de los comandos que se solicitan ejecutar para cumplir el planteamiento de la
          estrategia organizacional decidida.
        </p>
        <p style={cardDesc}>
          Cualquier miembro o candidato que no se acata o afecta el cálculo de la estrategia, queda
          fuera del proyecto en el acto, ya que los comandos se ejecutan sin cuestionamiento, y solo
          se analizan y corrigen durante la etapa de corrección en donde todos sin excepción tienen la
          obligación de votar y participar.
        </p>
      </>
    ),
  },
  {
    name: 'Regla 3 · Opciones de crecimiento',
    summary: 'La confianza se entrega, y no se traiciona.',
    body: () => (
      <>
        <p style={cardDesc}>
          El Grupo Corazones Cruzados ofrece un sistema de &quot;Desarrollo Humano&quot; que permite
          impulsar a los candidatos y miembros de la organización, y acceder a oportunidades para
          avanzar en su progreso sin excepciones ni condiciones.
        </p>
        <p style={cardDesc}>
          La confianza que ofrecemos y el acceso a mayores recursos y beneficios, depende de la{' '}
          <strong style={strong}>prospección</strong> y de los{' '}
          <strong style={strong}>resultados</strong> o logros obtenidos. Esa confianza se entrega{' '}
          <strong style={strong}>una sola vez</strong>, y si una opción de crecimiento se usa de forma
          abusiva o para fines distintos a los acordados, la decisión es la destitución.
        </p>
        <p style={cardDesc}>
          Para esta organización, la confianza no se recupera tras una traición, además que nosotros
          abordamos todas las necesidades aunque no sean de interés personal o progreso, así que no
          hay excusa para mentir o abusar de los recursos. Les pedimos mantener siempre las buenas
          intenciones, y las opciones de crecimiento llegarán.
        </p>
      </>
    ),
  },
];

function SlideOnboarding() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={pStyle}>Reglas del proyecto para todos los Candidatos y Miembros</p>
      <Aviso tono="peligro" titulo="Advertencia">
        Cualquier intento de faltar a una sola de estas reglas implica la{' '}
        <strong style={strong}>destitución</strong> del candidato y aplica igual a todos
        los miembros en cualquier rol. Quien es destituido del proyecto no tiene otra oportunidad para
        unirse; solo los fallos <em>no intencionales</em> se evalúan y pueden no llevar a la destitución.
      </Aviso>
      <Accordion items={REGLAS} />
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
        <p style={cardDesc}>
          El talento es justo lo que hace de este proyecto una realidad, cuando una persona puede traer
          a este mundo un valor agregado con su esfuerzo y capacidad, se convierte en una herramienta de
          altísimo valor para el progreso del proyecto que lo requiera.
        </p>
        <p style={cardDesc}>
          Nosotros queremos descubrir ese talento, y generar oportunidades en donde podamos sacar
          beneficios por posicionarte dentro de una estrategia organizacional; cada movimiento va a
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
        <p style={cardDesc}>
          La confianza de los clientes se mide en tus valores, cuando una persona no sostiene sus
          valores puede tomar un requerimiento como algo sin importancia, y limitando incluso el
          desarrollo de su talento; debido a eso, exigimos los valores organizacionales ya que son la
          fuente principal para obtener oportunidades.
        </p>
        <p style={cardDesc}>
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
        <p style={cardDesc}>
          Evaluamos las cuatro dimensiones del desarrollo humano ({' '}
          <strong style={strong}>laboral, corporal, social y mental</strong> ), cada una representa
          un conjunto de problemas que al no ser abordados, aumentan el riesgo de tomar malas
          decisiones, intenciones y malos comportamientos que terminen perjudicando a uno mismo, y a
          los demás.
        </p>
        <p style={cardDesc}>
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
        <p style={cardDesc}>
          En la actualidad, cuando las dimensiones de desarrollo humano se ven muy afectadas por
          problemas difíciles de resolver, la red de apoyo suele ser un factor vital para impulsar la
          solución de problemas, además de ser un buen referente para sostener los valores, y así
          obtener fuerzas para buscar oportunidades que, en caso de tener suerte, te permiten
          aprovechar tu talento y mejorar tu situación.
        </p>
        <p style={cardDesc}>
          Sin embargo para esta organización este factor vital tiene menor importancia porque los
          valores organizacionales te enseñan que no necesitas una red de apoyo para abordar tus
          problemas, sino que su importancia debe ser para nosotros un complemento que apoya nuestra
          condición, y por lo tanto no podemos depender de ella para estar bien.
        </p>
      </>
    ),
  },
];

function SlideMetodoCrecimiento() {
  const [active, setActive] = useState(0);
  const widths = ['58%', '72%', '86%', '100%'];
  const a = CRECIMIENTO[active];
  const rank = (n: number) =>
    n === 1 ? 'mayor importancia' : n === 4 ? 'menor importancia' : 'importancia intermedia';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Texto de Fernando (editor de textos, 2026-11-11), literal. */}
      <p style={pStyle}>
        La prospección de cada persona, es un indicador que mide su intención de crecimiento según 4
        aspectos  ordenados por la importancia que tienen para transformar su vida.
      </p>
      <p style={pStyle}>
        A continuación te presento el método de evaluación continua del Grupo Corazones Cruzados:
      </p>

      {/* Pirámide */}
      <div className="flex flex-col items-center gap-2">
        <GrowthCaption>Mayor importancia</GrowthCaption>
        {CRECIMIENTO.map((s, i) => {
          const on = active === i;
          return (
            <button
              key={s.title}
              type="button"
              onClick={() => setActive(i)}
              style={{ width: widths[i] }}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-left transition-colors ${
                on
                  ? 'bg-accent border-accent'
                  : 'bg-digi-card border-digi-border hover:border-accent'
              }`}
            >
              <span
                className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[11px] font-semibold ${
                  on ? 'bg-white text-accent' : 'bg-accent-light text-accent'
                }`}
              >
                {s.n}
              </span>
              <span className="flex-1 min-w-0">
                <span
                  className={`block text-[13px] font-semibold leading-tight ${
                    on ? 'text-white' : 'text-digi-text'
                  }`}
                >
                  {s.title}
                </span>
                <span
                  className={`block text-[11.5px] mt-0.5 ${on ? 'text-white/80' : 'text-digi-muted'}`}
                >
                  {s.tag}
                </span>
              </span>
              <ChevronRight
                className={`w-4 h-4 shrink-0 ${on ? 'text-white' : 'text-digi-muted'}`}
              />
            </button>
          );
        })}
        <GrowthCaption dim>Menor importancia</GrowthCaption>
      </div>

      {/* Detalle del nivel seleccionado */}
      <div
        key={active}
        className="flex items-start gap-3.5 rounded-lg border border-digi-border bg-digi-card p-4"
        style={{ animation: 'onbFadeUp 0.3s ease-out' }}
      >
        <div className="w-11 h-11 shrink-0 rounded-lg bg-accent-light text-accent flex items-center justify-center text-[17px] font-semibold">
          {a.n}
        </div>
        <div className="flex-1 min-w-0">
          <div style={cardTitle}>{a.title}</div>
          <div style={{ ...kickerStyle, marginTop: 3, marginBottom: 8 }}>
            {a.n} de 4 · {rank(a.n)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{a.text()}</div>
        </div>
      </div>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={pStyle}>
        La <strong style={strong}>afiliación</strong> es el proceso por el que un candidato se
        convierte en miembro, demostrando y representando los valores esperados. Sigue estas
        indicaciones:
      </p>

      {/* Indicaciones como línea de tiempo numerada (6 pasos, en orden) */}
      <ol className="flex flex-col">
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

/** Exportada: la página Candidatos enseña estos mismos apartados, uno por pestaña. */
export const SLIDES: Slide[] = [
  {
    id: 'modelo',
    title: tituloDePaso('modelo'),
    kicker: 'Slider 1',
    Icon: Layers3,
    Component: SlideModelo,
  },
  {
    id: 'herramientas',
    title: tituloDePaso('herramientas'),
    kicker: 'Slider 2',
    Icon: Wrench,
    Component: SlideHerramientas,
  },
  {
    id: 'motivos',
    title: tituloDePaso('motivos'),
    kicker: 'Slider 3',
    Icon: Heart,
    Component: SlideMotivos,
  },
  {
    id: 'onboarding',
    title: tituloDePaso('onboarding'),
    kicker: 'Slider 4',
    Icon: Gavel,
    Component: SlideOnboarding,
  },
  {
    id: 'metodo-crecimiento',
    title: tituloDePaso('metodo-crecimiento'),
    kicker: 'Slider 5',
    Icon: TrendingUp,
    Component: SlideMetodoCrecimiento,
  },
  {
    id: 'afiliacion',
    title: tituloDePaso('afiliacion'),
    kicker: 'Slider 7',
    Icon: BadgeCheck,
    Component: SlideAfiliacion,
  },
  // Slider 8: pendiente de contenido del usuario.
];

/* ------------------------------------------------------------------ */
/* Componente principal                                               */
/* ------------------------------------------------------------------ */

/**
 * Los pasos de la postulación, en orden: los sliders y el formulario final. Lo usan el raíl
 * de este diálogo y la tarjeta «Soy nuevo» de la portada (`RolesMundo`), que enseña el camino
 * antes de empezarlo.
 */
export const PASOS_POSTULACION: { label: string; Icon: IconType }[] = [
  ...SLIDES.map((s) => ({ label: s.title, Icon: s.Icon })),
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
  // index 0..N-1 => sliders informativos; index === N => formulario de postulación.
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  // Postulación: correo + motivación + aceptaciones. (El resto de datos
  // personales se piden luego, en el formulario de creación de cuenta.)
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [marketing, setMarketing] = useState(false);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  // Aceptación de términos por cada slider; no se puede avanzar sin aceptar.
  const [accepted, setAccepted] = useState<boolean[]>(() => SLIDES.map(() => false));
  // Aceptación final de términos y condiciones en el formulario de postulación.
  const [finalAccepted, setFinalAccepted] = useState(false);

  const total = SLIDES.length;
  const isForm = index === total;
  const current = SLIDES[index];
  const steps = total + 1; // sliders + postulación
  // «No soy un robot» (Fernando, 2026-10-29): sin la casilla resuelta no se envía.
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [reinicioCaptcha, setReinicioCaptcha] = useState(0);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const registro = useEstadoRegistro();
  const formOk = emailOk && reason.trim().length >= 10 && finalAccepted && !!captcha && !enviando;
  const enviar = async () => {
    if (!formOk || !captcha) return;
    setEnviando(true);
    setErrorEnvio(null);
    const error = await onComplete({ email: email.trim(), reason: reason.trim(), marketing, altcha: captcha });
    setEnviando(false);
    if (error) {
      setErrorEnvio(error);
      // La solución ya se gastó en el servidor: hay que marcar la casilla otra vez.
      setReinicioCaptcha((n) => n + 1);
    }
  };
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

  const next = () => {
    if (index < total) go(index + 1, 1);
  };
  const back = () => {
    if (index > 0) go(index - 1, -1);
  };

  /** Un paso es alcanzable si ya se visitó o si todos los anteriores están aceptados. */
  const canGoTo = (i: number) => i <= index || SLIDES.slice(0, i).every((_, k) => accepted[k]);

  const animName = dir === 1 ? 'onbInRight' : 'onbInLeft';
  const SlideComponent = isForm ? null : current.Component;
  const title = isForm ? '¿Por qué quieres ser candidato de este proyecto?' : current.title;

  const porcentaje = Math.round(((index + (acceptedHere && !isForm ? 1 : 0)) / steps) * 100);

  /*
   * «LA TRAVESÍA» — el diseño del formulario de postulación (Fernando, 2026-10-26: «actualiza
   * por completo el diseño… según tu creatividad»). Con el lenguaje de la portada:
   * · a la izquierda, el CAMINO: los 8 pasos como nodos unidos por una línea (hecho = visto,
   *   actual = brilla, bloqueado = candado), con un anillo de progreso arriba;
   * · a la derecha, en su propia tarjeta separada del camino (2026-10-29), el contenido del paso
   *   y, abajo, una barra con «Atrás», la aceptación como interruptor y «Siguiente».
   * La lógica (pasos, aceptación, envío) no cambió. Desde 2026-10-29 con el estilo del inicio de
   * sesión (`.corp dark`, tarjeta gris, radio 8 px, botón plano): `.onb-*` en globals.css.
   */
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Conoce el proyecto y postúlate"
      className={`corp dark corp-overlay onboarding-portada fixed inset-0 z-[250] flex items-center justify-center p-0 sm:p-5`}
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
                <div className="onb-marca-sub">Postulación de candidato</div>
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

            <nav className="onb-nodos flex-1 min-h-0 overflow-y-auto" aria-label="Pasos de la postulación">
              {PASOS_POSTULACION.map((s, i) => {
                const actual = i === index;
                const hecho = i < total ? accepted[i] : false;
                const enabled = canGoTo(i);
                return (
                  <button
                    key={s.label}
                    type="button"
                    disabled={!enabled}
                    aria-current={actual ? 'step' : undefined}
                    onClick={() => enabled && go(i, i > index ? 1 : -1)}
                    className={`onb-nodo ${actual ? 'es-actual' : ''} ${hecho ? 'es-hecho' : ''} ${!enabled ? 'es-bloqueado' : ''}`}
                  >
                    <span className="onb-nodo-punto">
                      {hecho && !actual ? <Check /> : !enabled ? <Lock /> : <s.Icon />}
                    </span>
                    <span className="onb-nodo-texto">
                      <span className="onb-nodo-num">Paso {i + 1}</span>
                      <span className="onb-nodo-nombre">{s.label}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* ── El paso ── */}
          <section className="onb-paso flex flex-col min-h-0">
            {/* Sin «01», sin «Paso 1 de 8» y sin barras (Fernando, 2026-10-29): el camino de la
                izquierda ya dice en qué paso se está. El nombre del paso solo se escribe aquí
                cuando el camino no se ve (teléfono); la pregunta del último paso, siempre. */}
            <header className={`onb-cabecera ${isForm ? '' : 'es-sin-titulo'}`}>
              <h2 className={`onb-titulo min-w-0 flex-1 ${isForm ? '' : 'lg:hidden'}`}>{title}</h2>
              <BotonCerrar onClick={onClose} />
            </header>

            <div className="onb-cuerpo flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
              <div key={index} style={{ animation: `${animName} 0.45s cubic-bezier(0.22,1,0.36,1)` }}>
                {isForm || !SlideComponent ? (
                  <CandidateForm
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
                ) : (
                  <SlideComponent />
                )}
                {(isForm || !SlideComponent) && (
                  <div className="mt-5">
                    <Captcha onCambio={setCaptcha} reinicio={reinicioCaptcha} tema="oscuro" />
                    {errorEnvio && (
                      <p role="alert" className="mt-3 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-[13px] leading-relaxed text-red-300 onb-error">
                        {errorEnvio}
                      </p>
                    )}
                  </div>
                )}
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
                  <button
                    type="button"
                    onClick={enviar}
                    disabled={!formOk}
                    className="onb-boton onb-boton-avanzar"
                  >
                    <Send />
                    Comenzar mi aventura
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => acceptedHere && next()}
                    disabled={!acceptedHere}
                    title={acceptedHere ? undefined : 'Marca la casilla de este apartado para continuar'}
                    className="onb-boton onb-boton-avanzar"
                  >
                    {index === total - 1 ? 'Postularme' : 'Siguiente'}
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

/**
 * EL FORMULARIO DE POSTULACIÓN DENTRO DE LA PÁGINA CANDIDATOS (Fernando, 2026-11-01: «quita de la
 * pantalla de inicio la tarjeta… lo dejo acá en la pestaña de candidatos, con la misma restricción»).
 * Los mismos campos, aceptaciones y captcha que el último paso del diálogo, y la MISMA pausa por
 * equipo: si desde aquí ya se creó un registro, se avisa en vez de enseñar el formulario (y el
 * servidor lo vuelve a comprobar al enviar).
 */
export function PostulacionEnPagina() {
  const registro = useEstadoRegistro();
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [marketing, setMarketing] = useState(false);
  const [finalAccepted, setFinalAccepted] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [reinicioCaptcha, setReinicioCaptcha] = useState(0);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const formOk = emailOk && reason.trim().length >= 10 && finalAccepted && !!captcha && !enviando;

  const enviar = async () => {
    if (!formOk || !captcha) return;
    setEnviando(true);
    setErrorEnvio(null);
    const error = await enviarPostulacion({ email: email.trim(), reason: reason.trim(), marketing, altcha: captcha });
    setEnviando(false);
    if (error) {
      setErrorEnvio(error);
      setReinicioCaptcha((n) => n + 1);
      return;
    }
    setEnviada(true);
  };

  if (enviada) {
    return (
      <div className="postulacion-aviso" role="status">
        <Send aria-hidden />
        <div>
          <p className="postulacion-aviso-titulo">Tu postulación está en revisión</p>
          <p style={pStyle}>
            Tu propuesta quedó registrada y está <strong style={strong}>en espera de aprobación</strong> por
            parte del administrador del proyecto. Te avisaremos a <strong style={strong}>{email.trim()}</strong>{' '}
            cuando sea aprobada.
          </p>
        </div>
      </div>
    );
  }
  if (registro === null) return <p style={pStyle}>Comprobando…</p>;
  if (registro.bloqueado) {
    return (
      <div className="postulacion-aviso" role="status">
        <Clock aria-hidden />
        <div>
          <p className="postulacion-aviso-titulo">Postulación: en pausa</p>
          <p style={pStyle}>
            Desde este equipo ya se creó un registro hace poco. Para evitar registros en cadena, cada
            equipo puede crear un registro cada 24 horas. Podrás postularte a partir del{' '}
            <strong style={strong}>{horaDeReanudacion(registro.hasta)}</strong>.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <CandidateForm
        email={email}
        setEmail={setEmail}
        emailOk={emailOk}
        reason={reason}
        setReason={setReason}
        termsAccepted={finalAccepted}
        onToggleTerms={() => setFinalAccepted((v) => !v)}
        marketing={marketing}
        onToggleMarketing={() => setMarketing((v) => !v)}
        enfocar={false}
      />
      <div>
        <Captcha onCambio={setCaptcha} reinicio={reinicioCaptcha} tema="claro" />
        {errorEnvio && (
          <p role="alert" className="mt-3 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-[13px] leading-relaxed text-red-700">
            {errorEnvio}
          </p>
        )}
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={enviar} disabled={!formOk} className="postulacion-enviar">
          <Send aria-hidden />
          {enviando ? 'Enviando…' : 'Enviar mi postulación'}
        </button>
      </div>
    </div>
  );
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

function CandidateForm({
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

type AccordionItem = { name: string; summary: string; body: () => React.ReactNode };

/** Lista de tarjetas expandibles (una abierta a la vez). Reutilizada por varios sliders. */
function Accordion({ items }: { items: AccordionItem[] }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((t, i) => {
        const isOpen = open === i;
        return (
          <div
            key={t.name}
            className={`rounded-lg border bg-digi-card overflow-hidden transition-colors ${
              isOpen ? 'border-accent' : 'border-digi-border'
            }`}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : i)}
              className="w-full flex items-center gap-3 p-3.5 text-left"
            >
              <span style={stepNum}>{i + 1}</span>
              <span className="flex-1 min-w-0">
                <span style={cardTitle}>{t.name}</span>
                {!isOpen && (
                  <span style={{ ...cardDesc, display: 'block', marginTop: 2 }}>{t.summary}</span>
                )}
              </span>
              <ChevronDown
                className={`w-4 h-4 shrink-0 transition-transform ${
                  isOpen ? 'rotate-180 text-accent' : 'text-digi-muted'
                }`}
              />
            </button>
            {isOpen && (
              <div
                className="px-3.5 pb-4 pt-0 border-t border-digi-border flex flex-col gap-2.5"
                style={{ animation: 'onbFadeUp 0.3s ease-out', paddingTop: 14 }}
              >
                {t.body()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

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

const kickerStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--color-digi-muted)',
};

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

const stepNum: React.CSSProperties = {
  width: 34,
  height: 34,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'var(--font-body)',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#ffffff',
  background: 'var(--color-accent)',
  borderRadius: 6,
};

// Solo color de texto: sin relleno ni borde (Fernando, 2026-10-29: las etiquetas con fondo y
// borde «no me gustan y no las quiero ver en otras partes»).
const KEYFRAMES = `
@keyframes onbInRight { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: translateX(0); } }
@keyframes onbInLeft { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: translateX(0); } }
@keyframes onbFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;
