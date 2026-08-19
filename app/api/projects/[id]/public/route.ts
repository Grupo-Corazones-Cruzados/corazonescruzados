import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getProjectBilling } from '@/lib/payments';

/**
 * Lo que ve el CLIENTE del proyecto con el enlace que le llega por correo.
 *
 * Enseña el acuerdo, no la cocina: avance, las ETAPAS pactadas con su importe y su estado,
 * y las facturas emitidas. **No** salen los requerimientos, ni quién los hace, ni lo que
 * cuesta cada pieza por dentro — eso es el reparto interno del trabajo (ver MEMORIA.md,
 * «la etapa no es el requerimiento»).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = req.nextUrl.searchParams.get('token');

    await pool.query(`
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS public_token VARCHAR(64);
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS public_token_expires_at TIMESTAMPTZ;
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS images TEXT[];
    `);

    const { rows } = await pool.query(
      `SELECT p.id, p.title, p.description, p.status, p.deadline,
              p.is_private, p.public_token, p.public_token_expires_at,
              p.created_at, p.confirmed_at,
              COALESCE(p.images, '{}') as images,
              c.name as client_name
       FROM gcc_world.projects p
       LEFT JOIN gcc_world.clients c ON c.id = p.client_id
       WHERE p.id = $1`,
      [id]
    );

    if (rows.length === 0) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    const project = rows[0];

    // Los proyectos privados exigen el token del enlace, y sin caducar.
    if (project.is_private) {
      if (!token || token !== project.public_token) {
        return NextResponse.json({ error: 'Este proyecto es privado' }, { status: 403 });
      }
      if (project.public_token_expires_at && new Date(project.public_token_expires_at) < new Date()) {
        return NextResponse.json({ error: 'El enlace ha expirado. Solicita uno nuevo al administrador.' }, { status: 403 });
      }
    }

    // Avance: solo la CIFRA de requerimientos entregados, nunca cuáles ni de quién.
    const { rows: [avance] } = await pool.query(
      `SELECT count(*) AS total, count(completed_at) AS hechos
         FROM gcc_world.project_requirements WHERE project_id = $1`,
      [id]
    );
    const total = Number(avance?.total) || 0;
    const hechos = Number(avance?.hechos) || 0;

    // Etapas pactadas y su estado de facturación.
    const billing = await getProjectBilling(id);

    // TODAS las facturas del proyecto, por cualquiera de sus tres enlaces: directo,
    // por la tabla de proyectos de una factura manual, o por la etapa que cubren.
    // Buscarlas solo por `project_id` dejaba al cliente sin ver su factura, porque las
    // que salen del módulo de facturas tienen ese campo vacío.
    const { rows: invoices } = await pool.query(
      `SELECT i.id, i.invoice_number, i.total, i.created_at AS issue_date, i.sri_status,
              i.authorization_number, (i.pdf_data IS NOT NULL) AS has_pdf,
              (SELECT e.name FROM gcc_world.project_stages e WHERE e.invoice_id = i.id LIMIT 1) AS stage_name
         FROM gcc_world.invoices i
        WHERE i.status <> 'cancelled'
          AND (i.project_id = ($1)::bigint
               OR i.id IN (SELECT ip.invoice_id FROM gcc_world.invoice_projects ip WHERE ip.project_id = ($1)::text)
               OR i.id IN (SELECT e.invoice_id FROM gcc_world.project_stages e WHERE e.project_id = ($1)::bigint))
        ORDER BY i.created_at`,
      [String(id)]
    );

    delete project.public_token;
    delete project.is_private;
    delete project.public_token_expires_at;

    return NextResponse.json({
      data: {
        ...project,
        avance: { total, hechos, pct: total > 0 ? Math.round((hechos / total) * 100) : 0 },
        etapas: (billing?.etapas || []).map(e => ({
          id: e.id, name: e.name, amount: e.amount,
          facturada: !!e.invoiceId, invoiceNumber: e.invoiceNumber,
        })),
        totalEtapas: billing?.mode === 'etapas' ? billing.stagesTotal : 0,
        invoices,
      },
    });
  } catch (err: any) {
    console.error('Public project GET error:', err.message);
    return NextResponse.json({ error: 'Error al obtener proyecto' }, { status: 500 });
  }
}
