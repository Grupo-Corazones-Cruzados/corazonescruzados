import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getAuthedClient } from '@/lib/world/auth';

const DEFAULT_SCENE = 'main';
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,62}$/;

function pickSlug(raw: string | null | undefined): string {
  const v = (raw ?? '').trim();
  return SLUG_REGEX.test(v) ? v : DEFAULT_SCENE;
}

const VALID_MODES = new Set([
  'steady',
  'blink',
  'pulse',
  'flicker',
  'rainbow',
]);
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

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

function rowToJson(row: LightRow) {
  return {
    id: row.id,
    map: row.map_name,
    x: row.x,
    y: row.y,
    radius: row.radius,
    color: row.color,
    mode: row.mode,
    periodMs: row.period_ms,
    intensity: row.intensity,
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const slug = pickSlug(url.searchParams.get('scene'));
    const r = await pool.query(
      `SELECT id, map_name, x, y, radius, color, mode, period_ms, intensity
         FROM gcc_world.lights
        WHERE map_name = $1
        ORDER BY id ASC`,
      [slug],
    );
    return NextResponse.json({ lights: r.rows.map(rowToJson) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('GET lights error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await getAuthedClient();
    if (!me?.isAdmin) {
      return NextResponse.json(
        { error: 'Solo el admin puede crear luces' },
        { status: 403 },
      );
    }
    const url = new URL(req.url);
    const body = await req.json();
    const slug = pickSlug(body?.scene ?? url.searchParams.get('scene'));
    const x = Math.floor(Number(body?.x));
    const y = Math.floor(Number(body?.y));
    const radius = clamp(Number(body?.radius) || 4, 0.5, 50);
    const color =
      typeof body?.color === 'string' && HEX_COLOR.test(body.color)
        ? body.color
        : '#ffd27a';
    const mode =
      typeof body?.mode === 'string' && VALID_MODES.has(body.mode)
        ? body.mode
        : 'steady';
    const periodMs = clamp(
      Math.floor(Number(body?.periodMs) || 1000),
      100,
      60000,
    );
    const intensity = clamp(Number(body?.intensity) || 1.0, 0, 1);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return NextResponse.json({ error: 'x/y requeridos' }, { status: 400 });
    }

    const r = await pool.query(
      `INSERT INTO gcc_world.lights
          (map_name, x, y, radius, color, mode, period_ms, intensity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, map_name, x, y, radius, color, mode, period_ms, intensity`,
      [slug, x, y, radius, color, mode, periodMs, intensity],
    );
    return NextResponse.json({ ok: true, light: rowToJson(r.rows[0]) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('POST light error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
