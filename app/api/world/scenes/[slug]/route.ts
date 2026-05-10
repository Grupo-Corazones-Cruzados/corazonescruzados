import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getAuthedClient } from '@/lib/world/auth';

type SceneRow = {
  slug: string;
  kind: string;
  name: string;
  order_idx: number;
  music_url: string | null;
  music_volume: number;
  event_trigger: string | null;
  data: unknown;
  updated_at: string;
};

type MapRow = {
  name: string;
  width: number;
  height: number;
  layers: unknown;
  items: unknown;
  spawn_x: number;
  spawn_y: number;
  ambient_darkness: number | string;
  transitions: unknown;
  updated_at: string;
};

type NpcRow = {
  id: number;
  map_name: string;
  name: string;
  config: unknown;
  x: number;
  y: number;
  facing: string;
  animation: string | null;
  dialogue: unknown;
};

type LightRow = {
  id: number;
  map_name: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  mode: string;
  period_ms: number;
  intensity: number;
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const r = await pool.query<SceneRow>(
      `SELECT slug, kind, name, order_idx, music_url, music_volume,
              event_trigger, data, updated_at
         FROM gcc_world.scenes
        WHERE slug = $1
        LIMIT 1`,
      [slug],
    );
    const row = r.rows[0];
    if (!row) {
      return NextResponse.json({ error: 'escena no existe' }, { status: 404 });
    }
    const me = await getAuthedClient();
    const meta = { ...rowToMeta(row), isAdmin: !!me?.isAdmin };

    if (row.kind === 'cinematic') {
      const data =
        row.data && typeof row.data === 'object'
          ? (row.data as { frames?: unknown[] })
          : { frames: [] };
      return NextResponse.json({
        kind: 'cinematic',
        meta,
        data: { frames: Array.isArray(data.frames) ? data.frames : [] },
      });
    }

    // kind = 'map' → join paired world_maps row + npcs + lights.
    const [mapRes, npcsRes, lightsRes] = await Promise.all([
      pool.query<MapRow>(
        `SELECT name, width, height, layers, items, spawn_x, spawn_y,
                ambient_darkness, transitions, updated_at
           FROM gcc_world.world_maps
          WHERE name = $1
          LIMIT 1`,
        [slug],
      ),
      pool.query<NpcRow>(
        `SELECT id, map_name, name, config, x, y, facing, animation, dialogue
           FROM gcc_world.npcs
          WHERE map_name = $1
          ORDER BY id ASC`,
        [slug],
      ),
      pool.query<LightRow>(
        `SELECT id, map_name, x, y, radius, color, mode, period_ms, intensity
           FROM gcc_world.lights
          WHERE map_name = $1
          ORDER BY id ASC`,
        [slug],
      ),
    ]);
    const m = mapRes.rows[0];
    if (!m) {
      return NextResponse.json(
        { error: 'la escena de mapa no tiene fila pareja en world_maps' },
        { status: 500 },
      );
    }
    return NextResponse.json({
      kind: 'map',
      meta,
      map: {
        name: m.name,
        width: m.width,
        height: m.height,
        layers: m.layers ?? [],
        items: m.items ?? [],
        spawnX: m.spawn_x,
        spawnY: m.spawn_y,
        ambientDarkness: Number(m.ambient_darkness) || 0,
        transitions: m.transitions ?? [],
        updatedAt: m.updated_at,
        isAdmin: !!me?.isAdmin,
      },
      npcs: (npcsRes.rows as NpcRow[]).map((row: NpcRow) => ({
        id: row.id,
        map: row.map_name,
        name: row.name,
        config: row.config,
        x: row.x,
        y: row.y,
        facing: row.facing,
        animation: row.animation ?? 'idle',
        dialogue: row.dialogue ?? [],
      })),
      lights: (lightsRes.rows as LightRow[]).map((row: LightRow) => ({
        id: row.id,
        map: row.map_name,
        x: row.x,
        y: row.y,
        radius: row.radius,
        color: row.color,
        mode: row.mode,
        periodMs: row.period_ms,
        intensity: row.intensity,
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('GET scene error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const me = await getAuthedClient();
    if (!me?.isAdmin) {
      return NextResponse.json(
        { error: 'Solo el admin puede editar escenas' },
        { status: 403 },
      );
    }
    const { slug } = await params;
    const cur = await pool.query<SceneRow>(
      `SELECT slug, kind FROM gcc_world.scenes WHERE slug = $1 LIMIT 1`,
      [slug],
    );
    const existing = cur.rows[0];
    if (!existing) {
      return NextResponse.json({ error: 'escena no existe' }, { status: 404 });
    }
    const body = await req.json();
    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (typeof body?.name === 'string' && body.name.trim()) {
      updates.push(`name = $${p++}`);
      values.push(body.name.trim());
    }
    if (typeof body?.orderIdx === 'number' && Number.isFinite(body.orderIdx)) {
      updates.push(`order_idx = $${p++}`);
      values.push(Math.floor(body.orderIdx));
    }
    if ('musicUrl' in body) {
      updates.push(`music_url = $${p++}`);
      values.push(
        typeof body.musicUrl === 'string' && body.musicUrl.trim().length > 0
          ? body.musicUrl.trim()
          : null,
      );
    }
    if (
      typeof body?.musicVolume === 'number' &&
      Number.isFinite(body.musicVolume)
    ) {
      updates.push(`music_volume = $${p++}`);
      values.push(Math.max(0, Math.min(1, body.musicVolume)));
    }
    if ('eventTrigger' in body) {
      // event_trigger is meaningful only for cinematics; for map scenes
      // we ignore the field.
      if (existing.kind === 'cinematic') {
        updates.push(`event_trigger = $${p++}`);
        values.push(
          typeof body.eventTrigger === 'string' &&
            body.eventTrigger.trim().length > 0
            ? body.eventTrigger.trim()
            : null,
        );
      }
    }
    if (existing.kind === 'cinematic' && body?.data) {
      const frames = Array.isArray(body.data.frames) ? body.data.frames : [];
      updates.push(`data = $${p++}::jsonb`);
      values.push(JSON.stringify({ frames }));
    }
    if (updates.length === 0) {
      return NextResponse.json({ ok: true });
    }
    updates.push(`updated_at = NOW()`);
    values.push(slug);
    await pool.query(
      `UPDATE gcc_world.scenes
          SET ${updates.join(', ')}
        WHERE slug = $${p}`,
      values,
    );
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    if (/duplicate key|unique/i.test(msg)) {
      return NextResponse.json(
        { error: 'evento ya está asignado a otra cinemática' },
        { status: 409 },
      );
    }
    console.error('PUT scene error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const me = await getAuthedClient();
    if (!me?.isAdmin) {
      return NextResponse.json(
        { error: 'Solo el admin puede borrar escenas' },
        { status: 403 },
      );
    }
    const { slug } = await params;
    const cur = await pool.query<SceneRow>(
      `SELECT slug, kind FROM gcc_world.scenes WHERE slug = $1 LIMIT 1`,
      [slug],
    );
    const row = cur.rows[0];
    if (!row) {
      return NextResponse.json({ error: 'escena no existe' }, { status: 404 });
    }
    if (row.kind === 'map') {
      // Refuse to delete the last map scene — runtime needs somewhere
      // to land.
      const count = await pool.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM gcc_world.scenes WHERE kind = 'map'`,
      );
      if ((count.rows[0]?.n ?? 0) <= 1) {
        return NextResponse.json(
          { error: 'no se puede borrar la última escena de mapa' },
          { status: 400 },
        );
      }
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM gcc_world.scenes WHERE slug = $1`, [
        slug,
      ]);
      if (row.kind === 'map') {
        await client.query(
          `DELETE FROM gcc_world.world_maps WHERE name = $1`,
          [slug],
        );
        await client.query(`DELETE FROM gcc_world.npcs WHERE map_name = $1`, [
          slug,
        ]);
        await client.query(
          `DELETE FROM gcc_world.lights WHERE map_name = $1`,
          [slug],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('DELETE scene error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
