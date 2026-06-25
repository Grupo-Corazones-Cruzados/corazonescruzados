import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

// GET — lista las postulaciones de candidatos (solo admin).
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ data: [] }, { status: 403 });
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS gcc_world.candidate_proposals (
        id BIGSERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        reason TEXT,
        marketing BOOLEAN DEFAULT FALSE,
        ip_hash TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        email_verified BOOLEAN DEFAULT FALSE,
        verification_token TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        decided_at TIMESTAMPTZ,
        decided_by TEXT
      )
    `);

    const { rows } = await pool.query(
      `SELECT id, email, reason, marketing, status, email_verified, created_at, decided_at, decided_by
         FROM gcc_world.candidate_proposals
        ORDER BY (status = 'pending') DESC, created_at DESC`,
    );
    return NextResponse.json({ data: rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Candidate proposals list error:', msg);
    return NextResponse.json({ data: [], error: msg }, { status: 500 });
  }
}
