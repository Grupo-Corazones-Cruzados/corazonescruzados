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

import { listarSoluciones, contenidoDeTalento, type ContenidoDeTalento } from '@/lib/soluciones';
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
    }));
  };

  if (process.env.NEXT_PHASE !== 'phase-production-build') return cargar();
  try {
    return await cargar();
  } catch (e) {
    console.warn(
      `⚠ Los soluciones no se pudieron leer durante el build: ${(e as Error).message}\n` +
        '  Las páginas se prerenderizan vacías; la primera revalidación (5 min) las llenará.',
    );
    return [];
  }
}
