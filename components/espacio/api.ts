/** Llamadas del navegador al servicio local, a través del candado de la web. */
export const BASE = '/api/espacio-trabajo/servicio';

export class ErrorEspacio extends Error {
  constructor(mensaje: string, public estado: number, public codigo?: string) { super(mensaje); }
}

export async function api<T = any>(ruta: string, init?: { metodo?: string; cuerpo?: unknown }): Promise<T> {
  const r = await fetch(`${BASE}${ruta}`, {
    method: init?.metodo || (init?.cuerpo !== undefined ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json' },
    body: init?.cuerpo !== undefined ? JSON.stringify(init.cuerpo) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { window.location.href = '/espacio-acceso'; throw new ErrorEspacio('Hay que entrar de nuevo.', 401); }
  if (!r.ok) throw new ErrorEspacio(j.error || 'No se pudo completar.', r.status, j.codigo);
  return j as T;
}

export interface Proyecto { id: string; ruta: string; nombre: string; grupo: string; subcarpetas: string[]; sandbox: boolean }
export type EstadoViva = 'iniciando' | 'trabajando' | 'espera' | 'libre' | 'cerrada';
export interface Viva { id: string; proyecto: string; estado: EstadoViva; noVisto: boolean; modelo?: string; modo?: string; preguntas: number }
export interface Sesion { id: string; titulo: string; actualizada: number; rama: string | null; carpeta: string | null; enTerminal: boolean; error: string | null; viva: Viva | null }

export type Bloque =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'pensando'; texto: string }
  | { tipo: 'imagen' }
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

export const TEXTO_ESTADO: Record<EstadoViva, { texto: string; clase: string }> = {
  iniciando: { texto: 'Iniciando', clase: 'text-digi-muted' },
  trabajando: { texto: 'Trabajando', clase: 'text-accent' },
  espera: { texto: 'Espera tu respuesta', clase: 'text-amber-400' },
  libre: { texto: 'Lista', clase: 'text-green-400' },
  cerrada: { texto: 'Cerrada', clase: 'text-digi-muted' },
};
