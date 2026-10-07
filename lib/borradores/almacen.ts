'use client';

/**
 * EL ALMACÉN DE BORRADORES EN EL DISPOSITIVO (Fernando, 2026-10-07).
 *
 * Los tickets y proyectos en borrador se pueden crear y editar SIN CONEXIÓN. Lo que se hace
 * sin red vive aquí (IndexedDB del dominio de la plataforma: el mismo en la app del teléfono,
 * en la del iPad y en el navegador) hasta que el sincronizador (`./sincronizar.ts`) lo sube.
 *
 *  · `serverId = null`  → creado sin conexión: estado «Sin conexión». Al volver la red se sube
 *                          y pasa SOLO a «Borrador».
 *  · `pendiente`        → tiene cambios que el servidor aún no conoce.
 *  · `version`          → la `updated_at` del servidor que se conocía al editar; si al subir no
 *                          coincide, el servidor responde 409 y queda `conflicto`.
 *
 * Es de UNA persona: si en el dispositivo entra otra cuenta, se vacía (ver `asegurarDueno`).
 */

export type DatosTicket = {
  title: string; description: string;
  client_id: string; client_email: string;
  service_id: string; deadline: string;
  estimated_hours: string; estimated_cost: string;
  required_talents: string[];
  /** Días de trabajo, `AAAA-MM-DD`. */
  dias: string[];
};
export type DatosProyecto = {
  title: string; description: string;
  client_id: string; client_email: string;
  deadline: string; budget_min: string; budget_max: string;
};

export type Borrador = {
  localId: string;
  tipo: 'ticket' | 'proyecto';
  serverId: number | null;
  version: string | null;
  pendiente: boolean;
  /** Los días cambiaron y hay que subirlos aparte (solo tickets). */
  diasCambiados?: boolean;
  conflicto?: { servidor: any } | null;
  error?: string | null;
  datos: DatosTicket | DatosProyecto;
  creadoLocal: string;
  actualizadoLocal: string;
};

export type Catalogos = {
  clientes: { id: number | string; name?: string | null; email?: string | null; status?: string | null }[];
  servicios: { id: number | string; name: string; base_price?: number | string | null }[];
  leidoEn: string;
};

export type Dueno = { userId: string; memberId: number | null; nombre: string };

const BD = 'gcc-borradores';
const VERSION = 1;

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(BD, VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('borradores')) db.createObjectStore('borradores', { keyPath: 'localId' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function con<T>(almacen: string, modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
  const db = await abrir();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(almacen, modo);
    const req = fn(tx.objectStore(almacen));
    tx.oncomplete = () => { resolve(req ? (req.result as T) : (undefined as T)); db.close(); };
    tx.onerror = () => { reject(tx.error); db.close(); };
  });
}

export const listar = () => con<Borrador[]>('borradores', 'readonly', (s) => s.getAll());
export const obtener = (localId: string) => con<Borrador | undefined>('borradores', 'readonly', (s) => s.get(localId));
export const guardar = (b: Borrador) => con<void>('borradores', 'readwrite', (s) => { s.put(b); });
export const quitar = (localId: string) => con<void>('borradores', 'readwrite', (s) => { s.delete(localId); });

export const leerMeta = <T>(clave: string) => con<T | undefined>('meta', 'readonly', (s) => s.get(clave));
export const escribirMeta = (clave: string, valor: unknown) => con<void>('meta', 'readwrite', (s) => { s.put(valor, clave); });

/** Si cambió la cuenta del dispositivo, lo de la anterior no se le enseña a la nueva. */
export async function asegurarDueno(d: Dueno): Promise<void> {
  const antes = await leerMeta<Dueno>('dueno');
  if (antes && antes.userId !== d.userId) {
    await con<void>('borradores', 'readwrite', (s) => { s.clear(); });
    await con<void>('meta', 'readwrite', (s) => { s.clear(); });
  }
  await escribirMeta('dueno', d);
}

/** ¿Hay algo que subir? (lo pregunta el sincronizador global antes de ponerse a trabajar). */
export async function hayPendientes(): Promise<boolean> {
  try {
    const todos = await listar();
    return todos.some((b) => b.serverId == null || b.pendiente);
  } catch { return false; }
}

export function ticketVacio(): DatosTicket {
  return { title: '', description: '', client_id: '', client_email: '', service_id: '', deadline: '',
    estimated_hours: '', estimated_cost: '', required_talents: [], dias: [] };
}
export function proyectoVacio(): DatosProyecto {
  return { title: '', description: '', client_id: '', client_email: '', deadline: '', budget_min: '', budget_max: '' };
}
