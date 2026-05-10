import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getAuthedClient } from '@/lib/world/auth';

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,62}$/;
const VALID_KINDS = new Set(['map', 'cinematic']);

type SceneRow = {
  slug: string;
  kind: string;
  name: string;
  order_idx: number;
  music_url: string | null;
  music_volume: number;
  event_trigger: string | null;
  updated_at: string;
};

function rowToMeta(row: SceneRow) {
  return {
    slug: row.slug,
    kind: row.kind,
    name: row.name,
    orderIdx: row.order_idx,
    musicUrl: row.music_url,
    musicVolume: Number(row.music_volume),
    eventTrigger: row.event_trigger,
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  try {
    const r = await pool.query<SceneRow>(
      `SELECT slug, kind, name, order_idx, music_url, music_volume,
              event_trigger, updated_at
         FROM gcc_world.scenes
        ORDER BY order_idx ASC, slug ASC`,
    );
    const scenes = (r.rows as SceneRow[]).map(rowToMeta);
    const firstMap = scenes.find((s: ReturnType<typeof rowToMeta>) => s.kind === 'map');
    return NextResponse.json({
      scenes,
      activeSlug: firstMap?.slug ?? null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('GET scenes error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await getAuthedClient();
    if (!me?.isAdmin) {
      return NextResponse.json(
        { error: 'Solo el admin puede crear escenas' },
        { status: 403 },
      );
    }
    const body = await req.json();
    const slug = typeof body?.slug === 'string' ? body.slug.trim() : '';
    const kind = typeof body?.kind === 'string' ? body.kind : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';

    if (!SLUG_REGEX.test(slug)) {
      return NextResponse.json(
        { error: 'slug inválido (a-z, 0-9, guion; 1-63 chars; empieza con alfanum.)' },
        { status: 400 },
      );
    }
    if (!VALID_KINDS.has(kind)) {
      return NextResponse.json({ error: 'kind inválido' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: 'name requerido' }, { status: 400 });
    }

    const musicUrl =
      typeof body?.musicUrl === 'string' && body.musicUrl.trim().length > 0
        ? body.musicUrl.trim()
        : null;
    const musicVolume = Math.max(
      0,
      Math.min(1, Number(body?.musicVolume) || 0.5),
    );
    const eventTrigger =
      kind === 'cinematic' &&
      typeof body?.eventTrigger === 'string' &&
      body.eventTrigger.trim().length > 0
        ? body.eventTrigger.trim()
        : null;

    const orderRes = await pool.query<{ next_idx: number }>(
      `SELECT COALESCE(MAX(order_idx) + 1, 0) AS next_idx FROM gcc_world.scenes`,
    );
    const orderIdx = orderRes.rows[0]?.next_idx ?? 0;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query<SceneRow>(
        `INSERT INTO gcc_world.scenes
            (slug, kind, name, order_idx, music_url, music_volume,
             event_trigger, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         RETURNING slug, kind, name, order_idx, music_url, music_volume,
                   event_trigger, updated_at`,
        [
          slug,
          kind,
          name,
          orderIdx,
          musicUrl,
          musicVolume,
          eventTrigger,
          kind === 'cinematic'
            ? JSON.stringify({ frames: [] })
            : JSON.stringify({}),
        ],
      );
      // Map scenes get a paired empty world_maps row keyed by slug.
      if (kind === 'map') {
        await client.query(
          `INSERT INTO gcc_world.world_maps
              (name, width, height, layers, items, spawn_x, spawn_y,
               ambient_darkness, transitions)
           VALUES ($1, 60, 40, '[]'::jsonb, '[]'::jsonb, 30, 20, 0,
                   '[]'::jsonb)
           ON CONFLICT (name) DO NOTHING`,
          [slug],
        );
      }
      await client.query('COMMIT');
      return NextResponse.json({ ok: true, scene: rowToMeta(r.rows[0]) });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    if (/duplicate key|unique/i.test(msg)) {
      return NextResponse.json(
        { error: 'slug o evento ya en uso' },
        { status: 409 },
      );
    }
    console.error('POST scene error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
