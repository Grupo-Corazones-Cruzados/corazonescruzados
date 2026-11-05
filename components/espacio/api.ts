/** Llamadas del navegador al servicio local, a través del candado de la web. */
export const BASE = '/api/espacio-trabajo/servicio';

export class ErrorEspacio extends Error {
  constructor(mensaje: string, public estado: number, public codigo?: string) { super(mensaje); }
}

const LLAVE_TOKEN = 'espacio_token';
export const RUTA_EMBEBIDA = '/espacio';
export const RUTA_CONTENIDO = '/contenido';
/** Aplicación instalada: la nativa del teléfono o la del escritorio. */
export const esAppInstalada = () => !!(window as any).Capacitor?.isNativePlatform?.() || window.matchMedia('(display-mode: standalone)').matches;
export const rutaAcceso = (volver: string) => `/espacio-acceso?volver=${encodeURIComponent(volver)}`;
/** Solo rutas de aquí: un enlace no puede mandar a otra web tras escribir la contraseña. */
export const destinoSeguro = (v: string | null | undefined) => (v && v.startsWith('/') && !v.startsWith('//') && !v.includes('\\') ? v : '/dashboard/admin/espacio');

export function tokenGuardado(): string | null {
  try { return localStorage.getItem(LLAVE_TOKEN); } catch { return null; }
}
export function guardarToken(t: string | null) {
  try { if (t) localStorage.setItem(LLAVE_TOKEN, t); else localStorage.removeItem(LLAVE_TOKEN); } catch { /* se volverá a pedir */ }
}
export function cabeceras(extra: Record<string, string> = {}): Record<string, string> {
  const t = tokenGuardado();
  return t ? { ...extra, 'x-espacio-token': t } : extra;
}

function sesionCaducada() {
  if (window.location.pathname === RUTA_EMBEBIDA || window.location.pathname === RUTA_CONTENIDO) { guardarToken(null); window.dispatchEvent(new Event('espacio-sin-sesion')); }
  else window.location.href = rutaAcceso(window.location.pathname + window.location.search);
}

/**
 * Los eventos de una sesión. Va por `fetch` y no por EventSource porque este no deja mandar
 * cabeceras, y dentro de la app la sesión viaja en una. Si se corta (el teléfono en segundo plano),
 * reconecta; quien escucha descarta lo ya visto por su número.
 */
export function escucharEventos(id: string, alEvento: (e: any) => void): () => void {
  const corte = new AbortController();
  (async () => {
    while (!corte.signal.aborted) {
      try {
        const r = await fetch(`${BASE}/sesiones/${id}/eventos?desde=0`, { headers: cabeceras(), signal: corte.signal });
        if (r.status === 401) { sesionCaducada(); return; }
        if (r.status === 404) return;
        if (!r.ok || !r.body) throw new Error('sin eventos');
        const lector = r.body.getReader();
        const texto = new TextDecoder();
        let resto = '';
        for (;;) {
          const { value, done } = await lector.read();
          if (done) break;
          resto += texto.decode(value, { stream: true });
          let i;
          while ((i = resto.indexOf('\n\n')) >= 0) {
            const trozo = resto.slice(0, i);
            resto = resto.slice(i + 2);
            const dato = trozo.split('\n').find((l) => l.startsWith('data: '));
            if (dato) alEvento(JSON.parse(dato.slice(6)));
          }
        }
      } catch { /* se reintenta abajo */ }
      if (corte.signal.aborted) return;
      await new Promise((ok) => setTimeout(ok, 2000));
    }
  })();
  return () => corte.abort();
}

export async function api<T = any>(ruta: string, init?: { metodo?: string; cuerpo?: unknown }): Promise<T> {
  const r = await fetch(`${BASE}${ruta}`, {
    method: init?.metodo || (init?.cuerpo !== undefined ? 'POST' : 'GET'),
    headers: cabeceras({ 'Content-Type': 'application/json' }),
    body: init?.cuerpo !== undefined ? JSON.stringify(init.cuerpo) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { sesionCaducada(); throw new ErrorEspacio('Hay que entrar de nuevo.', 401); }
  if (!r.ok) throw new ErrorEspacio(j.error || 'No se pudo completar.', r.status, j.codigo);
  return j as T;
}

export interface Proyecto { id: string; ruta: string; nombre: string; grupo: string; subcarpetas: string[]; aislado: boolean }
export type EstadoViva = 'iniciando' | 'trabajando' | 'espera' | 'libre' | 'cerrada';
export interface Viva { id: string; proyecto: string; estado: EstadoViva; noVisto: boolean; modelo?: string; modo?: string; preguntas: number; tareas?: number; flujo?: boolean }
export interface Sesion { id: string; proyecto: string; titulo: string; actualizada: number; rama: string | null; carpeta: string | null; enTerminal: boolean; estadoTerminal?: string | null; error: string | null; viva: Viva | null }

export type Bloque =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'pensando'; texto: string }
  | { tipo: 'imagen' }
  | { tipo: 'adjunto'; nombre: string }
  | { tipo: 'herramienta'; id: string; nombre: string; entrada: any }
  | { tipo: 'resultado'; id: string; error: boolean; texto: string };

export interface Mensaje { uuid: string; rol: 'user' | 'assistant' | 'system'; bloques: Bloque[]; padre?: string | null }
export interface Solicitud { solicitudId: string; herramienta: string; entrada: any }

export const MODOS = [
  { valor: 'bypassPermissions', texto: 'Sin confirmar' },
  { valor: 'acceptEdits', texto: 'Aceptar ediciones' },
  { valor: 'plan', texto: 'Plan' },
  { valor: 'default', texto: 'Preguntar' },
];

export function hace(ms: number | undefined): string {
  if (!ms) return '';
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return 'ahora';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 30 * 86400) return `hace ${Math.floor(s / 86400)} d`;
  return new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/** Lo escrito en una sesión que aún no existe se guarda a nombre de su proyecto. */
export const claveBorrador = (proyecto: string, sesion: string | null) => sesion || `nueva-${proyecto}`;
export const EVENTO_BORRADOR = 'espacio-borrador';
export const EVENTO_TITULO = 'espacio-titulo';

export const TEXTO_ESTADO: Record<EstadoViva, { texto: string; clase: string }> = {
  iniciando: { texto: 'Iniciando', clase: 'text-digi-muted' },
  trabajando: { texto: 'Trabajando', clase: 'text-accent' },
  espera: { texto: 'Espera tu respuesta', clase: 'text-amber-400' },
  libre: { texto: 'Lista', clase: 'text-green-400' },
  cerrada: { texto: 'Cerrada', clase: 'text-digi-muted' },
};
