import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const r = await pool.query<{ slug: string }>(
      `SELECT slug
         FROM gcc_world.scenes
        WHERE kind = 'map'
        ORDER BY order_idx ASC, slug ASC
        LIMIT 1`,
    );
    return NextResponse.json({ slug: r.rows[0]?.slug ?? null });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('GET active scene error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
