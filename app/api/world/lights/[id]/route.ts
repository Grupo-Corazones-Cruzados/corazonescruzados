import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getAuthedClient } from '@/lib/world/auth';

const VALID_MODES = new Set([
  'steady',
  'blink',
  'pulse',
  'flicker',
  'rainbow',
]);
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await getAuthedClient();
    if (!me?.isAdmin) {
      return NextResponse.json(
        { error: 'Solo el admin puede editar luces' },
        { status: 403 },
      );
    }
    const { id: idStr } = await params;
    const id = Number(idStr);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }
    const body = await req.json();
    const x = body?.x !== undefined ? Math.floor(Number(body.x)) : null;
    const y = body?.y !== undefined ? Math.floor(Number(body.y)) : null;
    const radius =
      body?.radius !== undefined
        ? clamp(Number(body.radius) || 4, 0.5, 50)
        : null;
    const color =
      typeof body?.color === 'string' && HEX_COLOR.test(body.color)
        ? body.color
        : null;
    const mode =
      typeof body?.mode === 'string' && VALID_MODES.has(body.mode)
        ? body.mode
        : null;
    const periodMs =
      body?.periodMs !== undefined
        ? clamp(Math.floor(Number(body.periodMs) || 1000), 100, 60000)
        : null;
    const intensity =
      body?.intensity !== undefined
        ? clamp(Number(body.intensity) || 1.0, 0, 1)
        : null;

    await pool.query(
      `UPDATE gcc_world.lights
          SET x         = COALESCE($2, x),
              y         = COALESCE($3, y),
              radius    = COALESCE($4, radius),
              color     = COALESCE($5, color),
              mode      = COALESCE($6, mode),
              period_ms = COALESCE($7, period_ms),
              intensity = COALESCE($8, intensity),
              updated_at = NOW()
        WHERE id = $1`,
      [id, x, y, radius, color, mode, periodMs, intensity],
    );
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('PUT light error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await getAuthedClient();
    if (!me?.isAdmin) {
      return NextResponse.json(
        { error: 'Solo el admin puede borrar luces' },
        { status: 403 },
      );
    }
    const { id: idStr } = await params;
    const id = Number(idStr);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }
    await pool.query(`DELETE FROM gcc_world.lights WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('DELETE light error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
