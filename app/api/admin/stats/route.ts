import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const staff = user.role === 'admin' || user.role === 'member';

    // No-staff (candidato/cliente): solo SUS tickets/proyectos abiertos; sin conteos globales.
    if (!staff) {
      const cr = await pool.query(`SELECT id FROM gcc_world.clients WHERE user_id = $1 LIMIT 1`, [user.userId]);
      const clientId = cr.rows[0]?.id != null ? Number(cr.rows[0].id) : -1;
      const [tickets, projects] = await Promise.all([
        pool.query(
          `SELECT COUNT(*) FROM gcc_world.tickets
            WHERE status IN ('pending','confirmed','in_progress')
              AND (user_id = $1::uuid OR client_id = $2)`,
          [user.userId, clientId],
        ),
        pool.query(
          `SELECT COUNT(*) FROM gcc_world.projects
            WHERE status IN ('open','in_progress','in_review')
              AND (created_by_user_id = $1::text OR client_id = $2)`,
          [user.userId, clientId],
        ),
      ]);
      return NextResponse.json({
        open_tickets: Number(tickets.rows[0].count),
        active_projects: Number(projects.rows[0].count),
      });
    }

    const [tickets, projects, users, members, clients] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM gcc_world.tickets WHERE status IN ('pending','confirmed','in_progress')"),
      pool.query("SELECT COUNT(*) FROM gcc_world.projects WHERE status IN ('open','in_progress','in_review')"),
      pool.query("SELECT COUNT(*) FROM gcc_world.users"),
      pool.query("SELECT COUNT(*) FROM gcc_world.members WHERE is_active = true"),
      pool.query("SELECT COUNT(*) FROM gcc_world.users WHERE role = 'client'"),
    ]);

    return NextResponse.json({
      open_tickets: Number(tickets.rows[0].count),
      active_projects: Number(projects.rows[0].count),
      users: Number(users.rows[0].count),
      active_members: Number(members.rows[0].count),
      clients: Number(clients.rows[0].count),
    });
  } catch (err: any) {
    console.error('Stats error:', err.message);
    return NextResponse.json({ open_tickets: 0, active_projects: 0 });
  }
}
