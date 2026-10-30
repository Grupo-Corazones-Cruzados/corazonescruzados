/**
 * EL MODELO DE GRUPO Y SUS HERRAMIENTAS — fuente ÚNICA de los textos (Fernando, 2026-10-29/30).
 *
 * Los leen DOS sitios y por eso viven aquí, fuera de los dos:
 * · el formulario de postulación (`components/landing/OnboardingSlidersModal.tsx`, pasos 1 y 2);
 * · las páginas públicas `/desarrollo-humano/modelo-organizacional-4p` y
 *   `/desarrollo-humano/herramientas-del-modelo`, que existen para que Google, Bing y sus modos
 *   con IA lean lo que define al grupo (*«que los buscadores recolecten esta información como
 *   parte fundamental de lo que es nuestro negocio»*). Dentro del formulario no lo veían: un
 *   buscador no pulsa el botón que lo abre.
 *
 * Una copia en cada sitio se separaría a la primera corrección. Cambiar un texto aquí lo cambia en
 * los dos (y en `/llms.txt`).
 *
 * Los textos son de Fernando, literales. `**así**` = negrita.
 */

/* ── Paso 1 · Modelo de Grupo ─────────────────────────────────────────────── */

export const MODELO_INTRO =
  'Este es el **proyecto de desarrollo humano** del **Grupo Corazones Cruzados**. Estamos aquí para luchar por un sueño, que es transformar el mundo, y construir un futuro mejor. Lo que queremos impulsar es el reconocimiento y aprovechamiento de las condiciones de los sujetos, para lograr estrategias organizacionales que logren resolver nuestras problemáticas sociales. Para alcanzar un objetivo tan grande como éste, trabajaremos usando como base el **Modelo Organizacional 4P**: el cual consiste en descubrir el talento de cada sujeto para posicionarlo en determinado rol y función de cualquier proyecto. Dicho esto, el modelo se distribuye de la siguiente manera:';

export const PISOS: { name: string; desc: string }[] = [
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

export const PASOS: { n: string; name: string; desc: string }[] = [
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

/** Cómo se lee la tabla (texto literal). La última es la conclusión. */
export const REGLAS_4P = [
  'Cada piso representa un rol en la organización que cumple con una necesidad en la gestión de un proyecto.',
  'Cada paso representa una función en el levantamiento y progreso de cualquier proyecto.',
  'Cada miembro de la organización se le asigna un piso y paso de acuerdo a su talento.',
  'Según el piso y paso que tenga asignado el miembro, se tiene acceso a un conjunto de sistemas.',
  'Cada sistema se activa según la necesidad del proyecto en el que participe el miembro.',
  'La necesidad determina todo lo que hacemos.',
];

/* ── Paso 2 · Herramientas ────────────────────────────────────────────────── */

export const HERRAMIENTAS_INTRO =
  'El **Modelo Organizacional 4P** funciona como un motor que para operar necesita tener en buenas condiciones sus requisitos. Lo que requerimos para este motor es un **talento correctamente clasificado** que se pueda tratar y posicionar en función de la estrategia organizacional. Para hacer esta correcta clasificación nos apoyaremos de las **herramientas del Modelo**, las cuales van a ser las fuentes de información que justificarán el posicionamiento de cada miembro. Las herramientas que usaremos son las siguientes:';

/** Los seis pasos de la Metodología Condiciológica. */
export const PASOS_CONDICIOLOGIA = ['Reconocer', 'Controlar', 'Predecir', 'Experimentar', 'Convertir', 'Cambiar'];

export interface Herramienta {
  /** Ancla pública: `/desarrollo-humano/herramientas-del-modelo#<id>`. No se cambia a la ligera. */
  id: string;
  nombre: string;
  /** El titular en la página pública: «¿Qué es…?», que es como lo pregunta la gente al buscador. */
  pregunta: string;
  /** La línea corta bajo el nombre. */
  resumen: string;
  parrafos: string[];
  /** Los seis pasos, que se pintan tras el primer párrafo (solo la Metodología). */
  conPasos?: boolean;
}

export const HERRAMIENTAS: Herramienta[] = [
  {
    id: 'metodologia-condiciologica',
    nombre: 'Metodología Condiciológica',
    pregunta: '¿Qué es la Metodología Condiciológica?',
    resumen: 'Una metodología científica de seis pasos, aplicable a cualquier ámbito de investigación.',
    conPasos: true,
    parrafos: [
      'La **Metodología Condiciológica** es una metodología con enfoque científico que fue creada para desarrollar la investigación de la Condiciología a través de **seis pasos**, los cuales son aplicables en cualquier ámbito de investigación.',
      'Cada paso espera un conjunto de parámetros que están siendo determinados por la **Condiciología**, la cual es una ciencia en desarrollo que se basa en evidenciar el estudio de las **condiciones** como un conjunto de factores que conforman la generación de un comportamiento dentro de un instante de la realidad.',
      'Para obtener los datos que esperan los parámetros de los pasos de la metodología, se utilizan diferentes fuentes de datos que vienen de herramientas que se ofrecerán solo a candidatos y miembros de la organización para según las condiciones del servicio, acepte consumir, o no hacer uso de las herramientas que disponemos para ellos.',
    ],
  },
  {
    id: 'sistema-de-control-psicosocial',
    nombre: 'Sistema de Control Psicosocial',
    pregunta: '¿Qué es el Sistema de Control Psicosocial?',
    resumen: 'Una arquitectura tecnológica contra la inseguridad física, basada en las señales de todos.',
    parrafos: [
      'El **Sistema de Control Psicosocial** es una arquitectura con enfoque tecnológico que busca resolver principalmente la problemática de **inseguridad física**, siendo un sistema que está basado en señales indicadas por la gran masa de clientes, candidatos, y miembros de la organización.',
      'Este sistema pretende dibujar la realidad a través de señales recibidas por parte de todos los dispositivos asociados que están siendo utilizados por usuarios del sistema, incluyendo usuarios de tipo agente con Inteligencia Artificial.',
      'Lo que propone este sistema es llevar la seguridad física y la aplicación de la ley a un nivel **«ipso facto»**, es decir que el acto delictivo tenga consecuencias en el momento sin requerir tiempo de procesos, intermediarios, o roles que solo alargan o incluso disminuyen la carga real de una condena.',
      'Su función principal es **organizar a las masas** a través de un sistema que castiga el delito, y recompensa de muchas maneras a los denunciantes.',
    ],
  },
  {
    id: 'proyecto-centralizado',
    nombre: 'Proyecto Centralizado',
    pregunta: '¿Qué es el Proyecto Centralizado?',
    resumen: 'Un servicio para negocios que necesitan recuperar o mejorar su flujo de trabajo.',
    parrafos: [
      'El **Proyecto Centralizado** del Grupo Corazones Cruzados es un servicio exclusivo que se ofrece a clientes, candidatos, y miembros de la organización, el cual busca ser una solución para negocios que tienen condiciones de necesidad/problemáticas internas/crisis que requieren alguna intervención para recuperar el correcto funcionamiento del flujo de trabajo, o descubrir mejores formas de seguir haciendo.',
      'Para ofrecer este servicio se requiere llegar a un **previo acuerdo con el dueño del negocio**, que incluye condiciones de acceso y control temporal en los departamentos afectados para poder implementar todos los sistemas de gobernanza del Grupo Corazones Cruzados.',
      'Existen otros beneficios adicionales por conectarse al Proyecto Centralizado debido a que los negocios afiliados serían parte de la **Estrategia Organizacional**, la cual conecta otros negocios y talentos para adoptar las mejores soluciones y crear oportunidades.',
    ],
  },
  {
    id: 'violeta',
    nombre: 'Violeta',
    pregunta: '¿Qué es Violeta?',
    resumen: 'La luz que nos representa, el color que une corazones.',
    parrafos: [
      '**Violeta es la luz que nos representa**, el color que une corazones, y un lugar para aquellos que son diferentes. Esta luz, ilumina el vacío y lo aprovecha, une destinos mientras destruye sus formas, y convierte todo lo que parece imposible, en sueños y felicidad.',
      'Es aquello que amamos, y luego aparece cuando recordamos nuestras raíces; es una expresión tan humana, tan natural, y es eso que sientes en el pálpito, en cada golpe, en cada esfuerzo, y con cada lágrima que derramaste mientras todo lo que no querías se movía a tu alrededor. Violeta es el mundo de afuera y lo de adentro, la verdad que no queremos aceptar, el problema que estamos confrontando, y la nostalgia que sientes cuando recuerdas ese preciso momento cuando todo lo malo cambió.',
      'Comprender esta fuerza que nos hace soñar, desear, y buscar sin saber cuándo deberíamos parar; ese deseo insaciable por insistir y descubrir aquello tan profundo que no cabe en el pecho, y que además tiene la habilidad de cruzar los corazones, los sentimientos y transformar la realidad.',
      'Violeta es el reto de todos los candidatos y los miembros que ansiamos alcanzar, ese sueño eterno por proteger la calidad de lo que nos hace humanos, el futuro de nuestros hijos, y convertirnos en los líderes dispuestos a cambiar el mundo. Violeta es un sueño que se puede medir a través de la prospección, y todos quienes participan en este proyecto demostrarán a través de la **evaluación continua** si son capaces de representar los valores y una bandera que logrará cruzar al mundo.',
    ],
  },
];

/** Parte un texto en trozos normales y en negrita (`**así**`). */
export function trozosNegrita(texto: string): { t: string; negrita: boolean }[] {
  return texto
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((t) => (t.startsWith('**') && t.endsWith('**') ? { t: t.slice(2, -2), negrita: true } : { t, negrita: false }));
}

/** El texto sin las marcas de negrita: para metadatos, JSON-LD y `/llms.txt`. */
export function sinNegritas(texto: string): string {
  return texto.replace(/\*\*([^*]+)\*\*/g, '$1');
}
