/** Lo que comparten el módulo de Recordatorios y el panel del Espacio de trabajo. */
export type Task = { id: string; text: string; done: boolean };
export type Attach = { id?: number; filename: string; content_type?: string | null; kind?: string; size?: number | null; data?: string };
export type Reminder = {
  id: number; title: string; notes?: string; remind_at?: string | null; tasks: Task[];
  status: string; source: string; source_event_id?: string | null; attachment_count?: number; attachments?: Attach[];
};

/** `fetch` por defecto. El Espacio de trabajo pasa el suyo, porque dentro de las apps la sesión va en una cabecera. */
export type Pedir = (url: string, init?: RequestInit) => Promise<Response>;
export const pedirNormal: Pedir = (url, init) => fetch(url, init);

export const STATUS_VARIANT: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  active: 'info', expired: 'error', done: 'success',
};
export const STATUS_LABEL: Record<string, string> = { active: 'Pendiente', expired: 'Vencido', done: 'Completado' };

/** Estado efectivo para la UI: los activos ya vencidos se muestran como "Vencido" aunque el cron aún no los haya marcado. */
export function effStatus(r: { status: string; remind_at?: string | null }): 'active' | 'expired' | 'done' {
  if (r.status === 'done') return 'done';
  if (r.remind_at && new Date(r.remind_at).getTime() <= Date.now()) return 'expired';
  return 'active';
}

/** ISO → valor para <input type="datetime-local"> en hora local. */
export function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function fmtDate(iso?: string | null): string {
  if (!iso) return 'Sin fecha';
  return new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}
export function fmtShort(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
}
export function relative(iso?: string | null): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'vencido';
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `en ${Math.max(1, Math.round(ms / 60000))} min`;
  if (h < 24) return `en ${h} h`;
  return `en ${Math.round(h / 24)} d`;
}

/**
 * Los que siguen pendientes. Primero lo que está por caducar, de lo más cercano a lo más lejano (sin fecha,
 * al final); lo que ya venció va aparte, lo más reciente arriba: si no, enterraría lo que aún se puede atender.
 */
export function porCaducar(lista: Reminder[]): { proximos: Reminder[]; vencidos: Reminder[] } {
  const fecha = (r: Reminder) => (r.remind_at ? new Date(r.remind_at).getTime() : Infinity);
  return {
    proximos: lista.filter((r) => effStatus(r) === 'active').sort((a, b) => fecha(a) - fecha(b)),
    vencidos: lista.filter((r) => effStatus(r) === 'expired').sort((a, b) => fecha(b) - fecha(a)),
  };
}
