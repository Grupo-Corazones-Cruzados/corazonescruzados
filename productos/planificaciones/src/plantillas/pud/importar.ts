import { NIVELES } from '@/lib/catalogo';

/**
 * IMPORTAR UN FORMATO YA HECHO (Fernando, 2026-09-17): el docente sube el PDF o
 * el Word de un PUD que ya redactó y el agente lo TRANSCRIBE —no lo reescribe—
 * al modelo de la aplicación: la cabecera de la unidad y una planificación
 * semanal por cada fila «SEMANA N» que encuentre. Un solo encargo, sin
 * herramientas: es lectura, no redacción.
 */
export type SemanaImportada = {
  fechaInicio: string;
  fechaFin: string;
  tema: string;
  numeroPeriodos: string;
  objetivosTema: string;
  destrezas: { codigo: string; descripcion: string }[];
  estrategias: { activacion: string[]; construccion: string[]; consolidacion: string[] };
  recursos: string[];
  tecnica: string[];
  instrumento: string[];
};

export type SalidaImportacion = {
  cabecera: {
    materia: string;
    ambito: string;
    nivel: string;
    gradoCurso: string;
    paralelo: string;
    jornada: string;
    numeroUnidad: number;
    tituloUnidad: string;
    inicioPud: string;
    finPud: string;
    objetivosUnidad: string;
    criteriosEvaluacion: string;
    elaboradoPor: string;
    revisadoPor: string;
    revisadoCargo: string;
    aprobadoPor: string;
    aprobadoCargo: string;
    deceNombre: string;
  };
  semanas: SemanaImportada[];
};

const lista = (descripcion: string) => ({ type: 'array', description: descripcion, items: { type: 'string' } });
const texto = (descripcion: string) => ({ type: 'string', description: descripcion });

export const ESQUEMA_IMPORTACION = {
  nombre: 'formato_pud_importado',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['cabecera', 'semanas'],
    properties: {
      cabecera: {
        type: 'object',
        additionalProperties: false,
        required: ['materia', 'ambito', 'nivel', 'gradoCurso', 'paralelo', 'jornada', 'numeroUnidad', 'tituloUnidad', 'inicioPud', 'finPud', 'objetivosUnidad', 'criteriosEvaluacion', 'elaboradoPor', 'revisadoPor', 'revisadoCargo', 'aprobadoPor', 'aprobadoCargo', 'deceNombre'],
        properties: {
          materia: texto('«Área de conocimiento».'),
          ambito: texto('«Ámbito de desarrollo/aprendizaje». Si no aparece, igual que la materia.'),
          nivel: { type: 'string', enum: NIVELES, description: 'Según «Nivel / Subnivel Educativo».' },
          gradoCurso: texto('«Grado / Curso». Vacío si no aparece.'),
          paralelo: texto('Vacío si no aparece.'),
          jornada: texto('Vacío si no aparece.'),
          numeroUnidad: { type: 'integer', description: '«N.º de Unidad de Planificación».' },
          tituloUnidad: texto('«Título de la Unidad de Planificación».'),
          inicioPud: texto('«Inicio de PUD» en AAAA-MM-DD. El año sale del año lectivo de la cabecera (p. ej. «2026-2027»: mayo-diciembre son del primer año, enero-abril del segundo).'),
          finPud: texto('«Fin de PUD» en AAAA-MM-DD, con la misma regla.'),
          objetivosUnidad: texto('«Objetivos específicos de la unidad», tal cual. Vacío si no hay.'),
          criteriosEvaluacion: texto('«Criterios específicos a evaluarse en la Unidad», tal cual. Vacío si no hay.'),
          elaboradoPor: texto('El nombre en «Elaborado por». Vacío si no hay.'),
          revisadoPor: texto('El nombre en «Revisado por». Vacío si no hay.'),
          revisadoCargo: texto('El cargo en «Revisado por» (p. ej. «Coordinador de área»). Vacío si no hay.'),
          aprobadoPor: texto('El nombre en «Aprobado por». Vacío si no hay.'),
          aprobadoCargo: texto('El cargo en «Aprobado por» (p. ej. «Rector/Vicerrector»). Vacío si no hay.'),
          deceNombre: texto('El nombre del responsable del DECE. Vacío si no hay.'),
        },
      },
      semanas: {
        type: 'array',
        description: 'Una entrada por cada fila «SEMANA N» de la tabla de planificación, en orden.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['fechaInicio', 'fechaFin', 'tema', 'numeroPeriodos', 'objetivosTema', 'destrezas', 'estrategias', 'recursos', 'tecnica', 'instrumento'],
          properties: {
            fechaInicio: texto('Primera fecha de la casilla de la semana, en AAAA-MM-DD (año según el año lectivo).'),
            fechaFin: texto('Segunda fecha de la casilla, en AAAA-MM-DD.'),
            tema: texto('El tema, tal cual (varias líneas si el original las tiene).'),
            numeroPeriodos: texto('El «N.º de periodos» tal como está escrito («3 horas», «5»). Vacío si no aparece.'),
            objetivosTema: texto('Los «Objetivos del tema», tal cual.'),
            destrezas: {
              type: 'array',
              description: 'Las destrezas con criterio de desempeño de la semana: código exacto (p. ej. «CS.1.1.1.») y su descripción tal cual.',
              items: { type: 'object', additionalProperties: false, required: ['codigo', 'descripcion'], properties: { codigo: { type: 'string' }, descripcion: { type: 'string' } } },
            },
            estrategias: {
              type: 'object',
              additionalProperties: false,
              required: ['activacion', 'construccion', 'consolidacion'],
              properties: {
                activacion: lista('Las actividades de ACTIVACIÓN DE CONOCIMIENTOS PREVIOS, una por elemento, con su numeración original si la tiene («1. », «1.1. »). Las preguntas generadoras van dentro del elemento de su actividad, cada una en su línea empezando por «• ». Un enlace va en su propia línea.'),
                construccion: lista('Las actividades de CONSTRUCCIÓN DEL CONOCIMIENTO, con las mismas reglas.'),
                consolidacion: lista('Las actividades de CONSOLIDACIÓN DEL APRENDIZAJE, con las mismas reglas.'),
              },
            },
            recursos: lista('Los recursos de la semana, uno por elemento.'),
            tecnica: lista('Las técnicas de evaluación, una por elemento.'),
            instrumento: lista('Los instrumentos de evaluación, uno por elemento, en el orden de las técnicas.'),
          },
        },
      },
    },
  } as Record<string, unknown>,
};

export const SISTEMA_IMPORTACION = `
Eres un transcriptor meticuloso de planificaciones de unidad didáctica (PUD) del Ecuador. Recibes el TEXTO extraído de un formato PUD ya hecho (de un PDF o un Word, así que las tablas llegan aplanadas, con las celdas una tras otra y a veces con cortes raros de línea) y lo devuelves en el JSON pedido.

REGLAS
1. TRANSCRIBES, NO REDACTAS. Copia el texto tal cual está: no resumas, no corrijas el estilo, no completes lo que falta, no inventes. Solo une las líneas que el PDF partió a mitad de frase y quita los saltos de página y las cabeceras de tabla repetidas («N.º de semana y Fecha», «Temas / Contenidos», «Estrategias Metodológica», «Recursos», «Técnica», «Instrumento», el nombre de la institución en cada página).
2. UNA ENTRADA POR SEMANA. Cada fila de la tabla de planificación empieza con «SEMANA N:» y dos fechas; devuelve las semanas en ese orden y no te saltes ninguna. La casilla de «Temas / Contenidos» contiene el tema, el «N.º de periodos» y los «Objetivos del tema»: repártelos en sus campos.
3. LAS ESTRATEGIAS VAN POR FASE. Dentro de cada semana aparecen tres títulos: «ACTIVACIÓN DE CONOCIMIENTOS PREVIOS», «CONSTRUCCIÓN DEL CONOCIMIENTO» y «CONSOLIDACIÓN DEL APRENDIZAJE» (a veces con «(A)» o «(C)» y las letras I R A del DUA al lado: ignora esas letras). Cada actividad es un elemento de la lista de su fase, con su numeración original al inicio si la tiene («1. », «2.1. »). Las preguntas generadoras («¿…?») que cuelgan de una actividad van DENTRO de ese elemento, cada una en su propia línea empezando por «• ». Un enlace (https://…) va en su propia línea dentro del elemento de la actividad que lo usa.
4. DESTREZAS: el código exacto (con sus puntos, p. ej. «CS.1.1.1.») y la descripción completa. Si una semana no muestra código, deja la lista vacía.
5. FECHAS: el formato escribe «26 de mayo» sin año; el año sale del año lectivo de la cabecera («2026-2027»: de mayo a diciembre es el primer año, de enero a abril el segundo). Devuélvelas como AAAA-MM-DD.
6. Recursos, técnicas e instrumentos: un elemento por línea del original. Las secciones fijas (ejes transversales, competencias, inserciones curriculares, adaptaciones curriculares, ajustes razonables, bibliografía, firmas) NO se transcriben, salvo los nombres que se piden en la cabecera (elaborado/revisado/aprobado por y el responsable del DECE).
7. Nada de markdown salvo las viñetas «• » descritas. Sin comentarios: solo el JSON.
`.trim();
