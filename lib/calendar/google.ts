import { pool } from '@/lib/db';
import { proveedorDe, type CalendarEvent } from '@/lib/calendar/recurrence';
import { leerConexion, tokenDeAcceso, GoogleNoConectado, GoogleReconectar } from '@/lib/integrations/google-oauth';

/**
 * ⇒ REUNIONES DE GOOGLE CALENDAR EN MI DÍA (Fernando, 2026-10-20).
 *
 * Cada persona ve las reuniones de SU cuenta de Google —la que conectó en Configuración →
 * Conexiones (`lib/integrations/google-oauth.ts`)—, ya no las de una sola cuenta de la casa.
 * Solo lectura: se editan en Google; en Mi día se pintan y, al tocarlas, abren Google Calendar.
 *
 * - Se pide a Google en vivo por rango (no se copian a la BD): lo que se mueve o borra allá,
 *   se mueve o borra aquí sin sincronizar nada.
 * - Fuera: canceladas, las que la persona rechazó, y las que ya son un evento de Mi día (GCC
 *   crea el Meet en Google al aceptar una propuesta: `meeting_event_id` o el mismo enlace).
 * - El estado de la conexión viaja con la respuesta (`sin_conexion`, `reconectar`,
 *   `sin_permiso`): una lista vacía nunca se hace pasar por «no tienes reuniones».
 */

export type EstadoGoogle = 'ok' | 'sin_conexion' | 'reconectar' | 'sin_permiso' | 'error';

export type EventoGoogle = CalendarEvent & { origen: 'google'; google_url: string | null };

export const SCOPE_CALENDAR = 'https://www.googleapis.com/auth/calendar';
const COLOR = '#4285F4';

/** Instante UTC de las 00:00 de `AAAA-MM-DD` en la zona del calendario. */
function inicioDelDia(dia: string, zona: string): Date {
  const aprox = new Date(`${dia}T00:00:00Z`);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(aprox).map((x) => [x.type, x.value]));
  const comoUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return new Date(aprox.getTime() - (comoUtc - aprox.getTime()));
}

export function zonaValida(z: string | undefined): string {
  if (!z) return 'America/Guayaquil';
  try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return z; } catch { return 'America/Guayaquil'; }
}

type Crudo = any;

/** Los eventos tal como los da Google, con el estado de la conexión. `completo` = no quedaron páginas sin leer. */
export async function leerGoogle(userId: string, desde: Date, hasta: Date): Promise<{
  estado: EstadoGoogle; email?: string; crudos: Crudo[]; zona: string; completo: boolean;
}> {
  const vacio = { crudos: [], zona: 'America/Guayaquil', completo: false };
  const conexion = await leerConexion(userId);
  if (!conexion) return { estado: 'sin_conexion', ...vacio };
  if (conexion.estado === 'revocada') return { estado: 'reconectar', email: conexion.email, ...vacio };
  if (!conexion.scopes.includes(SCOPE_CALENDAR)) return { estado: 'sin_permiso', email: conexion.email, ...vacio };

  let token: string;
  try { token = await tokenDeAcceso(userId); }
  catch (e) {
    if (e instanceof GoogleNoConectado) return { estado: 'sin_conexion', ...vacio };
    if (e instanceof GoogleReconectar) return { estado: 'reconectar', email: conexion.email, ...vacio };
    throw e;
  }

  const crudos: Crudo[] = [];
  let zona = 'America/Guayaquil';
  let pagina: string | undefined;
  // 4 páginas de 250: un mes muy cargado cabe de sobra.
  for (let i = 0; i < 4; i++) {
    const q = new URLSearchParams({
      singleEvents: 'true', orderBy: 'startTime', maxResults: '250',
      timeMin: desde.toISOString(), timeMax: hasta.toISOString(),
    });
    if (pagina) q.set('pageToken', pagina);
    const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    if (r.status === 401) return { estado: 'reconectar', email: conexion.email, ...vacio };
    if (r.status === 403) return { estado: 'sin_permiso', email: conexion.email, ...vacio };
    if (!r.ok) throw new Error(`Google Calendar respondió ${r.status}`);
    const j = await r.json();
    if (j.timeZone) zona = zonaValida(j.timeZone);
    crudos.push(...(j.items || []));
    pagina = j.nextPageToken;
    if (!pagina) break;
  }
  return { estado: 'ok', email: conexion.email, crudos, zona, completo: !pagina };
}

// Las invitaciones de Outlook/Teams (y muchas de Zoom) no traen `conferenceData`: el enlace va
// en la descripción o en el lugar. Se toma el primero que sea de una sala de videollamada.
const SALA = /https:\/\/(?:teams\.microsoft\.com\/(?:meet|l\/meetup-join)\/[^\s<>"']+|teams\.live\.com\/meet\/[^\s<>"']+|[\w-]+(?:\.[\w-]+)*\.zoom\.us\/[jw]\/[^\s<>"']+|zoom\.us\/[jw]\/[^\s<>"']+|meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}|[\w-]+\.webex\.com\/[^\s<>"']+)/i;

/** Enlace de videollamada del evento: Meet, el de `conferenceData`, o una sala citada en el texto. */
export function enlaceDe(g: Crudo): string | null {
  const directo = g.hangoutLink
    || (g.conferenceData?.entryPoints || []).find((p: any) => p.entryPointType === 'video')?.uri;
  if (directo) return directo;
  const texto = `${g.location || ''}\n${String(g.description || '').replace(/&amp;/g, '&')}`;
  return texto.match(SALA)?.[0] || null;
}

export { proveedorDe };

/** Ni cancelado, ni rechazado, ni un estado (ubicación de trabajo, «fuera de la oficina»…). */
export function esVisible(g: Crudo): boolean {
  if (g.status === 'cancelled') return false;
  if (g.eventType && !['default', 'fromGmail', 'focusTime'].includes(g.eventType)) return false;
  return !(g.attendees || []).some((a: any) => a.self && a.responseStatus === 'declined');
}

/** Inicio y fin reales; un día completo va de 00:00 a 23:59 en la zona del calendario. */
export function horasDe(g: Crudo, zonaCal: string): { ini: Date; fin: Date; todoElDia: boolean } | null {
  const todoElDia = !!g.start?.date;
  let ini: Date, fin: Date;
  if (todoElDia) {
    ini = inicioDelDia(g.start.date, zonaCal);
    // El `end.date` de Google es EXCLUSIVO; en Mi día un día completo termina a las 23:59.
    fin = new Date(inicioDelDia(g.end?.date || g.start.date, zonaCal).getTime() - 60_000);
    if (fin <= ini) fin = new Date(ini.getTime() + 24 * 3600_000 - 60_000);
  } else {
    ini = new Date(g.start?.dateTime);
    fin = new Date(g.end?.dateTime || g.start?.dateTime);
  }
  if (isNaN(ini.getTime()) || isNaN(fin.getTime())) return null;
  return { ini, fin, todoElDia };
}

/**
 * Lo que ya es un evento de Mi día no se pinta dos veces: el Meet que GCC creó en Google
 * (`meeting_event_id` o el mismo enlace) y las reuniones ya registradas desde Google
 * (`google_event_id`, `lib/calendar/google-import.ts`).
 */
export async function yaEnMiDia(userId: string): Promise<(g: Crudo) => boolean> {
  const { rows: propios } = await pool.query(
    `SELECT e.meeting_event_id, e.meeting_url, e.google_event_id
       FROM gcc_world.member_calendar_events e
       JOIN gcc_world.users u ON u.member_id = e.member_id
      WHERE u.id = $1 AND (e.meeting_event_id IS NOT NULL OR e.meeting_url IS NOT NULL OR e.google_event_id IS NOT NULL)`,
    [userId],
  );
  const ids = new Set<string>();
  for (const p of propios) { if (p.meeting_event_id) ids.add(p.meeting_event_id); if (p.google_event_id) ids.add(p.google_event_id); }
  const enlaces = new Set(propios.map((p: any) => p.meeting_url).filter(Boolean));
  return (g) => {
    const enlace = enlaceDe(g);
    return ids.has(g.id) || ids.has(g.recurringEventId) || (!!enlace && enlaces.has(enlace));
  };
}

export async function reunionesGoogle(
  userId: string, desde: Date, hasta: Date,
): Promise<{ estado: EstadoGoogle; email?: string; eventos: EventoGoogle[] }> {
  const { asegurarColumnasImportacion } = await import('@/lib/calendar/google-import');
  await asegurarColumnasImportacion();
  const leido = await leerGoogle(userId, desde, hasta);
  if (leido.estado !== 'ok') return { estado: leido.estado, email: leido.email, eventos: [] };
  const repetido = await yaEnMiDia(userId);

  const eventos: EventoGoogle[] = [];
  for (const g of leido.crudos) {
    if (!esVisible(g) || repetido(g)) continue;
    const h = horasDe(g, leido.zona);
    if (!h) continue;
    const enlace = enlaceDe(g);
    eventos.push({
      id: `google-${g.id}`,
      title: g.summary || '(Sin título)',
      description: null,
      event_type: 'progreso',
      client_id: null,
      client_name: null,
      start_at: h.ini.toISOString(),
      end_at: h.fin.toISOString(),
      all_day: h.todoElDia,
      timezone: zonaValida(g.start?.timeZone || leido.zona),
      recurrence_type: 'none',
      recurrence_days: null,
      recurrence_interval: 1,
      recurrence_until: null,
      color: COLOR,
      status: 'confirmed',
      availability_status: null,
      meeting_url: enlace,
      meeting_provider: proveedorDe(enlace),
      origen: 'google',
      google_url: g.htmlLink || null,
    });
  }
  return { estado: 'ok', email: leido.email, eventos };
}

/**
 * Para los avisos por push (cada minuto): lo de las próximas 2 h, guardado 5 min por persona
 * para no preguntarle a Google 60 veces por hora. Nunca lanza: sin Google, no hay avisos de Google.
 */
const cache = new Map<string, { hasta: number; eventos: EventoGoogle[] }>();
/** Tras registrar reuniones nuevas: que el push no avise también de su copia «de Google». */
export const olvidarProximas = (userId: string) => { cache.delete(userId); };
export async function reunionesGoogleProximas(userId: string, ahora = Date.now()): Promise<EventoGoogle[]> {
  const c = cache.get(userId);
  if (c && c.hasta > ahora) return c.eventos;
  let eventos: EventoGoogle[] = [];
  try {
    const r = await reunionesGoogle(userId, new Date(ahora - 10 * 60_000), new Date(ahora + 2 * 3600_000));
    eventos = r.eventos;
  } catch (e: any) {
    console.error('[google-calendar] avisos', e?.message);
  }
  cache.set(userId, { hasta: ahora + 5 * 60_000, eventos });
  return eventos;
}
