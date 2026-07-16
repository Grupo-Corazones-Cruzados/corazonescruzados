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

/** Envía un correo HTML por la Gmail API impersonando a la cuenta organizadora. */
export async function sendViaGmail(opts: {
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
}): Promise<{ id: string | null }> {
  const auth = getAuth([SCOPE_GMAIL]);
  const gmail = google.gmail({ version: 'v1', auth });
  const from = opts.from || ORGANIZER;
  const to = Array.isArray(opts.to) ? opts.to.join(', ') : opts.to;

  // From con display name: "Nombre <correo>" → encodear solo el display name.
  const fromHeader = (() => {
    const m = /^(.*)<(.+)>\s*$/.exec(from);
    if (m) return `${encodeHeader(m[1].trim())} <${m[2].trim()}>`;
    return from;
  })();

  const mime =
    `From: ${fromHeader}\r\n` +
    `To: ${to}\r\n` +
    `Subject: ${encodeHeader(opts.subject)}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: text/html; charset=utf-8\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    Buffer.from(opts.html, 'utf8').toString('base64');

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
