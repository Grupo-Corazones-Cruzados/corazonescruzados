import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getAuthedClient } from '@/lib/world/auth';

const DEFAULT_MAP = 'default';

type Tile = {
  x: number;
  y: number;
  s: number; // sheet index (matches SHEETS array on client)
  sx: number; // source col in sheet
  sy: number; // source row in sheet
  c?: 1; // collides flag (omitted = no collision)
};

type LayerData = { tiles: Tile[] };

export async function GET() {
  try {
    const r = await pool.query(
      `SELECT id, name, width, height, layers, spawn_x, spawn_y, updated_at
         FROM gcc_world.world_maps
        WHERE name = $1
        LIMIT 1`,
      [DEFAULT_MAP],
    );
    const row = r.rows[0];
    if (!row) {
      return NextResponse.json({
        name: DEFAULT_MAP,
        width: 60,
        height: 40,
        layers: [],
        spawnX: 30,
        spawnY: 20,
      });
    }
    const me = await getAuthedClient();
    return NextResponse.json({
      name: row.name,
      width: row.width,
      height: row.height,
      layers: row.layers,
      spawnX: row.spawn_x,
      spawnY: row.spawn_y,
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
    const body = await req.json();
    const width = Number(body?.width);
    const height = Number(body?.height);
    if (!Number.isFinite(width) || width < 5 || width > 500) {
      return NextResponse.json({ error: 'width inválido' }, { status: 400 });
    }
    if (!Number.isFinite(height) || height < 5 || height > 500) {
      return NextResponse.json({ error: 'height inválido' }, { status: 400 });
    }
    const layers: LayerData[] = Array.isArray(body?.layers) ? body.layers : [];
    const spawnX = Math.max(
      0,
      Math.min(width - 1, Math.floor(Number(body?.spawnX) || 0)),
    );
    const spawnY = Math.max(
      0,
      Math.min(height - 1, Math.floor(Number(body?.spawnY) || 0)),
    );

    await pool.query(
      `INSERT INTO gcc_world.world_maps
          (name, width, height, layers, spawn_x, spawn_y, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, NOW())
       ON CONFLICT (name) DO UPDATE
          SET width = EXCLUDED.width,
              height = EXCLUDED.height,
              layers = EXCLUDED.layers,
              spawn_x = EXCLUDED.spawn_x,
              spawn_y = EXCLUDED.spawn_y,
              updated_at = NOW()`,
      [DEFAULT_MAP, width, height, JSON.stringify(layers), spawnX, spawnY],
    );
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('PUT map error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
