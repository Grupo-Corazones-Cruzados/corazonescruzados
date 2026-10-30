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
 * (`pStyle`, `cardBase`, `cardTitle`, `cardDesc`, `chip`, `noteBox`, `stepNum`,
 * `kickerStyle`) — todas apuntan a los **tokens** `--color-digi-*` / `--color-accent*`,
 * así que cambiarlas (o cambiar los tokens de `.corp`) retematiza los 8 pasos y
 * funciona igual en claro y oscuro. NO usar hex crudos en los sliders.
 */

import Captcha from '@/components/landing/Captcha';
import { horaDeReanudacion, useEstadoRegistro } from '@/components/landing/estadoRegistro';
import { AuthDialog, BotonAuth } from '@/components/landing/AuthSurface';
import { useState } from 'react';
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
  Layers3,
  Lock,
  RefreshCw,
  Send,
  TrendingUp,
  Wrench,
  X,
} from 'lucide-react';
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
  id: string;
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

const PISOS: { name: string; desc: string }[] = [
  {
    name: 'Global',
    desc: 'Gobierna los sistemas fundamentales de la organización y toma las decisiones de alto nivel que hacen posible el crecimiento de cada etapa.',
  },
  {
    name: 'Pilar',
    desc: 'Diseña y gestiona los proyectos aprobados, dándoles forma y dirección para que estén listos para ejecutarse.',
  },
  {
    name: 'Controlador',
    desc: 'Traduce cada proyecto en tareas concretas y las asigna a quienes las llevarán a cabo.',
  },
  {
    name: 'Colaborador',
    desc: 'Ejecuta con precisión las tareas asignadas. Es el lugar donde las ideas se transforman en trabajo terminado.',
  },
];

const PASOS: { n: string; name: string; desc: string }[] = [
  {
    n: '01',
    name: 'Fundamentación',
    desc: 'Todo comienza con el porqué. Aquí investigamos y construimos la base de conocimiento que respalda el proyecto, para que nada se edifique sobre suposiciones.',
  },
  {
    n: '02',
    name: 'Creación',
    desc: 'Con los cimientos listos, damos forma al planteamiento: la idea ya fundamentada se convierte en una propuesta concreta y accionable.',
  },
  {
    n: '03',
    name: 'Implementación',
    desc: 'Llevamos el proyecto puertas adentro: configuramos su gestión interna, definimos políticas y reglas de negocio, y asignamos los roles y responsabilidades que lo mantendrán en marcha.',
  },
  {
    n: '04',
    name: 'Gestión',
    desc: 'Finalmente lo abrimos al mundo. Publicación, marketing y monetización para que el proyecto crezca y genere valor real.',
  },
];

/**
 * EL MODELO 4P COMO TABLA (Fernando, 2026-10-29: «quitemos las pestañas… en formato tabla, los
 * 4 pisos con su nombre y número, y los 4 pasos uno a la derecha del otro, porque es la forma
 * correcta de representar el modelo organizacional 4P»).
 *
 * Filas = los 4 PISOS (del gobierno, arriba, a la ejecución, abajo); columnas = los 4 PASOS (de
 * izquierda a derecha, en el orden en que se recorren). Cada cruce es un punto: en toda etapa
 * participan los cuatro roles. Al pasar por un piso, un paso o un cruce, se iluminan su fila y su
 * columna; la descripción de cada uno queda en su `title`.
 */
function Modelo4P() {
  const [foco, setFoco] = useState<{ piso: number | null; paso: number | null }>({ piso: null, paso: null });
  const soltar = () => setFoco({ piso: null, paso: null });
  return (
    <div className="modelo-4p" onMouseLeave={soltar}>
      <table>
        <caption className="sr-only">Modelo Organizacional 4P: los 4 pisos (filas) por los 4 pasos (columnas)</caption>
        <thead>
          <tr>
            <th scope="col" className="m4p-esquina">
              <span className="m4p-esquina-pasos">Pasos →</span>
              <span className="m4p-esquina-pisos">Pisos ↓</span>
            </th>
            {PASOS.map((s, j) => (
              <th
                key={s.name}
                scope="col"
                title={s.desc}
                className={`m4p-paso ${foco.paso === j ? 'es-foco' : ''}`}
                onMouseEnter={() => setFoco({ piso: null, paso: j })}
                onClick={() => setFoco({ piso: null, paso: j })}
              >
                <span className="m4p-num">{j + 1}</span>
                <span className="m4p-nombre">{s.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PISOS.map((p, i) => (
            <tr key={p.name}>
              <th
                scope="row"
                title={p.desc}
                className={`m4p-piso ${foco.piso === i ? 'es-foco' : ''}`}
                onMouseEnter={() => setFoco({ piso: i, paso: null })}
                onClick={() => setFoco({ piso: i, paso: null })}
              >
                <span className="m4p-num">{i + 1}</span>
                <span className="m4p-nombre">{p.name}</span>
              </th>
              {PASOS.map((s, j) => {
                const enFila = foco.piso === i;
                const enColumna = foco.paso === j;
                return (
                  <td
                    key={s.name}
                    className={`m4p-cruce ${enFila || enColumna ? 'es-foco' : ''} ${enFila && enColumna ? 'es-cruce' : ''}`}
                    onMouseEnter={() => setFoco({ piso: i, paso: j })}
                onClick={() => setFoco({ piso: i, paso: j })}
                    aria-label={`${p.name} en ${s.name}`}
                  >
                    <span className="m4p-punto" aria-hidden="true" />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SlideModelo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <p style={pStyle}>
        Este es el <strong style={strong}>proyecto de desarrollo humano</strong> del <strong style={strong}>Grupo Corazones Cruzados</strong>. Estamos aquí para luchar por un sueño, que es transformar el mundo, y construir un futuro mejor. Lo que queremos impulsar es el reconocimiento y aprovechamiento de las condiciones de los sujetos, para lograr estrategias organizacionales que logren resolver nuestras problemáticas sociales. Para alcanzar un objetivo tan grande como éste, trabajaremos usando como base el{' '}
        <strong style={strong}>Modelo Organizacional 4P</strong>: el cual consiste en descubrir el talento de cada sujeto para posicionarlo en determinado rol y función de cualquier proyecto. Dicho esto, el modelo se distribuye de la siguiente manera:
      </p>

      <Modelo4P />

      {/* Cómo se lee la tabla (Fernando, 2026-10-29, texto literal). La última es la conclusión. */}
      <ol className="m4p-reglas">
        {REGLAS_4P.map((r, i) => (
          <li key={i} className={i === REGLAS_4P.length - 1 ? 'es-conclusion' : ''}>
            <span className="m4p-regla-num" aria-hidden="true">{i + 1}</span>
            <span>{r}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const REGLAS_4P = [
  'Cada piso representa un rol en la organización que cumple con una necesidad en la gestión de un proyecto.',
  'Cada paso representa una función en el levantamiento y progreso de cualquier proyecto.',
  'Cada miembro de la organización se le asigna un piso y paso de acuerdo a su talento.',
  'Según el piso y paso que tenga asignado el miembro, se tiene acceso a un conjunto de sistemas.',
  'Cada sistema se activa según la necesidad del proyecto en el que participe el miembro.',
  'La necesidad determina todo lo que hacemos.',
];

/* ------------------------------------------------------------------ */
/* Slider 2 — Herramientas                                            */
/* ------------------------------------------------------------------ */

const COND_STEPS = ['Reconocer', 'Controlar', 'Predecir', 'Experimentar', 'Convertir', 'Cambiar'];

/**
 * LOS SEIS PASOS DE LA METODOLOGÍA como un RECORRIDO (Fernando, 2026-10-29): una línea con un
 * nodo por paso y, debajo, el número y el nombre SOLO con color de texto — nada de etiquetas con
 * relleno ni borde (*«ese estilo ya he dicho antes que no me gusta»*). Seis en fila desde `sm`;
 * en el teléfono, dos filas de tres. Estilos `.cond-*` en globals.css.
 */
function PasosCondiciologia() {
  return (
    <ol className="cond-pasos" aria-label="Los seis pasos de la Metodología Condiciológica">
      {COND_STEPS.map((s, i) => (
        <li key={s} className="cond-paso">
          <span className="cond-nodo" aria-hidden="true" />
          <span className="cond-num">{String(i + 1).padStart(2, '0')}</span>
          <span className="cond-nombre">{s}</span>
        </li>
      ))}
    </ol>
  );
}

const TOOLS: AccordionItem[] = [
  {
    name: 'Metodología Condiciológica',
    summary: 'Una metodología científica de seis pasos, aplicable a cualquier ámbito de investigación.',
    // Texto de Fernando (2026-10-29), literal.
    body: () => (
      <>
        <p style={cardDesc}>
          La <strong style={strong}>Metodología Condiciológica</strong> es una metodología con
          enfoque científico que fue creada para desarrollar la investigación de la Condiciología a
          través de <strong style={strong}>seis pasos</strong>, los cuales son aplicables en
          cualquier ámbito de investigación.
        </p>
        <PasosCondiciologia />
        <p style={cardDesc}>
          Cada paso espera un conjunto de parámetros que están siendo determinados por la{' '}
          <strong style={strong}>Condiciología</strong>, la cual es una ciencia en desarrollo que se
          basa en evidenciar el estudio de las <strong style={strong}>condiciones</strong> como un
          conjunto de factores que conforman la generación de un comportamiento dentro de un
          instante de la realidad.
        </p>
        <p style={cardDesc}>
          Para obtener los datos que esperan los parámetros de los pasos de la metodología, se
          utilizan diferentes fuentes de datos que vienen de herramientas que se ofrecerán solo a
          candidatos y miembros de la organización para según las condiciones del servicio, acepte
          consumir, o no hacer uso de las herramientas que disponemos para ellos.
        </p>
      </>
    ),
  },
  {
    name: 'Sistema de Control Psicosocial',
    summary: 'Una arquitectura tecnológica contra la inseguridad física, basada en las señales de todos.',
    // Texto de Fernando (2026-10-29), literal.
    body: () => (
      <>
        <p style={cardDesc}>
          El <strong style={strong}>Sistema de Control Psicosocial</strong> es una arquitectura con
          enfoque tecnológico que busca resolver principalmente la problemática de{' '}
          <strong style={strong}>inseguridad física</strong>, siendo un sistema que está basado en
          señales indicadas por la gran masa de clientes, candidatos, y miembros de la organización.
        </p>
        <p style={cardDesc}>
          Este sistema pretende dibujar la realidad a través de señales recibidas por parte de todos
          los dispositivos asociados que están siendo utilizados por usuarios del sistema,
          incluyendo usuarios de tipo agente con Inteligencia Artificial.
        </p>
        <p style={cardDesc}>
          Lo que propone este sistema es llevar la seguridad física y la aplicación de la ley a un
          nivel <strong style={strong}>«ipso facto»</strong>, es decir que el acto delictivo tenga
          consecuencias en el momento sin requerir tiempo de procesos, intermediarios, o roles que solo
          alargan o incluso disminuyen la carga real de una condena.
        </p>
        <p style={cardDesc}>
          Su función principal es <strong style={strong}>organizar a las masas</strong> a través de
          un sistema que castiga el delito, y recompensa de muchas maneras a los denunciantes.
        </p>
      </>
    ),
  },
  {
    name: 'Proyecto Centralizado',
    summary: 'Un servicio para negocios que necesitan recuperar o mejorar su flujo de trabajo.',
    // Texto de Fernando (2026-10-29), literal.
    body: () => (
      <>
        <p style={cardDesc}>
          El <strong style={strong}>Proyecto Centralizado</strong> del Grupo Corazones Cruzados es un
          servicio exclusivo que se ofrece a clientes, candidatos, y miembros de la organización, el
          cual busca ser una solución para negocios que tienen condiciones de necesidad/problemáticas
          internas/crisis que requieren alguna intervención para recuperar el correcto funcionamiento
          del flujo de trabajo, o descubrir mejores formas de seguir haciendo.
        </p>
        <p style={cardDesc}>
          Para ofrecer este servicio se requiere llegar a un{' '}
          <strong style={strong}>previo acuerdo con el dueño del negocio</strong>, que incluye
          condiciones de acceso y control temporal en los departamentos afectados para poder
          implementar todos los sistemas de gobernanza del Grupo Corazones Cruzados.
        </p>
        <p style={cardDesc}>
          Existen otros beneficios adicionales por conectarse al Proyecto Centralizado debido a que
          los negocios afiliados serían parte de la{' '}
          <strong style={strong}>Estrategia Organizacional</strong>, la cual conecta otros negocios
          y talentos para adoptar las mejores soluciones y crear oportunidades.
        </p>
      </>
    ),
  },
  {
    name: 'Violeta',
    summary: 'La luz que nos representa, el color que une corazones.',
    // Texto de Fernando (2026-10-29), literal.
    body: () => (
      <>
        <p style={cardDesc}>
          <strong style={strong}>Violeta es la luz que nos representa</strong>, el color que une
          corazones, y un lugar para aquellos que son diferentes. Esta luz, ilumina el vacío y lo
          aprovecha, une destinos mientras destruye sus formas, y convierte todo lo que parece
          imposible, en sueños y felicidad.
        </p>
        <p style={cardDesc}>
          Es aquello que amamos, y luego aparece cuando recordamos nuestras raíces; es una expresión
          tan humana, tan natural, y es eso que sientes en el pálpito, en cada golpe, en cada
          esfuerzo, y con cada lágrima que derramaste mientras todo lo que no querías, se movía a tu alrededor. Violeta
          es el mundo de afuera y lo de adentro, la verdad que no queremos aceptar, el problema que
          estamos confrontando, y la nostalgia que sientes cuando recuerdas ese preciso momento
          cuando todo lo malo cambió.
        </p>
        <p style={cardDesc}>
          Comprender esta fuerza que nos hace soñar, desear, y buscar sin saber cuándo deberíamos
          parar; ese deseo insaciable por insistir y descubrir aquello tan profundo que no cabe en el
          pecho, y que además tiene la habilidad de cruzar los corazones, los sentimientos y
          transformar la realidad.
        </p>
        <p style={cardDesc}>
          Violeta es el reto de todos los candidatos y los miembros que ansiamos alcanzar, ese sueño
          eterno por proteger la calidad de lo que nos hace humanos, el futuro de nuestros hijos, y convertirnos en los líderes dispuestos a cambiar el mundo. Violeta es un sueño que se puede
          medir a través de la prospección, y todos quienes participan en este proyecto demostrarán a
          través de la <strong style={strong}>evaluación continua</strong> si son capaces de representar los
          valores y una bandera que logrará cruzar al mundo.
        </p>
      </>
    ),
  },
];

function SlideHerramientas() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={pStyle}>
        El <strong style={strong}>Modelo Organizacional 4P</strong> funciona como un motor que para
        operar necesita tener en buenas condiciones sus requisitos. Lo que requerimos para este motor
        es un <strong style={strong}>talento correctamente clasificado</strong> que se pueda tratar y
        posicionar en función de la estrategia organizacional. Para hacer esta correcta
        clasificación nos apoyaremos de las <strong style={strong}>herramientas del Modelo</strong>,
        las cuales van a ser las fuentes de información que justificarán el posicionamiento de cada
        miembro. Las herramientas que usaremos son las siguientes:
      </p>
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
        <p style={cardDesc}>
          Creemos que un corazón —y una organización— puede representar esa{' '}
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
          resolverlos. Esa <strong style={strong}>realidad imposible</strong> —donde los valores se
          unen y la organización se fortalece por encima de la separación— solo puede enfrentarse
          con una <strong style={strong}>disciplina centralizada</strong>: un sueño único y
          compartido, trabajado cada día, que resuelve los problemas sociales paso a paso hasta
          limpiar nuestras calles, y el mundo, de aquello que está mal.
        </p>
      </>
    ),
  },
  {
    name: 'El poder se construye, no se decide',
    summary: 'El liderazgo legítimo se gana con acciones, no con votos.',
    body: () => (
      <>
        <p style={cardDesc}>
          Crecimos creyendo que la democracia, a través del voto, era la mejor forma de elegir a
          quienes nos representan. Pero, con demasiada frecuencia, ese camino ha terminado en
          corrupción y en entregar poder a quien no lo ha merecido. Tener acceso a recursos que no
          se han ganado, solo porque otros los conceden por confianza, no es un liderazgo legítimo.
        </p>
        <p style={cardDesc}>
          El verdadero poder no se decide: se <strong style={strong}>construye</strong>, se{' '}
          <strong style={strong}>gana</strong> y se sostiene cuando la gente reconoce a su líder
          por convicción, no porque deba elegir entre opciones que no la representan. Ni siquiera el
          voto nulo ofrece una salida: es apenas un vacío que nunca nos ha permitido elegir algo
          distinto.
        </p>
        <p style={cardDesc}>
          Por eso creemos que el liderazgo debe surgir de una <strong style={strong}>causa social
          genuina</strong>, nacida de la vida, las razones y las acciones de quien la encarna —no de
          la pertenencia a un partido—. Un líder se impone por naturaleza: si es capaz de movilizar
          a las personas y de habitar su corazón, es un líder nato; si no logra moverlas,
          sencillamente no lo es.
        </p>
        <p style={cardDesc}>
          Cuando existen preferencias divididas, su tarea es ganarse el corazón de todos; y si eso
          no es posible, entonces no había un solo líder, sino dos. El liderazgo es vivo y
          cambiante, pero siempre auténtico: se conquista con acciones reales, sin falsos positivos
          ni voluntades compradas. Eso —y no una votación— es lo que da legitimidad al poder.
        </p>
      </>
    ),
  },
];

function SlideMotivos() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={pStyle}>
        Más allá del <em>cómo</em>, importa el <strong style={strong}>porqué</strong>. Estos son
        los motivos que dan sentido a la existencia del Grupo Corazones Cruzados. Toca cada uno
        para leerlo.
      </p>
      <Accordion items={MOTIVOS} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slider 4 — Onboarding (3 reglas)                                   */
/* ------------------------------------------------------------------ */

// Cada valor se asocia a un compromiso (el "no" que lo encarna).
const VALORES: { valor: string; compromiso: string }[] = [
  { valor: 'Determinación', compromiso: 'no nos rendimos.' },
  { valor: 'Coraje', compromiso: 'no somos cobardes.' },
  { valor: 'Pureza', compromiso: 'no actuamos con malas intenciones ni causamos daño a otros.' },
  { valor: 'Fe', compromiso: 'no perdemos la fe ante lo que parece imposible.' },
  { valor: 'Paciencia', compromiso: 'no caemos en la desesperación.' },
  {
    valor: 'Seriedad',
    compromiso: 'no postergamos nuestros objetivos ni traicionamos nuestra palabra.',
  },
  { valor: 'Espontaneidad', compromiso: 'no manipulamos lo que mostramos.' },
  { valor: 'Autonomía', compromiso: 'no esperamos a que otros resuelvan nuestros problemas.' },
  { valor: 'Empatía', compromiso: 'no ignoramos los sentimientos de los demás.' },
];

const REGLAS: AccordionItem[] = [
  {
    name: 'Regla 1 · ¿Quiénes somos?',
    summary: 'Representamos lo que somos: un solo fallo a los valores nos deja fuera.',
    body: () => (
      <>
        <p style={cardDesc}>
          Esta regla invita a comprender quién es la persona que representa al proyecto, porque cada
          uno, con sus características, define <strong style={strong}>quiénes somos</strong> como
          organización. Si un candidato fuera un delincuente, el grupo sería un delincuente; si
          fuera un mentiroso, el grupo sería un mentiroso. Lo que somos se refleja en cada candidato
          y en cada miembro.
        </p>
        <p style={cardDesc}>
          Por eso un solo fallo a los valores del Grupo Corazones Cruzados nos deja fuera. Todos los
          candidatos están en desarrollo de estos valores y trabajan, día a día, en encarnar quiénes
          somos. Cada valor se traduce en un compromiso concreto:
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
        <p style={cardDesc}>
          Cuando un candidato logra representarlos, un miembro <strong style={strong}>Global</strong>{' '}
          del paso de <strong style={strong}>Implementación</strong> decide convertirlo en miembro.
        </p>
      </>
    ),
  },
  {
    name: 'Regla 2 · Comandos',
    summary: 'La gobernanza escucha, decide y corrige tras el resultado; los comandos se cumplen.',
    body: () => (
      <>
        <p style={cardDesc}>
          Aquí la gobernanza <strong style={strong}>escucha, decide y recibe correcciones</strong>{' '}
          después de ver un resultado. A diferencia de otras formas de gestión, en el Grupo
          Corazones Cruzados usamos la metodología condiciológica para medir resultados y reconocer
          las condiciones que más benefician al proyecto.
        </p>
        <p style={cardDesc}>
          Para aprovechar una condición, el líder toma una decisión tras escuchar las propuestas y
          discusiones. Una vez decidida, la decisión se <strong style={strong}>ejecuta</strong>, se{' '}
          <strong style={strong}>mide</strong> y solo se <strong style={strong}>cambia</strong> si
          los resultados fueron negativos; si fueron positivos, avanzamos al siguiente paso de
          crecimiento.
        </p>
        <p style={cardDesc}>
          La relación entre el líder, los miembros y los candidatos se sostiene en los comandos:
          todos seguimos el comando enviado para cumplir el planteamiento de la decisión. Un comando
          que no se acata distorsiona el cálculo de la metodología, y por eso quien no lo cumple
          queda fuera del proyecto. Los comandos se ejecutan sin cuestionamientos y solo se
          corrigen, en conjunto, después de ver su resultado.
        </p>
      </>
    ),
  },
  {
    name: 'Regla 3 · Opciones de crecimiento',
    summary: 'Creces desde el primer día; la confianza se gana con afinidad y no se traiciona.',
    body: () => (
      <>
        <p style={cardDesc}>
          Todos los candidatos y miembros pueden crecer en el grupo{' '}
          <strong style={strong}>desde el primer momento</strong> en que se unen. El crecimiento se
          adapta a la necesidad de cada persona: valoramos su talento y buscamos darle los recursos
          que necesita.
        </p>
        <p style={cardDesc}>
          La confianza, en cambio, depende de la <strong style={strong}>proactividad</strong> y la{' '}
          <strong style={strong}>afinidad</strong> con el proyecto: mientras más afín seas, más
          confianza y más opciones de obtener recursos para alcanzar tus objetivos personales
          recibirás. Es una confianza plena —sin reclamos ni sospechas, más allá del análisis que
          hacemos a todos—.
        </p>
        <p style={cardDesc}>
          Esa confianza se entrega <strong style={strong}>una sola vez</strong>. Si una opción de
          crecimiento se usa como abuso o para fines distintos a los acordados, la decisión es la
          destitución, porque la confianza no se recupera tras una traición. Si surge una necesidad
          que no sea de desarrollo humano o crecimiento, también puede solicitarse: por eso no hay
          excusa para mentir o abusar de los recursos. Mantén las buenas intenciones, y las opciones
          de crecimiento llegarán.
        </p>
      </>
    ),
  },
];

function SlideOnboarding() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={pStyle}>
        Tres reglas rigen todo el proyecto y deben respetarse en cada paso. Toca cada una para
        leerla.
      </p>
      <WarnBox>
        <strong className="font-semibold">Estas reglas no se negocian.</strong> Cualquier intento de
        faltar a una sola de ellas implica la <strong className="font-semibold">destitución</strong>{' '}
        del candidato —y aplica igual a los miembros en cualquier rol—. Quien es destituido no tiene
        una segunda oportunidad; solo los fallos <em>no intencionales</em> se evalúan y pueden no
        acarrear destitución.
      </WarnBox>
      <Accordion items={REGLAS} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slider 5 — Método de crecimiento (pirámide jerárquica)            */
/* ------------------------------------------------------------------ */

const CRECIMIENTO: { n: number; title: string; tag: string; text: () => React.ReactNode }[] = [
  {
    n: 1,
    title: 'Talento',
    tag: 'El origen del potencial',
    text: () => (
      <>
        Es lo más importante, porque es el <strong style={strong}>origen del potencial de
        crecimiento</strong>: es lo que le da a una persona valor social y la acerca al éxito.
        Cuando ese talento se reconoce y se aprovecha, todo lo demás tiene sobre qué construirse.
      </>
    ),
  },
  {
    n: 2,
    title: 'Valores',
    tag: 'Fortaleza ante el mundo',
    text: () => (
      <>
        Ocupan el segundo lugar, porque son las <strong style={strong}>características que
        fortalecen al sujeto</strong> frente al mundo. Al aceptar y mostrar su naturaleza con
        valores sólidos, las personas a su alrededor se sienten más afines y confían más en apoyar
        su talento.
      </>
    ),
  },
  {
    n: 3,
    title: 'Dimensiones de desarrollo humano',
    tag: 'Laboral · Corporal · Social · Mental',
    text: () => (
      <>
        En tercer lugar están las cuatro dimensiones del desarrollo humano —{' '}
        <strong style={strong}>laboral, corporal, social y mental</strong>—. De forma natural, quien
        tiene talento y buenos valores tiende a desarrollarlas. Cuando faltan esas dos bases, el
        desarrollo se resiente y aparecen los problemas: malestar mental, físico, social o laboral.
        Y si las bases están bien pero el desarrollo aun así falla, es señal de problemas o
        estancamientos que no se están superando; entonces analizamos cada dimensión —sus problemas,
        las situaciones asociadas y sus causas— y definimos logros y objetivos para resolverlos.
      </>
    ),
  },
  {
    n: 4,
    title: 'Red de apoyo',
    tag: 'Un complemento, no una base',
    text: () => (
      <>
        Es el aspecto de <strong style={strong}>menor peso</strong>, porque nadie necesita una red
        de apoyo para tener éxito. Es común que, tras muchos fracasos, alguien culpe a la falta de
        una red —para conseguir trabajo, estudiar o recibir consejos— y envidie a quienes sí la
        tuvieron. Pero la red de apoyo es solo un <strong style={strong}>complemento</strong>: el
        origen del crecimiento está, sobre todo, en el talento que quizá no se aprovecha, en los
        valores que no se trabajan y en las dimensiones afectadas por ello. Aun así, una buena red
        fortalece a quien ya tiene bases y ayuda a quien no las tiene; y quien no tiene ni red ni
        bases parte de una situación de crecimiento muy baja, que justamente este método permite
        abordar.
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
      <p style={pStyle}>
        El crecimiento de cada persona se analiza con un método de cuatro aspectos clave, ordenados
        por importancia. Toca cada nivel de la pirámide para conocer su justificación.
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
          <p style={cardDesc}>{a.text()}</p>
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
/* Slider 6 — Lideración sobre Acciones (diagrama triangular)         */
/* ------------------------------------------------------------------ */

/** Nodo del diagrama: tarjeta Fluent (blanca o rellena de accent para el líder). */
function CycleNode({
  x,
  y,
  w,
  h,
  title,
  lines,
  filled = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  lines: string[];
  filled?: boolean;
}) {
  const cx = x + w / 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        style={
          filled
            ? { fill: 'var(--color-accent)', stroke: 'var(--color-accent)' }
            : { fill: 'var(--color-digi-card)', stroke: 'var(--color-digi-border)' }
        }
        strokeWidth={1.5}
      />
      <text
        x={cx}
        y={y + 22}
        textAnchor="middle"
        fontSize={13}
        fontWeight={600}
        style={{ fill: filled ? '#ffffff' : 'var(--color-digi-text)' }}
      >
        {title}
      </text>
      {lines.map((l, i) => (
        <text
          key={l}
          x={cx}
          y={y + 38 + i * 13}
          textAnchor="middle"
          fontSize={11}
          style={{ fill: filled ? 'rgba(255,255,255,0.85)' : 'var(--color-digi-muted)' }}
        >
          {l}
        </text>
      ))}
    </g>
  );
}

function SlideLideracion() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={pStyle}>
        El liderazgo en el Grupo Corazones Cruzados gira en torno a las acciones, en un ciclo
        continuo entre el líder, el grupo y sus miembros.
      </p>

      <div className="rounded-lg border border-digi-border bg-digi-card p-4">
        <svg
          viewBox="0 0 380 320"
          width="100%"
          style={{
            maxWidth: 480,
            height: 'auto',
            display: 'block',
            margin: '0 auto',
            fontFamily: 'var(--font-body)',
          }}
          role="img"
          aria-label="Ciclo: el Líder escucha y decide; GCC ejecuta sin cuestionamientos; los Miembros discuten y corrigen; el ciclo vuelve al líder."
        >
          <defs>
            <marker
              id="lid-arrow"
              markerWidth="10"
              markerHeight="10"
              refX="7"
              refY="3.2"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M0,0 L7,3.2 L0,6.4 Z" style={{ fill: 'var(--color-accent)' }} />
            </marker>
          </defs>

          {/* Medallón central — el ciclo gira en torno a las acciones */}
          <circle
            cx={190}
            cy={186}
            r={35}
            style={{ fill: 'var(--color-accent-light)', stroke: 'var(--color-accent)' }}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <text
            x={190}
            y={183}
            textAnchor="middle"
            fontSize={9}
            fontWeight={600}
            style={{ fill: 'var(--color-accent)', letterSpacing: '0.08em' }}
          >
            ACCIONES
          </text>
          <text
            x={190}
            y={196}
            textAnchor="middle"
            fontSize={8}
            style={{ fill: 'var(--color-digi-muted)' }}
          >
            ciclo continuo
          </text>

          {/* Flechas curvas del ciclo: Líder → GCC → Miembros → Líder */}
          <g
            fill="none"
            style={{ stroke: 'var(--color-accent)' }}
            strokeWidth={2}
            strokeLinecap="round"
            markerEnd="url(#lid-arrow)"
          >
            <path d="M240 92 Q 326 150 296 224" />
            <path d="M224 264 Q 190 300 156 264" />
            <path d="M84 224 Q 54 150 144 92" />
          </g>

          {/* Badges de orden sobre el ciclo */}
          {[
            { x: 300, y: 154, n: 1 },
            { x: 190, y: 286, n: 2 },
            { x: 84, y: 154, n: 3 },
          ].map((b) => (
            <g key={b.n}>
              <circle cx={b.x} cy={b.y} r={10} style={{ fill: 'var(--color-accent)' }} />
              <text
                x={b.x}
                y={b.y + 3.4}
                textAnchor="middle"
                fontSize={10}
                fontWeight={600}
                fill="#ffffff"
              >
                {b.n}
              </text>
            </g>
          ))}

          {/* Nodos del ciclo */}
          <CycleNode
            x={124}
            y={28}
            w={132}
            h={58}
            title="Líder"
            lines={['Escucha y', 'Decide']}
            filled
          />
          <CycleNode
            x={228}
            y={228}
            w={132}
            h={60}
            title="GCC"
            lines={['Ejecuta sin', 'cuestionamientos']}
          />
          <CycleNode
            x={20}
            y={228}
            w={132}
            h={60}
            title="Miembros"
            lines={['Discuten y', 'Corrigen']}
          />
        </svg>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slider 7 — Afiliación (indicaciones del proceso)                  */
/* ------------------------------------------------------------------ */

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
    name: 'Recibe tu acceso y tu pulsera gris',
    desc: () => (
      <>
        Como candidato recibirás una invitación, acceso al sitio web como{' '}
        <strong style={strong}>usuario candidato</strong> y la <strong style={strong}>pulsera gris
        del GCC</strong>, que representa tu grado de afiliación. Desde ese momento puedes usar las
        herramientas del grupo para tu desarrollo humano; encontrarás todos sus detalles dentro del
        sitio web.
      </>
    ),
  },
  {
    n: '03',
    name: 'Lleva tu pizarra de visión personal',
    desc: () => (
      <>
        Los candidatos aceptados reciben una <strong style={strong}>pizarra de visión personal</strong>{' '}
        que deberán llevar a todas las reuniones semanales —siempre presenciales— con los miembros
        controladores del proyecto.
      </>
    ),
  },
  {
    n: '04',
    name: 'Asiste a las reuniones semanales',
    desc: () => (
      <>
        Allí recibirás todas las indicaciones sobre <strong style={strong}>cómo demostrar tu
        afiliación</strong> y los comandos que deberás ejecutar.
      </>
    ),
  },
  {
    n: '05',
    name: 'Demuestra los valores',
    desc: () => (
      <>
        Tu objetivo es demostrar y representar los valores esperados. La afiliación{' '}
        <strong style={strong}>no se mide en puntos</strong> ni en ninguna cuantificación: es una
        cualificación basada en los logros y resultados positivos de las acciones que ejecutes en
        los comandos indicados por los controladores.
      </>
    ),
  },
  {
    n: '06',
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

const GRADOS = ['Candidato', 'Colaborador', 'Controlador', 'Pilar', 'Global', 'Líder'];

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

      <div>
        <SectionLabel>Tu pulsera = tu grado de afiliación</SectionLabel>
        <p style={{ ...cardDesc, margin: '8px 0 10px' }}>
          El tipo de pulsera del GCC representa tu grado dentro del proyecto. Empiezas como
          Candidato, con la pulsera gris:
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {GRADOS.map((g, i) => (
            <span key={g} className="inline-flex items-center gap-2">
              {i === 0 ? (
                <span
                  style={{
                    ...chip,
                    color: 'var(--color-digi-text)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span
                    aria-hidden
                    className="w-2 h-2 rounded-full"
                    style={{ background: '#9aa0aa' }}
                  />
                  {g}
                </span>
              ) : (
                <span style={chip}>{g}</span>
              )}
              {i < GRADOS.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-digi-muted/70" />
              )}
            </span>
          ))}
        </div>
      </div>

      <div style={noteBox}>
        <strong style={strong}>Importante:</strong> desde tu afiliación recibes beneficios para tu
        desarrollo humano, en todas sus dimensiones. No abusamos de tu tiempo ni te asignamos
        trabajos no remunerados: toda acción tiene un propósito y un beneficio para ti.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lista de sliders (crecerá hasta 8)                                 */
/* ------------------------------------------------------------------ */

const SLIDES: Slide[] = [
  {
    id: 'modelo',
    kicker: 'Slider 1',
    title: 'Modelo de Grupo',
    Icon: Layers3,
    Component: SlideModelo,
  },
  {
    id: 'herramientas',
    kicker: 'Slider 2',
    title: 'Herramientas',
    Icon: Wrench,
    Component: SlideHerramientas,
  },
  {
    id: 'motivos',
    kicker: 'Slider 3',
    title: 'Motivos',
    Icon: Heart,
    Component: SlideMotivos,
  },
  {
    id: 'onboarding',
    kicker: 'Slider 4',
    title: 'Onboarding',
    Icon: Gavel,
    Component: SlideOnboarding,
  },
  {
    id: 'metodo-crecimiento',
    kicker: 'Slider 5',
    title: 'Método de crecimiento',
    Icon: TrendingUp,
    Component: SlideMetodoCrecimiento,
  },
  {
    id: 'lideracion',
    kicker: 'Slider 6',
    title: 'Lideración sobre Acciones',
    Icon: RefreshCw,
    Component: SlideLideracion,
  },
  {
    id: 'afiliacion',
    kicker: 'Slider 7',
    title: 'Afiliación',
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
            autoFocus
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
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-accent pl-2.5 text-[12.5px] font-semibold text-digi-text">
      {children}
    </div>
  );
}

/** Aviso de advertencia (rojo corp) — reusa los literales semánticos del dashboard. */
function WarnBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-red-300 bg-red-50 p-3.5">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
      <p className="text-[13px] leading-relaxed text-red-700 m-0">{children}</p>
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
const chip: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--color-accent-glow)',
};

const noteBox: React.CSSProperties = {
  fontSize: '0.875rem',
  lineHeight: 1.6,
  color: 'var(--color-digi-text)',
  background: 'var(--color-digi-darker)',
  border: '1px solid var(--color-digi-border)',
  borderLeft: '3px solid var(--color-accent)',
  borderRadius: 6,
  padding: '14px 16px',
};

const KEYFRAMES = `
@keyframes onbInRight { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: translateX(0); } }
@keyframes onbInLeft { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: translateX(0); } }
@keyframes onbFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;
