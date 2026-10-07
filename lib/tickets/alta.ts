import { pool } from '@/lib/db';
import { createNotification } from '@/lib/notifications';
import { sendViaGmail } from '@/lib/integrations/google-workspace';
import { sendClientInvitationEmail } from '@/lib/integrations/email';

/**
 * LO QUE PASA CUANDO UN TICKET «SALE AL MUNDO» (Fernando, 2026-10-07).
 *
 * Antes vivía dentro de la creación del ticket. Con los borradores hay dos momentos: crear
 * (un borrador no habla con nadie) y enviar. Esto es lo de enviar, en un solo sitio, y lo
 * llaman la creación normal (`POST /api/tickets`) y el envío de un borrador
 * (`POST /api/tickets/[id]/enviar`):
 *  · aviso al miembro elegido, si lo pidió un cliente;
 *  · correo al cliente con el ticket;
 *  · invitación a crear su cuenta, si el cliente se acaba de dar de alta por correo.
 * Nada de esto lanza: un correo que no sale no deshace el ticket.
 */
export async function anunciarTicket(ticket: any, o: {
  mode: 'create' | 'request';
  resolvedMemberId: number | null;
  resolvedClientEmail: string | null;
  invitePlaceholderEmail: string | null;
}): Promise<void> {
  const { mode, resolvedMemberId, resolvedClientEmail, invitePlaceholderEmail } = o;
  const title: string = ticket.title;
  const description: string | null = ticket.description;
  const deadline = ticket.deadline;
  const estimated_cost = ticket.estimated_cost;

  // Solicitar ticket con miembro escogido → notificar al miembro (usuario) elegido.
  if (mode === 'request' && resolvedMemberId) {
    try {
      const { rows: [u] } = await pool.query(
        `SELECT id FROM gcc_world.users WHERE member_id = $1 LIMIT 1`, [resolvedMemberId]
      );
      if (u?.id) {
        await createNotification(String(u.id), {
          type: 'ticket_request',
          title: title,
          message: description?.trim() || 'Te solicitaron atender este ticket.',
          link: `/dashboard/tickets/${ticket.id}`,
        });
      }
    } catch (e) { console.error('No se pudo crear la notificación de solicitud de ticket:', (e as any)?.message); }
  }

  // Send email notification to client
  if (resolvedClientEmail) {
    try {
      const ticketUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.grupocc.org'}/dashboard/tickets/${ticket.id}`;
      await sendViaGmail({
        from: process.env.EMAIL_FROM || 'GCC World <noreply@gccworld.com>',
        to: resolvedClientEmail,
        bcc: 'lfgonzalezm0@grupocc.org',
        subject: `Nuevo Ticket #${ticket.id}: ${title} — GCC World`,
        html: `<div style="font-family:'Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif;background:#faf9f8;padding:0;margin:0;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;">
  <div style="height:6px;background:#4B2D8E;"></div>
  <div style="padding:30px 40px;">
  <h1 style="color:#1a1a2e;font-size:22px;margin:0 0 6px;">Nuevo Ticket Creado</h1>
  <p style="color:#888;font-size:14px;margin:0 0 24px;">Se ha registrado un nuevo ticket de servicio a tu nombre.</p>
  <table style="width:100%;border-collapse:collapse;border:1px solid #e1dfdd;border-radius:8px;overflow:hidden;">
    <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;width:35%"><strong>Ticket:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">#${ticket.id}</td></tr>
    <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>Titulo:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">${title}</td></tr>
    ${description ? `<tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>Descripcion:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">${description}</td></tr>` : ''}
    <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>Estado:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">Pendiente</td></tr>
    ${deadline ? `<tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>Fecha Limite:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">${new Date(deadline).toLocaleDateString('es-EC')}</td></tr>` : ''}
    ${estimated_cost ? `<tr><td style="padding:10px 16px;color:#666;font-size:13px;"><strong>Costo Estimado:</strong></td><td style="padding:10px 16px;font-size:13px;">$${Number(estimated_cost).toFixed(2)}</td></tr>` : ''}
  </table>
  <div style="text-align:center;margin:24px 0 0;">
    <a href="${ticketUrl}" style="display:inline-block;padding:12px 24px;background:#4B2D8E;color:#ffffff;text-decoration:none;font-size:13px;font-weight:bold;border-radius:4px;">Ver Ticket</a>
  </div>
  <p style="color:#888;font-size:12px;margin:16px 0 0;text-align:center;">Este correo fue generado automaticamente por GCC World.</p>
  </div>
  <div style="height:3px;background:#4B2D8E;"></div>
</div>
</div>`,
      });
    } catch (emailErr: any) {
      console.error('Error sending ticket email:', emailErr.message);
    }
  }

  // RUTA 3: si se creó un placeholder nuevo por correo, invítale a crear su cuenta de cliente.
  if (invitePlaceholderEmail) {
    try {
      await sendClientInvitationEmail({ email: invitePlaceholderEmail, context: 'un ticket', contextTitle: title });
    } catch (e: any) { console.error('Ticket client invite email failed:', e.message); }
  }

}
