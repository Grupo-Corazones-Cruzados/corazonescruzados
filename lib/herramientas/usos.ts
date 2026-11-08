import { pool } from '@/lib/db';

/**
 * EL HISTORIAL DE USO DE LAS HERRAMIENTAS (Fernando, 2026-11-08: «que lo primero que se vea sea el
 * panel de historial en cada herramienta»). Solo el REGISTRO de cada uso —qué se hizo, cuándo y con qué
 * archivo—, nunca el resultado (decisión de Fernando: ni el audio convertido, ni el texto transcrito,
 * ni el Excel corregido). Cada persona ve los suyos; el administrador, los de todos.
 * Enlace y Entrega de un solo uso tienen su propio historial (`/api/enlaces`, `/api/entregas`).
 */
let tabla: Promise<void> | null = null;
function asegurarTabla(): Promise<void> {
  tabla ??= pool
    .query(`
      CREATE TABLE IF NOT EXISTS gcc_world.herramienta_usos (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        herramienta TEXT NOT NULL,
        titulo TEXT NOT NULL,
        detalle JSONB NOT NULL DEFAULT '{}'::jsonb,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS herramienta_usos_por_herramienta ON gcc_world.herramienta_usos (herramienta, user_id, creado_en DESC);`)
    .then(() => undefined)
    .catch((e: unknown) => { tabla = null; throw e; });
  return tabla!;
}

export type UsoHerramienta = {
  id: number; titulo: string; detalle: Record<string, string>; creado_en: string; persona: string | null;
};

export async function registrarUso(userId: string, herramienta: string, titulo: string, detalle: Record<string, string>) {
  await asegurarTabla();
  await pool.query(
    `INSERT INTO gcc_world.herramienta_usos (user_id, herramienta, titulo, detalle) VALUES ($1, $2, $3, $4)`,
    [userId, herramienta, titulo.slice(0, 200), JSON.stringify(detalle)],
  );
}

/** Los usos de una herramienta: de esa persona, o de todos si `deTodos` (administrador). */
export async function listarUsos(herramienta: string, userId: string, deTodos: boolean): Promise<UsoHerramienta[]> {
  await asegurarTabla();
  const { rows } = await pool.query(
    `SELECT h.id, h.titulo, h.detalle, h.creado_en,
            NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), '') AS persona
       FROM gcc_world.herramienta_usos h
       LEFT JOIN gcc_world.users u ON u.id::text = h.user_id
      WHERE h.herramienta = $1 AND ($3 OR h.user_id = $2)
      ORDER BY h.creado_en DESC LIMIT 500`,
    [herramienta, userId, deTodos],
  );
  return rows.map((r: any) => ({ id: Number(r.id), titulo: r.titulo, detalle: r.detalle ?? {}, creado_en: r.creado_en, persona: r.persona }));
}
