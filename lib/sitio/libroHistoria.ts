/**
 * «EL LIBRO DE GCC WORLD» — la postulación contada como un cuento (propuesta, Fernando 2026-11-12: «como
 * cuando en las películas te muestran el libro y te cuentan un cuento, con las ilustraciones y usando el
 * contenido que tenemos»).
 *
 * BORRADOR. La columna del libro son los textos de Fernando, LITERALES (los de `modeloGcc.ts` se importan;
 * los del formulario se copian tal cual de `OnboardingSlidersModal.tsx`). Lo único nuevo son los PUENTES
 * (`puente: true`): las frases cortas que unen un capítulo con el siguiente. Esas son mías y son las que
 * Fernando tiene que corregir. `**así**` = negrita.
 *
 * Cada página es una DOBLE PÁGINA del libro: a la izquierda la ilustración (una animación de Blender en
 * bucle de `public/animaciones/<id>.webp`, o una pieza de la página), a la derecha el texto.
 */
import {
  HERRAMIENTAS, HERRAMIENTAS_INTRO, MODELO_4P_INTRO, MODELO_PROYECTO, PASOS, PASOS_CONDICIOLOGIA, PISOS, REGLAS_4P,
} from './modeloGcc';

export type Bloque =
  | { tipo: 'texto'; texto: string; puente?: boolean }
  | { tipo: 'lista'; items: { titulo: string; texto: string }[] }
  | { tipo: 'numerada'; items: string[] }
  | { tipo: 'aviso'; titulo: string; texto: string }
  | { tipo: 'pasosMetodologia' };

/** Lo que va en la página izquierda. */
export type Ilustracion =
  | { tipo: 'animacion'; id: string; alt: string }
  | { tipo: 'miembros' }
  | { tipo: 'piramide'; activo?: number }
  | { tipo: 'desglose'; items: string[] };

export type PaginaLibro = {
  id: string;
  /** Índice del capítulo en `CAPITULOS`. */
  capitulo: number;
  titulo: string;
  izquierda: Ilustracion;
  bloques: Bloque[];
};

export const CAPITULOS = [
  { numero: 'Capítulo I', titulo: 'El sueño' },
  { numero: 'Capítulo II', titulo: 'Un corazón puede cruzar el mundo' },
  { numero: 'Capítulo III', titulo: 'Una disciplina centralizada' },
  { numero: 'Capítulo IV', titulo: 'El poder por convicción' },
  { numero: 'Capítulo V', titulo: 'El Grupo Corazones Cruzados' },
  { numero: 'Capítulo VI', titulo: 'El motor' },
  { numero: 'Capítulo VII', titulo: 'Las herramientas' },
  { numero: 'Capítulo VIII', titulo: 'Las reglas' },
  { numero: 'Capítulo IX', titulo: 'La prospección' },
  { numero: 'Capítulo X', titulo: 'La afiliación' },
  { numero: 'Epílogo', titulo: 'Tu página en blanco' },
];

const t = (texto: string, puente = false): Bloque => ({ tipo: 'texto', texto, puente });
const anim = (id: string, alt: string): Ilustracion => ({ tipo: 'animacion', id, alt });
const herramienta = (id: string) => HERRAMIENTAS.find((h) => h.id === id)!;

const metodologia = herramienta('metodologia-condiciologica');
const control = herramienta('sistema-de-control-psicosocial');
const centralizado = herramienta('proyecto-centralizado');
const violeta = herramienta('violeta');

export const PAGINAS: PaginaLibro[] = [
  /* ── I · El sueño ── */
  {
    id: 'sueno', capitulo: 0, titulo: 'El sueño',
    izquierda: anim('libro-sueno', 'Un cielo de estrellas y, en medio, el logo del grupo encendiéndose como una constelación'),
    bloques: [
      t('Esta historia comenzó mucho antes de que existiera el Grupo Corazones Cruzados, en la infancia de quien hoy la cuenta, cuando todavía no sabía que un sueño podía convertirse en un proyecto.', true),
      t('¡Cuando era pequeño me encantaba soñar! Soñar, soñar y solo soñar... ¡cuánto me encantaba soñar! Para mí, el sueño era la cuna de los retorcidos, el lugar más cálido, el lugar más cómodo, el mundo del cual jamás quería escapar.'),
    ],
  },
  {
    id: 'realidad', capitulo: 0, titulo: 'La realidad',
    izquierda: anim('libro-realidad', 'Un mundo gris que gira despacio y, sobre él, una sola luz violeta que late'),
    bloques: [
      t('Pero la realidad siempre volvía en forma de responsabilidad. Y vivir se convirtió en recordar aquello que no me gustaba y que sentía que no podía cambiar. Esa confrontación entre mi sueño y la realidad es lo que he revivido tantas veces, arrastrando una frustración intolerable que hunde mi pecho como si no tuviese otra forma de estar.'),
      t('¡Porque soy incapaz de aceptar este mundo! Y me aferro aquí, usando la promesa de aquel día que en profundo dolor, decidí dejar de soñar para empezar a vivir una realidad, dispuesto a cambiar todo lo que he visto y que jamás voy a olvidar.'),
    ],
  },
  {
    id: 'promesa', capitulo: 0, titulo: 'La promesa',
    izquierda: anim('libro-realidad', 'Un mundo gris que gira despacio y, sobre él, una sola luz violeta que late'),
    bloques: [
      t('No tengo otra opción. Prefiero morir antes que seguir observando todo lo que está mal en este mundo. Así que esto es todo lo que tengo, lo que me mueve y por lo que estoy dispuesto a darlo todo. No voy a aceptar jamás un futuro en el que mis hijos vivan en un mundo diferente al que quiero construir. No importa lo difícil o imposible que parezca; voy a cambiar este mundo, aunque me cueste la vida.'),
      t('De esa promesa nacieron tres convicciones, las cuales dieron forma a todo lo que se cuenta en las siguientes páginas.', true),
    ],
  },

  /* ── II · Un corazón puede cruzar el mundo ── */
  {
    id: 'corazon', capitulo: 1, titulo: 'Un corazón puede cruzar el mundo',
    izquierda: anim('motivos-1', 'El logo del grupo cruza el mundo y une sus puntos'),
    bloques: [
      t('La primera convicción fue que nadie puede cambiar el mundo solo, y que para lograrlo había que encontrar aquello que une a las personas por encima de lo que las separa.', true),
      t('Vivimos en sociedades separadas por fronteras y representadas por símbolos que, con el tiempo, nos han enseñado a mirarnos como distintos. Es cierto que crecemos en entornos diferentes, pero los valores que de verdad importan son los mismos en todas partes.'),
      t('Creemos que un corazón y una organización puede representar esa **alianza que ya existe**, silenciosa, en el fondo de la humanidad. El Grupo Corazones Cruzados nace para unir al mundo a través de sus valores y de un sistema que represente lo que de verdad necesitamos. Y lo que más necesitamos hoy es una **razón para trabajar juntos** por un futuro mejor.'),
    ],
  },

  /* ── III · Una disciplina centralizada ── */
  {
    id: 'disciplina', capitulo: 2, titulo: 'Una realidad imposible, frente a una disciplina centralizada',
    izquierda: anim('motivos-2', 'Una luz sube una escalera paso a paso y limpia los problemas hasta llegar al logo'),
    bloques: [
      t('La segunda convicción fue que unir a las personas no era suficiente, si no existía una forma de trabajar que no se rindiera ante lo que todos llaman imposible.', true),
      t('Sueño con un futuro en el que la humanidad trabaje unida por objetivos más grandes; un mundo donde las próximas generaciones no tengan que crecer entre la corrupción y las mafias que dañan, sin reparo, a quienes tienen el potencial de cambiarlo todo.'),
      t('Demasiadas veces los más jóvenes heredamos las consecuencias de problemas que otros prefirieron ignorar, convencidos de que era más fácil llamarlos imposibles que intentar resolverlos. Esa **realidad imposible** donde los valores se unen y la organización se fortalece por encima de la separación, solo puede cumplirse mediante una **disciplina centralizada** en trabajar cada día por resolver las problemáticas sociales paso a paso hasta limpiar nuestras calles y el mundo, de aquello que está mal.'),
    ],
  },

  /* ── IV · El poder por convicción ── */
  {
    id: 'poder', capitulo: 3, titulo: 'El poder por convicción, y no por decisión',
    izquierda: anim('motivos-3', 'El logo en el centro y anillos de personas que giran unidas a él'),
    bloques: [
      t('La tercera convicción fue sobre quién merece dirigir una organización como ésta, y por qué.', true),
      t('Crecimos creyendo que la democracia, a través del voto, era la mejor forma de elegir a quienes nos gobiernan, pero con demasiada frecuencia esa forma ha terminado en corrupción y en entregar el poder a quien no se lo ha merecido, creando una clase política que es capaz de todo por convencer a las masas, mientras ignoramos todas las incompetencias que éstos tienen para transformar la realidad que vivimos.'),
      t('Debemos cambiar lo que siempre se ha hecho, empezando por el poder, ya que éste no se debe entregar ni por convencimiento, ni por retórica. Los líderes se deben ganar su posición mediante lo que realmente son capaces de **hacer** y **construir** según sus logros, su propósito, y el impacto real que han tenido en la sociedad sin depender de los recursos de otros. "Porque sino puede cambiar su vida, peor va a poder cambiar la vida de otras personas". Así que tener o no tener recursos, solo es una excusa y una mentira que no podemos volver a aceptar.'),
    ],
  },
  {
    id: 'lider', capitulo: 3, titulo: 'Un líder nato',
    izquierda: anim('motivos-3', 'El logo en el centro y anillos de personas que giran unidas a él'),
    bloques: [
      t('Hoy vivimos algo completamente diferente e incoherente con lo que necesitamos, porque nuestros gobernantes nacen de cúpula de poder que se mueve e interesa por la política con el fin de obtener más poder. El pueblo a causa de la incompetencia natural que vivimos, aceptamos y nos conformamos  cada vez más con lo poco que nos dan, sin tener manera de tomar acciones inmediatas para cambiar lo que nos afecta. Un verdadero líder no necesita una posición para imponerse, porque alguien que es capaz de movilizar a personas, y habitar su corazón mediante su ejemplo y sacrificio; entonces ése es un líder nato; caso contrario, simplemente no lo es.'),
    ],
  },

  /* ── V · El Grupo Corazones Cruzados ── */
  {
    id: 'grupo', capitulo: 4, titulo: 'El Grupo Corazones Cruzados',
    izquierda: anim('libro-grupo', 'Personas que llegan desde lejos y se unen al anillo que rodea al logo'),
    bloques: [
      t('Con esas tres convicciones nació el Grupo Corazones Cruzados, y con él, un proyecto al que cualquier persona que comparta esos valores puede postularse.', true),
      t(MODELO_PROYECTO),
    ],
  },
  {
    id: 'miembros', capitulo: 4, titulo: 'Los miembros',
    izquierda: { tipo: 'miembros' },
    bloques: [
      t('Toda historia tiene sus personajes, y los de ésta son los miembros que hoy forman parte del proyecto, quienes ya demostraron los valores de la organización y trabajan cada día en ella.', true),
      t('Cada persona que se postula empieza como **candidato**, y al final de este libro se explica el camino que debe recorrer para llegar a ser uno de ellos.', true),
    ],
  },

  /* ── VI · El motor ── */
  {
    id: 'motor', capitulo: 5, titulo: 'El Modelo Organizacional 4P',
    izquierda: anim('libro-4p', 'Una rejilla de cuatro pisos por cuatro pasos que una onda recorre en diagonal'),
    bloques: [
      t(MODELO_4P_INTRO),
      { tipo: 'lista', items: PISOS.map((p) => ({ titulo: `Piso ${p.name}`, texto: p.desc })) },
    ],
  },
  {
    id: 'pasos-4p', capitulo: 5, titulo: 'Los pasos de un proyecto',
    izquierda: anim('libro-4p', 'Una rejilla de cuatro pisos por cuatro pasos que una onda recorre en diagonal'),
    bloques: [{ tipo: 'lista', items: PASOS.map((p) => ({ titulo: `${p.n} · ${p.name}`, texto: p.desc })) }],
  },
  {
    id: 'reglas-4p', capitulo: 5, titulo: 'Cómo se lee el modelo',
    izquierda: anim('libro-4p', 'Una rejilla de cuatro pisos por cuatro pasos que una onda recorre en diagonal'),
    bloques: [{ tipo: 'numerada', items: REGLAS_4P }],
  },

  /* ── VII · Las herramientas ── */
  {
    id: 'herramientas', capitulo: 6, titulo: 'Las herramientas del Modelo',
    izquierda: { tipo: 'desglose', items: HERRAMIENTAS.map((h) => h.nombre) },
    bloques: [t(HERRAMIENTAS_INTRO)],
  },
  {
    id: 'metodologia', capitulo: 6, titulo: metodologia.nombre,
    izquierda: anim('herramienta-metodologia', 'Seis pasos en ciclo, recorridos por un pulso de luz'),
    bloques: [t(metodologia.parrafos[0]), { tipo: 'pasosMetodologia' }, ...metodologia.parrafos.slice(1).map((p) => t(p))],
  },
  {
    id: 'control', capitulo: 6, titulo: control.nombre,
    izquierda: anim('herramienta-control', 'Una ciudad bajo una cúpula que recoge las señales de sus casas'),
    bloques: control.parrafos.map((p) => t(p)),
  },
  {
    id: 'centralizado', capitulo: 6, titulo: centralizado.nombre,
    izquierda: anim('herramienta-centralizado', 'Las áreas de un negocio unidas a un centro por el que va y viene el trabajo'),
    bloques: centralizado.parrafos.map((p) => t(p)),
  },
  {
    id: 'violeta', capitulo: 6, titulo: violeta.nombre,
    izquierda: anim('herramienta-violeta', 'El logo del grupo envuelto en aros de luz violeta'),
    bloques: violeta.parrafos.slice(0, 2).map((p) => t(p)),
  },
  {
    id: 'violeta-2', capitulo: 6, titulo: 'El reto de Violeta',
    izquierda: anim('herramienta-violeta', 'El logo del grupo envuelto en aros de luz violeta'),
    bloques: violeta.parrafos.slice(2).map((p) => t(p)),
  },

  /* ── VIII · Las reglas ── */
  {
    id: 'reglas', capitulo: 7, titulo: 'Reglas del proyecto para todos los Candidatos y Miembros',
    izquierda: { tipo: 'desglose', items: ['Regla #1 · ¿Quiénes somos?', 'Regla 2 · Comandos', 'Regla 3 · Opciones de crecimiento'] },
    bloques: [
      t('Quien decide formar parte de esta historia acepta sus reglas, las cuales aplican por igual a candidatos y miembros en cualquier rol.', true),
      { tipo: 'aviso', titulo: 'Advertencia', texto: 'Cualquier intento de faltar a una sola de estas reglas implica la **destitución** del candidato y aplica igual a todos los miembros en cualquier rol. Quien es destituido del proyecto no tiene otra oportunidad para unirse; solo los fallos no intencionales se evalúan y pueden no llevar a la destitución.' },
    ],
  },
  {
    id: 'regla-1', capitulo: 7, titulo: 'Regla #1 · ¿Quiénes somos?',
    izquierda: anim('regla-1', 'Nueve valores alrededor del logo que se encienden uno a uno'),
    bloques: [
      t('El proyecto del Grupo Corazones Cruzados es una organización que incluye en sus filas, solo candidatos y miembros que tienen la prospección a representarnos. Aquellos que caigan de delincuentes, mentirosos, o realicen cualquier mala intención u acción por mínima que sea, o incluso olviden trabajar y sostener en sus relaciones sociales y en su vida diaria nuestros valores organizacionales, serán des-agrupados del proyecto.'),
      t('A continuación te presento los valores que deberás trabajar para representar nuestra organización:'),
    ],
  },
  {
    id: 'valores', capitulo: 7, titulo: 'Los valores',
    izquierda: anim('regla-1', 'Nueve valores alrededor del logo que se encienden uno a uno'),
    bloques: [{
      tipo: 'lista',
      items: [
        { titulo: 'Determinación', texto: 'Insiste hasta el cansancio, o levántate y no te rindas.' },
        { titulo: 'Coraje', texto: 'Confronta todo lo que está mal, y descubre un motivo para superar tus miedos.' },
        { titulo: 'Pureza', texto: 'Nunca olvides tus raíces y quien realmente eres.' },
        { titulo: 'Fe', texto: 'Confía en ti, y convierte en real esos sueños que pueden parecer imposibles.' },
        { titulo: 'Paciencia', texto: 'Hay tantas cosas que puedes valorar en esta vida, antes de que te dejes llevar por la desesperación.' },
        { titulo: 'Seriedad', texto: 'Prioriza tus necesidades, y céntrate en hacerte responsable para aprender a solucionar tus problemas.' },
        { titulo: 'Espontaneidad', texto: 'Explora lo que sientes, y sin arrepentimientos a equivocarte.' },
        { titulo: 'Autonomía', texto: 'Tu futuro, depende únicamente de ti.' },
        { titulo: 'Empatía', texto: 'Recuerda valorar el corazón de quienes sí valen la pena.' },
      ],
    }],
  },
  {
    id: 'regla-2', capitulo: 7, titulo: 'Regla 2 · Comandos',
    izquierda: anim('regla-2', 'Desde el logo bajan los comandos a los miembros y sube la corrección'),
    bloques: [
      t('La gobernanza del Grupo Corazones Cruzados **escucha, decide y analiza correcciones** por cada estrategia organizacional que se implementa  con el fin de progresar, y enfrentar una problemática.'),
      t('Antes de decidirse por una estrategia organizacional, el líder tuvo que escuchar las propuestas y discusiones asociadas a esa problemática para que según las alternativas posibles, se desarrolle un  mapa visual del proyecto, y luego se presente la opción más viable a ejecutar y medir sus efectos.'),
      t('La relación entre el líder, los miembros o los candidatos se sostiene principalmente a través de los comandos que se solicitan ejecutar para cumplir el planteamiento de la estrategia organizacional decidida.'),
      t('Cualquier miembro o candidato que no se acata o afecta el cálculo de la estrategia, queda fuera del proyecto en el acto, ya que los comandos se ejecutan sin cuestionamiento, y solo se analizan y corrigen durante la etapa de corrección en donde todos sin excepción tienen la obligación de votar y participar.'),
    ],
  },
  {
    id: 'regla-3', capitulo: 7, titulo: 'Regla 3 · Opciones de crecimiento',
    izquierda: anim('regla-3', 'Un árbol por el que sube la energía hasta abrir sus brotes'),
    bloques: [
      t('El Grupo Corazones Cruzados ofrece un sistema de "Desarrollo Humano" que permite impulsar a los candidatos y miembros de la organización, y acceder a oportunidades para avanzar en su progreso sin excepciones ni condiciones.'),
      t('La confianza que ofrecemos y el acceso a mayores recursos y beneficios, depende de la **prospección** y de los **resultados** o logros obtenidos. Esa confianza se entrega **una sola vez**, y si una opción de crecimiento se usa de forma abusiva o para fines distintos a los acordados, la decisión es la destitución.'),
      t('Para esta organización, la confianza no se recupera tras una traición, además que nosotros abordamos todas las necesidades aunque no sean de interés personal o progreso, así que no hay excusa para mentir o abusar de los recursos. Les pedimos mantener siempre las buenas intenciones, y las opciones de crecimiento llegarán.'),
    ],
  },

  /* ── IX · La prospección ── */
  {
    id: 'prospeccion', capitulo: 8, titulo: 'La prospección',
    izquierda: anim('libro-prospeccion', 'Una pirámide de cuatro niveles que una luz recorre hasta llegar al logo'),
    bloques: [
      t('Las reglas dicen qué se espera de cada persona, y la prospección mide si de verdad lo está cumpliendo.', true),
      t('La prospección de cada persona, es un indicador que mide su intención de crecimiento según 4 aspectos  ordenados por la importancia que tienen para transformar su vida.'),
      t('A continuación te presento el método de evaluación continua del Grupo Corazones Cruzados:'),
    ],
  },
  {
    id: 'talento', capitulo: 8, titulo: 'Talento',
    izquierda: { tipo: 'piramide', activo: 0 },
    bloques: [
      t('El talento es justo lo que hace de este proyecto una realidad, cuando una persona puede traer a este mundo un valor agregado con su esfuerzo y capacidad, se convierte en una herramienta de altísimo valor para el progreso del proyecto que lo requiera.'),
      t('Nosotros queremos descubrir ese talento, y generar oportunidades en donde podamos sacar beneficios por posicionarte dentro de una estrategia organizacional, donde cada movimiento va a desarrollar tu talento y causar mayor interés en nuevos clientes que deseen tus servicios.'),
    ],
  },
  {
    id: 'valores-prospeccion', capitulo: 8, titulo: 'Valores',
    izquierda: { tipo: 'piramide', activo: 1 },
    bloques: [
      t('La confianza de los clientes se mide en tus valores, cuando una persona no sostiene sus valores puede tomar un requerimiento como algo sin importancia, y limitando incluso el desarrollo de su talento; debido a eso, exigimos los valores organizacionales ya que son la fuente principal para obtener oportunidades.'),
      t('La lógica es la siguiente, según al nivel de confianza que tenga un cliente, se arriesga a invertir su tiempo y dinero en cualquiera de nuestros servicios, talentos, y productos que ofrecemos. Si demostramos alta calidad humana sin importar el tipo de cliente o el lugar en donde estemos, nos podemos convertir en una organización ideal para encontrar personas que puedan trabajar en un proyecto en donde van a representar bien lo que estamos dispuestos a hacer por solucionar un problema.'),
    ],
  },
  {
    id: 'dimensiones', capitulo: 8, titulo: 'Dimensiones de desarrollo humano',
    izquierda: { tipo: 'piramide', activo: 2 },
    bloques: [
      t('Evaluamos las cuatro dimensiones del desarrollo humano ( **laboral, corporal, social y mental** ), cada una representa un conjunto de problemas que al no ser abordados, aumentan el riesgo de tomar malas decisiones, intenciones y malos comportamientos que terminen perjudicando a uno mismo, y a los demás.'),
      t('Estos riesgos se sostienen mediante los valores, y cuando el talento es muy competente, aumenta las posibilidades de resolver sus problemas haciendo uso de los recursos que puede obtener. Sin embargo existen problemas que se deben trabajar mediante estrategias personalizadas que logren mejorar la calidad de vida. Si estos problemas son abordados entonces el sujeto impulsará sus valores y talento en su entorno de trabajo.'),
    ],
  },
  {
    id: 'red-apoyo', capitulo: 8, titulo: 'Red de apoyo',
    izquierda: { tipo: 'piramide', activo: 3 },
    bloques: [
      t('En la actualidad, cuando las dimensiones de desarrollo humano se ven muy afectadas por problemas difíciles de resolver, la red de apoyo suele ser un factor vital para impulsar la solución de problemas, además de ser un buen referente para sostener los valores, y así obtener fuerzas para buscar oportunidades que, en caso de tener suerte, te permiten aprovechar tu talento y mejorar tu situación.'),
      t('Sin embargo para esta organización este factor vital tiene menor importancia porque los valores organizacionales te enseñan que no necesitas una red de apoyo para abordar tus problemas, sino que su importancia debe ser para nosotros un complemento que apoya nuestra condición, y por lo tanto no podemos depender de ella para estar bien.'),
    ],
  },

  /* ── X · La afiliación ── */
  {
    id: 'afiliacion', capitulo: 9, titulo: 'La afiliación',
    izquierda: anim('libro-afiliacion', 'Un camino de cinco paradas que termina en el logo del grupo'),
    bloques: [
      t('La **afiliación** es el proceso por el que un candidato se convierte en miembro, demostrando y representando los valores esperados. Sigue estas indicaciones:'),
      {
        tipo: 'lista',
        items: [
          { titulo: '01 · Postúlate', texto: 'Envía tu propuesta en el formulario de postulación. Si eres elegido como candidato, recibirás un **correo de confirmación**.' },
          { titulo: '02 · Recibe tu acceso', texto: 'Como candidato recibirás una invitación y acceso al sitio web como **usuario candidato**. Desde ese momento puedes usar las herramientas del grupo para tu desarrollo humano; encontrarás todos sus detalles dentro del sitio web.' },
          { titulo: '03 · Asiste a las reuniones semanales', texto: 'Allí recibirás todas las indicaciones sobre **cómo demostrar tu afiliación** y los comandos que deberás ejecutar.' },
        ],
      },
    ],
  },
  {
    id: 'afiliacion-2', capitulo: 9, titulo: 'Convertirse en miembro',
    izquierda: anim('libro-afiliacion', 'Un camino de cinco paradas que termina en el logo del grupo'),
    bloques: [{
      tipo: 'lista',
      items: [
        { titulo: '04 · Eleva tu prospección', texto: 'Tu avance se mide con la **evaluación continua de la prospección**: cada tarea que cumples suma y cada una que no cumples resta en el valor al que corresponde, y además se evalúan tus talentos, tus cuatro dimensiones de desarrollo humano y tu red de apoyo. Cuando tu prospección alcanza un nivel alto, tu caso se revisa para convertirte en miembro.' },
        { titulo: '05 · Conviértete en miembro', texto: 'Cuando cumplas con la demostración, un miembro **Global** del paso de **Implementación** realizará tu afiliación como nuevo miembro.' },
      ],
    }],
  },
];

/** La última doble página: el formulario. */
export const EPILOGO = {
  capitulo: CAPITULOS.length - 1,
  titulo: 'Tu página en blanco',
  ilustracion: anim('libro-pagina', 'Una página en la que una luz escribe renglón a renglón'),
  puente: 'Este libro todavía no termina. Las siguientes páginas las escriben quienes deciden formar parte del Grupo Corazones Cruzados, y la primera línea de esa historia empieza aquí.',
};

export { PASOS_CONDICIOLOGIA };
