import { pool } from '@/lib/db';

/**
 * ⇒ CALENDARIO PARA OTRAS APPS (iCal) (Fernando, 2026-10-19): portarretrato digital, Alexa (a
 * través de Google Calendar), Apple, Outlook… Se conectan con una URL que devuelve un `.ics` y la
 * vuelven a pedir cada cierto tiempo.
 *
 * - Es un enlace SECRETO y aparte del calendario público (`calendar_public_token`): aquel es
 *   «libre/ocupado» para que los clientes agenden; este lleva los títulos reales porque es para
 *   las pantallas del propio miembro. Se regenera o se apaga desde «Compartir» en Mi día.
 * - Horas con `TZID` de la zona del evento, no en UTC: una repetición semanal en UTC cambiaría de
 *   día (el lunes 20:00 de Ecuador es martes en UTC) y el `BYDAY` quedaría mal.
 * - Solo eventos confirmados; fuera los bloques de disponibilidad («Trabajando»…), que son un
 *   estado y no una cita. Lo no repetido, solo desde hace 90 días: el archivo no crece sin fin.
 */

let asegurando: Promise<void> | null = null;
export function asegurarColumnasIcal(): Promise<void> {
  if (asegurando) return asegurando;
  const p = pool
    .query(`
      ALTER TABLE gcc_world.members ADD COLUMN IF NOT EXISTS calendar_feed_token TEXT;
      ALTER TABLE gcc_world.members ADD COLUMN IF NOT EXISTS calendar_feed_token_created_at TIMESTAMPTZ;
      CREATE UNIQUE INDEX IF NOT EXISTS members_calendar_feed_token_idx ON gcc_world.members(calendar_feed_token);
    `)
    .then(() => undefined)
    .catch((e: unknown) => { asegurando = null; throw e; });
  asegurando = p;
  return p;
}

const DIAS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Texto de iCal: se escapan `\`, `;`, `,` y los saltos de línea. */
const txt = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Líneas de más de 75 octetos se doblan (RFC 5545 §3.1), sin partir un carácter UTF-8. */
function doblar(linea: string): string {
  const enc = new TextEncoder();
  if (enc.encode(linea).length <= 75) return linea;
  const partes: string[] = [];
  let actual = '', bytes = 0, limite = 75;
  for (const ch of linea) {
    const n = enc.encode(ch).length;
    if (bytes + n > limite) { partes.push(actual); actual = ''; bytes = 0; limite = 74; }
    actual += ch; bytes += n;
  }
  partes.push(actual);
  return partes.join('\r\n ');
}

const p2 = (n: number) => String(n).padStart(2, '0');
const utc = (d: Date) =>
  `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`;

/** Fecha y hora LOCAL de la zona, en el formato de iCal (`20261019T143000`). */
function local(d: Date, zona: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}${p.month}${p.day}T${p.hour}${p.minute}${p.second}`;
}
const soloFecha = (d: Date, zona: string) => local(d, zona).slice(0, 8);

/** Instante UTC de las 23:59:59 de `AAAA-MM-DD` en la zona (para el `UNTIL`). */
function finDelDia(dia: string, zona: string): Date {
  const aprox = new Date(`${dia}T23:59:59Z`);
  const l = local(aprox, zona);
  const comoUtc = Date.UTC(+l.slice(0, 4), +l.slice(4, 6) - 1, +l.slice(6, 8), +l.slice(9, 11), +l.slice(11, 13), +l.slice(13, 15));
  return new Date(aprox.getTime() - (comoUtc - aprox.getTime()));
}

// Ecuador no tiene horario de verano: −05:00 todo el año. Otras zonas van solo con su TZID
// (Google, Apple y Outlook conocen los nombres IANA).
const VTIMEZONE_EC = ['BEGIN:VTIMEZONE', 'TZID:America/Guayaquil', 'BEGIN:STANDARD', 'DTSTART:19700101T000000',
  'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0500', 'TZNAME:-05', 'END:STANDARD', 'END:VTIMEZONE'];

export async function icalDelMiembro(token: string): Promise<{ nombre: string; ics: string } | null> {
  await asegurarColumnasIcal();
  const { rows: [m] } = await pool.query(
    `SELECT id, name FROM gcc_world.members WHERE calendar_feed_token = $1 LIMIT 1`, [token]);
  if (!m) return null;

  const { rows } = await pool.query(
    `SELECT e.id, e.title, e.description, c.name AS client_name, e.start_at, e.end_at, e.all_day,
            COALESCE(e.timezone, 'America/Guayaquil') AS timezone, e.recurrence_type, e.recurrence_days,
            e.recurrence_interval, to_char(e.recurrence_until, 'YYYY-MM-DD') AS recurrence_until,
            e.meeting_url, e.created_at, e.updated_at
       FROM gcc_world.member_calendar_events e
       LEFT JOIN gcc_world.clients c ON c.id = e.client_id
      WHERE e.member_id = $1 AND e.status = 'confirmed' AND e.availability_status IS NULL
        AND (e.recurrence_type <> 'none' OR e.end_at >= NOW() - INTERVAL '90 days')
      ORDER BY e.start_at`,
    [m.id],
  );

  const lineas: string[] = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Grupo Corazones Cruzados//GCC World//ES', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', `X-WR-CALNAME:${txt(`GCC World · ${m.name || 'Mi día'}`)}`, 'X-WR-TIMEZONE:America/Guayaquil',
    // Cada cuánto volver a pedirlo: lo respetan Apple y Outlook; Google decide por su cuenta.
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M', 'X-PUBLISHED-TTL:PT15M',
  ];
  if (rows.some((e: any) => e.timezone === 'America/Guayaquil')) lineas.push(...VTIMEZONE_EC);

  for (const e of rows) {
    const zona: string = e.timezone;
    const ini = new Date(e.start_at), fin = new Date(e.end_at);
    if (isNaN(ini.getTime()) || isNaN(fin.getTime())) continue;
    lineas.push('BEGIN:VEVENT', `UID:${e.id}@grupocc.org`, `DTSTAMP:${utc(new Date(e.updated_at || e.created_at || Date.now()))}`);
    if (e.all_day) {
      // DTEND de un día completo es el día SIGUIENTE (exclusivo).
      const finDia = new Date(Math.max(fin.getTime(), ini.getTime()) + 24 * 3600 * 1000);
      lineas.push(`DTSTART;VALUE=DATE:${soloFecha(ini, zona)}`, `DTEND;VALUE=DATE:${soloFecha(finDia, zona)}`);
    } else {
      lineas.push(`DTSTART;TZID=${zona}:${local(ini, zona)}`, `DTEND;TZID=${zona}:${local(fin, zona)}`);
    }
    if (e.recurrence_type && e.recurrence_type !== 'none') {
      const freq = ({ daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY' } as Record<string, string>)[e.recurrence_type];
      if (freq) {
        let r = `RRULE:FREQ=${freq}`;
        if (e.recurrence_interval > 1) r += `;INTERVAL=${e.recurrence_interval}`;
        if (freq === 'WEEKLY' && Array.isArray(e.recurrence_days) && e.recurrence_days.length) {
          r += `;BYDAY=${e.recurrence_days.map((d: number) => DIAS[d]).filter(Boolean).join(',')}`;
        }
        if (e.recurrence_until) r += `;UNTIL=${e.all_day ? e.recurrence_until.replace(/-/g, '') : utc(finDelDia(e.recurrence_until, zona))}`;
        lineas.push(r);
      }
    }
    lineas.push(`SUMMARY:${txt(e.title || 'Evento')}`);
    const detalle = [e.client_name ? `Cliente: ${e.client_name}` : '', e.description || '', e.meeting_url ? `Reunión: ${e.meeting_url}` : '']
      .filter(Boolean).join('\n');
    if (detalle) lineas.push(`DESCRIPTION:${txt(detalle)}`);
    if (e.meeting_url) lineas.push(`URL:${e.meeting_url}`, `LOCATION:${txt(e.meeting_url)}`);
    lineas.push(`LAST-MODIFIED:${utc(new Date(e.updated_at || e.created_at || Date.now()))}`, 'END:VEVENT');
  }
  lineas.push('END:VCALENDAR');
  return { nombre: m.name || 'GCC World', ics: lineas.map(doblar).join('\r\n') + '\r\n' };
}
