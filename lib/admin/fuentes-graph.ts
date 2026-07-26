import { pool } from '@/lib/db';

/**
 * RELACIONES entre tablas para la vista "Universo" de Fuentes.
 *
 * SOLO relaciones REALES: claves foráneas declaradas en la base (`pg_constraint`,
 * `contype = 'f'`). Nada inferido ni adivinado — si aquí sale una flecha, existe la
 * restricción en Postgres.
 *
 * Las tablas sin ninguna FK no quedan sueltas en el grafo: siguen colgando de su
 * carpeta por las aristas de jerarquía del árbol.
 */

export interface Relation {
  source: string;
  target: string;
  /** Columnas que sostienen la FK (para el tooltip). */
  columns: string[];
}

export async function getRelations(): Promise<Relation[]> {
  const { rows } = await pool.query(
    `SELECT src.relname AS src, tgt.relname AS tgt,
            (SELECT array_agg(a.attname ORDER BY a.attnum)
               FROM pg_attribute a
              WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)) AS cols
       FROM pg_constraint c
       JOIN pg_class src ON src.oid = c.conrelid
       JOIN pg_class tgt ON tgt.oid = c.confrelid
       JOIN pg_namespace n ON n.oid = src.relnamespace
      WHERE c.contype = 'f' AND n.nspname = 'gcc_world'`);

  const byPair = new Map<string, Relation>();
  for (const r of rows as { src: string; tgt: string; cols: string[] | null }[]) {
    if (r.src === r.tgt) continue;                       // auto-referencia: no aporta al grafo
    const key = `${r.src}|${r.tgt}`;
    const prev = byPair.get(key);
    if (prev) prev.columns = [...new Set([...prev.columns, ...(r.cols ?? [])])];
    else byPair.set(key, { source: r.src, target: r.tgt, columns: r.cols ?? [] });
  }
  return [...byPair.values()];
}
