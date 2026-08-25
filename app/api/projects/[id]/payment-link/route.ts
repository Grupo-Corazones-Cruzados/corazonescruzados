/**
 * EL ENLACE DE PAGO — canal 3.
 *
 * «el responsable del proyecto tenga un botón para compartir el enlace de pago… antes
 * debe pedir el correo del cliente o usar el correo del cliente que está asociado al
 * ticket o proyecto… el usuario miembro responsable del proyecto define el tiempo máximo
 * de duración del token» (Fernando, 2026-08-25).
 *
 * Tres decisiones que salen literalmente de ahí:
 *   · El correo se PRERRELLENA con el del cliente del proyecto, pero se puede cambiar.
 *   · La caducidad **no tiene valor por defecto en la base**: la pone quien comparte.
 *   · Un enlace es de UNA etapa. Un token que sirviera para todo el proyecto sería una
 *     llave más grande de lo necesario, y las llaves de más se acaban filtrando.
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { pool } from '@/lib/db';
import { autorizarCompartir, SinAcceso } from '@/lib/pagos/acceso';
import { cotizarEtapa, cobroPagadoDeEtapa } from '@/lib/pagos/intentos';
import { proveedorActivo } from '@/lib/pagos';
import { sendPaymentLinkEmail } from '@/lib/integrations/email';

/** Tope duro de caducidad. Un enlace de pago eterno es una llave olvidada en la cerradura. */
const MAX_HORAS = 24 * 30;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await autorizarCompartir(id);
    const { rows } = await pool.query(
      `SELECT l.id, l.stage_id, l.email, l.expires_at, l.sent_at, l.opened_at, l.paid_at,
              l.revoked_at, l.created_at, e.name AS stage_name,
              (l.revoked_at IS NULL AND l.expires_at > NOW() AND l.paid_at IS NULL) AS vigente
         FROM gcc_world.payment_links l
         LEFT JOIN gcc_world.project_stages e ON e.id = l.stage_id
        WHERE l.source_type = 'project' AND l.source_id = $1
        ORDER BY l.created_at DESC`,
      [String(id)],
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    if (err instanceof SinAcceso) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId } = await autorizarCompartir(id);
    const cuerpo = await req.json();

    const stageId = Number(cuerpo.stage_id);
    if (!stageId) return NextResponse.json({ error: 'Elige la etapa que se va a cobrar.' }, { status: 400 });

    const horas = Number(cuerpo.horas);
    if (!Number.isFinite(horas) || horas < 1 || horas > MAX_HORAS) {
      return NextResponse.json({ error: `La duración debe estar entre 1 hora y ${MAX_HORAS / 24} días.` }, { status: 400 });
    }

    const yaPagada = await cobroPagadoDeEtapa(stageId);
    if (yaPagada) return NextResponse.json({ error: 'Esta etapa ya fue pagada.' }, { status: 409 });

    // Vuelve a validar que la etapa exista, sea de ESTE proyecto y no esté facturada, y
    // de paso calcula los importes que van en el correo. Un enlace que promete un importe
    // distinto del que se cobra es una discusión con el cliente asegurada.
    const proveedor = proveedorActivo();
    const etapa = await cotizarEtapa(id, stageId, proveedor.nombre);

    // El correo: el que manden, y si no, el del cliente del proyecto.
    const { rows: [proj] } = await pool.query(
      `SELECT p.title, c.email AS client_email,
              (SELECT m.name FROM gcc_world.members m WHERE m.id = p.assigned_member_id) AS responsable
         FROM gcc_world.projects p
         LEFT JOIN gcc_world.clients c ON c.id = p.client_id
        WHERE p.id = ($1)::bigint`,
      [String(id)],
    );
    const email = String(cuerpo.email || proj?.client_email || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({
        error: 'Hace falta el correo del cliente: este proyecto no tiene uno asociado.',
      }, { status: 400 });
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + horas * 3600_000);

    const { rows: [enlace] } = await pool.query(
      `INSERT INTO gcc_world.payment_links
         (token, source_type, source_id, stage_id, email, expires_at, created_by)
       VALUES ($1, 'project', $2, $3, $4, $5, $6)
       RETURNING id`,
      [token, String(id), stageId, email, expiresAt, userId],
    );

    const base = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const url = `${base}/pagar/${token}`;

    let correoEnviado = true;
    let avisoCorreo: string | null = null;
    try {
      await sendPaymentLinkEmail({
        email,
        projectTitle: etapa.projectTitle,
        stageName: etapa.stageName,
        neto: etapa.neto,
        recargo: etapa.recargo,
        total: etapa.total,
        url,
        expiresAt,
        responsibleName: proj?.responsable || null,
      });
      await pool.query(`UPDATE gcc_world.payment_links SET sent_at = NOW() WHERE id = $1`, [enlace.id]);
    } catch (e: any) {
      // El enlace YA existe y es válido: que el correo falle no lo invalida. Se devuelve
      // igualmente para que el responsable pueda copiarlo y mandarlo por donde quiera.
      correoEnviado = false;
      avisoCorreo = e.message;
      console.error('[pagos] no se pudo enviar el enlace de pago:', e.message);
    }

    return NextResponse.json({
      ok: true,
      id: Number(enlace.id),
      url,
      email,
      expiresAt,
      importes: { neto: etapa.neto, recargo: etapa.recargo, total: etapa.total },
      correoEnviado,
      avisoCorreo,
    });
  } catch (err: any) {
    if (err instanceof SinAcceso) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

/** Revoca un enlace. No borra: el rastro de que existió y a quién se mandó importa. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await autorizarCompartir(id);
    const linkId = Number(req.nextUrl.searchParams.get('link_id'));
    if (!linkId) return NextResponse.json({ error: 'Falta el enlace.' }, { status: 400 });
    const { rowCount } = await pool.query(
      `UPDATE gcc_world.payment_links SET revoked_at = NOW()
        WHERE id = $1 AND source_type = 'project' AND source_id = $2 AND revoked_at IS NULL`,
      [linkId, String(id)],
    );
    if (!rowCount) return NextResponse.json({ error: 'El enlace no existe o ya estaba anulado.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err instanceof SinAcceso) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
