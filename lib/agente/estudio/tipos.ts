/**
 * ESTUDIO DEL AGENTE — el contrato.
 *
 * ── QUÉ ES ─────────────────────────────────────────────────────────────────────
 * Un **visor del pipeline real** del agente, no un editor de flujos. Dibuja los pasos que
 * el código ejecuta de verdad, y desde cada paso se llega al contenido de los recursos que
 * usa —prompts, conocimiento, parámetros, conexión— para leerlo y editarlo.
 *
 * ── LA IDEA QUE LO GOBIERNA ────────────────────────────────────────────────────
 * > Nada se dibuja si no está en el código. Cada nodo corresponde a algo verificable en el
 * > repositorio (por eso cada uno lleva su `archivo`), y el contenido de las fuentes lo
 * > sirven **las mismas funciones que usa el runner**. Si lo que se ve en pantalla y lo que
 * > recibe el modelo divergen, es un bug.
 *
 * De ahí la regla visual: **el dato manda sobre la explicación**. En las tarjetas no hay
 * prosa descriptiva; hay esquemas reales de entrada y salida, y chips navegables.
 *
 * ── CONSECUENCIAS DE DISEÑO QUE NO SE NEGOCIAN ─────────────────────────────────
 * · **Los nodos NO se arrastran.** Mover una tarjeta daría a entender que se cambia el
 *   flujo, y no es así: el flujo lo cambia el código.
 * · **Los nodos NO se conectan.** Esto no es un constructor.
 * · **La rueda hace pan, no zoom.** En un diagrama largo el scroll sirve para recorrerlo;
 *   el zoom vive en los botones.
 *
 * ── POR QUÉ VIVE EN EL SERVIDOR ────────────────────────────────────────────────
 * El pipeline se construye entero —nodos, aristas, fuentes, estado— y se manda al cliente
 * en un objeto. El cliente no sabe nada del dominio: recibe datos y los dibuja. Eso es lo
 * que hace el patrón reutilizable: para otro tipo de agente se escribe otro archivo de
 * pipeline y el lienzo no se toca.
 */

/** `condicion` es un `if` REAL del código, no una decoración. */
export type TipoNodo = 'paso' | 'condicion' | 'fin';

/** `ia` cuesta dinero y puede variar entre corridas. Se distingue a propósito. */
export type Ejecucion = 'ia' | 'funcion';

/** Solo determina el acento de color del nodo. */
export type GrupoNodo = 'ingesta' | 'decision' | 'cierre';

/** De dónde sale el contenido de una fuente. Colorea su chip. */
export type OrigenFuente = 'bd' | 'codigo' | 'runtime';

export interface Bloque {
  id: string;
  /** «Entrada» | «Salida» | «Guarda»… */
  titulo: string;
  /**
   * El esquema REAL, serializado.
   *
   * 🔑 EL TRUCO DE LOS CHIPS: cualquier cadena con la forma `"@<fuenteId>"` se pinta como
   * **chip navegable** en vez de como texto. Así el recurso se nombra DENTRO del campo
   * donde interviene, y no hay que explicar con prosa qué usa cada paso:
   *
   *     salida: { system: ['@prompt_perfil', '@conocimiento', '@prompt_reglas'] }
   */
  esquema?: unknown;
}

/**
 * Un recurso del que un paso **dispone durante toda su ejecución**: contexto,
 * herramientas, tablas.
 *
 * ⚠️ NO es un paso siguiente. Por eso se dibuja al costado, con línea discontinua, y
 * nunca debajo.
 */
export interface Satelite {
  id: string;
  label: string;
  sublabel?: string;
  icono?: string;
  /** Sin esto es solo un agrupador visual. */
  fuenteId?: string;
  /** Árbol de hasta 3 niveles. */
  hijos?: Satelite[];
}

export interface NodoPipeline {
  id: string;
  label: string;
  sublabel?: string;
  /**
   * ⚠️ CLAVE, no componente. Este archivo se consume desde el servidor y desde utilidades
   * sin interfaz, así que **no puede importar React**. La traducción clave → componente se
   * hace en el cliente con un mapa.
   */
  icono?: string;
  tipo: TipoNodo;
  ejecucion: Ejecucion;
  grupo: GrupoNodo;
  bloques: Bloque[];
  satelites?: Satelite[];
  /** Dónde vive en el repositorio. Es lo que hace el diagrama auditable. */
  archivo?: string;
}

export interface Arista {
  desde: string;
  hacia: string;
  etiqueta?: string;
  /** `alterna` = la rama que no es el camino feliz (se pinta discontinua). */
  variante?: 'normal' | 'alterna';
}

export interface FuenteMeta {
  id: string;
  label: string;
  origen: OrigenFuente;
  /** «agente_prompts · tipo perfil_agente» — dónde está exactamente. */
  detalle: string;
}

/**
 * El contenido de una fuente, ya resuelto.
 *
 * **El panel derecho elige la vista según los campos que vengan.** No hay un `tipo` que
 * mantener sincronizado: si llega `texto` pinta un editor, si llega `json` un visor, si
 * llega `lista` una lista.
 */
export interface ContenidoFuente {
  meta: FuenteMeta;
  texto?: string;
  json?: unknown;
  lista?: { id: string; label: string; detalle?: string; vacio?: boolean }[];
  aviso?: string;
  /**
   * ⚠️ LO DECIDE EL SERVIDOR, NUNCA LA INTERFAZ. Y esto no es obvio:
   * **si el contenido se recortó para el navegador, NO se marca editable**. Guardar un
   * recorte borraría el resto del prompt sin que nadie se entere.
   */
  editable?:
    | { tipo: 'prompt'; clave: string }
    | { tipo: 'parametros' }
    | { tipo: 'conexion' }
    | { tipo: 'conocimiento' };
}

/** Entrada de los menús de acceso «por intención», anclados en el lienzo. */
export interface Atajo {
  fuenteId: string;
  label: string;
  sublabel?: string;
}

export interface EstadoPipeline {
  botActivo: boolean;
  modelo: string;
  estadoCanal: string;
  numero: string | null;
  tieneClaveIA: boolean;
  tieneToken: boolean;
  pendientes: string[];
  enCola: number;
  ultimoError: string | null;
}

export interface Pipeline {
  nodos: NodoPipeline[];
  aristas: Arista[];
  fuentes: Record<string, FuenteMeta>;
  /** Menús para entrar «por intención», sin buscar en el diagrama. */
  atajos: { titulo: string; items: Atajo[] }[];
  estado: EstadoPipeline;
}

/**
 * Recorta un texto largo para el navegador y **avisa**.
 *
 * Devuelve `aviso` cuando ha recortado; quien llame debe entonces NO marcar la fuente
 * como editable (ver `ContenidoFuente.editable`).
 */
export function recortar(texto: string, maximo = 40_000): { texto: string; aviso?: string } {
  if (texto.length <= maximo) return { texto };
  return {
    texto: texto.slice(0, maximo),
    aviso: `Se muestran ${maximo.toLocaleString('es-ES')} de ${texto.length.toLocaleString('es-ES')} caracteres. El agente sí recibe el total. Por eso este contenido no se puede editar desde aquí.`,
  };
}
