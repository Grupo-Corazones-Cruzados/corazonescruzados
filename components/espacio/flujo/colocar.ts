import { TIPOS_NODO, CLASES_CONEXION } from '@/services/espacio-trabajo/flujo-catalogo.mjs';

export type TipoNodo = keyof typeof TIPOS_NODO;
export type ClaseConexion = keyof typeof CLASES_CONEXION;

export interface RolFlujo { id: string; nombre: string; descripcion?: string }
export interface NodoFlujo { id: string; tipo: TipoNodo; rol: string; titulo: string; descripcion: string; origen: string }
export interface ConexionFlujo { de: string; a: string; clase?: ClaseConexion; etiqueta?: string }
export interface DocFlujo { version: 1; resumen: string; roles: RolFlujo[]; nodos: NodoFlujo[]; conexiones: ConexionFlujo[] }

export interface Punto { x: number; y: number }
export interface Caja { x: number; y: number; ancho: number; alto: number }
export interface AristaColocada { id: string; de: string; a: string; clase: ClaseConexion; etiqueta?: string; puntos: Punto[]; /** Cruza de un rol a otro. */ entrega: boolean }
export interface Colocacion {
  /** Relativa a su rol, como la espera React Flow. */
  nodos: Map<string, Caja>;
  /** Absoluta, para llevar la vista hasta un nodo. */
  absolutos: Map<string, Caja>;
  roles: Map<string, Caja>;
  aristas: AristaColocada[];
}

/** ⚠️ Deben coincidir con lo que dibuja `Lienzo.tsx`: ELK reserva el hueco que se le declara. */
export const TAMANO: Record<TipoNodo, { ancho: number; alto: number }> = {
  inicio: { ancho: 208, alto: 58 },
  accion: { ancho: 224, alto: 76 },
  proceso: { ancho: 224, alto: 76 },
  decision: { ancho: 240, alto: 132 },
  bucle: { ancho: 224, alto: 76 },
  dato: { ancho: 224, alto: 76 },
  integracion: { ancho: 224, alto: 76 },
  fin: { ancho: 208, alto: 58 },
};

const OPCIONES = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.edgeRouting': 'ORTHOGONAL',
  // Sin esto ELK reordena a su gusto y el flujo deja de leerse en el orden en que se escribió.
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.spacing.nodeNodeBetweenLayers': '72',
  'elk.spacing.nodeNode': '52',
  // Con menos, las líneas pasan rozando un nodo y parecen salir de su borde.
  'elk.spacing.edgeNode': '36',
  'elk.spacing.edgeEdge': '20',
  'elk.spacing.componentComponent': '64',
  // Arriba, el hueco del nombre del rol.
  'elk.padding': '[top=64,left=32,bottom=32,right=32]',
};

const SEPARACION_ROLES = 150;
const SEPARACION_CARRILES = 12;
const AIRE_LLEGADA = 20;

/** Las coordenadas salen de ELK relativas al rol; aquí se pasan al lienzo, sin repetir puntos (un punto doble mete un NaN en el trazo). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function puntosDe(arista: any, d: Punto): Punto[] {
  const puntos: Punto[] = [];
  for (const s of arista.sections ?? []) {
    for (const p of [s.startPoint, ...(s.bendPoints ?? []), s.endPoint]) {
      if (!p) continue;
      const punto = { x: p.x + d.x, y: p.y + d.y };
      const ultimo = puntos[puntos.length - 1];
      if (!ultimo || ultimo.x !== punto.x || ultimo.y !== punto.y) puntos.push(punto);
    }
  }
  return puntos;
}

/**
 * CADA ROL ES UNA COLUMNA. Colocar todo en un solo grafo lo convierte en una escalera: una entrega de un rol a
 * otro obliga a ELK a poner al segundo debajo del primero, y con 190 nodos salía 30 veces más alto que ancho
 * (medido el 2026-11-05). Por eso ELK coloca cada rol por su cuenta y las entregas entre roles se trazan aquí: salen
 * por el lado del nodo, bajan por el hueco entre columnas y entran por arriba al destino, cada una en su carril.
 */
export async function colocar(doc: DocFlujo): Promise<Colocacion> {
  // ELK pesa más de 1 MB: se descarga solo si hay un diagrama que dibujar.
  const ELK = (await import('elkjs/lib/elk.bundled.js')).default;
  const elk = new ELK();
  const rolDe = new Map(doc.nodos.map((n) => [n.id, n.rol]));

  const colocados = await Promise.all(doc.roles.map((r) => elk.layout({
    id: r.id,
    layoutOptions: OPCIONES,
    children: doc.nodos.filter((n) => n.rol === r.id).map((n) => {
      const t = TAMANO[n.tipo];
      return {
        id: n.id,
        width: t.ancho,
        height: t.alto,
        // ⚠️ Sin `elk.port.side`: al declararlo, ELK reancla el puerto e ignora su posición.
        layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
        ports: [
          { id: `${n.id}::e`, x: t.ancho / 2, y: 0, width: 1, height: 1 },
          { id: `${n.id}::s`, x: t.ancho / 2, y: t.alto, width: 1, height: 1 },
        ],
      };
    }),
    edges: doc.conexiones.flatMap((c, i) => (rolDe.get(c.de) === r.id && rolDe.get(c.a) === r.id ? [{ id: `a${i}`, sources: [`${c.de}::s`], targets: [`${c.a}::e`] }] : [])),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)));

  const nodos = new Map<string, Caja>();
  const absolutos = new Map<string, Caja>();
  const roles = new Map<string, Caja>();
  const aristas: AristaColocada[] = [];
  let x = 0;
  for (const g of colocados) {
    const rol = String(g.id);
    roles.set(rol, { x, y: 0, ancho: g.width ?? 0, alto: g.height ?? 0 });
    for (const n of g.children ?? []) {
      const caja = { x: n.x ?? 0, y: n.y ?? 0, ancho: n.width ?? 0, alto: n.height ?? 0 };
      nodos.set(n.id, caja);
      absolutos.set(n.id, { ...caja, x: caja.x + x });
    }
    for (const e of g.edges ?? []) {
      const c = doc.conexiones[Number(String(e.id).slice(1))];
      const puntos = puntosDe(e, { x, y: 0 });
      if (puntos.length >= 2) aristas.push({ id: String(e.id), de: c.de, a: c.a, clase: c.clase ?? 'normal', etiqueta: c.etiqueta, puntos, entrega: false });
    }
    x += (g.width ?? 0) + SEPARACION_ROLES;
  }

  /* Las entregas. El carril evita que dos que bajan por el mismo hueco se pisen. */
  const carriles = new Map<number, number>();
  doc.conexiones.forEach((c, i) => {
    const rolA = rolDe.get(c.de); const rolB = rolDe.get(c.a);
    if (rolA === rolB) return;
    const a = absolutos.get(c.de); const b = absolutos.get(c.a);
    const ca = rolA ? roles.get(rolA) : null;
    if (!a || !b || !ca) return;
    const haciaDerecha = b.x > a.x;
    const borde = haciaDerecha ? ca.x + ca.ancho : ca.x;
    const carril = carriles.get(borde) ?? 0;
    carriles.set(borde, carril + 1);
    const hueco = borde + (haciaDerecha ? 1 : -1) * (24 + (carril % 8) * SEPARACION_CARRILES);
    const yLlegada = b.y - AIRE_LLEGADA;
    const salida = { x: haciaDerecha ? a.x + a.ancho : a.x, y: a.y + a.alto / 2 };
    const crudos = [salida, { x: hueco, y: salida.y }, { x: hueco, y: yLlegada }, { x: b.x + b.ancho / 2, y: yLlegada }, { x: b.x + b.ancho / 2, y: b.y }];
    const puntos = crudos.filter((p, j) => j === 0 || p.x !== crudos[j - 1].x || p.y !== crudos[j - 1].y);
    aristas.push({ id: `a${i}`, de: c.de, a: c.a, clase: c.clase ?? 'normal', etiqueta: c.etiqueta, puntos, entrega: true });
  });

  return { nodos, absolutos, roles, aristas };
}
