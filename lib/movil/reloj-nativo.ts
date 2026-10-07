/**
 * EL RELOJ DEL TICKET EN EL TELÉFONO — lado de la página (Fernando, 2026-10-06).
 *
 * Dentro de la app (Capacitor), la página le pasa al plugin nativo `RelojTicket` la lista de
 * relojes en marcha que da el servidor (`/api/tickets/relojes`) y el teléfono los enseña con
 * su cronómetro (Android: notificación en curso · iPhone: Actividad en Vivo). Fuera de la app
 * —el navegador del computador— todo esto no hace nada.
 *
 * `@capacitor/core` se importa DENTRO de la función: así no entra en el servidor ni pesa en
 * la carga de quien usa la plataforma desde el navegador.
 */

/** Avisa de que un reloj cambió (iniciar, detener, borrar): la app vuelve a preguntar. */
export function avisarCambioDeReloj() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('gcc:relojes'));
}

export async function sincronizarRelojesNativos(): Promise<void> {
  if (typeof window === 'undefined') return;
  const { Capacitor, registerPlugin } = await import('@capacitor/core');
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('RelojTicket')) return;
  const RelojTicket = registerPlugin<{ sincronizar(o: { relojes: unknown[] }): Promise<{ permitido: boolean }> }>('RelojTicket');

  const r = await fetch('/api/tickets/relojes', { cache: 'no-store' });
  // Sin sesión no hay de quién enseñar relojes: se quitan. Cualquier otro fallo NO toca lo
  // que hay — un error del servidor no es «no hay relojes».
  if (r.status === 401) { await RelojTicket.sincronizar({ relojes: [] }); return; }
  if (!r.ok) return;
  const { data } = await r.json();
  await RelojTicket.sincronizar({ relojes: Array.isArray(data) ? data : [] });
}
