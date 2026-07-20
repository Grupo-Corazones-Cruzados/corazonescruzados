import { NextResponse } from 'next/server';
import { getAuthedClient } from '@/lib/world/auth';
import { savePosition } from '@/lib/game/pickup';
import { pool } from '@/lib/db';

// GET: dónde estaba el jugador. Permite retomar la partida donde se dejó, que
// hoy no ocurre: al recargar siempre se reaparece en el spawn del mapa.
export async function GET() {
  try {
    const me = await getAuthedClient();
    if (!me) return NextResponse.json({ position: null });
    const { rows } = await pool.query(
      `SELECT scene_slug, pos_x, pos_y, facing
         FROM gcc_world.player_progress
        WHERE client_id = $1`,
      [me.id],
    );
    const r = rows[0];
    return NextResponse.json({
      position: r ? { sceneSlug: r.scene_slug, x: r.pos_x, y: r.pos_y, facing: r.facing } : null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST: guardar la posición. El juego la envía con moderación (al cambiar de
// tile, no en cada frame) — es una escritura en base de datos, no telemetría.
// Body: { sceneSlug, x, y, facing? }
export async function POST(req: Request) {
  try {
    const me = await getAuthedClient();
    if (!me) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { sceneSlug, x, y, facing } = await req.json();
    if (typeof sceneSlug !== 'string' || !Number.isFinite(x) || !Number.isFinite(y)) {
      return NextResponse.json({ error: 'sceneSlug, x, y requeridos' }, { status: 400 });
    }

    // La posición debe caer dentro del mapa. No prueba que el jugador llegara
    // caminando, pero descarta coordenadas imposibles.
    const { rows } = await pool.query(
      'SELECT width, height FROM gcc_world.world_maps WHERE name = $1 LIMIT 1',
      [sceneSlug],
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Escena desconocida' }, { status: 400 });
    }
    const { width, height } = rows[0];
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return NextResponse.json({ error: 'Posición fuera del mapa' }, { status: 400 });
    }

    await savePosition(me.id, sceneSlug, x, y, typeof facing === 'string' ? facing : undefined);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
