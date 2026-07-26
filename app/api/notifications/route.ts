import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { listUserNotifications, getReadAt, markAllRead } from '@/lib/notifications';
import { NextResponse } from 'next/server';

// Notificaciones del usuario, de dos orígenes:
//  (1) Tabla `notifications` (persistente): p.ej. solicitud de ticket a un miembro.
//  (2) Invitaciones a proyectos DERIVADAS en vivo: a liderar (project_members
//      role='responsible' status='invited') y a participar (project_bids status='invited').
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const items: any[] = [];
    // Las invitaciones derivadas no tienen `is_read`: se consideran leídas si son
    // anteriores a la última vez que el usuario abrió sus notificaciones.
    const readAt = await getReadAt(user.userId);
    const readAtMs = readAt ? new Date(readAt).getTime() : 0;

    // (1) Notificaciones persistentes del usuario (tabla notifications).
    const stored = await listUserNotifications(user.userId);
    for (const n of stored) {
      const category = n.type === 'ticket_request' ? 'ticket' : n.type;
      const label = (n.message && String(n.message).trim())
        || (n.type === 'ticket_request' ? 'Te solicitaron atender este ticket' : '');
      items.push({ id: `n${n.id}`, category, title: n.title, label, href: n.link || '#', date: n.created_at, read: n.is_read });
    }

    // (2) Invitaciones a proyectos (por miembro).
    const { rows: [me] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
    if (me?.member_id) {
      const { rows: inv } = await pool.query(
        `SELECT p.id AS project_id, p.title, 'participant' AS kind, pb.created_at AS invited_at
           FROM gcc_world.project_bids pb JOIN gcc_world.projects p ON p.id = pb.project_id
          WHERE pb.member_id = $1 AND pb.status = 'invited'
         UNION ALL
         SELECT p.id, p.title, 'responsible', pm.created_at
           FROM gcc_world.project_members pm JOIN gcc_world.projects p ON p.id = pm.project_id
          WHERE pm.member_id = $1 AND pm.role = 'responsible' AND pm.status = 'invited'`,
        [me.member_id],
      );
      for (const r of inv) {
        items.push({
          id: `${r.kind}-${r.project_id}`,
          category: r.kind === 'responsible' ? 'project_responsible' : 'project_participant',
          title: r.title,
          label: r.kind === 'responsible' ? 'Invitación a liderar el proyecto' : 'Invitación a participar en el proyecto',
          href: `/dashboard/projects/${r.project_id}`,
          date: r.invited_at,
          read: r.invited_at ? new Date(r.invited_at).getTime() <= readAtMs : true,
        });
      }
    }

    // Más recientes primero (es el orden en el que se listan en la campanita).
    items.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    const unread = items.filter((i) => !i.read).length;
    return NextResponse.json({ data: items, unread });
  } catch (err: any) {
    console.error('Notifications GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** POST — marca TODAS como leídas. Lo dispara la campanita al abrirse. */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    await markAllRead(user.userId);
    return NextResponse.json({ data: { ok: true } });
  } catch (err: any) {
    console.error('Notifications POST error:', err.message);
    return NextResponse.json({ error: 'No se pudieron marcar como leídas.' }, { status: 500 });
  }
}
