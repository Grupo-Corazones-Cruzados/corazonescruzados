import { type CalendarEvent, type EventInstance, expandEvents } from '@/lib/calendar/recurrence';

/**
 * ⇒ AVISOS DE REUNIÓN (Fernando, 2026-10-19). Reglas COMPARTIDAS por el aviso dentro del panel
 * (`components/calendar/AvisoReuniones.tsx`) y el push al móvil (`lib/calendar/avisos-push.ts`):
 * los dos tienen que avisar de lo mismo y a la misma hora.
 */

/** Minutos antes del inicio en que avisa. De mayor a menor. */
export const UMBRALES = [60, 30, 15, 5];
/** Si la reunión ya empezó, aún se avisa durante estos minutos (se abrió tarde, o un despliegue). */
export const GRACIA = 5;

/** Solo eventos con hora y confirmados; nada de días completos, disponibilidad ni propuestas. */
export const esAvisable = (e: CalendarEvent) =>
  e.status === 'confirmed' && !e.all_day && !e.availability_status;

/**
 * El umbral más cercano ya alcanzado (con 20 min por delante toca el de 30), o `null` si aún
 * falta más de una hora o ya pasó la gracia.
 */
export function umbralDe(faltanMin: number): number | null {
  if (faltanMin < -GRACIA) return null;
  return [...UMBRALES].reverse().find((u) => faltanMin <= u) ?? null;
}

/** Clave de un aviso: evento + instancia (los recurrentes avisan en cada repetición) + umbral. */
export const claveAviso = (ev: { id: string }, inicio: number, umbral: number) => `${ev.id}|${inicio}|${umbral}`;

export function textoAviso(ev: EventInstance, faltanMin: number, zona?: string) {
  const mins = Math.max(0, Math.round(faltanMin));
  const cuando = faltanMin <= 0 ? 'Ya empezó' : mins >= 60 ? 'En 1 hora' : `En ${mins} min`;
  const h = (d: Date) => d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zona });
  return {
    titulo: `${cuando} · ${ev.title}`,
    detalle: `${h(ev.instanceStart)} – ${h(ev.instanceEnd)}${ev.client_name ? ` · ${ev.client_name}` : ''}`,
  };
}

/** Desfase de una zona respecto de UTC en minutos, en ese instante (−300 en Ecuador). */
function desfase(zona: string, en: Date): number {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(en).map((x) => [x.type, x.value]));
    const comoUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    return Math.round((comoUtc - Math.floor(en.getTime() / 1000) * 1000) / 60000);
  } catch { return -en.getTimezoneOffset(); }
}

/**
 * `expandEvents` calcula las repeticiones semanales y mensuales con la hora LOCAL del proceso, y
 * el servidor corre en UTC: la reunión del lunes a las 20:00 de Ecuador saldría el martes. Aquí se
 * corre el reloj a la zona del evento, se expande y se devuelve a la hora real. En el navegador
 * de Ecuador el corrimiento es cero.
 */
export function expandirEnZona(eventos: CalendarEvent[], desde: Date, hasta: Date): EventInstance[] {
  const porZona = new Map<string, CalendarEvent[]>();
  for (const e of eventos) {
    const z = e.timezone || 'America/Guayaquil';
    porZona.set(z, [...(porZona.get(z) || []), e]);
  }
  const out: EventInstance[] = [];
  for (const [zona, evs] of porZona) {
    const ms = (desfase(zona, desde) + desde.getTimezoneOffset()) * 60000;
    if (ms === 0) { out.push(...expandEvents(evs, desde, hasta)); continue; }
    const corridos = evs.map((e) => ({
      ...e,
      start_at: new Date(new Date(e.start_at).getTime() + ms).toISOString(),
      end_at: new Date(new Date(e.end_at).getTime() + ms).toISOString(),
    }));
    for (const i of expandEvents(corridos, new Date(desde.getTime() + ms), new Date(hasta.getTime() + ms))) {
      const original = evs.find((e) => e.id === i.id)!;
      out.push({ ...i, start_at: original.start_at, end_at: original.end_at,
        instanceStart: new Date(i.instanceStart.getTime() - ms), instanceEnd: new Date(i.instanceEnd.getTime() - ms) });
    }
  }
  return out.sort((a, b) => a.instanceStart.getTime() - b.instanceStart.getTime());
}

/** Lo que toca avisar ahora: cada instancia con su umbral, minutos que faltan y clave. */
export function avisosPendientes(eventos: CalendarEvent[], ahora: number) {
  const desde = new Date(ahora - GRACIA * 60000);
  const hasta = new Date(ahora + (UMBRALES[0] + 1) * 60000);
  const out: { ev: EventInstance; umbral: number; faltan: number; inicio: number }[] = [];
  for (const ev of expandirEnZona(eventos.filter(esAvisable), desde, hasta)) {
    const inicio = ev.instanceStart.getTime();
    if (inicio < desde.getTime()) continue;
    const faltan = (inicio - ahora) / 60000;
    const umbral = umbralDe(faltan);
    if (umbral != null) out.push({ ev, umbral, faltan, inicio });
  }
  return out;
}
