import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getAuthedClient } from '@/lib/world/auth';

const DEFAULT_SCENE = 'main';
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,62}$/;

type Tile = {
  x: number;
  y: number;
  s: number; // sheet index (matches SHEETS array on client)
  sx: number; // source col in sheet
  sy: number; // source row in sheet
  c?: 1; // collides flag (omitted = no collision)
};

type LayerData = { tiles: Tile[] };

function pickSlug(raw: string | null | undefined): string {
  const v = (raw ?? '').trim();
  return SLUG_REGEX.test(v) ? v : DEFAULT_SCENE;
}

async function ensureMapKind(slug: string): Promise<'ok' | 'cinematic' | 'missing'> {
  const r = await pool.query<{ kind: string }>(
    `SELECT kind FROM gcc_world.scenes WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  const k = r.rows[0]?.kind;
  if (!k) return 'missing';
  if (k !== 'map') return 'cinematic';
  return 'ok';
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const slug = pickSlug(url.searchParams.get('scene'));
    await pool.query(
      `ALTER TABLE gcc_world.world_maps
         ADD COLUMN IF NOT EXISTS character_layer text`,
    );
    const r = await pool.query(
      `SELECT id, name, width, height, layers, items,
              spawn_x, spawn_y, ambient_darkness, transitions, props,
              character_layer, updated_at
         FROM gcc_world.world_maps
        WHERE name = $1
        LIMIT 1`,
      [slug],
    );
    const row = r.rows[0];
    if (!row) {
      return NextResponse.json({
        name: slug,
        width: 60,
        height: 40,
        layers: [],
        items: [],
        spawnX: 30,
        spawnY: 20,
        ambientDarkness: 0,
        transitions: [],
        props: [],
      });
    }
    const me = await getAuthedClient();
    return NextResponse.json({
      name: row.name,
      width: row.width,
      height: row.height,
      layers: row.layers,
      items: row.items ?? [],
      spawnX: row.spawn_x,
      spawnY: row.spawn_y,
      ambientDarkness: Number(row.ambient_darkness) || 0,
      transitions: row.transitions ?? [],
      props: row.props ?? [],
      characterLayer: row.character_layer ?? undefined,
      updatedAt: row.updated_at,
      isAdmin: !!me?.isAdmin,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('GET map error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const me = await getAuthedClient();
    if (!me?.isAdmin) {
      return NextResponse.json(
        { error: 'Solo el admin puede editar el mapa' },
        { status: 403 },
      );
    }
    const url = new URL(req.url);
    const body = await req.json();
    const slug = pickSlug(body?.scene ?? url.searchParams.get('scene'));

    // Reject writes targeting a cinematic scene — they have no
    // world_maps row by design.
    const kind = await ensureMapKind(slug);
    if (kind === 'cinematic') {
      return NextResponse.json(
        { error: 'no se puede editar el mapa de una escena cinemática' },
        { status: 400 },
      );
    }

    const width = Number(body?.width);
    const height = Number(body?.height);
    if (!Number.isFinite(width) || width < 5 || width > 500) {
      return NextResponse.json({ error: 'width inválido' }, { status: 400 });
    }
    if (!Number.isFinite(height) || height < 5 || height > 500) {
      return NextResponse.json({ error: 'height inválido' }, { status: 400 });
    }
    const layers: LayerData[] = Array.isArray(body?.layers) ? body.layers : [];
    const items = Array.isArray(body?.items) ? body.items : [];
    const transitions = Array.isArray(body?.transitions)
      ? body.transitions
      : [];
    const props = Array.isArray(body?.props) ? body.props : [];
    const spawnX = Math.max(
      0,
      Math.min(width - 1, Math.floor(Number(body?.spawnX) || 0)),
    );
    const spawnY = Math.max(
      0,
      Math.min(height - 1, Math.floor(Number(body?.spawnY) || 0)),
    );
    const ambientDarkness = Math.max(
      0,
      Math.min(1, Number(body?.ambientDarkness) || 0),
    );
    const characterLayer =
      typeof body?.characterLayer === 'string' ? body.characterLayer : null;

    await pool.query(
      `ALTER TABLE gcc_world.world_maps
         ADD COLUMN IF NOT EXISTS character_layer text`,
    );
    await pool.query(
      `INSERT INTO gcc_world.world_maps
          (name, width, height, layers, items, spawn_x, spawn_y,
           ambient_darkness, transitions, props, character_layer, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9::jsonb,
               $10::jsonb, $11, NOW())
       ON CONFLICT (name) DO UPDATE
          SET width = EXCLUDED.width,
              height = EXCLUDED.height,
              layers = EXCLUDED.layers,
              items = EXCLUDED.items,
              spawn_x = EXCLUDED.spawn_x,
              spawn_y = EXCLUDED.spawn_y,
              ambient_darkness = EXCLUDED.ambient_darkness,
              transitions = EXCLUDED.transitions,
              props = EXCLUDED.props,
              character_layer = EXCLUDED.character_layer,
              updated_at = NOW()`,
      [
        slug,
        width,
        height,
        JSON.stringify(layers),
        JSON.stringify(items),
        spawnX,
        spawnY,
        ambientDarkness,
        JSON.stringify(transitions),
        JSON.stringify(props),
        characterLayer,
      ],
    );
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('PUT map error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
