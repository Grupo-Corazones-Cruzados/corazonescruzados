/**
 * CARGA DE LOS ÁMBITOS CON SU CONTENIDO — una sola definición para las dos rutas.
 *
 * La usan `/soluciones` y `/soluciones/<slug>`. Las dos pintan **la misma pantalla** y necesitan
 * **los mismos datos** —todos los soluciones, todos sus talentos y el contenido de cada uno—,
 * porque el panel izquierdo enseña el árbol completo aunque solo haya un talento abierto.
 *
 * Vive aquí y no duplicada en cada `page.tsx`: dos copias de una carga de datos se separan a
 * la primera corrección, y entonces una ruta enseña algo distinto de la otra sin motivo.
 */

import {
  listarSoluciones, contenidoDeTalento, conceptosPorTalento, ticketsPublicos,
  type ContenidoDeTalento,
} from '@/lib/soluciones';
import { unstable_cache } from 'next/cache';
import type { SolucionConContenido } from '@/components/sitio/SolucionesExplorador';

const VACIO: ContenidoDeTalento = { miembros: [], productos: [], proyectos: [], tickets: [] };

/**
 * ⏳ TOLERA QUE LA BASE NO CONTESTE **DURANTE EL BUILD**.
 *
 * Estas páginas se prerenderizan, así que convierten una consulta a Postgres en requisito de
 * compilación: si la base no responde mientras corre `next build`, no se cae la página — se
 * cae el despliegue entero. Ya pasó el 2026-08-04 y costó 20 despliegues fallidos.
 *
 * ⚠️ **En ejecución no se traga nada.** El error sube, Next sigue sirviendo la última versión
 * buena y reintenta en la siguiente revalidación. Devolver «no hay soluciones» cuando lo que hay
 * es una base caída es el fallo que ya costó una investigación entera.
 */
export async function cargarSolucionesConContenido(): Promise<SolucionConContenido[]> {
  const cargar = async (): Promise<SolucionConContenido[]> => {
    const soluciones = await listarSoluciones();
    // Los conceptos de TODOS los talentos en una sola consulta: pedirlos uno por uno
    // serían tantos viajes a la base como talentos tenga el panel izquierdo.
    // Cuelgan del talento desde la migración 051, no de la solución.
    const conceptos = await conceptosPorTalento();

    // El contenido se consulta UNA vez por talento. Un talento pertenece a un solo solución
    // (migración 042), pero la caché sigue valiendo: evita repetir la consulta si la misma
    // página se construye dos veces.
    const cache = new Map<string, ContenidoDeTalento>();
    for (const t of new Set(soluciones.flatMap((a) => a.talentos.map((x) => x.talento)))) {
      cache.set(t, await contenidoDeTalento(t));
    }
    return soluciones.map((a) => ({
      ...a,
      contenido: Object.fromEntries(a.talentos.map((t) => [t.talento, cache.get(t.talento) ?? VACIO])),
      conceptos: Object.fromEntries(a.talentos.map((t) => [t.talento, conceptos[t.talento] ?? []])),
    }));
  };

  if (process.env.NEXT_PHASE !== 'phase-production-build') return cargar();
  try {
    return await cargar();
  } catch (e) {
    console.warn(
      `⚠ Las soluciones no se pudieron leer durante el build: ${(e as Error).message}\n` +
        '  Las páginas se prerenderizan vacías; la primera revalidación (5 min) las llenará.',
    );
    return [];
  }
}

/**
 * ⭐ LA MISMA CARGA, GUARDADA 5 MINUTOS EN LA CACHÉ DE DATOS (2026-10-29).
 *
 * La usa `/soluciones`, que ya NO se prerenderiza en el build: se generaba vacía (en el build de
 * Railway no hay base), y el PRIMER visitante de cada despliegue veía «Todavía no hay soluciones
 * publicados» hasta la revalidación — le pasó a Fernando en su iPhone. Ahora la página se pinta en
 * cada visita (`dynamic = 'force-dynamic'`) pero la base se consulta como mucho una vez cada 5
 * minutos. Si la consulta falla, el error NO se guarda: la siguiente visita lo vuelve a intentar.
 */
export const cargarSolucionesCacheadas = unstable_cache(
  () => cargarSolucionesConContenido(),
  ['soluciones-con-contenido'],
  { revalidate: 300 },
);

/**
 * TODO LO DE UNA SOLUCIÓN, SUMANDO SUS TALENTOS — para la lista y la página de cada solución en
 * Clientes (2026-10-31). Un mismo trabajo o miembro puede colgar de varios talentos: se cuenta una vez.
 */
export function resumenSolucion(s: SolucionConContenido) {
  const unico = <T,>(l: T[], clave: (x: T) => string | number) => {
    const vistos = new Set<string | number>();
    return l.filter((x) => (vistos.has(clave(x)) ? false : (vistos.add(clave(x)), true)));
  };
  const c = Object.values(s.contenido);
  return {
    descripciones: s.talentos.map((t) => t.descripcion).filter((d): d is string => !!d),
    proyectos: unico(c.flatMap((x) => x.proyectos), (x) => x.id),
    tickets: unico(c.flatMap((x) => x.tickets), (x) => x.id),
    productos: unico(c.flatMap((x) => x.productos), (x) => x.id),
    miembros: unico(c.flatMap((x) => x.miembros), (x) => x.memberId),
    conceptos: unico(s.talentos.flatMap((t) => s.conceptos[t.talento] ?? []), (x) => x.id),
  };
}

/**
 * LO DE UN TALENTO DENTRO DE SU SOLUCIÓN — para su página en Clientes
 * (`/clientes/soluciones/<solución>/<talento>`, 2026-10-31). `null` si el talento no es de esa solución.
 */
export function resumenTalento(s: SolucionConContenido, slug: string) {
  const t = s.talentos.find((x) => x.slug === slug);
  if (!t) return null;
  const c = s.contenido[t.talento] ?? VACIO;
  return { ...t, ...c, conceptos: s.conceptos[t.talento] ?? [] };
}

/** Las cuatro cifras de lo hecho, en el orden en que se enseñan. */
export function cifrasDe(r: Pick<ReturnType<typeof resumenSolucion>, 'proyectos' | 'tickets' | 'productos' | 'miembros'>) {
  return [
    { valor: r.proyectos.length, etiqueta: 'Proyectos', uno: 'proyecto', varios: 'proyectos' },
    { valor: r.tickets.length, etiqueta: 'Tickets', uno: 'ticket', varios: 'tickets' },
    { valor: r.productos.length, etiqueta: 'Soluciones', uno: 'solución', varios: 'soluciones' },
    { valor: r.miembros.length, etiqueta: 'Talentos', uno: 'talento', varios: 'talentos' },
  ];
}

/**
 * Los tickets de Clientes ▸ Tickets (2026-10-31), con la misma caché de 5 minutos que las soluciones:
 * la página se pinta en cada visita, la base se consulta como mucho una vez cada 5 minutos.
 */
export const cargarTicketsCacheados = unstable_cache(() => ticketsPublicos(), ['tickets-publicos'], { revalidate: 300 });
