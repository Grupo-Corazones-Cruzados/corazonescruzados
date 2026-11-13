/**
 * EL GUION VISUAL DEL CUENTO PARA SORA (Fernando, 2026-11-12: «el prompt debe ser muy excelente para que logren
 * representar en el video todas las escenas… de forma que sea más lineal… y se dé su tiempo para mostrar un
 * evento durante el tiempo que se requiere hablar sobre esa frase»).
 *
 * Para cada frase de la narración (tiempos reales en `lib/sitio/libroFrases.json`, de `tiempos.mts`) hay un
 * ACONTECIMIENTO que se ve mientras la voz la dice. Las frases se agrupan en CLIPS de hasta 15 s (lo que Sora
 * genera de una vez) y cada clip lleva: el estilo, el reparto que sale, desde dónde continúa y los planos con
 * su tiempo exacto. Genera `docs/cuento/prompts-sora.md` y la página publicada con los prompts.
 *   npx tsx scripts/libro/guion.mts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';

type Frase = { frase: string; inicio: number; fin: number };
const FRASES: Record<string, Frase[]> = JSON.parse(readFileSync('lib/sitio/libroFrases.json', 'utf8'));
const MAX_CLIP = 15;

export const ESTILO =
  'Animación 3D estilizada de bloques, como un diorama hecho a mano: personajes, objetos y escenarios construidos con cubos y prismas ' +
  'de cartón pintado, texturas mate con leve grano, bordes un poco redondeados. Personajes muy expresivos: ojos y cejas cuadradas ' +
  'que cambian de expresión, boca de bloque, gestos claros y legibles. Iluminación cinematográfica suave con contraluz; paleta ' +
  'propia: violetas y azules profundos con acentos cálidos dorados. Profundidad de campo, cámara con movimientos lentos y ' +
  'motivados, encuadres de cine. Cada acontecimiento dura todo el tiempo indicado: nada de cortes rápidos dentro de un tramo. ' +
  'Sin texto en pantalla, sin subtítulos, sin letreros legibles, sin logotipos de marcas. Audio: solo ambiente y efectos ' +
  'suaves; sin voces, sin diálogos y sin música. Formato 16:9.';

export const REPARTO: Record<string, string> = {
  nino: 'EL NIÑO: niño de 9 años hecho de bloques, piel morena clara, pelo negro de bloques despeinado, ojos grandes y soñadores, sudadera violeta con un pequeño corazón blanco en el pecho, pantalón gris, zapatillas blancas.',
  sonador: 'EL SOÑADOR: el mismo niño ya adulto (unos 28 años), hecho de bloques, piel morena clara, pelo negro corto de bloques, barba corta, chaqueta violeta con el pequeño corazón blanco en el pecho, pantalón gris; mirada firme y serena.',
  viajero: 'EL VIAJERO: joven de unos 22 años hecho de bloques, piel clara con pecas, pelo castaño, bufanda verde, mochila de viaje marrón, botas de camino; curioso y tímido.',
  gente: 'LA GENTE: personas de bloques de muchos lugares, con distintos tonos de piel, peinados y ropas de colores (rojo, ocre, azul, verde); expresivas.',
  casa: 'LA CASA: un edificio alto de bloques de cuatro pisos apilados, de piedra clara y madera, tejado violeta y un gran corazón blanco en la fachada; cada piso tiene cuatro puertas de madera en fila; ventanas con luz cálida.',
};

type Plano = { r: string[]; v: string[] };
/** Por escena: lo que se ve en cada frase (`v`, uno o varios acontecimientos que se reparten el tiempo de la frase). */
const GUION: Record<string, Plano[]> = {
  sueno: [
    { r: ['nino'], v: ['Noche. Un cuarto pequeño de madera: el niño sentado en su pupitre junto a una ventana grande llena de estrellas, un farol encendido sobre la mesa. La cámara entra despacio por la ventana hacia él.'] },
    { r: ['nino'], v: ['Primer plano del niño: apoya la cara en las manos y sonríe con los ojos brillando hacia el cielo.'] },
    { r: ['nino'], v: ['Por la ventana el sol cruza el cielo y vuelve la luna en un time-lapse suave mientras el niño sigue mirando, soñando despierto.', 'El niño cierra los ojos: el cuarto se llena de luz cálida y el pupitre empieza a flotar entre nubes violetas; el niño se acurruca feliz entre ellas, sin querer volver.'] },
    { r: ['nino'], v: ['Desde la ventana, el niño señala las estrellas una por una; cada estrella que toca se enciende y se une a otras con líneas de luz.', 'Las constelaciones se ordenan en un gran círculo de luz en el cielo donde todas las estrellas caben; el niño lo mira asombrado.'] },
    { r: ['nino', 'gente'], v: ['Dentro del sueño: bajo ese cielo, personas de bloques de distintos colores se dan la mano formando una ronda alrededor del niño, que sonríe.'] },
  ],
  realidad: [
    { r: ['nino'], v: ['Corte a la mañana: la misma habitación, ahora gris y fría.'] },
    { r: ['nino'], v: ['Un despertador de bloques suena y salta sobre el pupitre; el niño se despierta sobresaltado y caen sobre la mesa pilas de cuadernos y tareas.'] },
    { r: ['nino'], v: ['El niño se asoma a la ventana: fuera, una ciudad de bloques gris bajo la lluvia.'] },
    { r: ['nino', 'gente'], v: ['En la calle, gente gris camina con la cabeza baja; alguien empuja a otro al suelo y todos pasan de largo. El niño, más alto cada vez en tres planos breves, sigue mirando y frunce las cejas.'] },
    { r: ['nino'], v: ['El niño, ya un adolescente, se lleva la mano al pecho; la cámara se aleja y el cuarto parece enorme y oscuro a su alrededor.'] },
    { r: ['nino'], v: ['Una noche de tormenta: el adolescente, sentado en el suelo junto a la cama, con la cabeza entre las rodillas; un relámpago ilumina el cuarto.'] },
    { r: ['nino'], v: ['Levanta la cabeza, aprieta los puños y en sus ojos se refleja una pequeña luz violeta.'] },
  ],
  promesa: [
    { r: ['nino'], v: ['Amanecer dorado entrando por la ventana.'] },
    { r: ['nino'], v: ['El adolescente, de pie frente a la ventana, levanta la mano hacia el sol como en un juramento; el corazón de su sudadera brilla violeta.'] },
    { r: ['nino'], v: ['Guarda en un cajón sus dibujos de estrellas y abre una libreta nueva; en el cristal de la ventana se reflejan recuerdos de la ciudad gris.'] },
    { r: ['nino'], v: ['Escribe con fuerza en la libreta a la luz del farol; montaje en el mismo lugar: cada plano es más mayor, de adolescente a joven, siempre escribiendo.', 'Una fotografía de bloques en la pared muestra niños jugando en un parque verde y luminoso; el joven la mira con ternura y determinación.'] },
    { r: ['sonador'], v: ['El joven cierra la libreta de golpe y se levanta decidido.'] },
    { r: ['sonador'], v: ['Se pone una mochila, toma una brújula del pupitre y abre la puerta de la casa: fuera, un camino que sale al amanecer. Plano de espaldas: el soñador camina hacia el horizonte.'] },
  ],
  corazon: [
    { r: ['sonador'], v: ['Sobre un gran mapa del mundo de bloques, un pequeño soñador camina dejando huellas de luz.'] },
    { r: ['sonador'], v: ['El soñador llega a una línea de frontera: una barrera de bloques se levanta y la cruza.'] },
    { r: ['sonador', 'gente'], v: ['Plano aéreo: territorios de colores separados por muros y líneas, cada uno con su bandera de bloques sin escudos legibles.', 'En cada territorio la gente se mira con desconfianza a través de las líneas; el soñador pasa entre ellos observando.'] },
    { r: ['sonador'], v: ['Montaje de viaje: el soñador en un pueblo de montaña, en una ciudad junto al mar, en un desierto, en una ciudad de rascacielos.'] },
    { r: ['sonador', 'gente'], v: ['En cada lugar, un gesto igual: una madre abraza a su hijo, un anciano comparte su pan, dos amigos se ayudan a levantar una carga. El soñador sonríe.'] },
    { r: ['sonador', 'gente'], v: ['De cada persona sale un hilo de luz violeta, fino y silencioso, que cruza las fronteras y une a unos con otros por debajo del mapa.'] },
    { r: ['sonador'], v: ['Primer plano del soñador: abre mucho los ojos, lo ha comprendido.'] },
    { r: ['sonador', 'gente'], v: ['Todos los hilos de luz se juntan en el pecho del soñador y forman un gran corazón violeta que late.', 'El corazón se eleva sobre el mapa y atraviesa las fronteras; las personas de los distintos territorios levantan la vista, se acercan y empiezan a trabajar juntas.'] },
  ],
  disciplina: [
    { r: ['sonador'], v: ['Un camino de bloques al atardecer: el soñador sigue su viaje.'] },
    { r: ['sonador', 'gente'], v: ['Encuentra a varios jóvenes de bloques sentados junto a montañas de cajas viejas y rotas que otros dejaron atrás.'] },
    { r: ['gente'], v: ['Sombras alargadas con sombreros oscuros (las mafias) se llevan lo que los jóvenes construyen y derriban sus torres de bloques.', 'Unos mayores, sentados en un banco, niegan con la cabeza y se encogen de hombros.'] },
    { r: ['sonador'], v: ['El soñador levanta la vista: ante él aparece una escalera altísima de bloques que sube hasta las nubes, con un obstáculo oscuro en cada peldaño.'] },
    { r: ['sonador'], v: ['El soñador se arremanga y pone el pie en el primer peldaño.'] },
    { r: ['sonador', 'gente'], v: ['Sube peldaño a peldaño; en cada uno retira el obstáculo y lo limpia; los jóvenes se le unen y suben con él.', 'Desde lo alto, abajo, las calles grises se van iluminando y llenando de color a medida que suben.'] },
  ],
  poder: [
    { r: ['sonador'], v: ['El soñador entra en una gran plaza de una ciudad de bloques.'] },
    { r: ['sonador', 'gente'], v: ['En la plaza, la gente hace fila para echar papeletas en grandes urnas de bloques.'] },
    { r: ['gente'], v: ['Sobre una tarima, un político de bloques con traje habla con grandes gestos y sonrisa ensayada; la multitud aplaude.', 'Detrás del telón, el mismo político guarda monedas de oro en un saco y la sonrisa se le borra; las urnas se llenan de telarañas.'] },
    { r: ['gente'], v: ['La gente de la plaza, cansada y gris, recoge las migajas que caen desde la tarima y vuelve a casa con la cabeza baja.'] },
    { r: ['sonador'], v: ['El soñador observa desde la esquina; frunce el ceño, se da la vuelta y deja atrás la plaza con paso firme.'] },
  ],
  lider: [
    { r: ['sonador'], v: ['Un taller abierto en la misma ciudad, de día.'] },
    { r: ['sonador'], v: ['El soñador, con las mangas arremangadas, levanta con sus propias manos un muro de bloques.'] },
    { r: ['sonador', 'gente'], v: ['Lo que construye toma forma: un puente, un huerto, una escuela de bloques; la gente se acerca a mirar.'] },
    { r: ['sonador'], v: ['Primero ordena su propia casa: barre, arregla la ventana, enciende el farol; después sale a ayudar al vecino.'] },
    { r: ['sonador'], v: ['El soñador baja de una tarima vacía y se pone a trabajar al nivel de la gente.'] },
    { r: ['sonador', 'gente'], v: ['La gente lo sigue sin que lo pida: uno a uno dejan lo que hacen y se suman; en el pecho de cada uno se enciende un pequeño corazón violeta.'] },
  ],
  grupo: [
    { r: ['sonador', 'casa'], v: ['El soñador regresa a su pueblo con la mochila al hombro, al atardecer.'] },
    { r: ['sonador', 'casa'], v: ['Clava en la tierra la primera piedra y levanta una casa de bloques con un gran corazón blanco en la fachada.'] },
    { r: ['casa'], v: ['La casa crece hacia el cielo y su corazón se enciende en violeta, iluminando el pueblo.'] },
    { r: ['sonador'], v: ['Dentro, el soñador ante una gran mesa de planos, pensativo.'] },
    { r: ['sonador', 'gente'], v: ['Sobre la mesa, figuras de bloques de distintas personas; el soñador coloca cada una en el sitio donde mejor encaja y todas encajan como piezas de un puzle que resuelve un problema.'] },
    { r: ['gente', 'casa'], v: ['Por los caminos llegan personas de lugares muy distintos y se reúnen alrededor de la casa, mirando su corazón encendido.'] },
  ],
  miembros: [
    { r: ['gente', 'casa'], v: ['Ante la puerta de la casa, un grupo de miembros con chaquetas violetas.'] },
    { r: ['gente', 'casa'], v: ['Los miembros sonríen a cámara, cada uno en su puesto de trabajo dentro de la casa.'] },
    { r: ['gente', 'casa'], v: ['Una persona llega con una pequeña insignia gris de candidato, ayuda a los demás, y su insignia se vuelve violeta.'] },
    { r: ['viajero', 'casa'], v: ['A lo lejos, un camino largo lleva hasta la puerta; al principio del camino, una figura con mochila mira la casa.'] },
  ],
  motor: [
    { r: ['casa'], v: ['Corte transversal de la casa, como una maqueta abierta: se ven sus cuatro pisos por dentro.'] },
    { r: ['sonador', 'casa'], v: ['En el sótano, el soñador enciende un gran motor de engranajes de bloques que hace vibrar la casa.'] },
    { r: ['sonador', 'gente', 'casa'], v: ['Del motor sale una luz que recorre a cada persona como un escáner: en cada pecho brilla un símbolo distinto, su talento.', 'El soñador acompaña a cada persona a una habitación distinta de la casa, donde se pone a trabajar a gusto.'] },
    { r: ['casa'], v: ['La cámara sube por el corte de la casa mostrando sus cuatro pisos uno sobre otro.'] },
    { r: ['gente', 'casa'], v: ['Último piso, la cúpula: unas personas ante una mesa redonda deciden sobre un gran plano luminoso; abajo todo se pone en marcha.'] },
    { r: ['gente', 'casa'], v: ['Segundo piso: arquitectos de bloques dibujan y montan maquetas de proyectos con forma y dirección.'] },
    { r: ['gente', 'casa'], v: ['Tercer piso: alguien parte un gran plano en pequeñas tarjetas de tareas y las reparte a cada persona.', 'Esas tarjetas bajan por un tubo hasta el piso de abajo.'] },
    { r: ['gente', 'casa'], v: ['Primer piso: un taller donde las tarjetas se convierten en objetos terminados que salen por la puerta brillando.'] },
  ],
  'pasos-4p': [
    { r: ['casa'], v: ['Plano frontal de un piso de la casa: un pasillo con cuatro puertas de madera.'] },
    { r: ['casa'], v: ['Las cuatro puertas se iluminan una tras otra de izquierda a derecha.'] },
    { r: ['gente', 'casa'], v: ['Se abre la primera puerta: un gran signo de interrogación de bloques flota en la sala.'] },
    { r: ['gente', 'casa'], v: ['Dentro, investigadores con lupas y libros apilan bloques de conocimiento como los cimientos de un edificio, firmes, sin huecos.'] },
    { r: ['gente', 'casa'], v: ['La segunda puerta: sobre esos cimientos, alguien levanta la maqueta de una idea que toma forma concreta.'] },
    { r: ['gente', 'casa'], v: ['La tercera puerta: la maqueta entra en una sala y se cierran las puertas tras ella.'] },
    { r: ['gente', 'casa'], v: ['Dentro, cada persona recibe su casco y su puesto, se cuelgan carteles de reglas sin texto legible y la maqueta empieza a funcionar sola.'] },
    { r: ['gente', 'casa'], v: ['La cuarta puerta se abre al exterior: el proyecto terminado sale a la calle, con focos y altavoces de bloques que lo anuncian.', 'La gente de la calle se acerca, lo usa, y caen monedas que hacen crecer un pequeño árbol junto a la puerta.'] },
  ],
  'reglas-4p': [
    { r: ['casa'], v: ['La casa entera, en corte, funcionando como un reloj.'] },
    { r: ['casa'], v: ['Los engranajes del motor giran sincronizados.'] },
    { r: ['casa'], v: ['Una cuadrícula de luz se dibuja sobre el corte: cuatro pisos en filas y cuatro puertas en columnas.', 'En cada cruce se enciende una pequeña luz cuando hay una tarea que lo necesita.'] },
    { r: ['gente', 'casa'], v: ['Una persona llega con su talento brillando en el pecho y una luz la guía a su cruce: su piso y su puerta.', 'Al ocupar su lugar, a su alrededor se encienden las herramientas que necesita, y se apagan las que no.'] },
    { r: ['sonador'], v: ['El soñador abre un viejo cuaderno de planos por la primera página y escribe una frase con pluma.'] },
    { r: ['sonador'], v: ['La frase escrita brilla en violeta, sin letras legibles, y su luz recorre toda la casa.'] },
  ],
  herramientas: [
    { r: ['casa'], v: ['El motor de la casa en el sótano.'] },
    { r: ['sonador', 'casa'], v: ['El motor tose: una pieza no encaja y salta una chispa; el soñador la saca, la mira y la limpia.', 'Prueba a colocar distintas personas en su sitio hasta que cada una encaja exacta, y el motor vuelve a girar suave.'] },
    { r: ['sonador'], v: ['En una fragua, el soñador golpea el yunque y forja cuatro objetos brillantes.'] },
    { r: ['sonador'], v: ['Coloca las cuatro herramientas sobre una mesa: de cada una sale un haz de luz que señala el lugar de una persona en la casa.'] },
  ],
  metodologia: [
    { r: ['sonador'], v: ['Sobre la mesa, la primera herramienta: un instrumento de bronce con forma de brújula científica.'] },
    { r: ['sonador'], v: ['El soñador la abre: dentro, seis agujas alrededor de un centro, como un reloj de laboratorio.'] },
    { r: ['sonador'], v: ['Las seis agujas se encienden una tras otra en círculo, cada una con un símbolo distinto (un ojo, una mano, una flecha, un tubo de ensayo, un engranaje, una mariposa).'] },
    { r: ['sonador'], v: ['El instrumento proyecta en el aire un laboratorio de luz.'] },
    { r: ['gente'], v: ['En la proyección, un momento congelado: una persona a punto de actuar, rodeada de pequeñas luces que son sus condiciones (su casa, su trabajo, su ánimo, su gente).'] },
    { r: ['gente'], v: ['Una mesa ofrece pequeñas herramientas de bloques a candidatos y miembros; unos las toman y otros no, y cada decisión se respeta con un gesto amable.'] },
  ],
  control: [
    { r: ['casa'], v: ['La segunda herramienta: una cúpula de cristal sobre una ciudad de bloques, de noche.'] },
    { r: ['gente'], v: ['Por las calles oscuras hay peligro: sombras en los callejones y la gente camina con miedo.'] },
    { r: ['gente'], v: ['Desde los teléfonos y relojes de miles de personas, y desde pequeños robots, suben puntos de luz hacia la cúpula.', 'La cúpula dibuja con esos puntos un mapa vivo de la ciudad que se mueve en tiempo real.'] },
    { r: ['gente'], v: ['Una sombra intenta robar en un callejón: al instante, una luz violeta la rodea y la detiene.', 'Sin oficinas ni papeles: ocurre en el mismo momento.'] },
    { r: ['gente'], v: ['La gente sale de sus casas y se organiza en las calles bajo la cúpula.'] },
    { r: ['gente'], v: ['La sombra queda encerrada en un cubo de luz y la persona que dio el aviso recibe una medalla brillante; los vecinos aplauden.'] },
  ],
  centralizado: [
    { r: ['gente'], v: ['La tercera herramienta: una tienda de bloques en apuros.'] },
    { r: ['gente'], v: ['Dentro, cajas tiradas, cintas transportadoras atascadas y el dueño agobiado con las manos en la cabeza.', 'Un grupo de la casa con chaquetas violetas llega con cajas de herramientas.', 'Ordenan el taller: las cintas vuelven a moverse y todo fluye mejor que antes.'] },
    { r: ['sonador', 'gente'], v: ['El soñador y el dueño se dan la mano sobre un acuerdo; el dueño le entrega una llave.', 'El equipo entra en las salas que fallaban, instala paneles de control de la casa y los arreglan.'] },
    { r: ['gente', 'casa'], v: ['Plano aéreo: muchas tiendas y talleres se conectan entre sí con caminos de luz que llegan hasta la casa.', 'Por esos caminos viajan personas con talento y soluciones de un negocio a otro, y en todos se encienden las luces.'] },
  ],
  violeta: [
    { r: ['casa'], v: ['Oscuridad total.'] },
    { r: ['sonador'], v: ['El soñador, con las manos vacías ante la fragua apagada.'] },
    { r: ['sonador', 'gente'], v: ['Del corazón de la casa nace una luz violeta que envuelve a personas muy diferentes entre sí y las une en un abrazo.'] },
    { r: ['gente'], v: ['La luz cae en un vacío oscuro y lo llena de flores de bloques; dos caminos separados se juntan en uno; un muro imposible se convierte en una puerta abierta.'] },
    { r: ['sonador'], v: ['El soñador mira una foto vieja de su infancia y una luz violeta brota de ella.'] },
    { r: ['sonador'], v: ['Primer plano de un corazón de bloques que late; una gota de sudor cae; una lágrima cae; y todo lo gris a su alrededor se vuelve de colores.'] },
  ],
  'violeta-2': [
    { r: ['sonador'], v: ['La luz violeta se mueve como una llama viva.'] },
    { r: ['sonador'], v: ['El soñador camina hacia el horizonte siguiendo la luz, sin detenerse, de día y de noche.'] },
    { r: ['gente'], v: ['La luz crece en un pecho hasta desbordarlo y salta a otro pecho, cruzando corazones; un paisaje gris se pinta de colores.'] },
    { r: ['gente', 'casa'], v: ['Frente a la casa, candidatos y miembros miran la luz violeta en lo alto.'] },
    { r: ['gente'], v: ['Protegen a unos niños bajo un tejado de luz y después dan un paso al frente, decididos, como líderes.'] },
    { r: ['gente', 'casa'], v: ['Una gran barra de luz junto a la casa sube a medida que cada persona cumple una tarea.', 'En lo alto de la casa se iza una bandera violeta con un corazón blanco que ondea sobre el mundo.'] },
  ],
  reglas: [
    { r: ['casa'], v: ['La gran puerta de madera de la casa, de cerca.'] },
    { r: ['sonador', 'casa'], v: ['El soñador graba con cincel tres símbolos en la puerta mientras candidatos y miembros de todos los pisos lo observan.'] },
    { r: ['sonador'], v: ['Debajo, graba una línea más.'] },
    { r: ['gente', 'casa'], v: ['Un personaje rompe uno de los símbolos a propósito: la puerta se cierra ante él y se queda fuera, solo, sin poder volver a entrar.'] },
    { r: ['gente', 'casa'], v: ['Otra persona tropieza sin querer y tira un jarrón; la gente la ayuda a levantarse y la puerta sigue abierta.'] },
  ],
  'regla-1': [
    { r: ['casa'], v: ['El primer símbolo de la puerta se ilumina.'] },
    { r: ['casa'], v: ['El símbolo brilla con fuerza.'] },
    { r: ['gente', 'casa'], v: ['La puerta se abre a un salón donde viven candidatos y miembros.'] },
    { r: ['gente', 'casa'], v: ['Cada persona lleva en el pecho una pequeña luz violeta que la identifica con la casa.'] },
    { r: ['gente', 'casa'], v: ['Una sombra que miente y otra que roba intentan entrar con mala intención; sus luces se apagan.', 'Alguien deja de cuidar a los suyos y descuida su luz; una por una, esas personas se separan del grupo y salen.'] },
    { r: ['casa'], v: ['Sobre la casa, nueve estrellas aparecen y giran alrededor del gran corazón.'] },
  ],
  valores: [
    { r: ['casa'], v: ['Nueve estrellas giran sobre la casa; la cámara se acerca a la primera.'] },
    { r: ['gente'], v: ['Determinación: un joven cae corriendo, se levanta y sigue, una y otra vez, hasta llegar.'] },
    { r: ['gente'], v: ['Coraje: una joven se planta ante una sombra enorme y la sombra retrocede.'] },
    { r: ['gente'], v: ['Pureza: un adulto vuelve a su pueblo natal y abraza a su madre en la puerta de su casa de la infancia.'] },
    { r: ['gente'], v: ['Fe: un niño dibuja un castillo en una hoja y el dibujo se levanta en bloques de verdad.'] },
    { r: ['gente'], v: ['Paciencia: una anciana riega una semilla, día tras día, hasta que crece un árbol en flor.'] },
    { r: ['gente'], v: ['Seriedad: un joven ordena un escritorio lleno de problemas y los resuelve uno a uno.'] },
    { r: ['gente'], v: ['Espontaneidad: una chica baila bajo la lluvia, tropieza y se ríe.'] },
    { r: ['gente'], v: ['Autonomía: un joven toma el timón de su barco y lo dirige él solo.'] },
    { r: ['gente'], v: ['Empatía: alguien tiende la mano a una persona sentada sola y se sienta a su lado.'] },
  ],
  'regla-2': [
    { r: ['casa'], v: ['El segundo símbolo de la puerta se ilumina.'] },
    { r: ['casa'], v: ['Brilla con fuerza.'] },
    { r: ['casa'], v: ['Un gran salón con una mesa redonda en el último piso.'] },
    { r: ['sonador', 'gente'], v: ['Alrededor de la mesa: unos hablan, el soñador escucha, se golpea un mazo de bloques, y alguien corrige un plano con un lápiz.'] },
    { r: ['sonador', 'gente'], v: ['Cada miembro presenta su propuesta; sobre la mesa se proyecta un mapa luminoso con varios caminos posibles.', 'El soñador señala el camino más claro, que se ilumina, y los demás se apagan.'] },
    { r: ['sonador', 'gente'], v: ['Desde la mesa salen órdenes como flechas de luz hacia cada piso, y cada persona recibe la suya.'] },
    { r: ['gente'], v: ['Todos ejecutan sus órdenes a la vez, como un equipo perfecto; uno se niega y rompe la línea, y una puerta lo deja fuera.'] },
    { r: ['gente'], v: ['Después, en el salón, todos levantan la mano y votan; se ajusta el plano y el equipo vuelve a funcionar mejor.'] },
  ],
  'regla-3': [
    { r: ['casa'], v: ['El tercer símbolo de la puerta se ilumina.'] },
    { r: ['casa'], v: ['Brilla con fuerza.'] },
    { r: ['gente'], v: ['Un brote de árbol junto a la casa.'] },
    { r: ['gente', 'casa'], v: ['La casa tiende escaleras y puentes de luz a candidatos y miembros, que suben hacia nuevas puertas; cualquiera puede subir.'] },
    { r: ['gente'], v: ['Una persona trabaja y cumple; sobre ella se abre una puerta más alta y recibe una llave dorada, una sola.', 'La guarda con cuidado.'] },
    { r: ['gente'], v: ['Otra persona usa su llave para abrir un cofre ajeno: la llave se rompe en sus manos.', 'La puerta se cierra para siempre ante ella; un puente se derrumba detrás.'] },
    { r: ['gente', 'casa'], v: ['La casa reparte comida, abrigo y ayuda a todos los que lo necesitan; nadie tiene que esconder nada.'] },
    { r: ['gente'], v: ['Una persona sonríe con las manos abiertas y a su alrededor brotan nuevas ramas del árbol, llenas de flores.'] },
  ],
  prospeccion: [
    { r: ['sonador'], v: ['El soñador, al anochecer, junto a un camino que sale de la casa.'] },
    { r: ['sonador'], v: ['Enciende cuatro faroles a lo largo del camino, uno tras otro.'] },
    { r: ['sonador'], v: ['Los cuatro faroles brillan en fila.'] },
    { r: ['gente'], v: ['Una persona recorre el camino; cada farol la ilumina con más o menos intensidad y su luz se suma en una barra junto al camino. El primer farol es el más grande.'] },
    { r: ['gente', 'casa'], v: ['Muchas personas recorren el camino a la vez; los faroles las alumbran y las acompañan.'] },
  ],
  talento: [
    { r: ['gente'], v: ['El primer farol, el más grande y brillante.'] },
    { r: ['gente'], v: ['Brilla con fuerza.'] },
    { r: ['gente'], v: ['Bajo su luz, una persona trabaja.'] },
    { r: ['gente'], v: ['En sus manos, un trabajo se convierte en algo valioso.'] },
    { r: ['gente', 'casa'], v: ['Una mujer de bloques talla una pieza de madera perfecta; su pieza encaja en un gran proyecto y lo completa.', 'El proyecto se pone en marcha y todos celebran.'] },
    { r: ['gente', 'casa'], v: ['La casa la lleva a un puesto mejor en el gran plano.', 'Llegan clientes con encargos y llaman a su puerta.'] },
  ],
  'valores-prospeccion': [
    { r: ['gente'], v: ['El segundo farol se enciende.'] },
    { r: ['gente'], v: ['Brilla.'] },
    { r: ['gente'], v: ['Un cliente mira a los ojos a una persona de la casa: un hilo de confianza los une.'] },
    { r: ['gente'], v: ['Alguien recibe un encargo y lo deja tirado en un rincón; el hilo se rompe y su talento pierde brillo.'] },
    { r: ['gente', 'casa'], v: ['La casa enseña sus valores a cada miembro y por ellos llegan nuevas puertas.'] },
    { r: ['gente'], v: ['Un cliente deja en la mano de una persona un reloj de arena y una bolsa de monedas.'] },
    { r: ['gente', 'casa'], v: ['Gente de todo el mundo acude a la casa con sus problemas; los miembros los atienden con calidad.', 'Los problemas se resuelven.'] },
  ],
  dimensiones: [
    { r: ['gente'], v: ['El tercer farol se enciende.'] },
    { r: ['gente'], v: ['Brilla.'] },
    { r: ['gente'], v: ['Su luz se divide en cuatro rayos sobre una persona.'] },
    { r: ['gente'], v: ['Cuatro escenas a la vez: su trabajo, su cuerpo, sus amigos y su mente.'] },
    { r: ['gente'], v: ['Cada rayo tiene una grieta: un problema; las grietas crecen y la persona tropieza con malas decisiones.', 'Sus tropiezos golpean también a quienes tiene cerca.'] },
    { r: ['gente'], v: ['Los valores sostienen a la persona como columnas; su talento le da herramientas y arregla algunas grietas.'] },
    { r: ['gente', 'casa'], v: ['Otras grietas necesitan un plan propio: alguien de la casa se sienta con ella y le da un mapa a su medida.', 'La persona se levanta fuerte y brilla en su trabajo.'] },
  ],
  'red-apoyo': [
    { r: ['gente'], v: ['El cuarto farol, el más pequeño.'] },
    { r: ['gente'], v: ['Brilla con una luz suave.'] },
    { r: ['gente'], v: ['Alrededor de una persona aparecen sus seres queridos.'] },
    { r: ['gente'], v: ['Familia y amigos la rodean.'] },
    { r: ['gente'], v: ['Cuando la persona cae, la levantan y la sostienen.', 'Le muestran el camino y le dan ánimo.'] },
    { r: ['gente'], v: ['La persona se levanta sola gracias a sus propios valores.', 'Su red queda a su lado, acompañándola, sin cargar con ella.'] },
    { r: ['gente'], v: ['Avanza por su camino, con su red caminando a su lado.'] },
  ],
  afiliacion: [
    { r: ['viajero', 'casa'], v: ['Un viajero con mochila llega por el camino a la puerta de la casa.'] },
    { r: ['viajero', 'sonador', 'casa'], v: ['Llama a la puerta y el soñador le abre con una sonrisa.', 'Lo invita a pasar y le muestra un camino de cinco paradas dibujado en un mapa.'] },
    { r: ['viajero'], v: ['El viajero escribe su propuesta en una hoja y la mete en un buzón.', 'Al rato, una paloma de bloques le trae una carta de confirmación.'] },
    { r: ['viajero', 'casa'], v: ['La puerta de la casa se abre para él y recibe una llave de candidato.', 'Dentro, toma herramientas de la mesa y empieza a usarlas.'] },
    { r: ['viajero', 'gente'], v: ['Cada semana se sienta en una gran reunión alrededor de la mesa redonda.', 'Recibe sus órdenes como flechas de luz.'] },
  ],
  'afiliacion-2': [
    { r: ['viajero'], v: ['El camino de cinco paradas.'] },
    { r: ['viajero'], v: ['Una barra de luz junto al viajero.'] },
    { r: ['viajero'], v: ['Cada tarea que cumple hace subir la barra, cada una que deja baja un poco.', 'Los faroles evalúan su talento, sus cuatro dimensiones y su red.'] },
    { r: ['viajero'], v: ['La barra llega a lo más alto y se enciende un gran símbolo de aprobación.'] },
    { r: ['viajero', 'gente'], v: ['Un miembro del último piso le pone al viajero una chaqueta violeta con el corazón blanco.'] },
    { r: ['viajero', 'sonador', 'casa'], v: ['De vuelta a la puerta de la casa, en el presente: el viajero, que ha escuchado todo al soñador, mira en silencio los tres símbolos grabados.'] },
    { r: ['viajero'], v: ['El viajero sonríe.'] },
  ],
  epilogo: [
    { r: ['casa'], v: ['Una página en blanco gigante sobre la mesa de la casa.'] },
    { r: ['casa'], v: ['La página brilla con una luz suave.'] },
    { r: ['casa'], v: ['Una pluma de luz violeta espera sobre ella; la cámara se acerca y la pluma se gira hacia el espectador, invitándolo a escribir.'] },
  ],
};

/* ── Repartir: un tramo por acontecimiento, agrupados en clips de hasta MAX_CLIP s ── */
type Tramo = { de: number; a: number; texto: string; ve: string; reparto: string[] };
const r1 = (x: number) => Math.round(x * 10) / 10;

function tramos(id: string): Tramo[] {
  const fr = FRASES[id];
  const g = GUION[id];
  if (!fr || !g) throw new Error(`Falta ${id}`);
  // `valores` tiene la frase partida en «Nombre:» + definición: se juntan los pares.
  const frases: Frase[] = [];
  if (id === 'valores') {
    frases.push(fr[0]);
    for (let k = 1; k < fr.length; k += 2) frases.push({ frase: `${fr[k].frase} ${fr[k + 1]?.frase ?? ''}`.trim(), inicio: fr[k].inicio, fin: (fr[k + 1] ?? fr[k]).fin });
  } else frases.push(...fr);
  if (frases.length !== g.length) throw new Error(`${id}: ${frases.length} frases y ${g.length} planos`);
  const out: Tramo[] = [];
  frases.forEach((f, k) => {
    const n = g[k].v.length;
    const paso = (f.fin - f.inicio) / n;
    g[k].v.forEach((ve, j) => out.push({ de: f.inicio + paso * j, a: f.inicio + paso * (j + 1), texto: j === 0 ? f.frase : `(sigue) ${f.frase}`, ve, reparto: g[k].r }));
  });
  // Sin huecos: cada tramo dura hasta que empieza el siguiente (las pausas de la voz son parte del plano).
  for (let k = 0; k < out.length - 1; k++) out[k].a = out[k + 1].de;
  return out;
}

function clips(t: Tramo[]) {
  const res: Tramo[][] = [];
  let actual: Tramo[] = [];
  for (const x of t) {
    const ini = actual[0]?.de ?? x.de;
    if (actual.length && x.a - ini > MAX_CLIP) {
      res.push(actual);
      actual = [];
    }
    actual.push(x);
  }
  if (actual.length) res.push(actual);
  return res;
}

const ORDEN = Object.keys(GUION);
const TITULOS: Record<string, string> = {};
for (const id of ORDEN) TITULOS[id] = FRASES[id][0].frase.replace(/[.:]$/, '');

export type ClipSora = { escena: string; titulo: string; n: number; de: number; dur: number; prompt: string; lineas: { t: string; texto: string }[] };
export const CLIPS: ClipSora[] = [];
let anterior = '';
for (const id of ORDEN) {
  clips(tramos(id)).forEach((c, k) => {
    const de = c[0].de;
    const dur = r1(c[c.length - 1].a - de);
    const reparto = [...new Set(c.flatMap((x) => x.reparto))];
    const planos = c.map((x) => `${r1(x.de - de).toFixed(1)}–${r1(x.a - de).toFixed(1)} s: ${x.ve}`);
    const prompt = [
      `ESTILO: ${ESTILO}`,
      `PERSONAJES (mantenerlos idénticos en todos los clips): ${reparto.map((r) => REPARTO[r]).join(' ')}`,
      `DURACIÓN EXACTA: ${dur} segundos, un solo plano-secuencia continuo o planos enlazados sin saltos bruscos.`,
      anterior ? `CONTINUIDAD: empieza justo donde terminó el clip anterior: «${anterior}».` : 'CONTINUIDAD: es el primer plano de la historia; empieza desde negro con un fundido.',
      'ACONTECIMIENTOS, en este orden y con estos tiempos (cada uno ocupa todo su tramo, sin adelantarse):',
      ...planos,
    ].join('\n');
    CLIPS.push({ escena: id, titulo: TITULOS[id], n: k + 1, de: r1(de), dur, prompt, lineas: c.filter((x, i) => i === 0 || !x.texto.startsWith('(sigue)')).map((x) => ({ t: `${r1(x.de - de).toFixed(1)} s`, texto: x.texto.startsWith('(sigue) ') ? `…${x.texto.slice(8)}` : x.texto })) });
    anterior = c[c.length - 1].ve;
  });
}

if (process.argv[1]?.endsWith('guion.mts')) {
  mkdirSync('docs/cuento', { recursive: true });
  let md = `# El cuento en Sora — prompts por clip (${CLIPS.length} clips)\n\nCada clip dura lo que la voz tarda en contar sus frases (tiempos reales de la narración). Generar en orden; sin voces ni música: la narración y los subtítulos se añaden después.\n\n## Estilo\n\n${ESTILO}\n\n## Reparto\n\n${Object.values(REPARTO).map((r) => `- ${r}`).join('\n')}\n`;
  let esc = '';
  for (const c of CLIPS) {
    if (c.escena !== esc) { esc = c.escena; md += `\n## ${c.titulo}\n`; }
    md += `\n### Clip ${c.escena}-${c.n} · ${c.dur} s\n\nNarración:\n${c.lineas.map((l) => `- ${l.t} — ${l.texto}`).join('\n')}\n\n\`\`\`\n${c.prompt}\n\`\`\`\n`;
  }
  writeFileSync('docs/cuento/prompts-sora.md', md);
  writeFileSync('docs/cuento/clips.json', JSON.stringify({ estilo: ESTILO, reparto: REPARTO, clips: CLIPS }, null, 1));
  console.log(CLIPS.length, 'clips;', 'el más largo', Math.max(...CLIPS.map((c) => c.dur)), 's');
}
