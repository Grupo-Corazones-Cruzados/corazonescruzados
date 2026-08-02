/**
 * PUENTE CON ELK: pipeline declarativo → posiciones.
 *
 * Aquí viven los tres fallos que más cuestan de este patrón. Están comentados en su sitio;
 * el resumen:
 *
 *  1. Los **espaciados hay que repetirlos en cada contenedor** (ELK no los hereda), pero
 *     **NUNCA las opciones de algoritmo**, que hacen reventar a ELK con aristas que cruzan
 *     contenedores.
 *  2. Los **puertos** van fijos al centro de la TARJETA, y **sin `elk.port.side`**.
 *  3. Las coordenadas de una arista son relativas al **ANCESTRO COMÚN** de sus extremos,
 *     no al nodo donde ELK la guarda.
 *
 * Por qué ELK y no coordenadas a mano: se probó con rejilla CSS y no aguanta. En cuanto
 * una condición abre tres ramas —«¿qué decidió?» → responder / callar / escalar—, colocar
 * a ojo deja de escalar: cada paso nuevo obliga a recalcular todo lo de abajo.
 */

import type { Pipeline, NodoPipeline } from '@/lib/agente/estudio/tipos';
import { altoAbanico, anchoAbanico } from './satelites-layout';

/**
 * Tamaños de tarjeta.
 * ⚠️ DEBEN COINCIDIR CON EL CSS. ELK reserva el hueco que se le declara; si el DOM mide
 * otra cosa, aparecen huecos o solapamientos.
 */
export const TAMANO = {
  paso: { ancho: 300, alto: 78 },
  condicion: { ancho: 300, alto: 78 },
  fin: { ancho: 236, alto: 60 },
} as const;

const OPCIONES_RAIZ = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.edgeRouting': 'ORTHOGONAL',
  // Respeta el orden en que se declararon los nodos. SIN ESTO ELK reordena «óptimamente»
  // y el pipeline deja de leerse como un relato.
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.layered.spacing.nodeNodeBetweenLayers': '76',
  'elk.spacing.nodeNode': '64',
  // ⚠️ `edgeNode` es la distancia entre una arista y una tarjeta. Con 28 las líneas pasaban
  // ROZANDO el nodo y parecían salir de su borde. 44 les da aire suficiente para leerse
  // como líneas que lo esquivan, que es lo que hacen.
  'elk.spacing.edgeNode': '44',
  'elk.spacing.edgeEdge': '26',
  'elk.padding': '[top=28,left=28,bottom=28,right=28]',
};

/**
 * ⚠️ SOLO espaciados y padding. NADA de algoritmo.
 *
 * Los espaciados hay que repetirlos porque ELK no los hereda y el hueco interno se
 * quedaría en el default de 20 px. Pero repetir aquí `considerModelOrder`, `edgeRouting`
 * o el algoritmo hace que ELK **reviente con un error interno** en cuanto una arista cruza
 * la frontera de un contenedor.
 */
const OPCIONES_GRUPO = {
  // 76 px arriba: el hueco para el título del contenedor.
  'elk.padding': '[top=76,left=36,bottom=36,right=36]',
  'elk.layered.spacing.nodeNodeBetweenLayers': '68',
  'elk.spacing.nodeNode': '58',
  'elk.spacing.edgeNode': '40',
  'elk.spacing.edgeEdge': '24',
};

export const GRUPOS: { id: string; label: string }[] = [
  { id: 'ingesta', label: 'Entrada · lo que llega de Meta' },
  { id: 'decision', label: 'Decisión · lo que decide el agente' },
  { id: 'cierre', label: 'Cierre · lo que se hace con la decisión' },
];

export interface NodoColocado {
  id: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  padre?: string;
}
export interface GrupoColocado extends NodoColocado { label: string }
export interface AristaColocada {
  id: string;
  desde: string;
  hacia: string;
  etiqueta?: string;
  variante?: 'normal' | 'alterna';
  puntos: { x: number; y: number }[];
}
export interface Colocacion {
  nodos: NodoColocado[];
  grupos: GrupoColocado[];
  aristas: AristaColocada[];
}

const tamanoDe = (n: NodoPipeline) => TAMANO[n.tipo];

export async function colocarPipeline(pipeline: Pipeline): Promise<Colocacion> {
  // ELK usa APIs de navegador y pesa ~500 kB: se carga aquí, solo en cliente.
  const ELK = (await import('elkjs/lib/elk.bundled.js')).default;
  const elk = new ELK();

  const porGrupo = new Map<string, NodoPipeline[]>();
  for (const n of pipeline.nodos) {
    if (!porGrupo.has(n.grupo)) porGrupo.set(n.grupo, []);
    porGrupo.get(n.grupo)!.push(n);
  }

  const grafo = {
    id: 'root',
    layoutOptions: OPCIONES_RAIZ,
    children: GRUPOS.filter((g) => porGrupo.has(g.id)).map((g) => ({
      id: `grupo:${g.id}`,
      layoutOptions: OPCIONES_GRUPO,
      children: porGrupo.get(g.id)!.map((n) => {
        const t = tamanoDe(n);
        // El conjunto = tarjeta + abanico. Se le declara a ELK el tamaño del CONJUNTO,
        // porque si no, el abanico de un nodo se dibuja encima del nodo vecino.
        const ancho = t.ancho + anchoAbanico(n.satelites);
        const alto = Math.max(t.alto, altoAbanico(n.satelites));
        return {
          id: n.id,
          width: ancho,
          height: alto,
          // ⚠️ Los puertos van al centro de la TARJETA, no de la caja: si no, con abanico
          // el centro cae en medio del abanico y las aristas salen de la nada.
          // ⚠️ Y NO se declara `elk.port.side`: al declararlo ELK reancla el puerto al
          // borde de la caja e ignora la `y` que se le dio.
          layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
          ports: [
            { id: `${n.id}::in`, x: t.ancho / 2, y: 0, width: 1, height: 1 },
            { id: `${n.id}::out`, x: t.ancho / 2, y: t.alto, width: 1, height: 1 },
          ],
        };
      }),
    })),
    edges: pipeline.aristas.map((a, i) => ({
      id: `a${i}`,
      sources: [`${a.desde}::out`],
      targets: [`${a.hacia}::in`],
    })),
  };

  const r: any = await elk.layout(grafo as any);

  /* ── Posiciones ─────────────────────────────────────────────────────────── */
  const grupos: GrupoColocado[] = [];
  const nodos: NodoColocado[] = [];
  /** nodo → id del contenedor que lo contiene. */
  const contenedorDe = new Map<string, string>();
  /** contenedor → su posición absoluta (la raíz es 0,0). */
  const posicionContenedor = new Map<string, { x: number; y: number }>([['__raiz__', { x: 0, y: 0 }]]);

  for (const g of r.children ?? []) {
    const idGrupo = String(g.id).replace('grupo:', '');
    const meta = GRUPOS.find((x) => x.id === idGrupo);
    grupos.push({
      id: String(g.id), label: meta?.label ?? idGrupo,
      x: g.x ?? 0, y: g.y ?? 0, ancho: g.width ?? 0, alto: g.height ?? 0,
    });
    posicionContenedor.set(String(g.id), { x: g.x ?? 0, y: g.y ?? 0 });
    for (const n of g.children ?? []) {
      // Las coordenadas del hijo YA vienen relativas a su contenedor, que es exactamente
      // lo que React Flow espera para un nodo con `parentId`. No hay que sumar nada.
      nodos.push({ id: String(n.id), x: n.x ?? 0, y: n.y ?? 0, ancho: n.width ?? 0, alto: n.height ?? 0, padre: String(g.id) });
      contenedorDe.set(String(n.id), String(g.id));
    }
  }

  /* ── Aristas ────────────────────────────────────────────────────────────── */
  /**
   * ⚠️ EL FALLO MÁS CARO DE TODO EL PATRÓN.
   *
   * Las coordenadas de una arista de ELK son relativas al **ANCESTRO COMÚN de sus dos
   * extremos**, NO al nodo donde ELK la guarda. Sumar el desplazamiento del contenedor
   * donde está guardada deja las aristas internas corridas justo lo que mide su grupo.
   *
   * (Y dejarlas en manos de React Flow tampoco vale: una arista que salta dos capas se
   * dibuja recta y atraviesa los nodos que tiene en medio. ELK las enruta esquivándolos.)
   */
  const nodoDe = (idPuerto?: string) => idPuerto?.split('::')[0];
  const aristas: AristaColocada[] = [];

  const recolectar = (contenedor: any) => {
    for (const e of contenedor.edges ?? []) {
      const origen = nodoDe(e.sources?.[0]);
      const destino = nodoDe(e.targets?.[0]);
      if (!origen || !destino) continue;

      const cOrigen = contenedorDe.get(origen);
      const cDestino = contenedorDe.get(destino);
      const ancestro = cOrigen && cOrigen === cDestino ? cOrigen : '__raiz__';
      const d = posicionContenedor.get(ancestro) ?? { x: 0, y: 0 };

      // ⚠️ Concatenar TODAS las secciones: una arista jerárquica puede venir partida en
      // varias, y quedarse con la primera dibuja media línea.
      const puntos: { x: number; y: number }[] = [];
      for (const s of e.sections ?? []) {
        for (const p of [s.startPoint, ...(s.bendPoints ?? []), s.endPoint]) {
          if (!p) continue;
          const punto = { x: p.x + d.x, y: p.y + d.y };
          const ultimo = puntos[puntos.length - 1];
          // ⚠️ Las secciones consecutivas REPITEN el punto de unión. Hay que descartarlo:
          // al redondear las esquinas, dos puntos idénticos meten un NaN en el `path` y el
          // navegador descarta la arista entera.
          if (ultimo && ultimo.x === punto.x && ultimo.y === punto.y) continue;
          puntos.push(punto);
        }
      }
      if (puntos.length < 2) continue;

      const meta = pipeline.aristas.find((a) => a.desde === origen && a.hacia === destino);
      aristas.push({
        id: String(e.id), desde: origen, hacia: destino,
        etiqueta: meta?.etiqueta, variante: meta?.variante, puntos,
      });
    }
    for (const h of contenedor.children ?? []) recolectar(h);
  };
  recolectar(r);

  return { nodos, grupos, aristas };
}
