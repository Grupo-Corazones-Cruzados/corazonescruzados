import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY || "");
  return _resend;
}

const FROM_EMAIL =
  process.env.EMAIL_FROM || "GCC World <noreply@gccworld.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";

/* ── Diseño de correos = tema corporativo `.corp` del /dashboard ──────────────────
 * Fondo claro, tarjeta blanca, tipografía Segoe UI (seria, NO videojuego), acento
 * violeta corporativo. Los tokens replican `app/globals.css` (.corp). Todos los
 * correos se componen con los helpers de abajo para que se vean idénticos. */
const CORP = {
  bg: '#faf9f8',        // fondo de página (digi-dark)
  card: '#ffffff',      // tarjeta (digi-card)
  border: '#e1dfdd',    // borde neutro (digi-border)
  text: '#242424',      // texto primario (digi-text)
  muted: '#605e5c',     // texto secundario (digi-muted)
  soft: '#8a8886',      // texto terciario / pies
  accent: '#4B2D8E',    // acento (accent)
  success: '#107c10',
  danger: '#d13438',
  warning: '#8a6900',
} as const;
const FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif";

/** Envoltorio base de todos los correos: cabecera "GCC World", tarjeta y pie. */
function emailShell(content: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:${FONT};background-color:${CORP.bg};margin:0;padding:32px 16px;color:${CORP.text};-webkit-font-smoothing:antialiased;">
<div style="max-width:560px;margin:0 auto;">
  <div style="text-align:center;margin-bottom:20px;">
    <span style="font-family:${FONT};font-size:20px;font-weight:700;color:${CORP.accent};">GCC World</span>
  </div>
  <div style="background:${CORP.card};border:1px solid ${CORP.border};border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <div style="height:3px;background:${CORP.accent};"></div>
    <div style="padding:32px 32px;">${content}</div>
    <div style="padding:16px 32px;background:${CORP.bg};border-top:1px solid ${CORP.border};">
      <p style="color:${CORP.soft};font-size:12px;margin:0;text-align:center;font-family:${FONT};">Este correo fue enviado por GCC World.</p>
    </div>
  </div>
  <p style="text-align:center;margin-top:20px;color:${CORP.soft};font-size:11px;font-family:${FONT};">&copy; ${new Date().getFullYear()} GCC World. Todos los derechos reservados.</p>
</div></body></html>`;
}

/** Título (+ subtítulo opcional) centrado. */
function emailHeading(title: string, subtitle?: string): string {
  return `<h1 style="color:${CORP.text};font-size:22px;font-weight:600;margin:0 0 ${subtitle ? '6px' : '18px'};text-align:center;font-family:${FONT};">${title}</h1>` +
    (subtitle ? `<p style="color:${CORP.muted};font-size:14px;text-align:center;margin:0 0 24px;font-family:${FONT};">${subtitle}</p>` : '');
}

/** Párrafo de cuerpo. */
function emailParagraph(html: string, align: 'left' | 'center' = 'left'): string {
  return `<p style="color:${CORP.text};font-size:15px;line-height:1.6;margin:0 0 20px;text-align:${align};font-family:${FONT};">${html}</p>`;
}

/** Nota discreta al pie del contenido. */
function emailNote(html: string, align: 'left' | 'center' = 'left'): string {
  return `<p style="color:${CORP.soft};font-size:12px;line-height:1.5;margin:24px 0 0;text-align:${align};font-family:${FONT};">${html}</p>`;
}

/** Texto en negrita con el color de acento (para destacar dentro de un párrafo). */
function accentStrong(text: string): string {
  return `<strong style="color:${CORP.accent};">${text}</strong>`;
}

/** Botón de acción (primario acento / peligro rojo). */
function emailButton(url: string, label: string, variant: 'primary' | 'danger' = 'primary'): string {
  const bg = variant === 'danger' ? CORP.danger : CORP.accent;
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${url}" style="display:inline-block;background:${bg};color:#ffffff;text-decoration:none;padding:12px 32px;font-weight:600;font-size:15px;border-radius:8px;font-family:${FONT};">${label}</a>
  </div>`;
}

/** Píldora de estado (badge) con color semántico. */
function emailBadge(label: string, color: string): string {
  return `<div style="text-align:center;margin-bottom:12px;">
    <span style="display:inline-block;padding:5px 12px;background:${color}14;color:${color};font-size:11px;font-weight:700;letter-spacing:0.04em;border:1px solid ${color}55;border-radius:6px;font-family:${FONT};">${label}</span>
  </div>`;
}

/** Caja de dato etiquetado (p. ej. FECHA Y HORA). */
function emailInfoBox(label: string, value: string, extra?: string): string {
  return `<div style="background:${CORP.bg};border:1px solid ${CORP.border};border-radius:8px;padding:14px 18px;margin:0 0 24px;">
    <p style="color:${CORP.soft};font-size:11px;margin:0 0 4px;font-weight:600;letter-spacing:0.03em;font-family:${FONT};">${label}</p>
    <p style="color:${CORP.text};font-size:14px;margin:0;font-family:${FONT};">${value}</p>` +
    (extra ? `<p style="color:${CORP.soft};font-size:10px;margin:8px 0 0;font-family:${FONT};">${extra}</p>` : '') +
  `</div>`;
}

/** Caja monoespaciada para un código o contraseña (la única parte que usa monoespaciado, por legibilidad). */
function emailCodeBox(value: string, letterSpacing = '0.5em', fontSize = 30): string {
  return `<div style="text-align:center;margin:20px 0;">
    <div style="display:inline-block;background:${CORP.bg};color:${CORP.text};padding:16px 32px;font-family:'Courier New',monospace;font-size:${fontSize}px;letter-spacing:${letterSpacing};font-weight:700;border:1px solid ${CORP.border};border-radius:8px;">${value}</div>
  </div>`;
}

export async function sendCharacterRecoveryCodeEmail(
  email: string,
  code: string,
  alias: string,
) {
  const html = emailShell(
    emailHeading('Recupera tu cuenta', 'Estás iniciando sesión en un nuevo dispositivo') +
    emailParagraph(`Hola ${accentStrong(escapeHtml(alias))},<br/>Usa este código para confirmar que eres tú e iniciar sesión desde este dispositivo. El código caduca en 15 minutos.`) +
    emailCodeBox(code) +
    emailNote('Si no fuiste tú, ignora este correo. Tu contraseña no ha cambiado.'),
  );
  return getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Código de acceso — GCC World',
    html,
  });
}

export async function sendCharacterVerificationEmail(
  email: string,
  token: string,
  alias: string,
) {
  const url = `${APP_URL}/api/character/auth/verify?token=${token}`;
  const html = emailShell(
    emailHeading('Confirma tu cuenta', 'Para guardar tu progreso en GCC World') +
    emailParagraph(`Hola ${accentStrong(escapeHtml(alias))},<br/>Recibimos tu registro en el juego. Confirma este correo para activar tu cuenta y poder seguir jugando con tu personaje. Hasta que confirmes, tu contraseña no será válida.`) +
    emailButton(url, 'Confirmar mi cuenta') +
    emailNote('Este enlace expira en 24 horas. Si no fuiste tú, puedes ignorar este correo.'),
  );
  return getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Confirma tu cuenta — GCC World',
    html,
  });
}

export async function sendCandidateProposalVerificationEmail(
  email: string,
  token: string,
) {
  const url = `${APP_URL}/api/candidate/verify?token=${token}`;
  const html = emailShell(
    emailHeading('Verifica tu correo', 'Tu postulación al Grupo Corazones Cruzados') +
    emailParagraph(`Recibimos tu postulación como candidato. Confirma este correo para validarlo. Tu propuesta quedará ${accentStrong('en espera de aprobación')} por parte del administrador del proyecto. Te avisaremos cuando sea aprobada.`) +
    emailButton(url, 'Verificar mi correo') +
    emailNote('Si no fuiste tú quien se postuló, puedes ignorar este correo.'),
  );
  return getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Verifica tu correo — Postulación GCC',
    html,
  });
}

export async function sendCandidateApprovalEmail(email: string) {
  const url = `${APP_URL}/`;
  const html = emailShell(
    emailHeading('¡Tu postulación fue aprobada!', 'Bienvenido al Grupo Corazones Cruzados') +
    emailParagraph(`Felicidades, fuiste aprobado como candidato. Para completar tu ingreso, vuelve al sitio, pulsa ${accentStrong('"Entrar"')} y continúa con tu postulación aprobada: ahí ${accentStrong('crearás tu cuenta')} definiendo tu contraseña y tus datos.`) +
    emailButton(url, 'Ir al sitio y continuar') +
    emailNote('Hasta que completes tu cuenta, tu postulación queda como una solicitud aprobada; no necesitas ninguna contraseña temporal.'),
  );
  return getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: '¡Postulación aprobada! — GCC World',
    html,
  });
}

/**
 * Invitación a un CLIENTE (por email) a unirse al sistema porque se le asignó un proyecto.
 * El proyecto queda registrado con su correo aunque el cliente aún no tenga cuenta; este
 * correo lo invita a crear una para dar seguimiento. Best-effort (no bloquea la creación).
 */
export async function sendProjectClientInvitationEmail(params: {
  email: string;
  projectTitle: string;
  inviterName?: string | null;
}) {
  const url = `${APP_URL}/`;
  const who = params.inviterName ? `${escapeHtml(params.inviterName)} de ${accentStrong('GCC World')}` : accentStrong('GCC World');
  const html = emailShell(
    emailBadge('INVITACIÓN A UN PROYECTO', CORP.accent) +
    emailHeading('Te invitaron a un proyecto', 'Únete a GCC World para darle seguimiento') +
    emailParagraph(`${who} creó un proyecto a tu nombre:`) +
    emailInfoBox('PROYECTO', escapeHtml(params.projectTitle)) +
    emailParagraph(`Crea tu cuenta de cliente en GCC World para ver el avance, aprobar la proforma y recibir la facturación. El proyecto ya quedó registrado con este correo.`) +
    emailButton(url, 'Unirme a GCC World') +
    emailNote('Si no esperabas esta invitación, puedes ignorar este correo.'),
  );
  return getResend().emails.send({
    from: FROM_EMAIL,
    to: params.email,
    subject: `Te invitaron al proyecto "${params.projectTitle}" — GCC World`,
    html,
  });
}

export async function sendVerificationEmail(
  email: string,
  token: string,
  name?: string
) {
  const url = `${APP_URL}/auth/verify?token=${token}`;
  const html = emailShell(
    emailHeading('Verifica tu cuenta', 'Solo un paso más para comenzar') +
    emailParagraph(`Hola${name ? ` <strong>${escapeHtml(name)}</strong>` : ''},<br/>Gracias por registrarte en ${accentStrong('GCC World')}. Haz clic en el botón para activar tu cuenta:`) +
    emailButton(url, 'Verificar mi cuenta') +
    emailNote('Este enlace expira en 24 horas.'),
  );
  return getResend().emails.send({ from: FROM_EMAIL, to: email, subject: "Verifica tu cuenta — GCC World", html });
}

export type CalendarEmailAction = 'created' | 'updated' | 'deleted';

export async function sendCalendarSubscribeVerification(
  email: string,
  token: string,
  memberName: string,
) {
  const url = `${APP_URL}/calendario/confirmar?token=${token}`;
  const html = emailShell(
    emailHeading('Confirma tu suscripción') +
    emailParagraph(`Recibiremos tu correo para notificarte de cambios en el calendario de ${accentStrong(escapeHtml(memberName))}. Confirma este correo para activar las notificaciones:`) +
    emailButton(url, 'Confirmar suscripción') +
    emailNote('Si no solicitaste esta suscripción, ignora este correo.'),
  );
  return getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Confirma tu suscripción al calendario de ${memberName}`,
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
  const actionColor = action === 'deleted' ? CORP.danger : CORP.accent;
  const range = `${formatEmailDateTime(eventStart)} — ${formatEmailDateTime(eventEnd)}`;

  const html = emailShell(
    emailBadge(actionTitle.toUpperCase(), actionColor) +
    emailHeading(escapeHtml(eventTitle), `${escapeHtml(memberName)} registró un ${actionLabel} en su calendario.`) +
    emailInfoBox('FECHA Y HORA', range, 'Zona horaria: América/Guayaquil (GMT-5)') +
    emailButton(publicUrl, 'Ver calendario'),
  );

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
  const html = emailShell(
    emailBadge('NUEVA PROPUESTA', CORP.warning) +
    emailHeading(escapeHtml(eventTitle), `<strong>${escapeHtml(clientName)}</strong> (${escapeHtml(clientEmail)}) te propuso un espacio en tu calendario.`) +
    emailInfoBox('FECHA Y HORA', range) +
    emailButton(url, 'Revisar y responder') +
    emailNote(`${escapeHtml(clientName)} recibirá un correo automático con tu decisión.`, 'center'),
  );
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
  const color = accepted ? CORP.success : CORP.danger;
  const label = accepted ? 'PROPUESTA ACEPTADA' : 'PROPUESTA RECHAZADA';
  const subject = accepted
    ? `Confirmado: ${eventTitle} con ${memberName}`
    : `Rechazada: ${eventTitle} con ${memberName}`;
  const range = `${formatEmailDateTime(eventStart)} — ${formatEmailDateTime(eventEnd)}`;
  const url = publicToken
    ? `${APP_URL}/calendario/${memberId}?token=${publicToken}`
    : `${APP_URL}/calendario/${memberId}`;

  const html = emailShell(
    emailBadge(label, color) +
    emailHeading(escapeHtml(eventTitle)) +
    emailParagraph(`Hola <strong>${escapeHtml(clientName)}</strong>,<br/>` + (accepted
      ? `<strong>${escapeHtml(memberName)}</strong> aceptó tu propuesta.`
      : `<strong>${escapeHtml(memberName)}</strong> no pudo aceptar tu propuesta en este momento.`)) +
    emailInfoBox('FECHA Y HORA', range) +
    (accepted
      ? emailButton(url, 'Ver calendario')
      : emailNote('Puedes intentar con otro horario desde el mismo enlace.', 'center')),
  );

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
  const html = emailShell(
    emailHeading('Restablecer contraseña') +
    emailParagraph(`Hola${name ? ` <strong>${escapeHtml(name)}</strong>` : ''},<br/>Recibimos una solicitud para restablecer tu contraseña.`) +
    emailButton(url, 'Restablecer contraseña') +
    emailNote('Este enlace expira en 1 hora. Si no solicitaste esto, ignora este correo.'),
  );
  return getResend().emails.send({ from: FROM_EMAIL, to: email, subject: "Restablecer contraseña — GCC World", html });
}

/* ── Helpers de diseño reusables para correos construidos en otras rutas
 *    (facturas, suscripciones, campañas, tickets, proyectos, proformas). Exportados
 *    para que TODOS los correos compartan el mismo tema corporativo. ─────────────── */
export const EMAIL_THEME = { ...CORP, font: FONT } as const;
export { emailShell, emailHeading, emailParagraph, emailNote, emailButton, emailBadge, emailInfoBox, accentStrong };
