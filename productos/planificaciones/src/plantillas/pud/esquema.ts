/**
 * EL CONTRATO DE SALIDA DEL AGENTE: los diez campos del encargo de Fernando
 * (fecha inicio, fecha fin, tema, número de periodos, objetivos del tema,
 * destrezas con criterio de desempeño, actividades o estrategias metodológicas,
 * recursos, técnica, instrumento) más las referencias web que usó.
 *
 * Es un JSON Schema estricto (`strict: true`): OpenAI garantiza la forma, así
 * que aquí no hay que defenderse de campos que faltan, solo de contenido.
 */
export type SalidaSemana = {
  fechaInicio: string;
  fechaFin: string;
  tema: string;
  objetivosTema: string;
  destrezas: string[];
  estrategias: { activacion: string[]; construccion: string[]; consolidacion: string[] };
  recursos: string[];
  tecnica: string[];
  instrumento: string[];
  referencias: { titulo: string; url: string; uso: string }[];
  /** Una por estudiante con condición especial del grado: la estrategia empleada esa semana (Fernando, 2026-09-16). */
  ajustesRazonables: { iniciales: string; estrategia: string }[];
};

const lista = (descripcion: string) => ({ type: 'array', description: descripcion, items: { type: 'string' } });

export const ESQUEMA_SEMANA = {
  nombre: 'planificacion_semanal',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['fechaInicio', 'fechaFin', 'tema', 'objetivosTema', 'destrezas', 'estrategias', 'recursos', 'tecnica', 'instrumento', 'referencias', 'ajustesRazonables'],
    properties: {
      fechaInicio: { type: 'string', description: 'Primer día de la semana planificada, AAAA-MM-DD.' },
      fechaFin: { type: 'string', description: 'Último día de la semana planificada, AAAA-MM-DD.' },
      tema: { type: 'string', description: 'Tema o contenidos de la semana. Si son dos contenidos, sepáralos con un salto de línea.' },
      objetivosTema: { type: 'string', description: 'Objetivo(s) del tema con la estructura fija. Si hay dos, sepáralos con una línea en blanco.' },
      destrezas: lista('El código EXACTO de UNA destreza elegida de la lista dada (un solo elemento). Vacío solo si la lista estaba vacía.'),
      estrategias: {
        type: 'object',
        additionalProperties: false,
        required: ['activacion', 'construccion', 'consolidacion'],
        properties: {
          activacion: lista('Actividades de ACTIVACIÓN DE CONOCIMIENTOS PREVIOS. Cada elemento es un párrafo con una actividad, numerada por sesión («1. », «1.1. », «2. »…) cuando la semana tiene más de una sesión: CADA sesión (1, 2, …, N) abre con su propia activación, así que aquí aparecen todas. Las preguntas generadoras van como líneas dentro del mismo elemento empezando por «• ». Un enlace va en su propia línea.'),
          construccion: lista('Actividades de CONSTRUCCIÓN DEL CONOCIMIENTO, con las mismas reglas.'),
          consolidacion: lista('Actividades de CONSOLIDACIÓN DEL APRENDIZAJE, con las mismas reglas.'),
        },
      },
      recursos: lista('Materiales concretos, uno por elemento, en minúscula salvo nombres propios, sin verbos.'),
      tecnica: lista('Técnicas de evaluación, una por elemento (Observación directa, Análisis de desempeño, Expresión oral, Interrogatorio).'),
      instrumento: lista('Instrumentos de evaluación, uno por elemento y en el mismo orden que las técnicas (Lista de cotejo, Rúbrica, Ficha de trabajo, Registro anecdótico, Preguntas formativas, Actividad de trazo).'),
      referencias: {
        type: 'array',
        description: 'Enlaces reales encontrados en la web y usados en la planificación. Vacío si no se usó ninguno.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['titulo', 'url', 'uso'],
          properties: { titulo: { type: 'string' }, url: { type: 'string' }, uso: { type: 'string', description: 'En qué actividad se usa.' } },
        },
      },
      ajustesRazonables: {
        type: 'array',
        description: 'Una entrada por cada estudiante con condición especial listado en el encargo, con sus iniciales exactas y la ESTRATEGIA EMPLEADA esa semana: un párrafo de 4 a 7 oraciones que adapta las actividades concretas de esta semana a su condición. Vacío si el encargo no lista estudiantes.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['iniciales', 'estrategia'],
          properties: { iniciales: { type: 'string', description: 'Las iniciales tal como vienen en el encargo.' }, estrategia: { type: 'string' } },
        },
      },
    },
  } as Record<string, unknown>,
};
