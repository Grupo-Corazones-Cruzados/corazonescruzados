import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getSubjectHorario } from '@/lib/centralized/horario-db';
import { NextRequest, NextResponse } from 'next/server';

const EMPTY = { subject: null, tasks: [], schedule: [], auto: [], generated: [] };

/** Resuelve el SUJETO (candidato/miembro) del usuario logueado. */
async function resolveSubject(user: any): Promise<{ kind: 'member' | 'candidate'; id: string } | null> {
  try {
    if (user.role === 'admin' || user.role === 'member') {
      const { rows } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
      const mid = rows[0]?.member_id;
      return mid != null ? { kind: 'member', id: String(mid) } : null;
    }
    // client/candidato: su fila en clients
    const { rows } = await pool.query(`SELECT id, account_type FROM gcc_world.clients WHERE user_id = $1 LIMIT 1`, [user.userId]);
    const c = rows[0];
    return c && c.account_type === 'candidate' ? { kind: 'candidate', id: String(c.id) } : null;
  } catch { return null; }
}

// GET — horario del USUARIO ACTUAL (para "Mi día"). `?from&to` acota las auto-entradas.
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ data: EMPTY }, { status: 401 });
    const subject = await resolveSubject(user);
    if (!subject) return NextResponse.json({ data: EMPTY });
    const sp = req.nextUrl.searchParams;
    const from = sp.get('from') || undefined;
    const to = sp.get('to') || undefined;
    const data = await getSubjectHorario(subject.kind, subject.id, from, to);
    return NextResponse.json({ data: { subject, ...data } });
  } catch (err: any) {
    console.error('Horario me error:', err.message);
    return NextResponse.json({ data: EMPTY, error: err.message }, { status: 500 });
  }
}
