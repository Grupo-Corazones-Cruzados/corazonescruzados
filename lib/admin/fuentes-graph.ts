import { pool } from '@/lib/db';

/**
 * RELACIONES entre tablas para la vista "Universo" de Fuentes.
 *
 * Dos orígenes, y se distinguen en el grafo:
 *  1. **Declarada** — una FOREIGN KEY real (`pg_constraint`). Es un hecho.
 *  2. **Inferida** — la columna se llama `<algo>_id` y existe una tabla que encaja.
 *     Buena parte del esquema se creó con SQL crudo sin FKs, así que sin esto casi
 *     todas las tablas saldrían sueltas. Es una HEURÍSTICA: se dibuja punteada y se
 *     etiqueta como tal para no hacerla pasar por una restricción real.
 *
 * Cobertura actual: 82 pares declarados + ~90 inferidos → ~141 de 172 tablas con al
 * menos una relación. Las que quedan sin ninguna (catálogos, logs, semillas) siguen
 * colgando de su carpeta por la jerarquía del árbol.
 */

export interface Relation {
  source: string;
  target: string;
  /** Columnas que sostienen la relación (para el tooltip). */
  columns: string[];
  /** `false` = inferida por nombre de columna, no es una FK declarada. */
  declared: boolean;
}

/** Candidatos de tabla destino para una columna `<base>_id`, en orden de preferencia. */
function candidates(base: string, srcPrefix: string | null): string[] {
  const out: string[] = [];
  // Primero dentro de la MISMA familia: en `aa_problem_causes`, `problem_id` apunta a
  // `aa_problems`, no a una inexistente `problems`.
  if (srcPrefix) out.push(`${srcPrefix}${base}s`, `${srcPrefix}${base}`, `${srcPrefix}${base}es`);
  out.push(`${base}s`, base, `${base}es`);
  return out;
}

export async function getRelations(): Promise<Relation[]> {
  const [{ rows: tabs }, { rows: fkRows }, { rows: cols }] = await Promise.all([
    pool.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'gcc_world' AND table_type = 'BASE TABLE'`),
    pool.query(
      `SELECT src.relname AS src, tgt.relname AS tgt,
              (SELECT array_agg(a.attname ORDER BY a.attnum)
                 FROM pg_attribute a
                WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)) AS cols
         FROM pg_constraint c
         JOIN pg_class src ON src.oid = c.conrelid
         JOIN pg_class tgt ON tgt.oid = c.confrelid
         JOIN pg_namespace n ON n.oid = src.relnamespace
        WHERE c.contype = 'f' AND n.nspname = 'gcc_world'`),
    pool.query(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'gcc_world' AND column_name LIKE '%\\_id'`),
  ]);

  const names = new Set<string>(tabs.map((t: { table_name: string }) => t.table_name));
  const byPair = new Map<string, Relation>();

  // 1) FKs declaradas
  for (const r of fkRows as { src: string; tgt: string; cols: string[] | null }[]) {
    if (r.src === r.tgt) continue;                       // auto-referencia: no aporta al grafo
    const key = `${r.src}|${r.tgt}`;
    const prev = byPair.get(key);
    const columns = r.cols ?? [];
    if (prev) prev.columns = [...new Set([...prev.columns, ...columns])];
    else byPair.set(key, { source: r.src, target: r.tgt, columns, declared: true });
  }

  // 2) Inferidas por convención `<base>_id`
  for (const c of cols as { table_name: string; column_name: string }[]) {
    const m = /^(.+)_id$/.exec(c.column_name);
    if (!m) continue;
    const prefix = /^([a-z]{2,3}_)/.exec(c.table_name)?.[1] ?? null;
    const target = candidates(m[1], prefix).find((n) => names.has(n));
    if (!target || target === c.table_name) continue;

    const key = `${c.table_name}|${target}`;
    const prev = byPair.get(key);
    if (prev) {
      if (!prev.columns.includes(c.column_name)) prev.columns.push(c.column_name);
      continue;                                          // ya existe (declarada o inferida)
    }
    byPair.set(key, { source: c.table_name, target, columns: [c.column_name], declared: false });
  }

  return [...byPair.values()];
}
