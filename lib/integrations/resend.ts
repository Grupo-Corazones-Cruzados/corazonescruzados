import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY || "");
  return _resend;
}

const FROM_EMAIL =
  process.env.EMAIL_FROM || "GCC World <noreply@gccworld.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";

function emailShell(content: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:'Courier New',monospace;background-color:#0A0E17;margin:0;padding:40px 20px;color:#e5e5e5;">
<div style="max-width:560px;margin:0 auto;">
  <div style="text-align:center;margin-bottom:24px;">
    <span style="font-family:'Courier New',monospace;font-size:24px;font-weight:bold;color:#7B5FBF;letter-spacing:0.1em;">GCC WORLD</span>
  </div>
  <div style="background:#131923;overflow:hidden;border:2px solid #2a2a3a;">
    <div style="height:3px;background:#4B2D8E;"></div>
    <div style="padding:36px 32px;">${content}</div>
    <div style="padding:20px 32px;background:#0f1320;border-top:1px solid #2a2a3a;">
      <p style="color:#737373;font-size:12px;margin:0;text-align:center;">
        Este correo fue enviado por GCC World.
      </p>
    </div>
  </div>
  <p style="text-align:center;margin-top:24px;color:#737373;font-size:11px;">
    &copy; ${new Date().getFullYear()} GCC World. Todos los derechos reservados.
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
    <h1 style="color:#e5e5e5;font-size:22px;font-weight:600;margin:0 0 8px;text-align:center;">Verifica tu cuenta</h1>
    <p style="color:#94A3B8;font-size:14px;text-align:center;margin:0 0 24px;">Solo un paso m&aacute;s para comenzar</p>
    <p style="color:#CBD5E1;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Hola${name ? ` <strong>${name}</strong>` : ""},<br/>
      Gracias por registrarte en <strong style="color:#7B5FBF;">GCC World</strong>.
      Haz clic en el bot&oacute;n para activar tu cuenta:
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:14px 40px;font-weight:600;font-size:15px;border:2px solid #7B5FBF;">
        Verificar mi cuenta
      </a>
    </div>
    <p style="color:#737373;font-size:12px;margin:24px 0 0;">Este enlace expira en 24 horas.</p>
  `);
  return getResend().emails.send({ from: FROM_EMAIL, to: email, subject: "Verifica tu cuenta — GCC World", html });
}

export type CalendarEmailAction = 'created' | 'updated' | 'deleted';

export async function sendCalendarSubscribeVerification(
  email: string,
  token: string,
  memberName: string,
) {
  const url = `${APP_URL}/calendario/confirmar?token=${token}`;
  const html = emailShell(`
    <h1 style="color:#e5e5e5;font-size:22px;font-weight:600;margin:0 0 8px;text-align:center;">Confirma tu suscripci&oacute;n</h1>
    <p style="color:#CBD5E1;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Recibiremos tu correo para notificarte de cambios en el calendario de
      <strong style="color:#7B5FBF;">${escapeHtml(memberName)}</strong>.
      Confirma este correo para activar las notificaciones:
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:14px 40px;font-weight:600;font-size:15px;border:2px solid #7B5FBF;">
        Confirmar suscripci&oacute;n
      </a>
    </div>
    <p style="color:#737373;font-size:12px;margin:24px 0 0;">Si no solicitaste esta suscripci&oacute;n, ignora este correo.</p>
  `);
  return getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Confirma tu suscripci\u00F3n al calendario de ${memberName}`,
    html,
  });
}

export async function sendCalendarEventNotification(params: {
  email: string;
  memberName: string;
  action: CalendarEmailAction;
  eventTitle: string;
  eventStart: Date;
  eventEnd: Date;
  publicUrl: string;
}) {
  const { email, memberName, action, eventTitle, eventStart, eventEnd, publicUrl } = params;
  const actionLabel = action === 'created' ? 'nuevo evento' : action === 'updated' ? 'evento actualizado' : 'evento eliminado';
  const actionTitle = action === 'created' ? 'Nuevo evento' : action === 'updated' ? 'Evento actualizado' : 'Evento eliminado';
  const actionColor = action === 'deleted' ? '#ef4444' : '#7B5FBF';
  const range = `${formatEmailDateTime(eventStart)} — ${formatEmailDateTime(eventEnd)}`;

  const html = emailShell(`
    <div style="text-align:center;margin-bottom:8px;">
      <span style="display:inline-block;padding:4px 10px;background:${actionColor}25;color:${actionColor};font-size:11px;font-weight:600;letter-spacing:0.05em;border:1px solid ${actionColor}80;">
        ${actionTitle.toUpperCase()}
      </span>
    </div>
    <h1 style="color:#e5e5e5;font-size:20px;font-weight:600;margin:12px 0 8px;text-align:center;">${escapeHtml(eventTitle)}</h1>
    <p style="color:#94A3B8;font-size:13px;text-align:center;margin:0 0 24px;">
      ${escapeHtml(memberName)} registr&oacute; un ${actionLabel} en su calendario.
    </p>
    <div style="background:#0f1320;border:1px solid #2a2a3a;padding:16px 20px;margin:0 0 24px;">
      <p style="color:#737373;font-size:11px;margin:0 0 4px;">FECHA Y HORA</p>
      <p style="color:#CBD5E1;font-size:14px;margin:0;">${range}</p>
      <p style="color:#737373;font-size:10px;margin:8px 0 0;">Zona horaria: Am&eacute;rica/Guayaquil (GMT-5)</p>
    </div>
    <div style="text-align:center;margin:24px 0;">
      <a href="${publicUrl}" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:12px 32px;font-weight:600;font-size:14px;border:2px solid #7B5FBF;">
        Ver calendario
      </a>
    </div>
  `);

  return getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `${actionTitle}: ${eventTitle} — ${memberName}`,
    html,
  });
}

export async function sendProposalReceivedToMember(params: {
  memberEmail: string;
  memberName: string;
  clientName: string;
  clientEmail: string;
  eventTitle: string;
  eventStart: Date;
  eventEnd: Date;
}) {
  const { memberEmail, memberName, clientName, clientEmail, eventTitle, eventStart, eventEnd } = params;
  const range = `${formatEmailDateTime(eventStart)} — ${formatEmailDateTime(eventEnd)}`;
  const url = `${APP_URL}/dashboard/settings/calendar`;
  const html = emailShell(`
    <div style="text-align:center;margin-bottom:8px;">
      <span style="display:inline-block;padding:4px 10px;background:#f59e0b25;color:#f59e0b;font-size:11px;font-weight:600;letter-spacing:0.05em;border:1px solid #f59e0b80;">
        NUEVA PROPUESTA
      </span>
    </div>
    <h1 style="color:#e5e5e5;font-size:20px;font-weight:600;margin:12px 0 8px;text-align:center;">${escapeHtml(eventTitle)}</h1>
    <p style="color:#94A3B8;font-size:13px;text-align:center;margin:0 0 24px;">
      <strong>${escapeHtml(clientName)}</strong> (${escapeHtml(clientEmail)}) te propuso un espacio en tu calendario.
    </p>
    <div style="background:#0f1320;border:1px solid #2a2a3a;padding:16px 20px;margin:0 0 24px;">
      <p style="color:#737373;font-size:11px;margin:0 0 4px;">FECHA Y HORA</p>
      <p style="color:#CBD5E1;font-size:14px;margin:0;">${range}</p>
    </div>
    <div style="text-align:center;margin:24px 0;">
      <a href="${url}" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:12px 32px;font-weight:600;font-size:14px;border:2px solid #7B5FBF;">
        Revisar y responder
      </a>
    </div>
    <p style="color:#737373;font-size:12px;text-align:center;margin:16px 0 0;">
      ${escapeHtml(clientName)} recibir&aacute; un correo autom&aacute;tico con tu decisi&oacute;n.
    </p>
  `);
  return getResend().emails.send({
    from: FROM_EMAIL,
    to: memberEmail,
    subject: `Propuesta de ${clientName}: ${eventTitle}`,
    html,
  });
}

export async function sendProposalDecisionToClient(params: {
  clientEmail: string;
  clientName: string;
  memberName: string;
  action: 'accepted' | 'rejected';
  eventTitle: string;
  eventStart: Date;
  eventEnd: Date;
  memberId: string;
  publicToken: string | null;
}) {
  const { clientEmail, clientName, memberName, action, eventTitle, eventStart, eventEnd, memberId, publicToken } = params;
  const accepted = action === 'accepted';
  const color = accepted ? '#22c55e' : '#ef4444';
  const label = accepted ? 'PROPUESTA ACEPTADA' : 'PROPUESTA RECHAZADA';
  const subject = accepted
    ? `Confirmado: ${eventTitle} con ${memberName}`
    : `Rechazada: ${eventTitle} con ${memberName}`;
  const range = `${formatEmailDateTime(eventStart)} — ${formatEmailDateTime(eventEnd)}`;
  const url = publicToken
    ? `${APP_URL}/calendario/${memberId}?token=${publicToken}`
    : `${APP_URL}/calendario/${memberId}`;

  const html = emailShell(`
    <div style="text-align:center;margin-bottom:8px;">
      <span style="display:inline-block;padding:4px 10px;background:${color}25;color:${color};font-size:11px;font-weight:600;letter-spacing:0.05em;border:1px solid ${color}80;">
        ${label}
      </span>
    </div>
    <h1 style="color:#e5e5e5;font-size:20px;font-weight:600;margin:12px 0 8px;text-align:center;">${escapeHtml(eventTitle)}</h1>
    <p style="color:#CBD5E1;font-size:14px;line-height:1.6;margin:0 0 20px;">
      Hola <strong>${escapeHtml(clientName)}</strong>,<br/>
      ${accepted
        ? `<strong>${escapeHtml(memberName)}</strong> acept&oacute; tu propuesta.`
        : `<strong>${escapeHtml(memberName)}</strong> no pudo aceptar tu propuesta en este momento.`}
    </p>
    <div style="background:#0f1320;border:1px solid #2a2a3a;padding:16px 20px;margin:0 0 24px;">
      <p style="color:#737373;font-size:11px;margin:0 0 4px;">FECHA Y HORA</p>
      <p style="color:#CBD5E1;font-size:14px;margin:0;">${range}</p>
    </div>
    ${accepted ? `
    <div style="text-align:center;margin:24px 0;">
      <a href="${url}" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:12px 32px;font-weight:600;font-size:14px;border:2px solid #7B5FBF;">
        Ver calendario
      </a>
    </div>` : `
    <p style="color:#737373;font-size:12px;text-align:center;margin:16px 0 0;">
      Puedes intentar con otro horario desde el mismo enlace.
    </p>`}
  `);

  return getResend().emails.send({
    from: FROM_EMAIL,
    to: clientEmail,
    subject,
    html,
  });
}

function formatEmailDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  name?: string
) {
  const url = `${APP_URL}/auth/reset-password?token=${token}`;
  const html = emailShell(`
    <h1 style="color:#e5e5e5;font-size:22px;font-weight:600;margin:0 0 8px;text-align:center;">Restablecer contrase&ntilde;a</h1>
    <p style="color:#CBD5E1;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Hola${name ? ` <strong>${name}</strong>` : ""},<br/>
      Recibimos una solicitud para restablecer tu contrase&ntilde;a.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:14px 40px;font-weight:600;font-size:15px;border:2px solid #7B5FBF;">
        Restablecer contrase&ntilde;a
      </a>
    </div>
    <p style="color:#737373;font-size:12px;margin:24px 0 0;">Este enlace expira en 1 hora. Si no solicitaste esto, ignora este correo.</p>
  `);
  return getResend().emails.send({ from: FROM_EMAIL, to: email, subject: "Restablecer contraseña — GCC World", html });
}
