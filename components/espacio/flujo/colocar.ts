import { TIPOS_NODO, CLASES_CONEXION } from '@/services/espacio-trabajo/flujo-catalogo.mjs';

export type TipoNodo = keyof typeof TIPOS_NODO;
export type ClaseConexion = keyof typeof CLASES_CONEXION;

export interface RolFlujo { id: string; nombre: string; descripcion?: string }
export interface NodoFlujo { id: string; tipo: TipoNodo; rol: string; titulo: string; descripcion: string; origen: string }
export interface ConexionFlujo { de: string; a: string; clase?: ClaseConexion; etiqueta?: string }
export interface DocFlujo { version: 1; resumen: string; roles: RolFlujo[]; nodos: NodoFlujo[]; conexiones: ConexionFlujo[] }

export interface Punto { x: number; y: number }
export interface Caja { x: number; y: number; ancho: number; alto: number }
export interface AristaColocada { id: string; de: string; a: string; clase: ClaseConexion; etiqueta?: string; puntos: Punto[] }
/** Una entrega entre roles, dibujada como una pieza corta junto a su nodo en vez de una línea que cruza el lienzo. */
export interface Conector { id: string; rol: string; sentido: 'sale' | 'entra'; nodo: string; otros: string[]; rolOtro: string }
export interface Colocacion {
  /** Relativa a su rol, como la espera React Flow. */
  nodos: Map<string, Caja>;
  /** Absoluta, para llevar la vista hasta un nodo. */
  absolutos: Map<string, Caja>;
  roles: Map<string, Caja>;
  aristas: AristaColocada[];
  conectores: Map<string, Conector>;
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
export const TAMANO_CONECTOR = { ancho: 200, alto: 40 };

const OPCIONES = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.edgeRouting': 'ORTHOGONAL',
  // Sin esto ELK reordena a su gusto y el flujo deja de leerse en el orden en que se escribió.
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.spacing.nodeNodeBetweenLayers': '64',
  'elk.layered.spacing.edgeNodeBetweenLayers': '28',
  'elk.layered.spacing.edgeEdgeBetweenLayers': '16',
  'elk.spacing.nodeNode': '52',
  // Con menos, las líneas pasan rozando un nodo y parecen salir de su borde.
  'elk.spacing.edgeNode': '36',
  'elk.spacing.edgeEdge': '20',
  'elk.spacing.componentComponent': '64',
  // Arriba, el hueco del nombre del rol.
  'elk.padding': '[top=64,left=32,bottom=32,right=32]',
};

const SEPARACION_ROLES = 72;
const PROPORCION_LIENZO = 1.8;

interface Tramo { id: string; de: string; a: string; clase: ClaseConexion; etiqueta?: string }

/** El borde del rombo a esa altura: el puerto de ELK está en su caja, y la línea debe tocar el dibujo. */
function bordeRombo(xRelativa: number, ancho: number, alto: number, abajo: boolean) {
  const lejania = Math.abs((2 * xRelativa) / ancho - 1);
  return alto / 2 + (abajo ? 1 : -1) * (alto / 2) * (1 - lejania);
}

/**
 * LAS CONEXIONES NO SE ENREDAN, Y ESO SE DECIDE AQUÍ.
 *
 * · Cada rol lo coloca ELK por su cuenta. Un solo grafo convierte los roles en una escalera (30 veces más alta que
 *   ancha con 192 nodos).
 * · Una entrega entre roles NO es una línea: en GCC WORLD son 216 entre 22 roles, cruzaban el lienzo entero y no se
 *   podía seguir ninguna (Fernando, 2026-11-05). Es un conector fuera de página: una pieza corta junto al nodo que
 *   dice a dónde va y lleva hasta allí. Las de un nodo hacia un mismo rol se agrupan en una.
 * · Cada conexión tiene su propio puerto en el borde del nodo. Con uno solo, todas nacían del mismo punto y
 *   compartían tramo: no se distinguía cuál iba a dónde.
 * · Sin líneas largas, los roles pueden repartirse en varias filas en vez de una tira interminable.
 */
export async function colocar(doc: DocFlujo): Promise<Colocacion> {
  // ELK pesa más de 1 MB: se descarga solo si hay un diagrama que dibujar.
  const ELK = (await import('elkjs/lib/elk.bundled.js')).default;
  const elk = new ELK();
  const rolDe = new Map(doc.nodos.map((n) => [n.id, n.rol]));
  const tipoDe = new Map(doc.nodos.map((n) => [n.id, n.tipo]));

  const conectores = new Map<string, Conector>();
  const tramos = new Map<string, Tramo[]>(doc.roles.map((r) => [r.id, []]));
  const agrupados = new Map<string, Conector>();
  const conector = (sentido: Conector['sentido'], nodo: string, otro: string) => {
    const rol = rolDe.get(nodo)!;
    const rolOtro = rolDe.get(otro)!;
    const clave = `${sentido}|${nodo}|${rolOtro}`;
    const ya = agrupados.get(clave);
    if (ya) { ya.otros.push(otro); return { c: ya, nuevo: false }; }
    const c: Conector = { id: `c:${agrupados.size}`, rol, sentido, nodo, otros: [otro], rolOtro };
    agrupados.set(clave, c);
    conectores.set(c.id, c);
    return { c, nuevo: true };
  };
  doc.conexiones.forEach((c, i) => {
    const clase = c.clase ?? 'normal';
    const rolA = rolDe.get(c.de); const rolB = rolDe.get(c.a);
    if (!rolA || !rolB) return;
    if (rolA === rolB) { tramos.get(rolA)!.push({ id: `a${i}`, de: c.de, a: c.a, clase, etiqueta: c.etiqueta }); return; }
    const sale = conector('sale', c.de, c.a);
    if (sale.nuevo) tramos.get(rolA)!.push({ id: `a${i}s`, de: c.de, a: sale.c.id, clase, etiqueta: c.etiqueta });
    const entra = conector('entra', c.a, c.de);
    if (entra.nuevo) tramos.get(rolB)!.push({ id: `a${i}e`, de: entra.c.id, a: c.a, clase: clase === 'si' || clase === 'no' ? 'normal' : clase });
  });

  const hijo = (id: string, ancho: number, alto: number, propios: Tramo[]) => ({
    id,
    width: ancho,
    height: alto,
    // Sin orden fijo: ELK los ordena en cada borde para que las líneas se crucen lo menos posible.
    layoutOptions: { 'elk.portConstraints': 'FIXED_SIDE' },
    ports: [
      ...propios.filter((t) => t.a === id).map((t) => ({ id: `${t.id}::e`, layoutOptions: { 'elk.port.side': 'NORTH' } })),
      ...propios.filter((t) => t.de === id).map((t) => ({ id: `${t.id}::s`, layoutOptions: { 'elk.port.side': 'SOUTH' } })),
    ],
  });

  const colocados = await Promise.all(doc.roles.map((r) => {
    const propios = tramos.get(r.id)!;
    return elk.layout({
      id: r.id,
      layoutOptions: OPCIONES,
      children: [
        ...doc.nodos.filter((n) => n.rol === r.id).map((n) => hijo(n.id, TAMANO[n.tipo].ancho, TAMANO[n.tipo].alto, propios)),
        ...[...conectores.values()].filter((c) => c.rol === r.id).map((c) => hijo(c.id, TAMANO_CONECTOR.ancho, TAMANO_CONECTOR.alto, propios)),
      ],
      edges: propios.map((t) => ({ id: t.id, sources: [`${t.id}::s`], targets: [`${t.id}::e`] })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }));

  /* Los roles, en filas, hasta llenar un lienzo apaisado. */
  const area = colocados.reduce((n, g) => n + (g.width ?? 0) * (g.height ?? 0), 0);
  const anchoFila = Math.max(Math.sqrt(area * PROPORCION_LIENZO), ...colocados.map((g) => g.width ?? 0));
  const nodos = new Map<string, Caja>();
  const absolutos = new Map<string, Caja>();
  const roles = new Map<string, Caja>();
  const aristas: AristaColocada[] = [];
  let x = 0; let y = 0; let altoFila = 0;
  for (const g of colocados) {
    if (x > 0 && x + (g.width ?? 0) > anchoFila) { x = 0; y += altoFila + SEPARACION_ROLES; altoFila = 0; }
    roles.set(String(g.id), { x, y, ancho: g.width ?? 0, alto: g.height ?? 0 });
    const cajaDe = new Map<string, Caja>();
    for (const n of g.children ?? []) {
      const caja = { x: n.x ?? 0, y: n.y ?? 0, ancho: n.width ?? 0, alto: n.height ?? 0 };
      nodos.set(n.id, caja);
      cajaDe.set(n.id, caja);
      absolutos.set(n.id, { ...caja, x: caja.x + x, y: caja.y + y });
    }
    const tramo = new Map((tramos.get(String(g.id)) ?? []).map((t) => [t.id, t]));
    for (const e of g.edges ?? []) {
      const t = tramo.get(String(e.id));
      if (!t) continue;
      const puntos: Punto[] = [];
      for (const s of (e as unknown as { sections?: { startPoint: Punto; endPoint: Punto; bendPoints?: Punto[] }[] }).sections ?? []) {
        for (const p of [s.startPoint, ...(s.bendPoints ?? []), s.endPoint]) {
          if (!p) continue;
          const ultimo = puntos[puntos.length - 1];
          // Un punto doble mete un NaN en el trazo y el navegador descarta la línea entera.
          if (!ultimo || ultimo.x !== p.x || ultimo.y !== p.y) puntos.push({ x: p.x, y: p.y });
        }
      }
      if (puntos.length < 2) continue;
      const cajaA = cajaDe.get(t.de); const cajaB = cajaDe.get(t.a);
      if (cajaA && tipoDe.get(t.de) === 'decision') puntos[0].y = cajaA.y + bordeRombo(puntos[0].x - cajaA.x, cajaA.ancho, cajaA.alto, true);
      const fin = puntos[puntos.length - 1];
      if (cajaB && tipoDe.get(t.a) === 'decision') fin.y = cajaB.y + bordeRombo(fin.x - cajaB.x, cajaB.ancho, cajaB.alto, false);
      aristas.push({ id: t.id, de: t.de, a: t.a, clase: t.clase, etiqueta: t.etiqueta, puntos: puntos.map((p) => ({ x: p.x + x, y: p.y + y })) });
    }
    x += (g.width ?? 0) + SEPARACION_ROLES;
    altoFila = Math.max(altoFila, g.height ?? 0);
  }

  return { nodos, absolutos, roles, aristas, conectores };
}
