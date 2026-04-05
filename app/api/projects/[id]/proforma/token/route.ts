import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

async function ensureTokenColumns() {
  try {
    await pool.query(`ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS proforma_token VARCHAR(64)`);
    await pool.query(`ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS proforma_token_expires_at TIMESTAMPTZ`);
  } catch {}
}

// POST: generate new token for proforma public access
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const { durationHours } = await req.json();

    if (!durationHours || typeof durationHours !== 'number' || durationHours < 1 || durationHours > 8760) {
      return NextResponse.json({ error: 'Duracion invalida (1-8760 horas)' }, { status: 400 });
    }

    await ensureTokenColumns();

    // Verify proforma exists
    const { rows } = await pool.query(`SELECT proforma FROM gcc_world.projects WHERE id = $1`, [id]);
    if (rows.length === 0 || !rows[0].proforma) {
      return NextResponse.json({ error: 'No hay proforma guardada para este proyecto' }, { status: 404 });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

    await pool.query(
      `UPDATE gcc_world.projects SET proforma_token = $1, proforma_token_expires_at = $2 WHERE id = $3`,
      [token, expiresAt, id]
    );

    return NextResponse.json({ token, expiresAt: expiresAt.toISOString() });
  } catch (err: any) {
    console.error('Proforma token POST error:', err.message);
    return NextResponse.json({ error: 'Error generando token' }, { status: 500 });
  }
}

// DELETE: revoke token
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    await ensureTokenColumns();

    await pool.query(
      `UPDATE gcc_world.projects SET proforma_token = NULL, proforma_token_expires_at = NULL WHERE id = $1`,
      [id]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
