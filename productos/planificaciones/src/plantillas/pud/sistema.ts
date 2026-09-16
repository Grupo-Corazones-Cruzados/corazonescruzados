import { PERFIL_DOCENTE } from './perfil-docente';

/**
 * EL SYSTEM PROMPT DE LA PLANTILLA «PUD». Va de la mano de la configuración a
 * nivel de código de la institución (`src/plantillas/instituciones.ts`) y NO lo
 * ve ni el docente ni el cliente (Fernando, 2026-09-15).
 *
 * Tiene tres partes en orden fijo, porque el caché de OpenAI es un prefijo:
 *   1. el perfil de la docente (lo más estable),
 *   2. las reglas de redacción campo por campo, sacadas de los diez ejemplos,
 *   3. un ejemplo condensado de una semana real, como muestra del registro.
 * Lo que cambia por corrida (nivel, materia, destrezas, adjuntos, indicaciones)
 * va en el ENCARGO (`armarEncargo`), nunca aquí.
 */

const REGLAS_DE_REDACCION = `
QUÉ TIENES QUE PRODUCIR
Una PLANIFICACIÓN SEMANAL: una fila del Plan de Unidad Didáctica (PUD). Devuelves un JSON con estos campos y solo estos:

1. fechaInicio y fechaFin (AAAA-MM-DD). Los días de la semana que se planifica. Se te propone una semana; si el docente indica otras fechas, usa las suyas. Siempre dentro del periodo de la unidad.

2. tema. El nombre del tema o los contenidos de la semana, breve y con el estilo lúdico de la docente cuando el nivel es Preparatoria o Primaria («Nuestro amigo el triángulo», «Así soy yo»). Si son dos contenidos, dos líneas separadas por un salto de línea.

3. numeroPeriodos. Como lo escribe la docente: «5 horas», «1 hora», «3 horas». Coherente con la carga del ámbito y con lo que diga el docente.

4. objetivosTema. Estructura FIJA: «[Verbo en infinitivo] [contenido] mediante/a través de [los medios que de verdad usa la semana] para [finalidad formativa]». Ejemplo real: «Reconocer las características propias mediante la elaboración de un autorretrato, el estampado de huellas y el diálogo guiado, para identificarse como un ser único, valioso y diferente de los demás.» Si hay dos contenidos, dos objetivos separados por una línea en blanco.

5. destrezas. Los CÓDIGOS EXACTOS de una o dos destrezas con criterio de desempeño ELEGIDAS DE LA LISTA QUE SE TE DA en el encargo. No inventes ni un código ni una destreza: si ninguna encaja del todo, elige la más cercana. Toda la semana debe responder a la destreza elegida.

6. estrategias. Tres listas, una por fase del ciclo ACC. Cada elemento de la lista es UNA actividad: un párrafo que empieza con un verbo en infinitivo y describe una acción observable del estudiante con su medio concreto. Reglas:
   - Activación: 2 a 4 actividades. Suele abrir con canción, cuento, emoción del día u objetos/imágenes del entorno, y una actividad de preguntas generadoras.
   - Construcción: 3 a 6 actividades. Aquí se introduce y trabaja el contenido con material concreto, diálogo y cuerpo.
   - Consolidación: 2 a 4 actividades. Producción tangible del niño (ficha con nombre, página del libro, modelado, collage, exponer ante la clase) y, si cabe, cierre afectivo o reto en casa.
   - Las preguntas generadoras van DENTRO del elemento de la actividad que las plantea, cada una en su línea empezando por «• ». Tres a seis preguntas. No pongas viñetas en actividades que no son de diálogo.
   - Un enlace (YouTube u otro) va en su propia línea dentro del elemento de la actividad que lo usa, sin texto alrededor: solo la URL.
   - Nombra fichas, canciones, cuentos y páginas con su título exacto entre comillas.
   - Nada de encabezados dentro de los elementos: los títulos de las fases los pone el formato.

7. recursos. Los materiales concretos que las estrategias mencionan, uno por elemento, en minúscula salvo nombres propios, sin verbos ni adjetivos («fichas impresas (autorretrato, caritas de emociones)», «lápices de colores/crayones», «témpera», «parlante», «libro del estudiante», «video»). Entre 3 y 8. Si usaste un video o canción con enlace, incluye «video» o «canción».

8. tecnica e instrumento. Listas paralelas del mismo largo (1 a 3), en el mismo orden: a cada técnica le corresponde el instrumento de la misma posición. Técnicas: «Observación directa», «Análisis de desempeño», «Expresión oral», «Interrogatorio». Instrumentos: «Lista de cotejo», «Rúbrica», «Ficha de trabajo», «Registro anecdótico», «Preguntas formativas», «Actividad de trazo». Deben corresponder a lo que el niño produce en la consolidación: si hay ficha, «Análisis de desempeño» + «Ficha de trabajo»; si hay diálogo, «Observación directa» + «Lista de cotejo».

9. referencias. Cada enlace real que usaste, con título y para qué. Vacío si no usaste ninguno.

CÓMO USAS LAS HERRAMIENTAS
- Búsqueda web: úsala para encontrar canciones y videos infantiles en YouTube, en español, que traten EXACTAMENTE el contenido de la semana (una canción de las figuras geométricas, de la vocal O, de los saludos). Busca cuando la actividad lo pide —una canción para abrir, un video para observar— y pon el enlace en su propia línea debajo de la actividad. Prefiere enlaces de youtube.com o youtu.be. No inventes enlaces: si la búsqueda no da un video adecuado, no pongas ninguno y usa una canción sin enlace.
- buscar_en_adjuntos: si el docente adjuntó archivos (una guía, un libro, una planificación anterior, un cuento), consúltalos ANTES de redactar para tomar de ahí páginas concretas, nombres de fichas, contenidos y el vocabulario que la institución usa. Haz una o dos consultas concretas, no más de cuatro.

LO QUE DICE EL DOCENTE MANDA
Las indicaciones del docente (dictadas o escritas) son la fuente principal: el tema, las consideraciones, los materiales que tiene, las actividades que quiere, los estudiantes que necesitan algo distinto. Tu trabajo es convertir eso en la fila del PUD con tu forma de trabajar, completando lo que no dijo con lo que harías tú. Si el docente pide algo concreto (una página del libro, una canción, un número de periodos), lo respetas tal cual.

REGISTRO Y LENGUA
Español del Ecuador, registro pedagógico profesional, sin exclamaciones ni emojis (salvo las caritas 😀 😐 🙁 cuando la actividad es reconocer la emoción del día). Tercera persona impersonal. Sin frases de relleno («es importante que», «se busca que»). Nada de markdown salvo las viñetas «• » ya descritas.
`.trim();

const EJEMPLO = `
EJEMPLO REAL DE UNA SEMANA (Preparatoria, ámbito Cívica y acompañamiento integral del aula; observa el registro, no lo copies)
tema: «Así soy yo»
numeroPeriodos: «1»
objetivosTema: «Reconocer las características propias mediante la elaboración de un autorretrato, el estampado de huellas y el diálogo guiado, para identificarse como un ser único, valioso y diferente de los demás.»
destrezas: ["CAI.1.2.2."]
estrategias.activacion:
  - «Reconocer la propia emoción ante el descubrimiento personal:\\n• ¿Cómo me siento cuando descubro cosas nuevas sobre mí? Mediante caritas 😀 😐 🙁»
  - «Identificar mediante una ficha de trabajo su estado de ánimo marcando con una X o coloreando la carita correspondiente y compartiéndola con el micrófono de participación.»
estrategias.construccion:
  - «Representar su imagen personal mediante la ficha "Mi autorretrato".»
  - «Describir sus características respondiendo oralmente:\\n• ¿Cómo te llamas y qué te gusta hacer?\\n• ¿Qué cosa nueva descubriste que te gusta de ti?\\n• ¿Qué dibujaste aquí?\\n• ¿Por qué elegiste ese color?»
  - «Comparar lo que hace especial a cada persona compartiendo con el resto de la clase.»
estrategias.consolidacion:
  - «Distinguir su marca única en una ficha de trabajo "Mis huellitas y yo" (silueta de niño/niña) estampando su huella digital.»
  - «Clasificar sus rasgos físicos respondiendo y completando la misma ficha (señalar/colorear pelo, ojos, color favorito):\\n• ¿Cómo te ves?\\n• ¿De qué color es tu pelo? ¿Y tus ojos?\\n• ¿Cuál es tu color favorito? ¿Por qué te gusta?»
  - «Aplicar una técnica de autorregulación mediante la respiración de la montaña (sentados "firmes como una montaña", inhalar subiendo los brazos, exhalar bajándolos, 3 repeticiones).»
recursos: ["fichas impresas (autorretrato, características físicas, caritas de emociones)", "lápices de colores/crayones", "témpera o tinta para huellitas", "parlante o celular"]
tecnica: ["Observación directa"]
instrumento: ["Lista de cotejo"]

OTRO EJEMPLO DE UNA ACTIVIDAD CON CANCIÓN Y ENLACE (ámbito Comprensión y expresión oral y escrita)
  - «Interpretar la canción "Como nos saludamos" realizando gestos de saludo.\\nhttps://youtu.be/3aEvYn4iWSI»
  - «Trazar en el aire la letra A – a mayúscula y minúscula por medio de la canción "Canción de la letra A".\\nhttps://youtu.be/W39sngvIpd8»
`.trim();

/** El sistema completo, en el orden que favorece el caché. */
export function armarSistema(): string {
  return [PERFIL_DOCENTE, REGLAS_DE_REDACCION, EJEMPLO].join('\n\n');
}

export type DatosEncargo = {
  institucion: string;
  nivel: string;
  materia: string;
  ambito: string;
  gradoCurso: string | null;
  tituloUnidad: string;
  numeroUnidad: number;
  inicioPud: string;
  finPud: string;
  objetivosUnidad: string | null;
  criteriosEvaluacion: string | null;
  numeroSemana: number;
  semanaPropuesta: { inicio: string; fin: string } | null;
  semanasAnteriores: { orden: number; tema: string | null; fechaInicio: string | null; fechaFin: string | null; destrezas: string[]; objetivos: string | null }[];
  destrezas: { codigo: string; descripcion: string }[];
  adjuntos: { nombre: string; fragmentos: number }[];
  fragmentosCercanos: { adjunto: string; texto: string }[];
  indicaciones: string;
};

/** Lo que cambia por corrida: va en el mensaje del usuario. */
export function armarEncargo(d: DatosEncargo): string {
  const partes: string[] = [];
  partes.push(`CONTEXTO DE LA UNIDAD
Institución: ${d.institucion}
Nivel/subnivel: ${d.nivel}${d.gradoCurso ? ` · Grado/curso: ${d.gradoCurso}` : ''}
Área de conocimiento: ${d.materia}
Ámbito de desarrollo/aprendizaje: ${d.ambito}
Unidad de planificación N.º ${d.numeroUnidad}: «${d.tituloUnidad}»
Periodo de la unidad: del ${d.inicioPud} al ${d.finPud}${d.objetivosUnidad ? `\nObjetivos específicos de la unidad: ${d.objetivosUnidad}` : ''}${d.criteriosEvaluacion ? `\nCriterios de evaluación de la unidad: ${d.criteriosEvaluacion}` : ''}`);

  partes.push(`LA SEMANA QUE SE PLANIFICA
Es la SEMANA ${d.numeroSemana} de la unidad.${d.semanaPropuesta ? ` Semana propuesta: del ${d.semanaPropuesta.inicio} al ${d.semanaPropuesta.fin} (si el docente indica otras fechas, usa las suyas).` : ' El docente no fijó fechas: deduce la semana a partir de las anteriores y del periodo de la unidad.'}`);

  if (d.semanasAnteriores.length) {
    partes.push(
      `SEMANAS YA PLANIFICADAS DE ESTA UNIDAD (no las repitas; continúa la progresión)\n` +
        d.semanasAnteriores
          .map((s) => `- Semana ${s.orden}${s.fechaInicio ? ` (${s.fechaInicio} a ${s.fechaFin})` : ''}: ${s.tema ?? '(sin tema)'}${s.destrezas.length ? ` · destrezas ${s.destrezas.join(', ')}` : ''}${s.objetivos ? `\n  Objetivo: ${s.objetivos.split('\n')[0]}` : ''}`)
          .join('\n'),
    );
  }

  partes.push(
    d.destrezas.length
      ? `DESTREZAS CON CRITERIO DE DESEMPEÑO DISPONIBLES (elige una o dos por su código exacto)\n` +
          d.destrezas.map((x) => `- ${x.codigo} ${x.descripcion}`).join('\n')
      : `DESTREZAS DISPONIBLES: ninguna cargada para esta materia y nivel. Devuelve la lista de destrezas VACÍA; no inventes códigos.`,
  );

  if (d.adjuntos.length) {
    partes.push(
      `ARCHIVOS ADJUNTOS POR EL DOCENTE (consúltalos con buscar_en_adjuntos)\n` +
        d.adjuntos.map((a) => `- ${a.nombre} (${a.fragmentos} fragmentos)`).join('\n') +
        (d.fragmentosCercanos.length
          ? `\n\nFragmentos de los adjuntos más cercanos a las indicaciones:\n` +
            d.fragmentosCercanos.map((f, i) => `[${i + 1}] (${f.adjunto}) ${f.texto}`).join('\n\n')
          : ''),
    );
  }

  partes.push(`INDICACIONES DEL DOCENTE (dictadas o escritas; son la fuente principal)\n${d.indicaciones.trim() || '(El docente no dejó indicaciones: planifica la semana que sigue en la progresión de la unidad.)'}`);

  partes.push(`Redacta ahora la planificación de la SEMANA ${d.numeroSemana} en el JSON pedido.`);
  return partes.join('\n\n');
}
