import path from 'path';
import fs from 'fs';
import { randomBytes } from 'crypto';
import { google } from 'googleapis';

// Tipo del cliente JWT tal como lo produce `googleapis` (evita el conflicto con la
// copia top-level de google-auth-library, que tiene tipos ligeramente distintos).
type JwtClient = InstanceType<typeof google.auth.JWT>;

/**
 * Integración con Google Workspace de GCC (dominio grupocc.org) vía una service
 * account con DELEGACIÓN DE TODO EL DOMINIO que impersona a la cuenta organizadora
 * (GOOGLE_WORKSPACE_ORGANIZER). Se usa para:
 *   - Enviar correo por la **Gmail API** (reemplaza a Resend).
 *   - Crear reuniones **Google Meet** (Calendar API) al aceptar una propuesta.
 *
 * La clave privada JSON de la service account se carga desde:
 *   - `GOOGLE_SA_KEY`      → el JSON completo como string (producción/Railway), o
 *   - `GOOGLE_SA_KEY_PATH` → ruta a un archivo (local; por defecto data/google-sa.json, gitignored).
 * NUNCA se versiona en el repo.
 */

const ORGANIZER = process.env.GOOGLE_WORKSPACE_ORGANIZER || '';

const SCOPE_GMAIL = 'https://www.googleapis.com/auth/gmail.send';
const SCOPE_CALENDAR = 'https://www.googleapis.com/auth/calendar';
const SCOPE_MEET = 'https://www.googleapis.com/auth/meetings.space.created';
const SCOPE_MEET_READONLY = 'https://www.googleapis.com/auth/meetings.space.readonly';
const SCOPE_DIRECTORY = 'https://www.googleapis.com/auth/admin.directory.user';

// Unidad organizativa donde viven las cuentas de candidatos/miembros (para excluirla de
// la asignación automática de licencias → cuentas gratis Cloud Identity, cuando aplique).
export const CANDIDATES_OU = '/Candidatos';

type SAKey = { client_email: string; private_key: string };

let _key: SAKey | null = null;
let _keyLoaded = false;

function loadKey(): SAKey | null {
  if (_keyLoaded) return _key;
  _keyLoaded = true;
  try {
    const raw = process.env.GOOGLE_SA_KEY;
    if (raw && raw.trim().startsWith('{')) {
      const k = JSON.parse(raw);
      _key = k?.client_email && k?.private_key ? k : null;
      return _key;
    }
    const p = process.env.GOOGLE_SA_KEY_PATH;
    if (p) {
      const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
      if (fs.existsSync(abs)) {
        const k = JSON.parse(fs.readFileSync(abs, 'utf8'));
        _key = k?.client_email && k?.private_key ? k : null;
        return _key;
      }
    }
  } catch (e: any) {
    console.error('Google SA key load error:', e?.message);
  }
  _key = null;
  return _key;
}

/** True si hay clave + cuenta organizadora configuradas (para poder usar Gmail/Meet). */
export function isGoogleWorkspaceConfigured(): boolean {
  return !!ORGANIZER && !!loadKey();
}

const _jwtCache = new Map<string, JwtClient>();

function getAuth(scopes: string[]): JwtClient {
  const key = loadKey();
  if (!key) throw new Error('Google Workspace no configurado (falta la clave de service account)');
  if (!ORGANIZER) throw new Error('Falta GOOGLE_WORKSPACE_ORGANIZER');
  const cacheKey = scopes.join(' ');
  const cached = _jwtCache.get(cacheKey);
  if (cached) return cached;
  const jwt = new google.auth.JWT({ email: key.client_email, key: key.private_key, scopes, subject: ORGANIZER });
  _jwtCache.set(cacheKey, jwt);
  return jwt;
}

// RFC 2047 para cabeceras con caracteres no ASCII (acentos, em-dash…).
function encodeHeader(s: string): string {
  return /[^\x00-\x7F]/.test(s)
    ? `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`
    : s;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface GmailAttachment {
  filename: string;
  /** Bytes del adjunto: Buffer o string base64. Alternativamente usar `path` (URL). */
  content?: Buffer | string;
  /** URL a descargar como adjunto (si no se pasa `content`). */
  path?: string;
  contentType?: string;
}

/** Envía un correo HTML por la Gmail API (con cc/bcc y adjuntos opcionales). */
export async function sendViaGmail(opts: {
  from?: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  attachments?: GmailAttachment[];
}): Promise<{ id: string | null }> {
  const auth = getAuth([SCOPE_GMAIL]);
  const gmail = google.gmail({ version: 'v1', auth });
  const from = opts.from || ORGANIZER;
  const list = (v?: string | string[]) => (Array.isArray(v) ? v.join(', ') : (v || ''));

  const fromHeader = (() => {
    const m = /^(.*)<(.+)>\s*$/.exec(from);
    if (m) return `${encodeHeader(m[1].trim())} <${m[2].trim()}>`;
    return from;
  })();

  // Resolver adjuntos (content Buffer/base64 o path=URL a descargar) → base64.
  const atts: { filename: string; b64: string; contentType: string }[] = [];
  for (const a of opts.attachments || []) {
    let buf: Buffer | null = null;
    if (a.content) buf = Buffer.isBuffer(a.content) ? a.content : Buffer.from(String(a.content), 'base64');
    else if (a.path) { const r = await fetch(a.path); buf = Buffer.from(await r.arrayBuffer()); }
    if (!buf) continue;
    atts.push({ filename: a.filename, b64: buf.toString('base64'), contentType: a.contentType || 'application/octet-stream' });
  }

  const headers =
    `From: ${fromHeader}\r\n` +
    `To: ${list(opts.to)}\r\n` +
    (opts.cc ? `Cc: ${list(opts.cc)}\r\n` : '') +
    (opts.bcc ? `Bcc: ${list(opts.bcc)}\r\n` : '') +
    `Subject: ${encodeHeader(opts.subject)}\r\n` +
    `MIME-Version: 1.0\r\n`;

  let mime: string;
  const htmlPart =
    `Content-Type: text/html; charset=utf-8\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    Buffer.from(opts.html, 'utf8').toString('base64');

  if (atts.length === 0) {
    mime = headers + htmlPart;
  } else {
    const boundary = `gcc_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    let body = headers + `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
    body += `--${boundary}\r\n` + htmlPart + `\r\n`;
    for (const a of atts) {
      body += `--${boundary}\r\n` +
        `Content-Type: ${a.contentType}; name="${a.filename}"\r\n` +
        `Content-Transfer-Encoding: base64\r\n` +
        `Content-Disposition: attachment; filename="${a.filename}"\r\n\r\n` +
        (a.b64.match(/.{1,76}/g)?.join('\r\n') || a.b64) + `\r\n`;
    }
    body += `--${boundary}--`;
    mime = body;
  }

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: b64url(Buffer.from(mime, 'utf8')) },
  });
  return { id: res.data.id || null };
}

/**
 * Crea un evento en el calendario de la cuenta organizadora con un enlace de Google
 * Meet e invita a los asistentes (miembro + visitante). Google envía la invitación
 * de calendario (`sendUpdates:'all'`). Devuelve el enlace Meet y el id del evento.
 */
export async function createMeetEvent(opts: {
  title: string;
  description?: string | null;
  startISO: string;
  endISO: string;
  timezone: string;
  attendees: { email: string; name?: string | null }[];
}): Promise<{ meetUrl: string | null; eventId: string | null; htmlLink: string | null }> {
  const cal = google.calendar({ version: 'v3', auth: getAuth([SCOPE_CALENDAR]) });

  // 1) Crear el ESPACIO de Meet con AUTO-grabación + transcripción + notas (Gemini).
  //    Así la reunión se graba y transcribe sola al iniciar (cuando entra un participante
  //    con licencia del dominio, p. ej. el miembro). Si falla (licencia/API), caemos a un
  //    Meet estándar creado por el propio evento (sin auto-grabación).
  let conferenceData: any = null;
  let meetUri: string | null = null;
  try {
    const meet = google.meet({ version: 'v2', auth: getAuth([SCOPE_MEET]) });
    const space = (await meet.spaces.create({
      requestBody: {
        config: {
          accessType: 'OPEN',
          artifactConfig: {
            recordingConfig: { autoRecordingGeneration: 'ON' },
            transcriptionConfig: { autoTranscriptionGeneration: 'ON' },
            smartNotesConfig: { autoSmartNotesGeneration: 'ON' },
          },
        },
      },
    })).data;
    meetUri = space.meetingUri || null;
    if (meetUri && space.meetingCode) {
      conferenceData = {
        conferenceId: space.meetingCode,
        conferenceSolution: { key: { type: 'hangoutsMeet' }, name: 'Google Meet' },
        entryPoints: [{ entryPointType: 'video', uri: meetUri, label: meetUri }],
      };
    }
  } catch (e: any) {
    console.error('Meet space (auto-grabación) error, uso Meet estándar:', e?.response?.data ? JSON.stringify(e.response.data) : e.message);
  }

  const requestId = `gcc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const res = await cal.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    sendUpdates: 'all',
    requestBody: {
      summary: opts.title,
      description: opts.description || undefined,
      start: { dateTime: opts.startISO, timeZone: opts.timezone },
      end: { dateTime: opts.endISO, timeZone: opts.timezone },
      attendees: opts.attendees
        .filter((a) => a.email)
        .map((a) => ({ email: a.email, displayName: a.name || undefined })),
      // Adjunta el espacio con auto-grabación; si no se pudo crear, Meet estándar.
      conferenceData: conferenceData || {
        createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } },
      },
    },
  });

  return {
    meetUrl: res.data.hangoutLink || meetUri,
    eventId: res.data.id || null,
    htmlLink: res.data.htmlLink || null,
  };
}

/**
 * Trae las TRANSCRIPCIONES de las reuniones de Meet terminadas desde `sinceMs`. Devuelve por
 * cada conferenceRecord su meetingUri/meetingCode (para emparejar con el evento) y el texto
 * completo de la transcripción (vacío si aún no está lista). Requiere el scope
 * `meetings.space.readonly` en la delegación de dominio. Best-effort: si la API falla,
 * devuelve lo que pudo (o []).
 */
export async function fetchRecentMeetTranscripts(sinceMs: number): Promise<
  { meetingUri: string | null; meetingCode: string | null; endTime: string | null; text: string }[]
> {
  const meet: any = google.meet({ version: 'v2', auth: getAuth([SCOPE_MEET_READONLY]) });
  const out: { meetingUri: string | null; meetingCode: string | null; endTime: string | null; text: string }[] = [];
  const sinceIso = new Date(sinceMs).toISOString();

  const records: any[] = [];
  try {
    let pageToken: string | undefined;
    do {
      const res: any = await meet.conferenceRecords.list({ filter: `end_time >= "${sinceIso}"`, pageSize: 50, pageToken });
      for (const r of (res.data.conferenceRecords || [])) records.push(r);
      pageToken = res.data.nextPageToken;
    } while (pageToken && records.length < 200);
  } catch (e: any) {
    console.error('[meet] conferenceRecords.list error:', e?.response?.data ? JSON.stringify(e.response.data) : e.message);
    return out;
  }

  for (const rec of records) {
    let meetingUri: string | null = null, meetingCode: string | null = null;
    try {
      const sp: any = await meet.spaces.get({ name: rec.space });
      meetingUri = sp.data.meetingUri || null;
      meetingCode = sp.data.meetingCode || null;
    } catch { /* sin acceso al space */ }

    let text = '';
    try {
      const trRes: any = await meet.conferenceRecords.transcripts.list({ parent: rec.name });
      for (const tr of (trRes.data.transcripts || [])) {
        // Estados terminales con archivo disponible: ENDED / FILE_GENERATED. Solo se
        // omite STARTED (transcripción aún en curso).
        if (tr.state === 'STARTED') continue;
        let etoken: string | undefined;
        do {
          const eRes: any = await meet.conferenceRecords.transcripts.entries.list({ parent: tr.name, pageSize: 1000, pageToken: etoken });
          for (const e of (eRes.data.transcriptEntries || [])) if (e.text) text += `${e.text}\n`;
          etoken = eRes.data.nextPageToken;
        } while (etoken);
      }
    } catch { /* transcripción aún no lista */ }

    out.push({ meetingUri, meetingCode, endTime: rec.endTime || null, text: text.trim() });
  }
  return out;
}

/** Actualiza la descripción de un evento de Google Calendar (best-effort). */
export async function patchCalendarEventDescription(eventId: string, description: string): Promise<void> {
  const cal = google.calendar({ version: 'v3', auth: getAuth([SCOPE_CALENDAR]) });
  await cal.events.patch({ calendarId: 'primary', eventId, requestBody: { description } });
}

/** Contraseña aleatoria fuerte para la cuenta inicial (el usuario la cambia al ingresar). */
function randomPassword(): string {
  return 'Gcc-' + randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 14) + '9x';
}

function splitFullName(fullName: string): { givenName: string; familyName: string } {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { givenName: 'Miembro', familyName: 'GCC' };
  if (parts.length === 1) return { givenName: parts[0], familyName: parts[0] };
  return { givenName: parts[0], familyName: parts.slice(1).join(' ') };
}

/**
 * Crea la cuenta corporativa `usuario@grupocc.org` en la unidad organizativa de
 * candidatos. Devuelve `created:false` si ya existía (409). La cuenta se crea con
 * contraseña aleatoria y `changePasswordAtNextLogin`.
 */
export async function createWorkspaceUser(opts: {
  email: string;
  fullName?: string;
  orgUnitPath?: string;
}): Promise<{ email: string; id: string | null; created: boolean; password?: string }> {
  const dir = google.admin({ version: 'directory_v1', auth: getAuth([SCOPE_DIRECTORY]) });
  const { givenName, familyName } = splitFullName(opts.fullName || opts.email.split('@')[0]);
  const password = randomPassword();
  try {
    const res = await dir.users.insert({
      requestBody: {
        primaryEmail: opts.email,
        name: { givenName, familyName },
        password,
        changePasswordAtNextLogin: true,
        orgUnitPath: opts.orgUnitPath || CANDIDATES_OU,
      },
    });
    return { email: res.data.primaryEmail || opts.email, id: res.data.id || null, created: true, password };
  } catch (e: any) {
    const code = e?.code || e?.response?.status;
    if (code === 409) return { email: opts.email, id: null, created: false };
    throw e;
  }
}

/** Elimina una cuenta corporativa (idempotente ante 404). */
export async function deleteWorkspaceUser(email: string): Promise<void> {
  const dir = google.admin({ version: 'directory_v1', auth: getAuth([SCOPE_DIRECTORY]) });
  try {
    await dir.users.delete({ userKey: email });
  } catch (e: any) {
    const code = e?.code || e?.response?.status;
    if (code === 404) return;
    throw e;
  }
}

const b64ToUrl = (s: string) => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64UrlToStd = (s: string) => s.replace(/-/g, '+').replace(/_/g, '/');

/** Empuja nombre/teléfono al perfil de Google (patch parcial). */
export async function updateGoogleProfile(email: string, data: {
  givenName?: string; familyName?: string; phone?: string;
}): Promise<void> {
  const dir = google.admin({ version: 'directory_v1', auth: getAuth([SCOPE_DIRECTORY]) });
  const body: any = {};
  if (data.givenName !== undefined || data.familyName !== undefined) {
    body.name = {};
    if (data.givenName !== undefined) body.name.givenName = data.givenName || '-';
    if (data.familyName !== undefined) body.name.familyName = data.familyName || '-';
  }
  if (data.phone !== undefined) {
    body.phones = data.phone ? [{ value: data.phone, type: 'work', primary: true }] : [];
  }
  if (Object.keys(body).length === 0) return;
  await dir.users.patch({ userKey: email, requestBody: body });
}

/** Establece la foto de perfil de Google desde bytes de imagen. */
export async function setGooglePhoto(email: string, imageBase64Std: string, mimeType: string): Promise<void> {
  const dir = google.admin({ version: 'directory_v1', auth: getAuth([SCOPE_DIRECTORY]) });
  await dir.users.photos.update({ userKey: email, requestBody: { photoData: b64ToUrl(imageBase64Std), mimeType } });
}

/** Lee el perfil de Google (nombre, teléfono) + la foto (base64 estándar), para traer a la app. */
export async function getGoogleProfile(email: string): Promise<{
  givenName: string | null; familyName: string | null; phone: string | null;
  photoBase64Std: string | null; photoMime: string | null;
}> {
  const dir = google.admin({ version: 'directory_v1', auth: getAuth([SCOPE_DIRECTORY]) });
  const u = (await dir.users.get({ userKey: email })).data;
  const phones = (u.phones as any[]) || [];
  const primaryPhone = phones.find((p) => p.primary)?.value || phones[0]?.value || null;
  let photoBase64Std: string | null = null;
  let photoMime: string | null = null;
  try {
    const ph = (await dir.users.photos.get({ userKey: email })).data;
    if (ph.photoData) { photoBase64Std = b64UrlToStd(ph.photoData); photoMime = ph.mimeType || 'image/jpeg'; }
  } catch (e: any) {
    if ((e?.code || e?.response?.status) !== 404) throw e; // 404 = sin foto
  }
  return {
    givenName: (u.name as any)?.givenName || null,
    familyName: (u.name as any)?.familyName || null,
    phone: primaryPhone,
    photoBase64Std, photoMime,
  };
}

/**
 * Cancela una reunión: borra el evento de Google Calendar de la cuenta organizadora
 * (con `sendUpdates:'all'` para notificar a los invitados). Esto quita el evento y su
 * Meet de todos los calendarios. Idempotente: si ya no existe (410/404) no falla.
 */
export async function deleteMeetEvent(calendarEventId: string): Promise<void> {
  const cal = google.calendar({ version: 'v3', auth: getAuth([SCOPE_CALENDAR]) });
  try {
    await cal.events.delete({ calendarId: 'primary', eventId: calendarEventId, sendUpdates: 'all' });
  } catch (e: any) {
    const code = e?.code || e?.response?.status;
    if (code === 404 || code === 410) return; // ya estaba borrado/cancelado
    throw e;
  }
}
