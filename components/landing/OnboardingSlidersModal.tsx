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
 * desarrollados los 2 primeros (Modelo de Grupo · Herramientas); los demás se
 * agregarán conforme el usuario aporte su contenido.
 *
 * Estilo: pixelart de la landing — borde/acento `var(--color-accent)` (#4B2D8E),
 * títulos en Silkscreen, cuerpo en una tipografía legible (Inter) por ser textos
 * largos. Sigue el patrón de overlay de `AccountRecoveryModal`.
 */

import { useState } from 'react';
import BrandLoader from '@/components/ui/BrandLoader';

const PIXEL = "'Silkscreen', cursive";
const BODY = "'Inter', system-ui, -apple-system, sans-serif";

export type PostulacionData = {
  email: string;
  reason: string;
  /** Consentimiento OPCIONAL para recibir publicidad/novedades del proyecto. */
  marketing: boolean;
};

type Slide = {
  id: string;
  kicker: string;
  title: string;
  // Componente (no función llamada en render) para que sus hooks corran al nivel
  // superior del propio slider, no anidados dentro del padre.
  Component: React.FC;
  // 'terms' = el slider gestiona permisos/accesos/condiciones → aceptación de términos.
  // 'ack'   = slider solo informativo, sin términos → confirmación "Entendido".
  consent: 'terms' | 'ack';
  // Resumen muy breve de lo que se acepta (solo para sliders 'terms').
  consentSummary?: string;
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

function ModeloTabs() {
  const [tab, setTab] = useState<'pisos' | 'pasos'>('pisos');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Pestañas (estilo subrayado) */}
      <div
        style={{
          display: 'flex',
          gap: 28,
          borderBottom: '1px solid rgba(225,215,255,0.14)',
        }}
      >
        {(
          [
            ['pisos', 'Los 4 Pisos'],
            ['pasos', 'Los 4 Pasos'],
          ] as const
        ).map(([key, label]) => {
          const on = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              style={{
                background: 'transparent',
                border: 0,
                padding: '0 2px 10px',
                marginBottom: -1,
                cursor: 'pointer',
                fontFamily: PIXEL,
                fontSize: '0.74rem',
                letterSpacing: '0.04em',
                color: on ? '#f1eefb' : 'rgba(225,215,255,0.5)',
                borderBottom: on
                  ? '2px solid var(--color-accent-glow, #7B5FBF)'
                  : '2px solid transparent',
                transition: 'color 0.2s, border-color 0.2s',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Contenido según la pestaña */}
      <div key={tab} style={{ animation: 'onbFadeUp 0.3s ease-out' }}>
        {tab === 'pisos' ? (
          <>
            <p style={{ ...pStyle, fontSize: '0.82rem', opacity: 0.85, marginBottom: 12 }}>
              Cuatro roles, cada uno experto en su área, que se complementan en toda iniciativa.
            </p>
            <div style={grid2}>
              {PISOS.map((p, i) => (
                <Card key={p.name} delay={i}>
                  <span style={cardTitle}>{p.name}</span>
                  <p style={cardDesc}>{p.desc}</p>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <>
            <p style={{ ...pStyle, fontSize: '0.82rem', opacity: 0.85, marginBottom: 12 }}>
              Se recorren en orden; cada etapa resuelve una necesidad y prepara la siguiente.
            </p>
            <div style={grid2}>
              {PASOS.map((s, i) => (
                <Card key={s.name} delay={i}>
                  <span style={cardTitle}>{s.name}</span>
                  <p style={cardDesc}>{s.desc}</p>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SlideModelo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <p style={pStyle}>
        Somos un <strong style={strong}>proyecto de desarrollo humano</strong>, y creemos que las
        grandes ideas necesitan una estructura que las sostenga. Por eso trabajamos con el{' '}
        <strong style={strong}>Modelo 4P</strong>: un marco que organiza a las personas en{' '}
        <strong style={strong}>4 Pisos</strong> (roles) y guía cada iniciativa a través de{' '}
        <strong style={strong}>4 Pasos</strong> (etapas). Juntos, convierten una idea en un
        proyecto real.
      </p>

      <ModeloTabs />

      <div style={noteBox}>
        Cada uno de los cuatro pasos se apoya en los cuatro pisos: en toda etapa, los roles
        trabajan juntos —cada uno experto en lo suyo— para resolver lo que el proyecto necesita y
        dar el siguiente paso con seguridad.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slider 2 — Herramientas                                            */
/* ------------------------------------------------------------------ */

const COND_STEPS = ['Reconocer', 'Controlar', 'Predecir', 'Experimentar', 'Convertir', 'Cambiar'];

const TOOLS: AccordionItem[] = [
  {
    name: 'Metodología Condiciológica',
    summary: 'Un método para entender y transformar las condiciones que dan forma a la realidad.',
    body: () => (
      <>
        <p style={cardDesc}>
          Es una metodología de seis pasos que nos lleva, de forma ordenada, desde observar una
          situación hasta transformarla:
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0' }}>
          {COND_STEPS.map((s, i) => (
            <span key={s} style={chip}>
              <span style={{ opacity: 0.6 }}>{i + 1}.</span> {s}
            </span>
          ))}
        </div>
        <p style={cardDesc}>
          Detrás está la <strong style={strong}>Condiciología</strong>, una investigación
          desarrollada por <strong style={strong}>Luis Fernando González Muyulema</strong>{' '}
          (Guayaquil, Ecuador) dedicada al estudio de las <strong style={strong}>condiciones</strong>:
          el conjunto de factores que se reúnen para que algo ocurra en un instante de la realidad.
        </p>
        <p style={cardDesc}>
          Pensemos en un gesto tan simple como mover la mano. En ese instante intervienen factores{' '}
          <em>corporales</em>, <em>ambientales</em> y <em>cognitivos</em> que, combinados, lo hacen
          posible. Mientras no los estudiamos, es apenas un hecho que pasa desapercibido; cuando
          comprendemos <em>por qué</em> sucedió, se convierte en una <strong style={strong}>condición</strong>{' '}
          que podemos reconocer y aprovechar.
        </p>
        <p style={cardDesc}>
          Las condiciones no son exclusivas de las personas: también las tienen los objetos y las
          ideas. Un proyecto, por ejemplo, vive rodeado de condiciones, y según qué tan bien las
          aprovechemos tomamos mejores decisiones estratégicas. Por eso la condiciología se aplica
          a todo lo que hacemos y se integra en la lógica de nuestros sistemas y en las
          herramientas de desarrollo personal de cada miembro, que registran y evalúan sus
          condiciones día a día.
        </p>
      </>
    ),
  },
  {
    name: 'Sistema de Control Psicosocial',
    summary: 'Tecnología al servicio de espacios más seguros, para las personas y la comunidad.',
    body: () => (
      <>
        <p style={cardDesc}>
          Nace de una convicción: la seguridad es la base sobre la que crecen las personas y los
          proyectos. Este sistema aprovecha la tecnología y los datos para anticipar y atender, a
          tiempo, situaciones que hoy son difíciles de controlar.
        </p>
        <p style={cardDesc}>
          Tomemos un ejemplo cotidiano. Ante un robo, la respuesta habitual —llamar y esperar—
          muchas veces llega tarde. Imaginemos en cambio un entorno donde una cámara reconoce el
          incidente por voz o sonido, despliega al instante un dispositivo táctico que verifica lo
          que ocurre y, al confirmarlo, activa una respuesta coordinada en segundos, sin trámites
          que den ventaja a quien comete el delito.
        </p>
        <p style={cardDesc}>
          La meta no es vigilar por vigilar, sino <strong style={strong}>hacer que las reglas que
          ya existen se cumplan de verdad</strong>. Los miembros aceptan, de forma voluntaria y
          consciente, un mayor nivel de control —como compartir su ubicación—, siempre respetando
          la intimidad de su vida privada y de su hogar. Apoyándonos en la condiciología para
          anticipar movimientos e intenciones, buscamos actuar en el momento justo y evitar que un
          delito quede impune.
        </p>
      </>
    ),
  },
  {
    name: 'Proyecto Centralizado',
    summary: 'Cada proyecto suma a una estrategia común más grande que la suma de sus partes.',
    body: () => (
      <>
        <p style={cardDesc}>
          Trabajamos bajo una idea central: todo proyecto que nace en la organización es, además,
          un <strong style={strong}>recurso del Grupo Corazones Cruzados</strong>. Aunque cada
          proyecto tenga su propio dueño legal —que conserva plenamente su beneficio—, también
          forma parte de una estrategia compartida, pensada para que el éxito de uno impulse al
          resto.
        </p>
        <p style={cardDesc}>
          Esta visión común exige coordinación y confianza: las decisiones estratégicas se siguen
          con disciplina, porque la dirección la marca un solo liderazgo, el de{' '}
          <strong style={strong}>Luis Fernando González Muyulema</strong>. Así evitamos esfuerzos
          dispersos y avanzamos todos en la misma dirección.
        </p>
      </>
    ),
  },
  {
    name: 'Violeta',
    summary: 'El color, la marca y la filosofía que nos unen en uno solo.',
    body: () => (
      <>
        <div
          style={{
            height: 8,
            borderRadius: 2,
            margin: '2px 0 12px',
            background: 'linear-gradient(90deg, #d63b5a 0%, #7B5FBF 50%, #2f6bd6 100%)',
            boxShadow: '0 0 14px rgba(123,95,191,0.5)',
          }}
        />
        <p style={cardDesc}>
          El violeta nace de la unión de dos colores distintos —el rojo y el azul—. Esa es,
          justamente, nuestra filosofía: <strong style={strong}>unir lo diferente para crear algo
          más grande</strong>. La unión hace la fuerza, y el violeta es el color que representa al
          Grupo Corazones Cruzados.
        </p>
        <p style={cardDesc}>
          <strong style={strong}>Como marca</strong>, el violeta está presente, de forma
          consistente, en todos nuestros proyectos —sin importar quién sea su dueño—, para que
          cualquier persona reconozca al instante que pertenecen al grupo. Es nuestro sello
          compartido.
        </p>
        <p style={cardDesc}>
          <strong style={strong}>Como filosofía personal</strong>, invitamos a cada miembro a
          identificarse con lo que el violeta representa. No se trata de una obligación, sino de
          creer genuinamente en esta forma de ver las cosas.
        </p>
        <p style={cardDesc}>
          <strong style={strong}>Como actitud</strong>, el violeta es reciprocidad: ayudar y
          dejarse ayudar. El apoyo que recibimos hoy lo devolvemos mañana. Compartimos lo aprendido
          entre generaciones y proyectos, competimos de forma sana y, cuando una iniciativa pierde
          fuerza, su talento encuentra un nuevo lugar donde brillar. Así crecemos de manera
          constante, ganamos experiencia y construimos la confianza de quienes nos eligen.
        </p>
      </>
    ),
  },
];

function SlideHerramientas() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={pStyle}>
        Más allá de la estructura, cada miembro del grupo trabaja con un conjunto común de
        herramientas. Son <strong style={strong}>cuatro</strong> y acompañan el día a día de todos
        por igual. Toca cada una para conocerla.
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, margin: '4px 0' }}>
          {VALORES.map((v) => (
            <div key={v.valor} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              <span
                style={{
                  flexShrink: 0,
                  marginTop: 6,
                  width: 7,
                  height: 7,
                  borderRadius: 2,
                  transform: 'rotate(45deg)',
                  background: 'var(--color-accent-glow, #7B5FBF)',
                }}
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
      <div style={warnBox}>
        <strong style={{ color: '#ffd2d2' }}>⚠ Estas reglas no se negocian.</strong> Cualquier
        intento de faltar a una sola de ellas implica la <strong style={{ color: '#ffd2d2' }}>destitución</strong>{' '}
        del candidato —y aplica igual a los miembros en cualquier rol—. Quien es destituido no tiene
        una segunda oportunidad; solo los fallos <em>no intencionales</em> se evalúan y pueden no
        acarrear destitución.
      </div>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <p style={pStyle}>
        El crecimiento de cada persona se analiza con un método de cuatro aspectos clave, ordenados
        por importancia. Toca cada nivel de la pirámide para conocer su justificación.
      </p>

      {/* Pirámide */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
        <GrowthCaption>▲ Mayor importancia</GrowthCaption>
        {CRECIMIENTO.map((s, i) => {
          const on = active === i;
          return (
            <button
              key={s.title}
              type="button"
              onClick={() => setActive(i)}
              style={{
                width: widths[i],
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 16px',
                cursor: 'pointer',
                borderRadius: 10,
                textAlign: 'left',
                transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s',
                background: on
                  ? 'linear-gradient(135deg, var(--color-accent-glow, #7B5FBF), var(--color-accent, #4B2D8E))'
                  : 'rgba(75,45,142,0.16)',
                border: on
                  ? '1px solid var(--color-accent-glow, #7B5FBF)'
                  : '1px solid rgba(123,95,191,0.3)',
                boxShadow: on ? '0 8px 24px rgba(123,95,191,0.4)' : 'none',
                transform: on ? 'translateY(-1px)' : 'none',
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: PIXEL,
                  fontSize: '0.72rem',
                  color: on ? 'var(--color-accent, #4B2D8E)' : '#fff',
                  background: on ? '#fff' : 'rgba(123,95,191,0.38)',
                  border: on ? 'none' : '1px solid rgba(123,95,191,0.6)',
                }}
              >
                {s.n}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontFamily: PIXEL,
                    fontSize: '0.72rem',
                    lineHeight: 1.25,
                    color: on ? '#fff' : '#ece8f7',
                  }}
                >
                  {s.title}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontFamily: BODY,
                    fontSize: '0.72rem',
                    marginTop: 2,
                    color: on ? 'rgba(255,255,255,0.85)' : 'rgba(225,215,255,0.55)',
                  }}
                >
                  {s.tag}
                </span>
              </span>
              <span
                style={{
                  flexShrink: 0,
                  fontFamily: PIXEL,
                  fontSize: '0.66rem',
                  color: on ? '#fff' : 'var(--color-accent-glow, #7B5FBF)',
                  opacity: on ? 0.95 : 0.6,
                }}
              >
                {on ? '●' : '›'}
              </span>
            </button>
          );
        })}
        <GrowthCaption dim>Menor importancia ▼</GrowthCaption>
      </div>

      {/* Detalle del nivel seleccionado */}
      <div
        key={active}
        style={{
          display: 'flex',
          gap: 14,
          alignItems: 'flex-start',
          background: 'rgba(75,45,142,0.16)',
          border: '1px solid rgba(123,95,191,0.4)',
          borderRadius: 10,
          padding: '16px',
          animation: 'onbFadeUp 0.3s ease-out',
        }}
      >
        <div
          style={{
            flexShrink: 0,
            width: 46,
            height: 46,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: PIXEL,
            fontSize: '1.15rem',
            color: '#fff',
            background:
              'linear-gradient(135deg, var(--color-accent-glow, #7B5FBF), var(--color-accent, #4B2D8E))',
            boxShadow: '0 4px 14px rgba(123,95,191,0.4)',
          }}
        >
          {a.n}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: PIXEL, fontSize: '0.84rem', color: '#f1eefb' }}>{a.title}</div>
          <div style={{ ...kickerStyle, marginTop: 3, marginBottom: 9 }}>
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
      style={{
        fontFamily: PIXEL,
        fontSize: '0.58rem',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: dim ? 'rgba(225,215,255,0.4)' : 'var(--color-accent-glow, #7B5FBF)',
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slider 6 — Lideración sobre Acciones (diagrama triangular)         */
/* ------------------------------------------------------------------ */

function SlideLideracion() {
  const GLOW = '#7B5FBF';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={pStyle}>
        El liderazgo en el Grupo Corazones Cruzados gira en torno a las acciones, en un ciclo
        continuo entre el líder, el grupo y sus miembros.
      </p>

      <svg
        viewBox="0 0 380 320"
        width="100%"
        style={{ maxWidth: 480, height: 'auto', display: 'block', margin: '4px auto' }}
        role="img"
        aria-label="Ciclo: el Líder escucha y decide; GCC ejecuta sin cuestionamientos; los Miembros discuten y corrigen; el ciclo vuelve al líder."
      >
        <defs>
          <linearGradient id="lid-stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#9b7fd6" />
            <stop offset="100%" stopColor={GLOW} />
          </linearGradient>
          <linearGradient id="lid-leader" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(123,95,191,0.55)" />
            <stop offset="100%" stopColor="rgba(75,45,142,0.30)" />
          </linearGradient>
          <marker
            id="lid-arrow"
            markerWidth="10"
            markerHeight="10"
            refX="7"
            refY="3.2"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M0,0 L7,3.2 L0,6.4 Z" fill="#b39ddb" />
          </marker>
        </defs>

        {/* Medallón central — el ciclo gira en torno a las acciones */}
        <circle
          cx={190}
          cy={186}
          r={31}
          fill="rgba(123,95,191,0.10)"
          stroke="rgba(123,95,191,0.35)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <text x={190} y={183} textAnchor="middle" fontFamily={PIXEL} fontSize={9} fill={GLOW}>
          ACCIONES
        </text>
        <text
          x={190}
          y={196}
          textAnchor="middle"
          fontFamily={BODY}
          fontSize={8}
          fill="rgba(225,215,255,0.55)"
        >
          ciclo continuo
        </text>

        {/* Flechas curvas del ciclo: Líder → GCC → Miembros → Líder */}
        <g
          fill="none"
          stroke="url(#lid-stroke)"
          strokeWidth={2.5}
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
            <circle cx={b.x} cy={b.y} r={10} fill="var(--color-accent, #4B2D8E)" stroke="#b39ddb" />
            <text
              x={b.x}
              y={b.y + 3.2}
              textAnchor="middle"
              fontFamily={PIXEL}
              fontSize={9}
              fill="#fff"
            >
              {b.n}
            </text>
          </g>
        ))}

        {/* Nodo superior — Líder (resaltado) */}
        <g>
          <rect
            x={124}
            y={28}
            width={132}
            height={58}
            rx={10}
            fill="url(#lid-leader)"
            stroke={GLOW}
            strokeWidth={2}
          />
          <text x={190} y={50} textAnchor="middle" fontFamily={PIXEL} fontSize={13} fill="#fff">
            Líder
          </text>
          <text x={190} y={66} textAnchor="middle" fontFamily={BODY} fontSize={11} fill="#e7e1f5">
            Escucha y
          </text>
          <text x={190} y={79} textAnchor="middle" fontFamily={BODY} fontSize={11} fill="#e7e1f5">
            Decide
          </text>
        </g>

        {/* Nodo derecho — GCC */}
        <g>
          <rect
            x={228}
            y={228}
            width={132}
            height={60}
            rx={10}
            fill="rgba(75,45,142,0.18)"
            stroke="rgba(123,95,191,0.5)"
            strokeWidth={1.5}
          />
          <text x={294} y={250} textAnchor="middle" fontFamily={PIXEL} fontSize={13} fill="#f1eefb">
            GCC
          </text>
          <text x={294} y={266} textAnchor="middle" fontFamily={BODY} fontSize={11} fill="#cfc9e2">
            Ejecuta sin
          </text>
          <text x={294} y={279} textAnchor="middle" fontFamily={BODY} fontSize={11} fill="#cfc9e2">
            cuestionamientos
          </text>
        </g>

        {/* Nodo izquierdo — Miembros */}
        <g>
          <rect
            x={20}
            y={228}
            width={132}
            height={60}
            rx={10}
            fill="rgba(75,45,142,0.18)"
            stroke="rgba(123,95,191,0.5)"
            strokeWidth={1.5}
          />
          <text x={86} y={250} textAnchor="middle" fontFamily={PIXEL} fontSize={13} fill="#f1eefb">
            Miembros
          </text>
          <text x={86} y={266} textAnchor="middle" fontFamily={BODY} fontSize={11} fill="#cfc9e2">
            Discuten y
          </text>
          <text x={86} y={279} textAnchor="middle" fontFamily={BODY} fontSize={11} fill="#cfc9e2">
            Corrigen
          </text>
        </g>
      </svg>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <p style={pStyle}>
        La <strong style={strong}>afiliación</strong> es el proceso por el que un candidato se
        convierte en miembro, demostrando y representando los valores esperados. Sigue estas
        indicaciones:
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {AFIL_STEPS.map((s, i) => (
          <Card key={s.name} delay={i} row>
            <div style={stepNum}>{s.n}</div>
            <div>
              <div style={cardTitle}>{s.name}</div>
              <p style={{ ...cardDesc, marginTop: 4 }}>{s.desc()}</p>
            </div>
          </Card>
        ))}
      </div>

      <SectionLabel>Tu pulsera = tu grado de afiliación</SectionLabel>
      <p style={{ ...pStyle, marginTop: -10, fontSize: '0.82rem', opacity: 0.85 }}>
        El tipo de pulsera del GCC representa tu grado dentro del proyecto. Empiezas como Candidato,
        con la pulsera gris:
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        {GRADOS.map((g, i) => (
          <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span
              style={
                i === 0
                  ? {
                      ...chip,
                      background: 'rgba(154,160,170,0.22)',
                      border: '1px solid rgba(154,160,170,0.7)',
                      color: '#eef0f3',
                    }
                  : chip
              }
            >
              {g}
            </span>
            {i < GRADOS.length - 1 && (
              <span style={{ color: 'rgba(225,215,255,0.4)', fontFamily: PIXEL }}>›</span>
            )}
          </span>
        ))}
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
  { id: 'modelo', kicker: 'Slider 1', title: 'Modelo de Grupo', Component: SlideModelo, consent: 'ack' },
  {
    id: 'herramientas',
    kicker: 'Slider 2',
    title: 'Herramientas',
    Component: SlideHerramientas,
    consent: 'terms',
    consentSummary:
      'el uso continuo de las herramientas del grupo, incluidas las del Sistema de Control Psicosocial. Cada herramienta solicitará su propio permiso, de forma específica, antes de acceder a cualquier dato',
  },
  { id: 'motivos', kicker: 'Slider 3', title: 'Motivos', Component: SlideMotivos, consent: 'ack' },
  {
    id: 'onboarding',
    kicker: 'Slider 4',
    title: 'Onboarding',
    Component: SlideOnboarding,
    consent: 'terms',
    consentSummary:
      'regirte por las 3 reglas del proyecto, cuyo incumplimiento implica la destitución',
  },
  {
    id: 'metodo-crecimiento',
    kicker: 'Slider 5',
    title: 'Método de crecimiento',
    Component: SlideMetodoCrecimiento,
    consent: 'ack',
  },
  {
    id: 'lideracion',
    kicker: 'Slider 6',
    title: 'Lideración sobre Acciones',
    Component: SlideLideracion,
    consent: 'ack',
  },
  {
    id: 'afiliacion',
    kicker: 'Slider 7',
    title: 'Afiliación',
    Component: SlideAfiliacion,
    consent: 'terms',
    consentSummary:
      'las condiciones del proceso de afiliación: acceso como candidato, asistencia a las reuniones semanales y uso de los recursos otorgados conforme a su propósito',
  },
  // Slider 8: pendiente de contenido del usuario.
];

/* ------------------------------------------------------------------ */
/* Componente principal                                               */
/* ------------------------------------------------------------------ */

export default function OnboardingSlidersModal({
  onComplete,
  onClose,
  onHaveAccount,
}: {
  /** Se llama al enviar la postulación con los datos del candidato. */
  onComplete: (data: PostulacionData) => void;
  /** Cancela el onboarding y vuelve a la landing. */
  onClose: () => void;
  /** Abre el flujo "Ya tengo una cuenta" (anexar cuenta por código). */
  onHaveAccount: () => void;
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
  const formOk = emailOk && reason.trim().length >= 10 && finalAccepted;
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

  const animName = dir === 1 ? 'onbInRight' : 'onbInLeft';
  const SlideComponent = isForm ? null : current.Component;

  return (
    <div role="dialog" aria-modal="true" style={overlay}>
      <style>{KEYFRAMES}</style>

      <div style={panel}>
        {/* Cerrar */}
        <button type="button" aria-label="Cerrar" onClick={onClose} style={closeBtn}>
          ✕
        </button>

        {/* Ya tengo una cuenta (anexar cuenta por código) */}
        <button
          type="button"
          onClick={onHaveAccount}
          style={{
            position: 'absolute',
            top: 12,
            left: 14,
            zIndex: 2,
            background:
              'linear-gradient(135deg, var(--color-accent-glow, #7B5FBF), var(--color-accent, #4B2D8E))',
            border: '1px solid var(--color-accent-glow, #7B5FBF)',
            borderRadius: 6,
            color: '#fff',
            fontFamily: BODY,
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '6px 11px',
            boxShadow: '0 3px 12px rgba(123,95,191,0.4)',
          }}
        >
          Ya tengo una cuenta
        </button>

        {/* Logo */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            paddingTop: 18,
          }}
        >
          <BrandLoader size="sm" />
          <span
            style={{ fontFamily: PIXEL, fontSize: '0.6rem', letterSpacing: '0.2em', color: '#fff' }}
          >
            GCC WORLD
          </span>
        </div>

        {/* Header */}
        <div style={{ padding: '14px 26px 14px' }}>
          {isForm && <div style={kickerStyle}>Postulación</div>}
          <h2 style={titleStyle}>
            {isForm ? '¿Por qué quieres ser candidato de este proyecto?' : current.title}
          </h2>

          {/* Progreso por segmentos */}
          <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
            {Array.from({ length: steps }).map((_, i) => (
              <span
                key={i}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  background:
                    i <= index ? 'var(--color-accent-glow, #7B5FBF)' : 'rgba(225,215,255,0.16)',
                  boxShadow: i === index ? '0 0 8px var(--color-accent-glow, #7B5FBF)' : 'none',
                  transition: 'background 0.3s',
                }}
              />
            ))}
          </div>
          <div style={{ ...kickerStyle, marginTop: 8, opacity: 0.7 }}>
            {isForm ? `Último paso · ${steps} de ${steps}` : `Paso ${index + 1} de ${steps}`}
          </div>
        </div>

        {/* Cuerpo (scroll + animación de entrada) */}
        <div style={bodyWrap}>
          <div key={index} style={{ animation: `${animName} 0.4s cubic-bezier(0.22,1,0.36,1)` }}>
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
          </div>
        </div>

        {/* Aceptación de términos / "Entendido" según el slider */}
        {!isForm && (
          <AcceptTerms
            mode={current.consent}
            summary={current.consentSummary}
            checked={!!acceptedHere}
            onToggle={toggleAccept}
          />
        )}

        {/* Footer */}
        <div style={footer}>
          <button
            type="button"
            onClick={back}
            disabled={index === 0}
            className="pixel-btn pixel-btn-secondary"
            style={{ opacity: index === 0 ? 0.35 : 1, cursor: index === 0 ? 'default' : 'pointer' }}
          >
            ← Atrás
          </button>

          {isForm ? (
            <button
              type="button"
              onClick={() =>
                formOk && onComplete({ email: email.trim(), reason: reason.trim(), marketing })
              }
              disabled={!formOk}
              className="pixel-btn pixel-btn-primary"
              style={{ opacity: formOk ? 1 : 0.5, cursor: formOk ? 'pointer' : 'default' }}
            >
              Comenzar mi aventura →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => acceptedHere && next()}
              disabled={!acceptedHere}
              className="pixel-btn pixel-btn-primary"
              style={{ opacity: acceptedHere ? 1 : 0.5, cursor: acceptedHere ? 'pointer' : 'default' }}
            >
              {index === total - 1 ? 'Postularme →' : 'Siguiente →'}
            </button>
          )}
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
  summary,
  checked,
  onToggle,
  inline = false,
}: {
  mode: 'terms' | 'ack' | 'final' | 'marketing';
  summary?: string;
  checked: boolean;
  onToggle: () => void;
  inline?: boolean;
}) {
  return (
    <div
      onClick={onToggle}
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onToggle();
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 11,
        padding: inline ? '14px 14px' : '12px 26px',
        cursor: 'pointer',
        borderTop: '1px solid rgba(225,215,255,0.12)',
        borderRadius: inline ? 4 : 0,
        border: inline ? '1px solid rgba(123,95,191,0.4)' : undefined,
        background: checked ? 'rgba(75,45,142,0.14)' : 'transparent',
        transition: 'background 0.2s',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          marginTop: 1,
          width: 20,
          height: 20,
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.8rem',
          color: '#fff',
          background: checked ? 'var(--color-accent, #4B2D8E)' : 'transparent',
          border: checked
            ? '2px solid var(--color-accent-glow, #7B5FBF)'
            : '2px solid rgba(123,95,191,0.6)',
          transition: 'background 0.2s, border 0.2s',
        }}
      >
        {checked ? '✓' : ''}
      </span>
      <span
        style={{
          fontFamily: BODY,
          fontSize: '0.78rem',
          lineHeight: 1.5,
          color: checked ? '#e9e6f5' : 'rgba(225,215,255,0.78)',
        }}
      >
        {mode === 'terms' ? (
          <>
            Acepto lo indicado en este apartado: <strong style={{ color: '#fff' }}>{summary}</strong>
            .
          </>
        ) : mode === 'final' ? (
          <>
            Acepto los{' '}
            <a
              href="/legal"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ color: '#c9b6ff', textDecoration: 'underline' }}
            >
              términos y condiciones y la política de privacidad
            </a>{' '}
            del proyecto, y autorizo el tratamiento de los datos que proporcione conforme a ella.
            Entiendo que los permisos otorgados{' '}
            <strong style={{ color: '#fff' }}>no podrán ser revocados</strong>, salvo que solicite
            voluntariamente mi desafiliación del grupo, o que esta se produzca por incumplimiento de
            las reglas; en cualquiera de los dos casos, los permisos previamente aceptados serán
            retirados.
          </>
        ) : mode === 'marketing' ? (
          <>
            Quiero recibir información sobre publicidad, productos y novedades del proyecto. Si no
            marcas esta casilla, no te enviaremos ese tipo de comunicaciones, y de todos modos
            puedes continuar.
          </>
        ) : (
          <>
            <strong style={{ color: '#fff' }}>Entendido.</strong> He leído y comprendido la
            información de este apartado.
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={pStyle}>
        Ya conoces las bases del proyecto. Para iniciar tu postulación al{' '}
        <strong style={strong}>Grupo Corazones Cruzados</strong>, cuéntanos, con sinceridad, qué te
        mueve a formar parte de esto.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={{ ...kickerStyle, opacity: 0.9 }}>Correo electrónico</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tucorreo@ejemplo.com"
          autoComplete="email"
          style={{
            width: '100%',
            padding: '11px 14px',
            background: '#0f1320',
            color: '#e9e6f5',
            border: `2px solid ${email.length > 0 && !emailOk ? '#c8455c' : 'var(--color-accent)'}`,
            borderRadius: 4,
            fontFamily: BODY,
            fontSize: '0.92rem',
            outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, max))}
          placeholder="Escribe aquí qué te mueve a formar parte de esto..."
          autoFocus
          rows={6}
          style={{
            width: '100%',
            resize: 'vertical',
            minHeight: 130,
            padding: '12px 14px',
            background: '#0f1320',
            color: '#e9e6f5',
            border: '2px solid var(--color-accent)',
            borderRadius: 4,
            fontFamily: BODY,
            fontSize: '0.92rem',
            lineHeight: 1.55,
            outline: 'none',
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: BODY,
            fontSize: '0.72rem',
            color: 'rgba(225,215,255,0.6)',
          }}
        >
          <span>{reason.trim().length < 10 ? 'Mínimo 10 caracteres.' : 'Listo para postular.'}</span>
          <span>
            {reason.length}/{max}
          </span>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((t, i) => {
        const isOpen = open === i;
        return (
          <div key={t.name} style={{ ...cardBase, padding: 0, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : i)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                background: 'transparent',
                border: 0,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ ...stepNum, width: 30, height: 30, fontSize: '0.7rem' }}>{i + 1}</span>
              <span style={{ flex: 1 }}>
                <span style={cardTitle}>{t.name}</span>
                {!isOpen && (
                  <span style={{ ...cardDesc, display: 'block', marginTop: 2 }}>{t.summary}</span>
                )}
              </span>
              <span
                style={{
                  color: 'var(--color-accent-glow, #7B5FBF)',
                  fontFamily: PIXEL,
                  transition: 'transform 0.25s',
                  transform: isOpen ? 'rotate(90deg)' : 'none',
                }}
              >
                ▸
              </span>
            </button>
            {isOpen && (
              <div style={{ padding: '0 16px 16px 16px', animation: 'onbFadeUp 0.3s ease-out' }}>
                {t.body()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: PIXEL,
        fontSize: '0.74rem',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'var(--color-accent-glow, #7B5FBF)',
        borderLeft: '3px solid var(--color-accent)',
        paddingLeft: 10,
      }}
    >
      {children}
    </div>
  );
}

function Card({
  children,
  delay = 0,
  row = false,
}: {
  children: React.ReactNode;
  delay?: number;
  row?: boolean;
}) {
  return (
    <div
      style={{
        ...cardBase,
        display: 'flex',
        flexDirection: row ? 'row' : 'column',
        alignItems: row ? 'flex-start' : 'stretch',
        gap: row ? 14 : 6,
        animation: 'onbFadeUp 0.4s ease-out both',
        animationDelay: `${0.05 + delay * 0.06}s`,
      }}
    >
      {children}
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 250,
  background: 'rgba(6,7,12,0.82)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  animation: 'pixelFadeIn 0.45s ease-out',
};

const panel: React.CSSProperties = {
  width: '100%',
  maxWidth: 860,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: '#121722',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 12,
  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
  position: 'relative',
};

const closeBtn: React.CSSProperties = {
  position: 'absolute',
  top: 10,
  right: 12,
  zIndex: 2,
  background: 'transparent',
  border: 0,
  color: 'rgba(225,215,255,0.6)',
  fontFamily: PIXEL,
  fontSize: '0.85rem',
  cursor: 'pointer',
  padding: 6,
};

const bodyWrap: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: '6px 26px 22px',
};

const footer: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  padding: '14px 26px',
  borderTop: '1px solid rgba(225,215,255,0.12)',
};

const kickerStyle: React.CSSProperties = {
  fontFamily: PIXEL,
  fontSize: '0.66rem',
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: 'var(--color-accent-glow, #7B5FBF)',
};

const titleStyle: React.CSSProperties = {
  fontFamily: PIXEL,
  fontSize: '1.15rem',
  lineHeight: 1.35,
  color: '#f1eefb',
  margin: '8px 0 0',
  textShadow: '1px 1px 0 rgba(0,0,0,0.6)',
};

const pStyle: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: '0.95rem',
  lineHeight: 1.6,
  color: '#d9d4ea',
  margin: 0,
};

const strong: React.CSSProperties = { color: '#fff', fontWeight: 700 };

const cardBase: React.CSSProperties = {
  background: '#151a26',
  border: '1px solid rgba(123,95,191,0.35)',
  borderRadius: 5,
  padding: '14px 16px',
};

const grid2: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
};

const cardTitle: React.CSSProperties = {
  fontFamily: PIXEL,
  fontSize: '0.82rem',
  color: '#f1eefb',
  letterSpacing: '0.02em',
};

const cardDesc: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: '0.88rem',
  lineHeight: 1.55,
  color: '#cfc9e2',
  margin: 0,
};

const stepNum: React.CSSProperties = {
  width: 38,
  height: 38,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: PIXEL,
  fontSize: '0.85rem',
  color: '#fff',
  background: 'var(--color-accent)',
  border: '1px solid var(--color-accent-glow, #7B5FBF)',
  borderRadius: 4,
};

const chip: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: '0.78rem',
  color: '#e9e6f5',
  background: 'rgba(123,95,191,0.18)',
  border: '1px solid rgba(123,95,191,0.45)',
  borderRadius: 999,
  padding: '4px 10px',
};

const noteBox: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: '0.9rem',
  lineHeight: 1.55,
  color: '#e9e6f5',
  background: 'rgba(75,45,142,0.18)',
  borderLeft: '3px solid var(--color-accent)',
  borderRadius: 4,
  padding: '12px 14px',
};

const warnBox: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: '0.88rem',
  lineHeight: 1.55,
  color: '#f3dede',
  background: 'rgba(160,40,55,0.16)',
  borderLeft: '3px solid #c8455c',
  borderRadius: 4,
  padding: '12px 14px',
};

const KEYFRAMES = `
@keyframes onbInRight { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: translateX(0); } }
@keyframes onbInLeft { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: translateX(0); } }
@keyframes onbFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;
