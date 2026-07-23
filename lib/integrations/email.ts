import { sendViaGmail } from "./google-workspace";

const FROM_EMAIL =
  process.env.EMAIL_FROM || "Corazones Cruzados <lfgonzalezm0@grupocc.org>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";

/**
 * Envío de correo unificado por la **Gmail API** (cuenta corporativa grupocc.org).
 * Todas las funciones `send*` de abajo llaman a esto. (Resend se eliminó por completo.)
 */
async function deliver(opts: { from?: string; to: string | string[]; subject: string; html: string }) {
  const from = opts.from || FROM_EMAIL;
  return sendViaGmail({ from, to: opts.to, subject: opts.subject, html: opts.html });
}

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
  return deliver({
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
  return deliver({
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
  return deliver({
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
  return deliver({
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
  return deliver({
    from: FROM_EMAIL,
    to: params.email,
    subject: `Te invitaron al proyecto "${params.projectTitle}" — GCC World`,
    html,
  });
}

/**
 * Invitación genérica a crear cuenta de cliente cuando se asocia su correo a un ticket
 * (o cualquier registro). El registro ya quedó a su nombre; al crear su cuenta con este
 * mismo correo verá su historial. Best-effort.
 */
export async function sendClientInvitationEmail(params: {
  email: string;
  context: string;           // p. ej. 'un ticket', 'un servicio'
  contextTitle?: string | null;
  inviterName?: string | null;
}) {
  const url = `${APP_URL}/`;
  const who = params.inviterName ? `${escapeHtml(params.inviterName)} de ${accentStrong('GCC World')}` : accentStrong('GCC World');
  const html = emailShell(
    emailBadge('INVITACIÓN', CORP.accent) +
    emailHeading('Te registraron como cliente', 'Únete a GCC World para darle seguimiento') +
    emailParagraph(`${who} registró ${escapeHtml(params.context)} a tu nombre${params.contextTitle ? `:` : '.'}`) +
    (params.contextTitle ? emailInfoBox('DETALLE', escapeHtml(params.contextTitle)) : '') +
    emailParagraph(`Crea tu cuenta de cliente en GCC World con este mismo correo para ver el avance y recibir la facturación. Ya quedó registrado con tu correo.`) +
    emailButton(url, 'Unirme a GCC World') +
    emailNote('Si no esperabas esta invitación, puedes ignorar este correo.'),
  );
  return deliver({
    from: FROM_EMAIL,
    to: params.email,
    subject: `Te registraron como cliente en GCC World`,
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
  return deliver({ from: FROM_EMAIL, to: email, subject: "Verifica tu cuenta — GCC World", html });
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
  return deliver({
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
  const range = `${formatEmailDateTime(eventStart, MEMBER_TZ)} — ${formatEmailDateTime(eventEnd, MEMBER_TZ)}`;

  const html = emailShell(
    emailBadge(actionTitle.toUpperCase(), actionColor) +
    emailHeading(escapeHtml(eventTitle), `${escapeHtml(memberName)} registró un ${actionLabel} en su calendario.`) +
    emailInfoBox('FECHA Y HORA', range, tzNote(MEMBER_TZ, eventStart)) +
    emailButton(publicUrl, 'Ver calendario'),
  );

  return deliver({
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
  // El miembro siempre agenda en su horario (Ecuador): mostramos la propuesta en su zona.
  const range = `${formatEmailDateTime(eventStart, MEMBER_TZ)} — ${formatEmailDateTime(eventEnd, MEMBER_TZ)}`;
  const url = `${APP_URL}/dashboard/settings/calendar`;
  const html = emailShell(
    emailBadge('NUEVA PROPUESTA', CORP.warning) +
    emailHeading(escapeHtml(eventTitle), `<strong>${escapeHtml(clientName)}</strong> (${escapeHtml(clientEmail)}) te propuso un espacio en tu calendario.`) +
    emailInfoBox('FECHA Y HORA', range, tzNote(MEMBER_TZ, eventStart)) +
    emailButton(url, 'Revisar y responder') +
    emailNote(`${escapeHtml(clientName)} recibirá un correo automático con tu decisión.`, 'center'),
  );
  return deliver({
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
  /** Zona horaria que eligió el cliente al proponer (columna `timezone` del evento). */
  timezone?: string | null;
  memberId: string;
  publicToken: string | null;
  meetingUrl?: string | null;
}) {
  const { clientEmail, clientName, memberName, action, eventTitle, eventStart, eventEnd, timezone, memberId, publicToken, meetingUrl } = params;
  const accepted = action === 'accepted';
  const color = accepted ? CORP.success : CORP.danger;
  const label = accepted ? 'PROPUESTA ACEPTADA' : 'PROPUESTA RECHAZADA';
  const subject = accepted
    ? `Confirmado: ${eventTitle} con ${memberName}`
    : `Rechazada: ${eventTitle} con ${memberName}`;
  // El cliente ve la reunión en SU zona horaria (la que eligió al proponer).
  const clientTz = timezone || MEMBER_TZ;
  const range = `${formatEmailDateTime(eventStart, clientTz)} — ${formatEmailDateTime(eventEnd, clientTz)}`;
  const url = publicToken
    ? `${APP_URL}/calendario/${memberId}?token=${publicToken}`
    : `${APP_URL}/calendario/${memberId}`;

  const html = emailShell(
    emailBadge(label, color) +
    emailHeading(escapeHtml(eventTitle)) +
    emailParagraph(`Hola <strong>${escapeHtml(clientName)}</strong>,<br/>` + (accepted
      ? `<strong>${escapeHtml(memberName)}</strong> aceptó tu propuesta.`
      : `<strong>${escapeHtml(memberName)}</strong> no pudo aceptar tu propuesta en este momento.`)) +
    emailInfoBox('FECHA Y HORA', range, tzNote(clientTz, eventStart)) +
    (accepted
      ? (meetingUrl
          ? emailButton(meetingUrl, 'Unirse a la reunión (Google Meet)') +
            emailNote(`Enlace de la reunión: <a href="${meetingUrl}" style="color:${CORP.accent};">${escapeHtml(meetingUrl)}</a><br/>También recibirás la invitación de calendario con este enlace.`, 'center')
          : emailButton(url, 'Ver calendario'))
      : emailNote('Puedes intentar con otro horario desde el mismo enlace.', 'center')),
  );

  return deliver({
    from: FROM_EMAIL,
    to: clientEmail,
    subject,
    html,
  });
}

const MEMBER_TZ = 'America/Guayaquil';

/**
 * Correo de un RECORDATORIO (módulo Recordatorios). Se envía con frecuencia escalada según
 * se acerca la fecha, y un último correo cuando VENCE. Incluye título, fecha/hora, tareas
 * pendientes y un botón al módulo.
 */
export async function sendReminderEmail(params: {
  email: string;
  name?: string | null;
  title: string;
  remindAt?: string | Date | null;
  tasks?: { text: string; done?: boolean }[];
  notes?: string | null;
  link: string;
  expired?: boolean;
}) {
  const when = params.remindAt ? formatEmailDateTime(new Date(params.remindAt), MEMBER_TZ) : null;
  const pending = (params.tasks || []).filter((t) => !t.done);
  const tasksHtml = pending.length
    ? `<ul style="margin:8px 0 20px;padding-left:18px;color:${CORP.text};font-family:${FONT};font-size:13px;">${pending.map((t) => `<li style="margin:4px 0;">${escapeHtml(t.text)}</li>`).join('')}</ul>`
    : '';
  const html = emailShell(
    emailBadge(params.expired ? 'RECORDATORIO VENCIDO' : 'RECORDATORIO', params.expired ? CORP.danger : CORP.accent) +
    emailHeading(escapeHtml(params.title), params.expired ? 'Se cumplió la fecha y hora del recordatorio.' : 'Se acerca la fecha de tu recordatorio.') +
    (when ? emailInfoBox('FECHA Y HORA', when, 'Zona horaria: Ecuador (GMT-5)') : '') +
    (params.notes ? emailParagraph(escapeHtml(params.notes)) : '') +
    (tasksHtml ? emailParagraph('<strong>Tareas pendientes:</strong>') + tasksHtml : '') +
    emailButton(params.link, 'Ver recordatorio') +
    (params.expired ? emailNote('Este recordatorio ha vencido; no recibirás más correos de él.', 'center') : ''),
  );
  return deliver({
    from: FROM_EMAIL,
    to: params.email,
    subject: `${params.expired ? 'Vencido' : 'Recordatorio'}: ${params.title} — GCC World`,
    html,
  });
}

/**
 * Formatea un instante (Date UTC) en una zona horaria EXPLÍCITA, independiente de la
 * zona del servidor. Sin esto, el correo mostraba la hora local del servidor (UTC en
 * Railway), que no corresponde ni a la del miembro ni a la del cliente.
 */
function formatEmailDateTime(d: Date, timeZone: string = MEMBER_TZ): string {
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${g('day')} ${months[Number(g('month')) - 1]} ${g('year')} ${g('hour')}:${g('minute')}`;
}

/** Nombres amigables de las zonas ofrecidas al cliente en el formulario de propuesta. */
const TZ_LABELS: Record<string, string> = {
  'America/Guayaquil': 'Ecuador',
  'America/Bogota': 'Colombia',
  'America/Lima': 'Perú',
  'America/Mexico_City': 'México',
  'America/New_York': 'Nueva York',
  'America/Los_Angeles': 'Los Ángeles',
  'America/Chicago': 'Chicago',
  'America/Argentina/Buenos_Aires': 'Argentina',
  'America/Santiago': 'Chile',
  'Europe/Madrid': 'España',
  'Europe/London': 'Londres',
  'UTC': 'UTC',
};

/** Nota "Zona horaria: Ecuador (GMT-5)" para la caja FECHA Y HORA, con offset real (respeta DST). */
function tzNote(timeZone: string, at: Date): string {
  let offset = '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(at);
    offset = parts.find((x) => x.type === 'timeZoneName')?.value ?? '';
  } catch { /* si la zona no es válida, se omite el offset */ }
  const name = TZ_LABELS[timeZone] || timeZone;
  return offset ? `Zona horaria: ${name} (${offset})` : `Zona horaria: ${name}`;
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
  return deliver({ from: FROM_EMAIL, to: email, subject: "Restablecer contraseña — GCC World", html });
}

/** Envía la COTIZACIÓN al cliente externo (enlace de solo lectura + agente + aceptar/rechazar). */
export async function sendQuoteToClient(params: {
  email: string; projectTitle: string; total: number; url: string; responsibleName?: string;
}) {
  const totalFmt = `$${params.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const html = emailShell(
    emailBadge('COTIZACIÓN', CORP.accent) +
    emailHeading('Tienes una cotización lista', params.responsibleName ? `Preparada por ${escapeHtml(params.responsibleName)}` : 'Revisa el detalle de tu proyecto') +
    emailParagraph(`Preparamos la cotización de tu proyecto:`) +
    emailInfoBox('PROYECTO', escapeHtml(params.projectTitle), `Total estimado: ${accentStrong(totalFmt)}`) +
    emailParagraph(`Abre el enlace para ver el detalle (requerimientos, costos y tiempos) y ${accentStrong('aceptarla o rechazarla')}. Si el costo no se ajusta a lo que tienes disponible, usa la opción ${accentStrong('“Modificar presupuesto”')} para indicarnos tu monto: el responsable ajustará la cotización y te la compartirá de nuevo.`) +
    emailButton(params.url, 'Ver mi cotización') +
    emailNote('Este enlace es personal y puede expirar. Si no reconoces este mensaje, ignóralo.'),
  );
  return deliver({ to: params.email, subject: `Tu cotización — ${params.projectTitle}`, html });
}

/** Avisa al responsable (miembro) que el cliente aceptó o rechazó la cotización. */
export async function sendQuoteDecisionToResponsible(params: {
  email: string; name?: string; projectTitle: string; action: 'accepted' | 'rejected'; clientEmail?: string; url: string;
}) {
  const accepted = params.action === 'accepted';
  const html = emailShell(
    emailBadge(accepted ? 'COTIZACIÓN ACEPTADA' : 'COTIZACIÓN RECHAZADA', accepted ? CORP.success : CORP.danger) +
    emailHeading(accepted ? 'El cliente aceptó la cotización' : 'El cliente rechazó la cotización', escapeHtml(params.projectTitle)) +
    emailParagraph(`${params.name ? `Hola ${accentStrong(escapeHtml(params.name))}, ` : ''}el cliente${params.clientEmail ? ` (${escapeHtml(params.clientEmail)})` : ''} ${accepted ? `${accentStrong('aceptó')} la cotización. Ya puedes convertirla en proyecto y comenzar.` : `${accentStrong('rechazó')} la cotización. Puedes revisarla, ajustarla con el agente y volver a compartirla.`}`) +
    emailButton(params.url, accepted ? 'Ver el proyecto' : 'Revisar la cotización'),
  );
  return deliver({ to: params.email, subject: `${accepted ? 'Aceptada' : 'Rechazada'}: ${params.projectTitle}`, html });
}

/** Envía al CLIENTE el PDF de la cotización ACEPTADA como adjunto (correo con tema GCC World). */
export async function sendAcceptedQuoteToClient(params: {
  email: string | string[]; projectTitle: string; total: number; responsibleName?: string; pdf: Buffer;
}) {
  const totalFmt = `$${Number(params.total).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const html = emailShell(
    emailBadge('COTIZACIÓN ACEPTADA', CORP.success) +
    emailHeading('¡Gracias! Tu cotización fue aceptada', escapeHtml(params.projectTitle)) +
    emailParagraph('Adjuntamos el PDF con el detalle completo de la cotización aceptada: requerimientos, costos, total y las notas adicionales.') +
    emailInfoBox('PROYECTO', escapeHtml(params.projectTitle), `Total: ${accentStrong(totalFmt)}`) +
    emailParagraph(params.responsibleName
      ? `Tu responsable ${accentStrong(escapeHtml(params.responsibleName))} se pondrá en contacto para los siguientes pasos.`
      : 'Nos pondremos en contacto contigo para los siguientes pasos.') +
    emailNote('Conserva este documento como respaldo de la cotización aceptada.'),
  );
  const safeName = (params.projectTitle || 'GCC').replace(/[^\w\-]+/g, '_').slice(0, 40) || 'GCC';
  return sendViaGmail({
    from: FROM_EMAIL,
    to: params.email,
    bcc: 'lfgonzalezm0@grupocc.org',
    subject: `Cotización aceptada — ${params.projectTitle}`,
    html,
    attachments: [{ filename: `Cotizacion-${safeName}.pdf`, content: params.pdf, contentType: 'application/pdf' }],
  });
}

/* ── Helpers de diseño reusables para correos construidos en otras rutas
 *    (facturas, suscripciones, campañas, tickets, proyectos, proformas). Exportados
 *    para que TODOS los correos compartan el mismo tema corporativo. ─────────────── */
export const EMAIL_THEME = { ...CORP, font: FONT } as const;
export { emailShell, emailHeading, emailParagraph, emailNote, emailButton, emailBadge, emailInfoBox, accentStrong };
