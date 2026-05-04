import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getAuthedClient } from '@/lib/world/auth';

const DEFAULT_MAP = 'default';
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

type NpcRow = {
  id: number;
  map_name: string;
  name: string;
  config: unknown;
  x: number;
  y: number;
  facing: string;
  animation: string;
  dialogue: unknown;
};

function rowToJson(row: NpcRow) {
  return {
    id: row.id,
    map: row.map_name,
    name: row.name,
    config: row.config,
    x: row.x,
    y: row.y,
    facing: row.facing,
    animation: row.animation ?? 'idle',
    dialogue: row.dialogue ?? [],
  };
}

export async function GET() {
  try {
    const r = await pool.query(
      `SELECT id, map_name, name, config, x, y, facing, animation, dialogue
         FROM gcc_world.npcs
        WHERE map_name = $1
        ORDER BY id ASC`,
      [DEFAULT_MAP],
    );
    return NextResponse.json({ npcs: r.rows.map(rowToJson) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('GET npcs error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await getAuthedClient();
    if (!me?.isAdmin) {
      return NextResponse.json(
        { error: 'Solo el admin puede crear NPCs' },
        { status: 403 },
      );
    }
    const body = await req.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const config = body?.config;
    const x = Math.floor(Number(body?.x));
    const y = Math.floor(Number(body?.y));
    const facing =
      typeof body?.facing === 'string' && VALID_FACINGS.has(body.facing)
        ? body.facing
        : 's';
    const animation =
      typeof body?.animation === 'string' &&
      VALID_ANIMATIONS.has(body.animation)
        ? body.animation
        : 'idle';
    const dialogue = Array.isArray(body?.dialogue)
      ? body.dialogue.filter((s: unknown) => typeof s === 'string')
      : [];

    if (!name) {
      return NextResponse.json({ error: 'name requerido' }, { status: 400 });
    }
    if (!config || typeof config !== 'object') {
      return NextResponse.json({ error: 'config requerido' }, { status: 400 });
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return NextResponse.json({ error: 'x/y requeridos' }, { status: 400 });
    }

    const r = await pool.query(
      `INSERT INTO gcc_world.npcs
          (map_name, name, config, x, y, facing, animation, dialogue)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8::jsonb)
       RETURNING id, map_name, name, config, x, y, facing, animation, dialogue`,
      [
        DEFAULT_MAP,
        name,
        JSON.stringify(config),
        x,
        y,
        facing,
        animation,
        JSON.stringify(dialogue),
      ],
    );
    return NextResponse.json({ ok: true, npc: rowToJson(r.rows[0]) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('POST npc error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
