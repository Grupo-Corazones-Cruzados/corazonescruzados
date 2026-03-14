import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL =
  process.env.EMAIL_FROM ||
  "Corazones Cruzados <noreply@corazonescruzados.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function emailShell(content: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Inter',sans-serif;background-color:#F9FAFB;margin:0;padding:40px 20px;">
<div style="max-width:560px;margin:0 auto;">
  <div style="text-align:center;margin-bottom:24px;">
    <img src="${APP_URL}/LogoCC.png" alt="CC" style="width:48px;height:48px;border-radius:12px;" />
  </div>
  <div style="background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E5E7EB;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
    <div style="height:3px;background:#4B2D8E;"></div>
    <div style="padding:36px 32px;">${content}</div>
    <div style="padding:20px 32px;background:#F9FAFB;border-top:1px solid #F3F4F6;">
      <p style="color:#9CA3AF;font-size:12px;margin:0;text-align:center;">
        Este correo fue enviado por Corazones Cruzados.
      </p>
    </div>
  </div>
  <p style="text-align:center;margin-top:24px;color:#9CA3AF;font-size:11px;">
    &copy; ${new Date().getFullYear()} Corazones Cruzados. Todos los derechos reservados.
  </p>
</div></body></html>`;
}

export async function sendVerificationEmail(
  email: string,
  token: string,
  name?: string
) {
  const url = `${APP_URL}/auth/verify?token=${token}`;
  const html = emailShell(`
    <h1 style="color:#111827;font-size:22px;font-weight:600;margin:0 0 8px;text-align:center;">Verifica tu cuenta</h1>
    <p style="color:#6B7280;font-size:14px;text-align:center;margin:0 0 24px;">Solo un paso más para comenzar</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Hola${name ? ` <strong>${name}</strong>` : ""},<br/>
      Gracias por registrarte en <strong style="color:#4B2D8E;">Corazones Cruzados</strong>.
      Haz clic en el botón para activar tu cuenta:
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:14px 40px;border-radius:9999px;font-weight:600;font-size:15px;">
        Verificar mi cuenta
      </a>
    </div>
    <p style="color:#9CA3AF;font-size:12px;margin:24px 0 0;">Este enlace expira en 24 horas.</p>
  `);
  return resend.emails.send({ from: FROM_EMAIL, to: email, subject: "Verifica tu cuenta — Corazones Cruzados", html });
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  name?: string
) {
  const url = `${APP_URL}/auth/reset-password?token=${token}`;
  const html = emailShell(`
    <h1 style="color:#111827;font-size:22px;font-weight:600;margin:0 0 8px;text-align:center;">Restablecer contraseña</h1>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Hola${name ? ` <strong>${name}</strong>` : ""},<br/>
      Recibimos una solicitud para restablecer tu contraseña.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:14px 40px;border-radius:9999px;font-weight:600;font-size:15px;">
        Restablecer contraseña
      </a>
    </div>
    <p style="color:#9CA3AF;font-size:12px;margin:24px 0 0;">Este enlace expira en 1 hora. Si no solicitaste esto, ignora este correo.</p>
  `);
  return resend.emails.send({ from: FROM_EMAIL, to: email, subject: "Restablecer contraseña — Corazones Cruzados", html });
}

export async function sendInvoiceEmail(
  email: string,
  invoiceNumber: string,
  total: string,
  pdfUrl?: string
) {
  const html = emailShell(`
    <h1 style="color:#111827;font-size:22px;font-weight:600;margin:0 0 8px;text-align:center;">Nueva Factura</h1>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;text-align:center;">
      Se ha generado la factura <strong>${invoiceNumber}</strong> por un total de <strong>${total}</strong>.
    </p>
    ${pdfUrl ? `<div style="text-align:center;margin:28px 0;"><a href="${pdfUrl}" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:14px 40px;border-radius:9999px;font-weight:600;font-size:15px;">Descargar PDF</a></div>` : ""}
  `);
  return resend.emails.send({ from: FROM_EMAIL, to: email, subject: `Factura ${invoiceNumber} — Corazones Cruzados`, html });
}

export async function sendTicketConfirmationEmail(
  email: string,
  ticketTitle: string,
  scheduledAt: string,
  memberName?: string
) {
  const html = emailShell(`
    <h1 style="color:#111827;font-size:22px;font-weight:600;margin:0 0 8px;text-align:center;">Ticket Confirmado</h1>
    <p style="color:#6B7280;font-size:14px;text-align:center;margin:0 0 24px;">Tu cita ha sido agendada</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
      <tr>
        <td style="padding:10px 0;color:#6B7280;font-size:14px;border-bottom:1px solid #F3F4F6;">Servicio</td>
        <td style="padding:10px 0;color:#111827;font-size:14px;font-weight:500;text-align:right;border-bottom:1px solid #F3F4F6;">${ticketTitle}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#6B7280;font-size:14px;border-bottom:1px solid #F3F4F6;">Fecha</td>
        <td style="padding:10px 0;color:#111827;font-size:14px;font-weight:500;text-align:right;border-bottom:1px solid #F3F4F6;">${scheduledAt}</td>
      </tr>
      ${memberName ? `<tr><td style="padding:10px 0;color:#6B7280;font-size:14px;">Miembro asignado</td><td style="padding:10px 0;color:#111827;font-size:14px;font-weight:500;text-align:right;">${memberName}</td></tr>` : ""}
    </table>
    <div style="text-align:center;margin:28px 0;">
      <a href="${APP_URL}/dashboard/tickets" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:14px 40px;border-radius:9999px;font-weight:600;font-size:15px;">
        Ver mis tickets
      </a>
    </div>
  `);
  return resend.emails.send({ from: FROM_EMAIL, to: email, subject: `Ticket confirmado: ${ticketTitle} — Corazones Cruzados`, html });
}

export async function sendTicketWorkDaysUpdatedEmail(
  email: string,
  clientName: string,
  ticketId: number,
  ticketTitle: string,
  memberName: string,
  reason: string,
  newDates: string[]
) {
  const datesHtml = newDates
    .map(
      (d) =>
        `<span style="display:inline-block;background:#EFF6FF;color:#4B2D8E;padding:4px 12px;border-radius:9999px;font-size:13px;font-weight:500;margin:2px 4px;">${d}</span>`
    )
    .join(" ");

  const html = emailShell(`
    <h1 style="color:#111827;font-size:22px;font-weight:600;margin:0 0 8px;text-align:center;">Días de Trabajo Actualizados</h1>
    <p style="color:#6B7280;font-size:14px;text-align:center;margin:0 0 24px;">Ticket #${ticketId}: ${ticketTitle}</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
      Hola <strong>${clientName}</strong>,<br/>
      <strong>${memberName}</strong> ha actualizado los días de trabajo de tu ticket.
    </p>
    <div style="padding:16px;background:#F9FAFB;border-radius:12px;margin:0 0 20px;">
      <p style="color:#6B7280;font-size:12px;margin:0 0 8px;">Motivo del cambio:</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0;">${reason}</p>
    </div>
    <p style="color:#6B7280;font-size:13px;margin:0 0 8px;">Nuevos días de trabajo:</p>
    <div style="margin:0 0 24px;">${datesHtml}</div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${APP_URL}/dashboard/tickets/${ticketId}" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:14px 40px;border-radius:9999px;font-weight:600;font-size:15px;">
        Ver ticket
      </a>
    </div>
  `);
  return resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Días actualizados — Ticket #${ticketId}: ${ticketTitle}`,
    html,
  });
}

export async function sendTicketStatusChangeEmail(
  email: string,
  clientName: string,
  ticketId: number,
  ticketTitle: string,
  memberName: string,
  newStatus: "completed" | "cancelled" | "withdrawn",
  reason?: string
) {
  const statusLabels: Record<string, string> = {
    completed: "Completado",
    cancelled: "Cancelado",
    withdrawn: "Desistido",
  };
  const statusColors: Record<string, { bg: string; color: string }> = {
    completed: { bg: "#ECFDF5", color: "#059669" },
    cancelled: { bg: "#FEF2F2", color: "#DC2626" },
    withdrawn: { bg: "#F3F4F6", color: "#6B7280" },
  };
  const statusMessages: Record<string, string> = {
    completed: "ha marcado como completado",
    cancelled: "ha cancelado",
    withdrawn: "ha desistido de",
  };

  const label = statusLabels[newStatus];
  const colors = statusColors[newStatus];
  const message = statusMessages[newStatus];

  const html = emailShell(`
    <h1 style="color:#111827;font-size:22px;font-weight:600;margin:0 0 8px;text-align:center;">Ticket ${label}</h1>
    <p style="color:#6B7280;font-size:14px;text-align:center;margin:0 0 24px;">Ticket #${ticketId}: ${ticketTitle}</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
      Hola <strong>${clientName}</strong>,<br/>
      <strong>${memberName}</strong> ${message} tu ticket.
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <span style="display:inline-block;background:${colors.bg};color:${colors.color};padding:8px 20px;border-radius:9999px;font-size:14px;font-weight:600;">
        ${label}
      </span>
    </div>
    ${reason ? `<div style="padding:16px;background:#F9FAFB;border-radius:12px;margin:0 0 24px;">
      <p style="color:#6B7280;font-size:12px;margin:0 0 8px;">Motivo:</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0;">${reason}</p>
    </div>` : ""}
    <div style="text-align:center;margin:28px 0;">
      <a href="${APP_URL}/dashboard/tickets/${ticketId}" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:14px 40px;border-radius:9999px;font-weight:600;font-size:15px;">
        Ver ticket
      </a>
    </div>
  `);
  return resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Ticket #${ticketId} ${label} — ${ticketTitle}`,
    html,
  });
}

export async function sendProjectUpdateEmail(
  email: string,
  projectTitle: string,
  newStatus: string,
  message?: string
) {
  const html = emailShell(`
    <h1 style="color:#111827;font-size:22px;font-weight:600;margin:0 0 8px;text-align:center;">Actualización de Proyecto</h1>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;text-align:center;">
      El proyecto <strong>${projectTitle}</strong> cambió de estado.
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <span style="display:inline-block;background:#EFF6FF;color:#4B2D8E;padding:8px 20px;border-radius:9999px;font-size:14px;font-weight:600;">
        ${newStatus}
      </span>
    </div>
    ${message ? `<p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px;padding:16px;background:#F9FAFB;border-radius:12px;">${message}</p>` : ""}
    <div style="text-align:center;margin:28px 0;">
      <a href="${APP_URL}/dashboard/projects" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:14px 40px;border-radius:9999px;font-weight:600;font-size:15px;">
        Ver proyecto
      </a>
    </div>
  `);
  return resend.emails.send({ from: FROM_EMAIL, to: email, subject: `Proyecto actualizado: ${projectTitle} — Corazones Cruzados`, html });
}

export async function sendOrderConfirmationEmail(
  email: string,
  orderId: number,
  total: string,
  itemCount: number
) {
  const html = emailShell(`
    <h1 style="color:#111827;font-size:22px;font-weight:600;margin:0 0 8px;text-align:center;">Pedido Confirmado</h1>
    <p style="color:#6B7280;font-size:14px;text-align:center;margin:0 0 24px;">Gracias por tu compra</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
      <tr>
        <td style="padding:10px 0;color:#6B7280;font-size:14px;border-bottom:1px solid #F3F4F6;">Orden</td>
        <td style="padding:10px 0;color:#111827;font-size:14px;font-weight:500;text-align:right;border-bottom:1px solid #F3F4F6;">#${orderId}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#6B7280;font-size:14px;border-bottom:1px solid #F3F4F6;">Productos</td>
        <td style="padding:10px 0;color:#111827;font-size:14px;font-weight:500;text-align:right;border-bottom:1px solid #F3F4F6;">${itemCount} artículo${itemCount > 1 ? "s" : ""}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#6B7280;font-size:14px;">Total</td>
        <td style="padding:10px 0;color:#111827;font-size:18px;font-weight:700;text-align:right;">${total}</td>
      </tr>
    </table>
    <div style="text-align:center;margin:28px 0;">
      <a href="${APP_URL}/dashboard/marketplace" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:14px 40px;border-radius:9999px;font-weight:600;font-size:15px;">
        Ver mis pedidos
      </a>
    </div>
  `);
  return resend.emails.send({ from: FROM_EMAIL, to: email, subject: `Pedido #${orderId} confirmado — Corazones Cruzados`, html });
}

// ----- Project invitation & confirmation emails -----

export async function sendProjectInvitationEmail(
  email: string,
  memberName: string,
  projectTitle: string,
  clientName: string,
  projectId: number
) {
  const html = emailShell(`
    <h1 style="color:#111827;font-size:22px;font-weight:600;margin:0 0 8px;text-align:center;">Invitación a Proyecto</h1>
    <p style="color:#6B7280;font-size:14px;text-align:center;margin:0 0 24px;">Has sido invitado a participar</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Hola <strong>${memberName}</strong>,<br/>
      <strong>${clientName}</strong> te ha invitado al proyecto <strong style="color:#4B2D8E;">${projectTitle}</strong>.
      Revisa los detalles y envía tu propuesta.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${APP_URL}/dashboard/projects/${projectId}" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:14px 40px;border-radius:9999px;font-weight:600;font-size:15px;">
        Ver proyecto
      </a>
    </div>
  `);
  return resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Invitación al proyecto: ${projectTitle} — Corazones Cruzados`,
    html,
  });
}

export async function sendProjectConfirmedEmail(
  email: string,
  recipientName: string,
  projectTitle: string,
  finalCost: string,
  projectId: number
) {
  const html = emailShell(`
    <h1 style="color:#111827;font-size:22px;font-weight:600;margin:0 0 8px;text-align:center;">Proyecto Confirmado</h1>
    <p style="color:#6B7280;font-size:14px;text-align:center;margin:0 0 24px;">¡El proyecto ha sido confirmado!</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Hola <strong>${recipientName}</strong>,<br/>
      El proyecto <strong style="color:#4B2D8E;">${projectTitle}</strong> ha sido confirmado.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
      <tr>
        <td style="padding:10px 0;color:#6B7280;font-size:14px;border-bottom:1px solid #F3F4F6;">Costo final</td>
        <td style="padding:10px 0;color:#111827;font-size:18px;font-weight:700;text-align:right;border-bottom:1px solid #F3F4F6;">${finalCost}</td>
      </tr>
    </table>
    <div style="text-align:center;margin:28px 0;">
      <a href="${APP_URL}/dashboard/projects/${projectId}" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:14px 40px;border-radius:9999px;font-weight:600;font-size:15px;">
        Ver proyecto
      </a>
    </div>
  `);
  return resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Proyecto confirmado: ${projectTitle} — Corazones Cruzados`,
    html,
  });
}

// ----- Client invitation email -----

export async function sendClientInvitationEmail(
  email: string,
  memberName: string,
  projectTitle?: string
) {
  const url = `${APP_URL}/auth?tab=register`;
  const contextLine = projectTitle
    ? `Te ha invitado al proyecto <strong style="color:#4B2D8E;">${projectTitle}</strong>.`
    : `Te ha invitado a colaborar en la plataforma.`;
  const html = emailShell(`
    <h1 style="color:#111827;font-size:22px;font-weight:600;margin:0 0 8px;text-align:center;">Invitación a Corazones Cruzados</h1>
    <p style="color:#6B7280;font-size:14px;text-align:center;margin:0 0 24px;">Has recibido una invitación</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Hola,<br/>
      <strong>${memberName}</strong> ${contextLine}
      Crea tu cuenta para comenzar:
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:14px 40px;border-radius:9999px;font-weight:600;font-size:15px;">
        Crear mi cuenta
      </a>
    </div>
    <p style="color:#9CA3AF;font-size:12px;margin:24px 0 0;">Si ya tienes una cuenta, simplemente inicia sesión.</p>
  `);
  return resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `${memberName} te invita a Corazones Cruzados`,
    html,
  });
}

// ----- Campaign emails -----

export async function sendCampaignEmail(
  to: string,
  subject: string,
  htmlBody: string,
  signatureHtml?: string | null
) {
  const fullBody = signatureHtml ? `${htmlBody}${signatureHtml}` : htmlBody;
  return resend.emails.send({ from: FROM_EMAIL, to, subject, html: fullBody });
}

// ----- Order confirmation flow emails -----

export async function sendMemberConfirmationRequestEmail(
  memberEmail: string,
  memberName: string,
  orderId: number,
  clientName: string,
  items: { name: string; quantity: number; price: string }[]
) {
  const itemRows = items
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px 0;color:#374151;font-size:14px;border-bottom:1px solid #F3F4F6;">${i.name}</td>
          <td style="padding:8px 0;color:#374151;font-size:14px;text-align:center;border-bottom:1px solid #F3F4F6;">${i.quantity}</td>
          <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:500;text-align:right;border-bottom:1px solid #F3F4F6;">${i.price}</td>
        </tr>`
    )
    .join("");

  const html = emailShell(`
    <h1 style="color:#111827;font-size:22px;font-weight:600;margin:0 0 8px;text-align:center;">Nuevo Pedido Recibido</h1>
    <p style="color:#6B7280;font-size:14px;text-align:center;margin:0 0 24px;">Un cliente quiere adquirir tu trabajo</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Hola <strong>${memberName}</strong>,<br/>
      <strong>${clientName}</strong> ha realizado un pedido que incluye proyectos tuyos. Revisa los detalles y confirma si puedes cumplir con la entrega.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
      <tr>
        <td style="padding:8px 0;color:#6B7280;font-size:12px;font-weight:600;text-transform:uppercase;border-bottom:2px solid #E5E7EB;">Producto</td>
        <td style="padding:8px 0;color:#6B7280;font-size:12px;font-weight:600;text-transform:uppercase;text-align:center;border-bottom:2px solid #E5E7EB;">Cant.</td>
        <td style="padding:8px 0;color:#6B7280;font-size:12px;font-weight:600;text-transform:uppercase;text-align:right;border-bottom:2px solid #E5E7EB;">Precio</td>
      </tr>
      ${itemRows}
    </table>
    <div style="text-align:center;margin:28px 0;">
      <a href="${APP_URL}/dashboard/marketplace?tab=confirmations" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:14px 40px;border-radius:9999px;font-weight:600;font-size:15px;">
        Revisar y Confirmar
      </a>
    </div>
    <p style="color:#9CA3AF;font-size:12px;margin:24px 0 0;">Pedido #${orderId}</p>
  `);
  return resend.emails.send({
    from: FROM_EMAIL,
    to: memberEmail,
    subject: `Nuevo pedido #${orderId} — Confirmación requerida`,
    html,
  });
}

export async function sendClientMemberResponseEmail(
  clientEmail: string,
  clientName: string,
  orderId: number,
  memberName: string,
  confirmed: boolean,
  deliveryDate?: string,
  message?: string
) {
  const statusText = confirmed ? "ha confirmado" : "ha rechazado";
  const statusColor = confirmed ? "#059669" : "#DC2626";
  const statusBg = confirmed ? "#ECFDF5" : "#FEF2F2";

  const html = emailShell(`
    <h1 style="color:#111827;font-size:22px;font-weight:600;margin:0 0 8px;text-align:center;">Respuesta del Miembro</h1>
    <p style="color:#6B7280;font-size:14px;text-align:center;margin:0 0 24px;">Actualización sobre tu pedido #${orderId}</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
      Hola <strong>${clientName}</strong>,<br/>
      <strong>${memberName}</strong> ${statusText} tu pedido.
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <span style="display:inline-block;background:${statusBg};color:${statusColor};padding:8px 20px;border-radius:9999px;font-size:14px;font-weight:600;">
        ${confirmed ? "Confirmado" : "Rechazado"}
      </span>
    </div>
    ${confirmed && deliveryDate ? `<table style="width:100%;border-collapse:collapse;margin:0 0 24px;"><tr><td style="padding:10px 0;color:#6B7280;font-size:14px;border-bottom:1px solid #F3F4F6;">Fecha de entrega estimada</td><td style="padding:10px 0;color:#111827;font-size:14px;font-weight:500;text-align:right;border-bottom:1px solid #F3F4F6;">${deliveryDate}</td></tr></table>` : ""}
    ${message ? `<div style="padding:16px;background:#F9FAFB;border-radius:12px;margin:0 0 24px;"><p style="color:#6B7280;font-size:12px;margin:0 0 8px;">Mensaje del miembro:</p><p style="color:#374151;font-size:14px;line-height:1.6;margin:0;">${message}</p></div>` : ""}
    ${confirmed ? `<div style="text-align:center;margin:28px 0;"><a href="${APP_URL}/dashboard/marketplace/orders/${orderId}" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:14px 40px;border-radius:9999px;font-weight:600;font-size:15px;">Revisar y Aceptar</a></div>` : ""}
  `);
  return resend.emails.send({
    from: FROM_EMAIL,
    to: clientEmail,
    subject: `Pedido #${orderId} — ${confirmed ? "Confirmado por miembro" : "Rechazado por miembro"}`,
    html,
  });
}

export async function sendMemberOrderAcceptedEmail(
  memberEmail: string,
  memberName: string,
  orderId: number,
  clientName: string,
  accepted: boolean
) {
  const statusText = accepted ? "ha aceptado las condiciones" : "ha rechazado las condiciones";
  const statusColor = accepted ? "#059669" : "#DC2626";
  const statusBg = accepted ? "#ECFDF5" : "#FEF2F2";

  const html = emailShell(`
    <h1 style="color:#111827;font-size:22px;font-weight:600;margin:0 0 8px;text-align:center;">Respuesta del Cliente</h1>
    <p style="color:#6B7280;font-size:14px;text-align:center;margin:0 0 24px;">Actualización sobre el pedido #${orderId}</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
      Hola <strong>${memberName}</strong>,<br/>
      <strong>${clientName}</strong> ${statusText} de tu pedido.
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <span style="display:inline-block;background:${statusBg};color:${statusColor};padding:8px 20px;border-radius:9999px;font-size:14px;font-weight:600;">
        ${accepted ? "Aceptado" : "Rechazado"}
      </span>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${APP_URL}/dashboard/marketplace" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:14px 40px;border-radius:9999px;font-weight:600;font-size:15px;">
        Ver mis pedidos
      </a>
    </div>
  `);
  return resend.emails.send({
    from: FROM_EMAIL,
    to: memberEmail,
    subject: `Pedido #${orderId} — ${accepted ? "Cliente aceptó" : "Cliente rechazó"}`,
    html,
  });
}
