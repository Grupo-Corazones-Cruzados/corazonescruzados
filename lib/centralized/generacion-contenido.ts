/**
 * Sistema «Generación de Contenido» (Centralizado · colaborador · gestión, celda «Líder»).
 * Dominio PURO: tipos, catálogos y los PROMPTS POR DEFECTO del agente. Sin dependencias de
 * base de datos, para que lo pueda importar tanto una ruta como la pantalla.
 *
 * El agente recibe una IDEA DE VIDEO y devuelve los entregables con los que se graba.
 * Lo que hace bueno a un entregable no es el prompt: es el CONTEXTO que se le arma
 * (referencia histórica real + fuentes de conocimiento ya clasificadas + talento + tonos).
 */

/* ── Estado del contenido ─────────────────────────────────────────────────────── */
export type ContenidoEstado = 'en_desarrollo' | 'desarrollado' | 'publicado' | 'cancelado';

export const ESTADO_LABEL: Record<ContenidoEstado, string> = {
  en_desarrollo: 'En desarrollo',
  desarrollado: 'Desarrollado',
  publicado: 'Publicado',
  cancelado: 'Cancelado',
};

export const ESTADO_VARIANT: Record<ContenidoEstado, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  en_desarrollo: 'warning',
  desarrollado: 'info',
  publicado: 'success',
  cancelado: 'error',
};

export const ESTADOS: ContenidoEstado[] = ['en_desarrollo', 'desarrollado', 'publicado', 'cancelado'];
export const isEstado = (v: string): v is ContenidoEstado => (ESTADOS as string[]).includes(v);

/* ── Entregables ──────────────────────────────────────────────────────────────── */
export type EntregableTipo =
  | 'guion_largo'
  | 'guion_corto'
  | 'short'
  | 'carrusel'
  | 'requerimientos'
  | 'metadatos';

/**
 * `panel` dice DÓNDE se mira cada entregable, y no es un detalle de estilo: Fernando pidió
 * expresamente que los requerimientos NO compartan sitio con los guiones. En el centro se
 * elige qué guion leer; a la derecha están siempre los requerimientos y los metadatos.
 * `editable` = el texto se puede corregir a mano por encima de lo que escribió el agente.
 * `depende` = qué entregable tiene que existir antes (el short es un recorte del guion largo:
 * generarlo sin él sería inventarse el video).
 */
export interface EntregableMeta {
  tipo: EntregableTipo;
  label: string;
  descripcion: string;
  panel: 'centro' | 'derecha';
  editable: boolean;
  /** El entregable es texto corrido (guiones) o estructura (requerimientos/metadatos/carrusel). */
  forma: 'texto' | 'datos';
  depende: EntregableTipo[];
}

export const ENTREGABLES: EntregableMeta[] = [
  {
    tipo: 'guion_largo',
    label: 'Guion largo (YouTube)',
    descripcion: 'La versión larga del tema: técnica, detallada y profunda. Con cortes, transiciones, sonido y formato de grabación.',
    panel: 'centro', editable: true, forma: 'texto', depende: [],
  },
  {
    tipo: 'guion_corto',
    label: 'Guion corto (TikTok)',
    descripcion: 'La versión corta del mismo tema, en lenguaje para público general. Con sus cortes, transiciones y sonido.',
    panel: 'centro', editable: true, forma: 'texto', depende: ['guion_largo'],
  },
  {
    tipo: 'short',
    label: 'Short (≤30 s)',
    descripcion: 'El trozo del guion largo que engancha, recortado a 30 segundos como máximo.',
    panel: 'centro', editable: true, forma: 'texto', depende: ['guion_largo'],
  },
  {
    tipo: 'carrusel',
    label: 'Carrusel (Instagram)',
    descripcion: 'Las láminas del carrusel: la primera introduce, las de en medio desarrollan y la última cierra. Cada una con su imagen generada por IA.',
    panel: 'centro', editable: false, forma: 'datos', depende: ['guion_largo'],
  },
  {
    tipo: 'requerimientos',
    label: 'Acciones y requerimientos',
    descripcion: 'Lo que hay que conseguir y hacer para rodar lo que dicen los guiones: tomas, objetos, gestos, sonido y formatos.',
    panel: 'derecha', editable: false, forma: 'datos', depende: ['guion_largo'],
  },
  {
    tipo: 'metadatos',
    label: 'Metadatos del video',
    descripcion: 'Duración estimada por concepto, fuentes, referencias, tema y datos de publicación.',
    panel: 'derecha', editable: false, forma: 'datos', depende: ['guion_largo'],
  },
];

export const ENTREGABLE_META: Record<EntregableTipo, EntregableMeta> =
  Object.fromEntries(ENTREGABLES.map((e) => [e.tipo, e])) as Record<EntregableTipo, EntregableMeta>;

export const ENTREGABLE_TIPOS = ENTREGABLES.map((e) => e.tipo);
export const isEntregableTipo = (v: string): v is EntregableTipo =>
  (ENTREGABLE_TIPOS as string[]).includes(v);

/** El orden en que se generan: cada uno se apoya en lo que ya escribió el anterior. */
export const ORDEN_GENERACION: EntregableTipo[] = [
  'guion_largo', 'guion_corto', 'short', 'carrusel', 'requerimientos', 'metadatos',
];

/* ── Fuentes de conocimiento (lo que se elige de Gestión de Datos) ────────────── */
export type FuenteTipo = 'codigo' | 'categoria' | 'pieza' | 'rompecabezas' | 'subtema' | 'tema';

export const FUENTE_TIPOS: FuenteTipo[] = ['codigo', 'categoria', 'pieza', 'rompecabezas', 'subtema', 'tema'];
export const FUENTE_LABEL: Record<FuenteTipo, string> = {
  codigo: 'Códigos', categoria: 'Categorías', pieza: 'Piezas',
  rompecabezas: 'Rompecabezas', subtema: 'Subtemas', tema: 'Temas',
};
export const isFuenteTipo = (v: string): v is FuenteTipo => (FUENTE_TIPOS as string[]).includes(v);

/* ── Referencia histórica (trabajo real del grupo que el video cita) ──────────── */
export type ReferenciaTipo = 'producto' | 'proyecto' | 'ticket';
export const REFERENCIA_TIPOS: ReferenciaTipo[] = ['producto', 'proyecto', 'ticket'];
export const REFERENCIA_LABEL: Record<ReferenciaTipo, string> = {
  producto: 'Producto', proyecto: 'Proyecto', ticket: 'Ticket',
};
export const isReferenciaTipo = (v: string): v is ReferenciaTipo =>
  (REFERENCIA_TIPOS as string[]).includes(v);

/* ── Carrusel ─────────────────────────────────────────────────────────────────── */
/**
 * Cuántas láminas hacen falta lo decide el agente («las imágenes necesarias para completar
 * el contenido», Fernando). El tope no es un capricho de diseño: cada lámina es UNA llamada
 * de imagen, que es lo más lento y lo más caro de todo este sistema.
 */
export const CARRUSEL_MIN_LAMINAS = 3;
export const CARRUSEL_MAX_LAMINAS = 10;

/** Instagram admite 1:1 y 4:5; el cuadrado es el que nunca recorta mal. */
export const CARRUSEL_TAMANO = '1024x1024';

export type LaminaRol = 'intro' | 'desarrollo' | 'cierre';
export const LAMINA_ROL_LABEL: Record<LaminaRol, string> = {
  intro: 'Introducción', desarrollo: 'Desarrollo', cierre: 'Cierre',
};

/* ── Tonos: semilla de la lista global `gd_tonos` ─────────────────────────────── */
/**
 * Solo la SEMILLA de la lista, no la lista. A partir de aquí manda `gd_tonos`, que Fernando
 * edita desde Encuadre Condiciológico igual que talentos o situaciones.
 */
export const TONOS_SEMILLA: string[] = [
  'Alegre', 'Triste', 'Esperanzador', 'Épico', 'Íntimo', 'Serio', 'Urgente',
  'Reflexivo', 'Provocador', 'Didáctico', 'Nostálgico', 'Irónico',
  'Motivador', 'Sereno', 'Combativo', 'Cercano', 'Solemne', 'Curioso',
];

/* ── Los prompts por defecto ──────────────────────────────────────────────────── */
/**
 * ESTO ES UNA SEMILLA, NO LA VERDAD. Se copia a `gcont_prompts` la primera vez y a partir de
 * ahí manda la tabla, que es lo que edita el botón de configuración. Fernando lo dijo tal
 * cual: todavía no tiene los ejemplos de cómo debe expresarse el agente y los irá afinando.
 *
 * `base` se antepone SIEMPRE a la instrucción del entregable. Es el sitio donde vivirán los
 * ejemplos de redacción y presentación cuando existan: cómo se hizo antes y cómo debería
 * hacerse ahora.
 */
export const PROMPTS_POR_DEFECTO: Record<'base' | EntregableTipo, string> = {
  base: `Eres el guionista del Grupo Corazones Cruzados (GCC), una organización ecuatoriana que
es a la vez estudio de software y proyecto de desarrollo humano. Escribes el contenido en
video con el que el grupo cuenta lo que investiga y lo que construye.

CÓMO SE ESCRIBE AQUÍ
- En español de Ecuador, neutro, sin regionalismos cerrados.
- Frases cortas. Se afirma; no se adorna. Si algo no se sabe, no se inventa.
- Nada de relleno motivacional vacío ni de «en el mundo de hoy…». Se entra directo al asunto.
- El conocimiento que se cita viene de las FUENTES DE CONOCIMIENTO que se te entregan: son
  códigos, categorías, piezas, rompecabezas, subtemas y temas ya verificados por el grupo.
  Cítalos por su nomenclatura cuando aporte credibilidad. NO te inventes fuentes nuevas.
- La REFERENCIA HISTÓRICA es un trabajo real del grupo (un producto, un proyecto o un
  ticket). Sirve para aterrizar el tema en algo que de verdad pasó. Úsala como ejemplo
  concreto; no exageres lo que se hizo.
- Los TONOS DE EXPRESIÓN mandan sobre el resultado entero: lo que se dice, cómo suena y cómo
  se ve. Si te dan más de uno, NO elijas: encuentra la manera de integrarlos para que la
  mezcla capte la atención (por ejemplo, abrir en tono triste y resolver en tono alegre).
- El TALENTO indica desde qué oficio se habla; el vocabulario y los ejemplos salen de ahí.

Respondes SIEMPRE con un objeto JSON válido y nada más.`,

  guion_largo: `Escribe el GUION DE VIDEO LARGO para YouTube.

- Es la versión profunda: técnica, detallada, con el porqué de cada cosa. Entre 6 y 12
  minutos de duración hablada.
- Estructura por bloques. Cada bloque tiene su texto de locución y su indicación de rodaje.
- CADA bloque debe indicar: el corte, la transición hacia el siguiente, el tipo de sonido o
  ambientación, los efectos de sonido, el formato de grabación (plano, cámara, movimiento),
  los objetos que aparecen en pantalla y los gestos o la forma de mostrar el contenido.
- El título del video lo eliges tú y debe poder leerse solo.

Devuelve JSON:
{
  "titulo": "string",
  "duracion_estimada": "string (p. ej. '8-10 min')",
  "bloques": [
    {
      "nombre": "string (p. ej. 'Gancho', 'Contexto', 'Demostración', 'Cierre')",
      "duracion": "string (p. ej. '0:00-0:40')",
      "locucion": "string (lo que se dice, redactado para leerse en voz alta)",
      "corte": "string",
      "transicion": "string",
      "sonido": "string (ambientación y música)",
      "efectos": "string (efectos de sonido puntuales)",
      "formato": "string (plano, cámara, movimiento)",
      "objetos": "string (lo que debe aparecer en pantalla)",
      "gestos": "string (gestos y forma de presentar)"
    }
  ]
}`,

  guion_corto: `Escribe el GUION DE VIDEO CORTO para TikTok.

- Mismo tema que el guion largo, pero en lenguaje para PÚBLICO GENERAL: sin jerga, con
  ejemplos cotidianos. Entre 45 y 90 segundos.
- Gancho en los primeros 3 segundos o no lo ve nadie.
- Cada bloque lleva las mismas indicaciones de rodaje que el guion largo (corte, transición,
  sonido, efectos, formato, objetos, gestos).
- No es un resumen del guion largo: es el mismo tema contado para otra persona.

Devuelve JSON con la MISMA estructura que el guion largo:
{ "titulo": "string", "duracion_estimada": "string", "bloques": [ … ] }`,

  short: `Escribe el SHORT.

- Es UNA PARTE del guion largo, la que más engancha, recortada para publicarse suelta.
- Máximo 30 segundos. Si no cabe en 30 segundos, recorta más.
- Tiene que entenderse sin haber visto el video largo, y dejar ganas de verlo.
- Indica de qué bloque del guion largo sale.

Devuelve JSON:
{
  "titulo": "string",
  "bloque_origen": "string (nombre del bloque del guion largo del que se recorta)",
  "duracion_estimada": "string (≤ 30 s)",
  "locucion": "string",
  "corte": "string", "transicion": "string", "sonido": "string", "efectos": "string",
  "formato": "string", "objetos": "string", "gestos": "string",
  "texto_en_pantalla": "string"
}`,

  carrusel: `Diseña el CARRUSEL DE INSTAGRAM del mismo tema.

- Un carrusel es una serie de imágenes: la PRIMERA introduce el tema, las de EN MEDIO lo
  desarrollan (una idea por lámina, nunca dos) y la ÚLTIMA cierra con la conclusión y la
  llamada a la acción.
- Usa TANTAS láminas como haga falta para que el contenido quede completo, entre {MIN} y
  {MAX}. Ni una de relleno.
- El texto de cada lámina se lee en un teléfono: máximo unas 45 palabras.
- El campo prompt_visual es la instrucción para el modelo de imagen, EN INGLÉS, describiendo una
  ilustración cuadrada, legible en pequeño, coherente con las demás láminas (mismo estilo,
  misma paleta) y acorde a los tonos de expresión pedidos. No pidas texto dentro de la
  imagen: el texto va aparte.

Devuelve JSON:
{
  "titulo": "string",
  "estilo_visual": "string (en inglés, el estilo común a TODAS las láminas)",
  "laminas": [
    { "rol": "intro|desarrollo|cierre", "titulo": "string", "texto": "string", "prompt_visual": "string" }
  ]
}`,

  requerimientos: `Escribe la LISTA DE ACCIONES Y REQUERIMIENTOS para poder grabar los guiones.

- Es la lista de la compra del rodaje: lo que hay que conseguir, preparar y hacer para que
  exista en pantalla lo que dicen los guiones.
- Agrupa por bloques de trabajo. Cada acción debe ser concreta y comprobable («conseguir una
  pizarra blanca de 60×90», no «material de apoyo»).
- Marca qué es imprescindible y qué es deseable.

Devuelve JSON:
{
  "grupos": [
    {
      "titulo": "string (p. ej. 'Tomas', 'Objetos en pantalla', 'Sonido', 'Locaciones', 'Equipo')",
      "items": [ { "accion": "string", "detalle": "string", "imprescindible": true } ]
    }
  ]
}`,

  metadatos: `Escribe los METADATOS del video, a partir de todo lo generado.

Devuelve JSON:
{
  "tema": "string",
  "publico": "string (a quién va dirigido)",
  "duracion_total": "string",
  "por_concepto": [ { "concepto": "string", "duracion": "string" } ],
  "fuentes": [ "string (nomenclatura + de qué trata, tomadas de las fuentes entregadas)" ],
  "referencias": [ "string (los trabajos del grupo citados)" ],
  "palabras_clave": [ "string" ],
  "titulos_alternativos": [ "string" ],
  "descripcion_publicacion": "string (la que se pega al publicar)"
}`,
};

/** Los prompts con los huecos ya resueltos (el carrusel lleva el tope de láminas dentro). */
export function promptPorDefecto(clave: 'base' | EntregableTipo): string {
  return PROMPTS_POR_DEFECTO[clave]
    .replace('{MIN}', String(CARRUSEL_MIN_LAMINAS))
    .replace('{MAX}', String(CARRUSEL_MAX_LAMINAS));
}

export const CLAVES_PROMPT: ('base' | EntregableTipo)[] = ['base', ...ENTREGABLE_TIPOS];
export const PROMPT_LABEL: Record<string, string> = {
  base: 'Contexto base (se antepone a todos)',
  ...Object.fromEntries(ENTREGABLES.map((e) => [e.tipo, e.label])),
};
