import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = req.nextUrl.searchParams.get('token');

    // Ensure columns exist
    await pool.query(`
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS public_token VARCHAR(64);
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS public_token_expires_at TIMESTAMPTZ;
    `);

    const { rows } = await pool.query(
      `SELECT p.id, p.title, p.description, p.status, p.budget_min, p.budget_max,
              p.final_cost, p.deadline, p.is_private, p.public_token, p.public_token_expires_at,
              p.created_at, p.updated_at, p.confirmed_at,
              c.name as client_name
       FROM gcc_world.projects p
       LEFT JOIN gcc_world.clients c ON c.id = p.client_id
       WHERE p.id = $1`,
      [id]
    );

    if (rows.length === 0) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    const project = rows[0];

    // Private projects require a valid, non-expired token
    if (project.is_private) {
      if (!token || token !== project.public_token) {
        return NextResponse.json({ error: 'Este proyecto es privado' }, { status: 403 });
      }
      if (project.public_token_expires_at && new Date(project.public_token_expires_at) < new Date()) {
        return NextResponse.json({ error: 'El enlace ha expirado. Solicita uno nuevo al administrador.' }, { status: 403 });
      }
    }

    // Get requirements with assignments
    const reqs = await pool.query(
      `SELECT r.id, r.title, r.description, r.estimated_cost, r.completed_at,
              (r.completed_at IS NOT NULL) as is_completed,
              COALESCE(
                (SELECT json_agg(json_build_object(
                  'member_name', m.name, 'photo_url', m.photo_url, 'status', ra.status
                )) FROM gcc_world.requirement_assignments ra
                JOIN gcc_world.members m ON m.id = ra.member_id
                WHERE ra.requirement_id = r.id AND ra.status = 'accepted'),
                '[]'::json
              ) as assignments,
              COALESCE(
                (SELECT json_agg(json_build_object(
                  'id', ri.id, 'title', ri.title, 'is_completed', ri.is_completed
                ) ORDER BY ri.sort_order, ri.id) FROM gcc_world.requirement_items ri
                WHERE ri.requirement_id = r.id),
                '[]'::json
              ) as items
       FROM gcc_world.project_requirements r
       WHERE r.project_id = $1
       ORDER BY r.id`,
      [id]
    );

    // Get accepted participants/bids (public info only)
    const bids = await pool.query(
      `SELECT m.name as member_name, m.photo_url, m.position, pb.status
       FROM gcc_world.project_bids pb
       JOIN gcc_world.members m ON m.id = pb.member_id
       WHERE pb.project_id = $1 AND pb.status = 'accepted'
       ORDER BY pb.created_at`,
      [id]
    );

    // Get invoice summary (no sensitive data)
    const invoice = await pool.query(
      `SELECT i.invoice_number, i.total, i.issue_date, i.sri_status,
              i.subtotal_0, i.subtotal_iva, i.iva_amount
       FROM gcc_world.invoices i
       WHERE i.project_id = $1
       ORDER BY i.created_at DESC LIMIT 1`,
      [id]
    );

    // Remove sensitive fields
    delete project.public_token;
    delete project.is_private;

    return NextResponse.json({
      data: {
        ...project,
        requirements: reqs.rows,
        participants: bids.rows,
        invoice: invoice.rows[0] || null,
      },
    });
  } catch (err: any) {
    console.error('Public project GET error:', err.message);
    return NextResponse.json({ error: 'Error al obtener proyecto' }, { status: 500 });
  }
}
