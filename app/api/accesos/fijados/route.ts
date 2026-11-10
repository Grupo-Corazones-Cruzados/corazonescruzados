import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

/**
 * LOS FAVORITOS DEL MENÚ 1 (Fernando, 2026-11-10: «se me están acumulando las herramientas, y luego
 * también los productos»). Cada cuenta fija los productos y herramientas que quiere ver en el menú; el
 * resto está en el lanzador «Todos». Se guardan en la base para que sean los mismos en la web, la Mac
 * y el teléfono. Claves: `p:<producto>/<slug>` y `h:<id de herramienta>`, en el orden del menú.
 */
let preparada: Promise<unknown> | null = null;
const preparar = () => (preparada ??= pool.query(`
  CREATE TABLE IF NOT EXISTS gcc_world.accesos_fijados (
    user_id UUID PRIMARY KEY REFERENCES gcc_world.users(id) ON DELETE CASCADE,
    claves TEXT[] NOT NULL DEFAULT '{}',
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
  )`).catch((e: unknown) => { preparada = null; throw e; }));

/** `data: null` = nunca eligió (el menú usa su selección por defecto). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  await preparar();
  const { rows: [r] } = await pool.query(`SELECT claves FROM gcc_world.accesos_fijados WHERE user_id = $1::uuid`, [String(user.userId)]);
  return NextResponse.json({ data: r ? r.claves : null });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const claves = Array.isArray(b.claves)
    ? Array.from(new Set(b.claves.map(String).filter((c: string) => /^[ph]:[\w./-]{1,120}$/.test(c)))).slice(0, 40)
    : null;
  if (!claves) return NextResponse.json({ error: 'Lista no válida' }, { status: 400 });
  await preparar();
  await pool.query(
    `INSERT INTO gcc_world.accesos_fijados (user_id, claves) VALUES ($1::uuid, $2::text[])
     ON CONFLICT (user_id) DO UPDATE SET claves = EXCLUDED.claves, actualizado_en = now()`,
    [String(user.userId), claves],
  );
  return NextResponse.json({ data: claves });
}
