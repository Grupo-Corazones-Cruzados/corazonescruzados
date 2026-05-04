import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getAuthedClient } from '@/lib/world/auth';

const VALID_FACINGS = new Set(['n', 's', 'e', 'w']);
const VALID_ANIMATIONS = new Set([
  'idle',
  'walk',
  'cast',
  'thrust',
  'slash',
  'shoot',
  'hurt',
  'sit',
]);

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await getAuthedClient();
    if (!me?.isAdmin) {
      return NextResponse.json(
        { error: 'Solo el admin puede editar NPCs' },
        { status: 403 },
      );
    }
    const { id: idStr } = await params;
    const id = Number(idStr);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }
    const body = await req.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : null;
    const config = body?.config;
    const x = body?.x !== undefined ? Math.floor(Number(body.x)) : null;
    const y = body?.y !== undefined ? Math.floor(Number(body.y)) : null;
    const facing =
      typeof body?.facing === 'string' && VALID_FACINGS.has(body.facing)
        ? body.facing
        : null;
    const animation =
      typeof body?.animation === 'string' &&
      VALID_ANIMATIONS.has(body.animation)
        ? body.animation
        : null;
    const dialogue = Array.isArray(body?.dialogue)
      ? body.dialogue.filter((s: unknown) => typeof s === 'string')
      : null;

    await pool.query(
      `UPDATE gcc_world.npcs
          SET name      = COALESCE($2, name),
              config    = COALESCE($3::jsonb, config),
              x         = COALESCE($4, x),
              y         = COALESCE($5, y),
              facing    = COALESCE($6, facing),
              animation = COALESCE($7, animation),
              dialogue  = COALESCE($8::jsonb, dialogue),
              updated_at = NOW()
        WHERE id = $1`,
      [
        id,
        name,
        config ? JSON.stringify(config) : null,
        x,
        y,
        facing,
        animation,
        dialogue ? JSON.stringify(dialogue) : null,
      ],
    );
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('PUT npc error:', msg);
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
        { error: 'Solo el admin puede borrar NPCs' },
        { status: 403 },
      );
    }
    const { id: idStr } = await params;
    const id = Number(idStr);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }
    await pool.query(`DELETE FROM gcc_world.npcs WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('DELETE npc error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
