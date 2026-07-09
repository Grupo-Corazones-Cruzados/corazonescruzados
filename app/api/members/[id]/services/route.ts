import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Servicios que un USUARIO ofrece, agrupados por TALENTO. Cada servicio es una fila en
 * `gcc_world.services` con `member_id` (dueño) + `talent` (talento al que pertenece) +
 * `is_active`. Al crear un ticket, el desplegable de servicios muestra los servicios
 * ACTIVOS del miembro (de sus talentos). Los servicios globales (member_id NULL) no se tocan.
 */
async function ensureServiceCols() {
  await pool.query(`ALTER TABLE gcc_world.services ADD COLUMN IF NOT EXISTS member_id BIGINT`);
  await pool.query(`ALTER TABLE gcc_world.services ADD COLUMN IF NOT EXISTS talent TEXT`);
}

/** ¿El usuario puede gestionar el perfil de miembro `id`? Dueño (users.member_id) o admin. */
async function canManage(user: any, memberId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  const { rows } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
  return String(rows[0]?.member_id || '') === String(memberId);
}

// GET — servicios del miembro (opcional ?active=1 y ?talent=). Para el CV y el ticket.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    await ensureServiceCols();
    const { id } = await params;
    const onlyActive = req.nextUrl.searchParams.get('active') === '1';
    const talent = req.nextUrl.searchParams.get('talent');
    const clauses = ['member_id = $1'];
    const vals: any[] = [id];
    if (onlyActive) clauses.push('is_active = true');
    if (talent) { vals.push(talent); clauses.push(`talent = $${vals.length}`); }
    const { rows } = await pool.query(
      `SELECT id, name, description, base_price, is_active, talent
         FROM gcc_world.services WHERE ${clauses.join(' AND ')} ORDER BY talent, name`,
      vals,
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Member services GET error:', err.message);
    return NextResponse.json({ data: [] });
  }
}

// POST — crea un servicio propio { name, description, base_price, talent }.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    if (!(await canManage(user, id))) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    await ensureServiceCols();
    const b = await req.json();
    const name = String(b.name || '').trim();
    if (!name) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    const { rows } = await pool.query(
      `INSERT INTO gcc_world.services (name, description, base_price, is_active, member_id, talent, created_at, updated_at)
       VALUES ($1, $2, $3, true, $4, $5, NOW(), NOW())
       RETURNING id, name, description, base_price, is_active, talent`,
      [name, String(b.description || '').trim() || null, b.base_price != null && b.base_price !== '' ? Number(b.base_price) : 0, id, b.talent ? String(b.talent) : null],
    );
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Member services POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
