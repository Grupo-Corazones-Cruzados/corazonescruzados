import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get('type') || 'project';

    // Ni lo retirado por una denuncia ni lo de quien esta cuenta bloqueó (lib/moderacion.ts).
    const user = await getCurrentUser().catch(() => null);
    const { rows } = await pool.query(
      `SELECT pi.*, pi.cost as price, pi.item_type as type, COALESCE(pi.images, '{}') as images, m.name as member_name, m.photo_url as member_photo
       FROM gcc_world.member_portfolio_items pi
       JOIN gcc_world.members m ON m.id = pi.member_id
       WHERE pi.item_type = $1 AND pi.retirado_moderacion_en IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM gcc_world.moderacion_bloqueos b
             LEFT JOIN gcc_world.users bu ON bu.id = b.bloqueado_user_id
            WHERE b.usuario_id = $2::uuid AND (b.bloqueado_member_id = pi.member_id OR bu.member_id = pi.member_id))
       ORDER BY pi.created_at DESC`,
      [type, user?.userId ?? null]
    );

    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Portfolio public error:', err.message);
    return NextResponse.json({ data: [] });
  }
}
