/**
 * «EL LIBRO DE GCC WORLD» — la postulación contada como un cuento (Fernando, 2026-11-12).
 *
 * VERSIÓN 2, una HISTORIA INVENTADA (Fernando: «el cuento debe redactar la historia inventándose una historia
 * que vaya contando los puntos… para conectar las cosas»): un niño que soñaba, la promesa que hizo, el viaje en
 * el que descubre lo que une a las personas, la casa de cuatro pisos que construye (el Modelo 4P), las
 * herramientas que forja, las reglas que graba en la puerta, el camino de los cuatro faroles (la prospección)
 * y cómo llega un viajero a ser de la casa (la afiliación). Todo lo que se cuenta de la organización es lo
 * que dicen los textos originales de Fernando; la historia es el hilo que los une. BORRADOR para que él lo
 * corrija. Los originales, literales, están en `docs/respaldo/textos-postulacion-originales.md`.
 *
 * Cada página es una DOBLE PÁGINA: a la izquierda la ilustración, a la derecha la narración. La narración se
 * lee en voz alta (`public/libro/voz/<id>.mp3`, español de España) y, al terminar, el libro pasa la hoja.
 * `**así**` = negrita.
 */

export type Ilustracion =
  | { tipo: 'animacion'; id: string; alt: string }
  /** Escena 3D realista (modelos de Poly Haven en Blender), en video MP4 en bucle: `public/animaciones/<id>.mp4`. */
  | { tipo: 'video'; id: string; alt: string }
  | { tipo: 'miembros' }
  | { tipo: 'piramide'; activo?: number }
  | { tipo: 'desglose'; items: string[] };

export type PaginaLibro = {
  id: string;
  /** Índice del capítulo en `CAPITULOS`. */
  capitulo: number;
  titulo: string;
  izquierda: Ilustracion;
  parrafos: string[];
};

/** El ambiente de la música de cada capítulo (`public/libro/musica/<ambiente>.mp3`). */
export type Ambiente = 'sueno' | 'realidad' | 'esperanza' | 'grupo' | 'motor' | 'reglas' | 'camino' | 'final';

export const CAPITULOS: { numero: string; titulo: string; ambiente: Ambiente }[] = [
  { numero: 'Capítulo I', titulo: 'El niño que soñaba', ambiente: 'sueno' },
  { numero: 'Capítulo II', titulo: 'Un corazón puede cruzar el mundo', ambiente: 'esperanza' },
  { numero: 'Capítulo III', titulo: 'La escalera imposible', ambiente: 'realidad' },
  { numero: 'Capítulo IV', titulo: 'El poder por convicción', ambiente: 'realidad' },
  { numero: 'Capítulo V', titulo: 'La casa de los corazones cruzados', ambiente: 'grupo' },
  { numero: 'Capítulo VI', titulo: 'El motor de los cuatro pisos', ambiente: 'motor' },
  { numero: 'Capítulo VII', titulo: 'Las herramientas', ambiente: 'motor' },
  { numero: 'Capítulo VIII', titulo: 'Las reglas de la puerta', ambiente: 'reglas' },
  { numero: 'Capítulo IX', titulo: 'El camino de los cuatro faroles', ambiente: 'camino' },
  { numero: 'Capítulo X', titulo: 'El viajero que llegó a la casa', ambiente: 'camino' },
  { numero: 'Epílogo', titulo: 'Tu página en blanco', ambiente: 'final' },
];

const anim = (id: string, alt: string): Ilustracion => ({ tipo: 'animacion', id, alt });

export const PAGINAS: PaginaLibro[] = [
  /* ── I · El niño que soñaba ── */
  {
    id: 'sueno', capitulo: 0, titulo: 'Había una vez un niño que soñaba',
    // Primera escena con modelos 3D reales (2026-11-12, `scripts/animaciones/real/libro-sueno-real.py`).
    izquierda: { tipo: 'video', id: 'libro-sueno-real', alt: 'El rincón del niño de noche: un farol encendido junto a sus libros y una ventana con el cielo estrellado' },
    parrafos: [
      'Había una vez un niño al que le encantaba soñar. Soñaba de día y soñaba de noche, y cuando cerraba los ojos el mundo se volvía un lugar cálido y cómodo, un lugar del que jamás quería escapar.',
      'Cada noche miraba las estrellas desde su ventana y les ponía nombres, convencido de que allá arriba existía un orden en el que nadie se quedaba fuera. En sus sueños las personas se entendían, y el mundo era justo como debía ser.',
    ],
  },
  {
    id: 'realidad', capitulo: 0, titulo: 'La realidad',
    izquierda: anim('libro-realidad', 'Un mundo gris que gira despacio y, sobre él, una sola luz violeta que late'),
    parrafos: [
      'Pero cada mañana la realidad volvía, y siempre volvía en forma de responsabilidad. Afuera el mundo era gris: había cosas que estaban mal y que nadie parecía dispuesto a cambiar, y el niño crecía recordando todo aquello que no le gustaba.',
      'La distancia entre su sueño y la realidad le apretaba el pecho con una frustración que no sabía cómo soltar. Hasta que un día, en medio de un profundo dolor, comprendió algo que lo cambió todo: no era capaz de aceptar ese mundo.',
    ],
  },
  {
    id: 'promesa', capitulo: 0, titulo: 'La promesa',
    izquierda: anim('libro-realidad', 'Un mundo gris que gira despacio y, sobre él, una sola luz violeta que late'),
    parrafos: [
      'Aquel día hizo una promesa. Dejaría de soñar para empezar a vivir la realidad, dispuesto a cambiar todo lo que había visto y que jamás iba a olvidar.',
      'Prometió que nunca aceptaría un futuro en el que sus hijos crecieran en un mundo distinto al que quería construir, y que no importaba lo difícil o lo imposible que pareciera: iba a cambiar ese mundo, aunque le costara la vida.',
      'Con esa promesa guardada en el pecho, el niño, que ya empezaba a ser un hombre, salió a buscar la manera de cumplirla.',
    ],
  },

  /* ── II · Un corazón puede cruzar el mundo ── */
  {
    id: 'corazon', capitulo: 1, titulo: 'El viaje',
    izquierda: anim('motivos-1', 'El logo del grupo cruza el mundo y une sus puntos'),
    parrafos: [
      'Su viaje empezó cruzando fronteras. En cada lugar encontraba sociedades separadas por líneas en los mapas y representadas por símbolos que, con el tiempo, habían enseñado a las personas a mirarse como distintas.',
      'Sin embargo, en cada pueblo y en cada ciudad descubrió lo mismo: aunque la gente creciera en entornos diferentes, los valores que de verdad importaban eran iguales en todas partes. Había una **alianza que ya existía**, silenciosa, en el fondo de la humanidad.',
      'Entonces lo entendió. Un corazón y una organización podían representar esa alianza y unir al mundo a través de sus valores, porque lo que más necesitaban las personas era una **razón para trabajar juntos** por un futuro mejor.',
    ],
  },

  /* ── III · La escalera imposible ── */
  {
    id: 'disciplina', capitulo: 2, titulo: 'La escalera imposible',
    izquierda: anim('motivos-2', 'Una luz sube una escalera paso a paso y limpia los problemas hasta llegar al logo'),
    parrafos: [
      'En el camino conoció a muchos jóvenes que habían heredado las consecuencias de problemas que otros prefirieron ignorar. La corrupción y las mafias dañaban, sin reparo, a quienes tenían el potencial de cambiarlo todo, y los mayores repetían que aquello era imposible de resolver.',
      'El soñador vio en esa **realidad imposible** una escalera muy alta, llena de obstáculos en cada peldaño. Comprendió que solo se podía subir mediante una **disciplina centralizada**: trabajar cada día, paso a paso, resolviendo las problemáticas sociales una a una, hasta limpiar las calles y el mundo de aquello que está mal.',
    ],
  },

  /* ── IV · El poder por convicción ── */
  {
    id: 'poder', capitulo: 3, titulo: 'Los que convencían',
    izquierda: anim('motivos-3', 'El logo en el centro y anillos de personas que giran unidas a él'),
    parrafos: [
      'Más adelante llegó a una ciudad donde el poder se entregaba por votos. Allí, quienes gobernaban no eran los más capaces, sino los que mejor sabían convencer a las masas, y con demasiada frecuencia aquello terminaba en corrupción y en entregar el poder a quien no se lo había merecido.',
      'El pueblo, cansado, se conformaba cada vez más con lo poco que le daban, sin manera de tomar acciones inmediatas para cambiar lo que le afectaba. El soñador entendió que había que cambiar lo que siempre se había hecho, empezando por el poder, que no debía entregarse ni por convencimiento ni por retórica.',
    ],
  },
  {
    id: 'lider', capitulo: 3, titulo: 'El líder nato',
    izquierda: anim('motivos-3', 'El logo en el centro y anillos de personas que giran unidas a él'),
    parrafos: [
      'Desde entonces tuvo claro que un líder se gana su posición por lo que es capaz de **hacer** y de **construir**: por sus logros, por su propósito y por el impacto real que ha tenido en la sociedad, sin depender de los recursos de otros. Porque quien no puede cambiar su propia vida, peor va a poder cambiar la vida de los demás.',
      'Un verdadero líder no necesita una posición para imponerse. Quien es capaz de movilizar a las personas y de habitar su corazón mediante su ejemplo y su sacrificio, ese es un líder nato.',
    ],
  },

  /* ── V · La casa de los corazones cruzados ── */
  {
    id: 'grupo', capitulo: 4, titulo: 'La casa de los corazones cruzados',
    izquierda: anim('libro-grupo', 'Personas que llegan desde lejos y se unen al anillo que rodea al logo'),
    parrafos: [
      'Con todo lo aprendido, el soñador volvió a casa y fundó el **Grupo Corazones Cruzados**: un **proyecto de desarrollo humano** para luchar por un sueño, el de transformar el mundo y construir un futuro mejor.',
      'La idea era sencilla de decir y difícil de cumplir: reconocer y aprovechar las condiciones de cada persona para lograr estrategias organizacionales que resolvieran las problemáticas sociales. Poco a poco, personas de lugares muy distintos empezaron a llegar y a unirse alrededor de aquel corazón.',
    ],
  },
  {
    id: 'miembros', capitulo: 4, titulo: 'Los primeros de la casa',
    izquierda: { tipo: 'miembros' },
    parrafos: [
      'Estos son los miembros que hoy forman parte de la historia. Cada uno llegó primero como candidato, demostró los valores de la organización y hoy trabaja cada día en ella.',
      'Todo el que llega a la casa empieza por el mismo lugar, y en las últimas páginas de este libro se cuenta el camino que hay que recorrer para llegar a ser uno de ellos.',
    ],
  },

  /* ── VI · El motor de los cuatro pisos ── */
  {
    id: 'motor', capitulo: 5, titulo: 'El motor de los cuatro pisos',
    izquierda: anim('libro-4p', 'Una rejilla de cuatro pisos por cuatro pasos que una onda recorre en diagonal'),
    parrafos: [
      'Para alcanzar un objetivo tan grande, la casa necesitaba un motor. El soñador lo llamó **Modelo Organizacional 4P**, y su secreto consistía en descubrir el talento de cada persona para colocarla en el rol y la función que le correspondían en cualquier proyecto.',
      'El motor tenía cuatro pisos. En el piso **Global** se gobernaban los sistemas fundamentales y se tomaban las decisiones de alto nivel que hacían crecer cada etapa. En el piso **Pilar** se diseñaban y gestionaban los proyectos aprobados, dándoles forma y dirección.',
      'En el piso **Controlador** cada proyecto se traducía en tareas concretas que se asignaban a quienes las llevarían a cabo, y en el piso **Colaborador** esas tareas se ejecutaban con precisión: era el lugar donde las ideas se transformaban en trabajo terminado.',
    ],
  },
  {
    id: 'pasos-4p', capitulo: 5, titulo: 'Las cuatro puertas',
    izquierda: anim('libro-4p', 'Una rejilla de cuatro pisos por cuatro pasos que una onda recorre en diagonal'),
    parrafos: [
      'Cada piso tenía además cuatro puertas, una por cada paso de un proyecto. La primera era la **Fundamentación**, porque todo comienza con el porqué: allí se investigaba y se construía la base de conocimiento, para que nada se levantara sobre suposiciones.',
      'La segunda era la **Creación**, donde la idea ya fundamentada se convertía en una propuesta concreta. La tercera, la **Implementación**, llevaba el proyecto puertas adentro: su gestión interna, sus políticas y reglas, y los roles que lo mantendrían en marcha.',
      'La cuarta puerta era la **Gestión**, y por ella el proyecto salía al mundo con su publicación, su marketing y su monetización, para crecer y generar valor real.',
    ],
  },
  {
    id: 'reglas-4p', capitulo: 5, titulo: 'Cómo funcionaba el motor',
    izquierda: anim('libro-4p', 'Una rejilla de cuatro pisos por cuatro pasos que una onda recorre en diagonal'),
    parrafos: [
      'Así funcionaba el motor: cada piso era un rol que cumplía una necesidad en la gestión de un proyecto, y cada paso era una función en su levantamiento y su progreso.',
      'A cada miembro se le asignaba un piso y un paso de acuerdo con su talento, y según ese lugar tenía acceso a un conjunto de sistemas, que se activaban según la necesidad del proyecto en el que participara.',
      'Y por encima de todo había una sola ley, que el soñador escribió en la primera página de sus planos: **la necesidad determina todo lo que hacemos**.',
    ],
  },

  /* ── VII · Las herramientas ── */
  {
    id: 'herramientas', capitulo: 6, titulo: 'Las herramientas del motor',
    izquierda: { tipo: 'desglose', items: ['Metodología Condiciológica', 'Sistema de Control Psicosocial', 'Proyecto Centralizado', 'Violeta'] },
    parrafos: [
      'Pero un motor solo funciona si sus piezas están en buenas condiciones, y lo que este motor necesitaba era un **talento correctamente clasificado**, que se pudiera tratar y posicionar en función de la estrategia de la organización.',
      'Para clasificarlo bien, el soñador forjó cuatro herramientas. Serían las fuentes de información que justificarían el lugar de cada miembro dentro de la casa.',
    ],
  },
  {
    id: 'metodologia', capitulo: 6, titulo: 'La primera herramienta',
    izquierda: anim('herramienta-metodologia', 'Seis pasos en ciclo, recorridos por un pulso de luz'),
    parrafos: [
      'La primera fue la **Metodología Condiciológica**, una metodología con enfoque científico de seis pasos: **reconocer, controlar, predecir, experimentar, convertir y cambiar**, aplicables a cualquier ámbito de investigación.',
      'Nació para desarrollar la **Condiciología**, una ciencia en desarrollo que estudia las **condiciones**: el conjunto de factores que dan lugar a un comportamiento en un instante de la realidad.',
      'Los datos que necesita cada paso vienen de herramientas que se ofrecen solo a candidatos y miembros, y cada uno decide, según las condiciones del servicio, si acepta usarlas o no.',
    ],
  },
  {
    id: 'control', capitulo: 6, titulo: 'La segunda herramienta',
    izquierda: anim('herramienta-control', 'Una ciudad bajo una cúpula que recoge las señales de sus casas'),
    parrafos: [
      'La segunda fue el **Sistema de Control Psicosocial**, una arquitectura tecnológica pensada para resolver la **inseguridad física**. Funciona con las señales de la gran masa de clientes, candidatos y miembros, y de todos los dispositivos asociados, incluidos los agentes con inteligencia artificial, para dibujar la realidad tal como está ocurriendo.',
      'Su propósito es llevar la seguridad y la aplicación de la ley a un nivel **«ipso facto»**, para que un acto delictivo tenga consecuencias en el momento, sin procesos ni intermediarios que alarguen o disminuyan la condena. Su función principal es **organizar a las masas**: castiga el delito y recompensa de muchas maneras a quienes lo denuncian.',
    ],
  },
  {
    id: 'centralizado', capitulo: 6, titulo: 'La tercera herramienta',
    izquierda: anim('herramienta-centralizado', 'Las áreas de un negocio unidas a un centro por el que va y viene el trabajo'),
    parrafos: [
      'La tercera fue el **Proyecto Centralizado**, un servicio exclusivo para clientes, candidatos y miembros cuyos negocios atraviesan una necesidad, un problema interno o una crisis, y necesitan recuperar el buen funcionamiento de su flujo de trabajo o descubrir mejores formas de hacer las cosas.',
      'Para ofrecerlo se llega primero a un **acuerdo con el dueño del negocio**, que da acceso y control temporal de los departamentos afectados para implantar los sistemas de gobernanza del Grupo. Y los negocios que se conectan pasan a formar parte de la **Estrategia Organizacional**, que une negocios y talentos para adoptar las mejores soluciones y crear oportunidades.',
    ],
  },
  {
    id: 'violeta', capitulo: 6, titulo: 'La cuarta herramienta',
    izquierda: anim('herramienta-violeta', 'El logo del grupo envuelto en aros de luz violeta'),
    parrafos: [
      'La cuarta herramienta no se forjó en ningún taller. Se llamó **Violeta**, la luz que representa a la casa, el color que une corazones y un lugar para aquellos que son diferentes. Es una luz que ilumina el vacío y lo aprovecha, que une destinos y convierte lo que parece imposible en sueños y en felicidad.',
      'Violeta aparece cuando alguien recuerda sus raíces. Es lo que se siente en cada latido, en cada esfuerzo y en cada lágrima, y la nostalgia del momento preciso en que todo lo malo cambió.',
    ],
  },
  {
    id: 'violeta-2', capitulo: 6, titulo: 'El reto de Violeta',
    izquierda: anim('herramienta-violeta', 'El logo del grupo envuelto en aros de luz violeta'),
    parrafos: [
      'Violeta es la fuerza que hace soñar, desear y seguir buscando sin saber cuándo parar; un deseo tan profundo que no cabe en el pecho y que tiene la habilidad de cruzar los corazones y transformar la realidad.',
      'Por eso es el reto de todos los candidatos y miembros: proteger lo que nos hace humanos y el futuro de nuestros hijos, y convertirse en los líderes dispuestos a cambiar el mundo. Es un sueño que se mide a través de la **prospección**, y cada participante demuestra en la **evaluación continua** si es capaz de representar sus valores y una bandera que logrará cruzar al mundo.',
    ],
  },

  /* ── VIII · Las reglas de la puerta ── */
  {
    id: 'reglas', capitulo: 7, titulo: 'Las reglas de la puerta',
    izquierda: { tipo: 'desglose', items: ['Regla #1 · ¿Quiénes somos?', 'Regla 2 · Comandos', 'Regla 3 · Opciones de crecimiento'] },
    parrafos: [
      'Cuando la casa estuvo lista, el soñador grabó tres reglas en su puerta, para todos los candidatos y miembros, en cualquier rol.',
      'Debajo escribió una advertencia: faltar a una sola de esas reglas significa la **destitución**, y quien es destituido no tiene otra oportunidad para volver a unirse. Solo los fallos que no son intencionales se evalúan, y pueden no llevar a la destitución.',
    ],
  },
  {
    id: 'regla-1', capitulo: 7, titulo: 'La primera regla: ¿quiénes somos?',
    izquierda: anim('regla-1', 'Nueve valores alrededor del logo que se encienden uno a uno'),
    parrafos: [
      'La primera regla dice quiénes pueden vivir en la casa: solo candidatos y miembros que tienen la prospección de representarla. Quienes caigan en delitos o mentiras, quienes actúen con mala intención por mínima que sea, o quienes olviden sostener en su vida diaria y en sus relaciones los valores de la organización, serán des-agrupados del proyecto.',
      'Y esos valores son nueve, como nueve estrellas alrededor del corazón.',
    ],
  },
  {
    id: 'valores', capitulo: 7, titulo: 'Las nueve estrellas',
    izquierda: anim('regla-1', 'Nueve valores alrededor del logo que se encienden uno a uno'),
    parrafos: [
      '**Determinación**: insistir hasta el cansancio, levantarse y no rendirse. **Coraje**: confrontar todo lo que está mal y descubrir un motivo para superar los miedos. **Pureza**: no olvidar nunca las raíces ni quién eres en realidad.',
      '**Fe**: confiar en ti y convertir en reales los sueños que parecen imposibles. **Paciencia**: valorar todo lo que hay en esta vida antes de dejarse llevar por la desesperación. **Seriedad**: priorizar las necesidades y hacerse responsable para aprender a solucionar los propios problemas.',
      '**Espontaneidad**: explorar lo que sientes, sin miedo a equivocarte. **Autonomía**: saber que tu futuro depende únicamente de ti. Y **Empatía**: valorar el corazón de quienes sí valen la pena.',
    ],
  },
  {
    id: 'regla-2', capitulo: 7, titulo: 'La segunda regla: los comandos',
    izquierda: anim('regla-2', 'Desde el logo bajan los comandos a los miembros y sube la corrección'),
    parrafos: [
      'La segunda regla explica cómo se mueve la casa. La gobernanza **escucha, decide y analiza correcciones** en cada estrategia que pone en marcha para progresar y enfrentar una problemática.',
      'Antes de decidir, el líder escucha las propuestas y las discusiones, se dibuja un mapa visual del proyecto con las alternativas posibles y se elige la opción más viable para ejecutarla y medir sus efectos. Desde ese momento, la relación entre el líder, los miembros y los candidatos se sostiene a través de los comandos que hay que ejecutar.',
      'Los comandos se ejecutan sin cuestionamiento, y quien no los acata o afecta el cálculo de la estrategia queda fuera del proyecto en el acto. Todo se analiza y se corrige después, en la etapa de corrección, donde todos sin excepción tienen la obligación de votar y participar.',
    ],
  },
  {
    id: 'regla-3', capitulo: 7, titulo: 'La tercera regla: la confianza',
    izquierda: anim('regla-3', 'Un árbol por el que sube la energía hasta abrir sus brotes'),
    parrafos: [
      'La tercera regla habla de crecer. La casa ofrece un sistema de **Desarrollo Humano** que impulsa a sus candidatos y miembros y les da acceso a oportunidades para avanzar en su progreso, sin excepciones ni condiciones.',
      'Pero la confianza y el acceso a mayores recursos dependen de la **prospección** y de los **resultados** obtenidos, y esa confianza se entrega **una sola vez**. Si una oportunidad se usa de forma abusiva o para otros fines, la decisión es la destitución, porque para esta casa la confianza no se recupera tras una traición.',
      'Como la casa atiende todas las necesidades, incluso las que no son de interés personal, no hay excusa para mentir ni para abusar de los recursos. Solo pide mantener siempre las buenas intenciones, y las opciones de crecimiento llegarán.',
    ],
  },

  /* ── IX · El camino de los cuatro faroles ── */
  {
    id: 'prospeccion', capitulo: 8, titulo: 'El camino de los cuatro faroles',
    izquierda: anim('libro-prospeccion', 'Una pirámide de cuatro niveles que una luz recorre hasta llegar al logo'),
    parrafos: [
      'Para saber quién estaba preparado para crecer, el soñador trazó un camino iluminado por cuatro faroles. Lo llamó **prospección**: un indicador que mide la intención de crecimiento de cada persona según cuatro aspectos, ordenados por la importancia que tienen para transformar su vida.',
      'Ese camino es el método de evaluación continua del Grupo Corazones Cruzados, y cada farol alumbra uno de esos aspectos.',
    ],
  },
  {
    id: 'talento', capitulo: 8, titulo: 'El primer farol: el talento',
    izquierda: { tipo: 'piramide', activo: 0 },
    parrafos: [
      'El primer farol, el más brillante, es el **talento**. Es lo que hace de este proyecto una realidad: cuando una persona puede aportar al mundo un valor con su esfuerzo y su capacidad, se convierte en una herramienta de altísimo valor para el proyecto que lo necesite.',
      'La casa quiere descubrir ese talento y crear oportunidades para posicionarlo dentro de una estrategia organizacional, donde cada movimiento lo desarrolle y despierte el interés de nuevos clientes que deseen sus servicios.',
    ],
  },
  {
    id: 'valores-prospeccion', capitulo: 8, titulo: 'El segundo farol: los valores',
    izquierda: { tipo: 'piramide', activo: 1 },
    parrafos: [
      'El segundo farol son los **valores**, porque la confianza de los clientes se mide en ellos. Quien no los sostiene puede tomar un encargo como algo sin importancia y limitar incluso su propio talento; por eso la casa exige sus valores, que son la fuente principal de las oportunidades.',
      'Según la confianza que tenga, un cliente se arriesga a invertir su tiempo y su dinero en los servicios, talentos y productos de la casa. Si sus miembros demuestran una alta calidad humana, sin importar el cliente ni el lugar, la casa se convierte en el lugar ideal para encontrar a quien sabe resolver un problema.',
    ],
  },
  {
    id: 'dimensiones', capitulo: 8, titulo: 'El tercer farol: las dimensiones',
    izquierda: { tipo: 'piramide', activo: 2 },
    parrafos: [
      'El tercer farol alumbra las cuatro **dimensiones del desarrollo humano**: la **laboral, la corporal, la social y la mental**. Cada una guarda un conjunto de problemas que, si no se atienden, aumentan el riesgo de malas decisiones y comportamientos que terminan dañando a uno mismo y a los demás.',
      'Los valores sostienen esos riesgos, y un talento competente tiene más posibilidades de resolverlos con los recursos que consigue. Aun así, hay problemas que requieren estrategias personalizadas para mejorar la calidad de vida, y cuando se abordan, la persona impulsa sus valores y su talento en su entorno de trabajo.',
    ],
  },
  {
    id: 'red-apoyo', capitulo: 8, titulo: 'El cuarto farol: la red de apoyo',
    izquierda: { tipo: 'piramide', activo: 3 },
    parrafos: [
      'El último farol es la **red de apoyo**: las personas que nos rodean. Cuando las dimensiones están muy afectadas, suele ser un factor vital para resolver los problemas, un buen referente para sostener los valores y una fuerza para buscar oportunidades.',
      'Pero en esta casa es el farol de menor importancia, porque sus valores enseñan que no se necesita una red de apoyo para afrontar los propios problemas. Es un complemento que acompaña, y nadie debe depender de ella para estar bien.',
    ],
  },

  /* ── X · El viajero que llegó a la casa ── */
  {
    id: 'afiliacion', capitulo: 9, titulo: 'El viajero que llegó a la casa',
    izquierda: anim('libro-afiliacion', 'Un camino de cinco paradas que termina en el logo del grupo'),
    parrafos: [
      'Un día llegó a la casa un viajero que quería ser parte de ella, y el soñador le explicó cómo se recorre la **afiliación**, el camino por el que un candidato se convierte en miembro.',
      'Primero tendría que **postularse**, enviando su propuesta en el formulario, y si era elegido recibiría un **correo de confirmación**. Después **recibiría su acceso** al sitio web como **usuario candidato**, y desde ese momento podría usar las herramientas del grupo para su desarrollo humano.',
      'Luego **asistiría a las reuniones semanales**, donde recibiría las indicaciones para **demostrar su afiliación** y los comandos que debería ejecutar.',
    ],
  },
  {
    id: 'afiliacion-2', capitulo: 9, titulo: 'Convertirse en miembro',
    izquierda: anim('libro-afiliacion', 'Un camino de cinco paradas que termina en el logo del grupo'),
    parrafos: [
      'Después tendría que **elevar su prospección**. Cada tarea cumplida sumaría y cada tarea incumplida restaría en el valor al que corresponde, y además se evaluarían sus talentos, sus cuatro dimensiones y su red de apoyo. Cuando su prospección alcanzara un nivel alto, su caso se revisaría para convertirlo en miembro.',
      'Y al final, cuando cumpliera con la demostración, un miembro **Global** del paso de **Implementación** realizaría su afiliación como nuevo miembro de la casa.',
      'El viajero escuchó en silencio, miró la puerta con sus tres reglas grabadas y sonrió. Ya sabía qué tenía que hacer.',
    ],
  },
];

/** La última doble página: el formulario. */
export const EPILOGO = {
  id: 'epilogo',
  capitulo: CAPITULOS.length - 1,
  titulo: 'Tu página en blanco',
  ilustracion: anim('libro-pagina', 'Una página en la que una luz escribe renglón a renglón'),
  parrafos: [
    'Este libro todavía no termina. Las páginas que faltan las escriben quienes deciden formar parte del Grupo Corazones Cruzados, y la primera línea de esa historia empieza aquí.',
  ],
};

/** Lo que se lee en voz alta en el índice. */
export const NARRACION_INDICE = 'Grupo Corazones Cruzados. Un corazón puede cruzar al mundo.';

export const PASOS_CONDICIOLOGIA = ['Reconocer', 'Controlar', 'Predecir', 'Experimentar', 'Convertir', 'Cambiar'];
