import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { emitirCredencialAlta } from '@/lib/candidatos/credencial';

/**
 * POST — «Reenviar credencial» de una postulación aprobada (Fernando, 2026-11-14): una contraseña temporal nueva,
 * 7 días más, al correo personal. Solo mientras el candidato no haya creado su cuenta.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id } = await params;
  const { rows: [p] } = await pool.query(`SELECT email, status, primer_nombre FROM gcc_world.candidate_proposals WHERE id = $1`, [id]);
  if (!p) return NextResponse.json({ error: 'Postulación no encontrada' }, { status: 404 });
  if (p.status !== 'approved') return NextResponse.json({ error: 'La postulación no está aprobada' }, { status: 409 });
  const { rows: [c] } = await pool.query(`SELECT id FROM gcc_world.clients WHERE LOWER(email) = LOWER($1) LIMIT 1`, [p.email]);
  if (!c) return NextResponse.json({ error: 'No se encontró la cuenta del candidato' }, { status: 404 });
  try {
    const r = await emitirCredencialAlta(c.id, p.primer_nombre);
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    console.error('[candidatos] reenviar credencial', p.email, e?.message);
    return NextResponse.json({ error: e?.message || 'No se pudo enviar la credencial' }, { status: 400 });
  }
}
