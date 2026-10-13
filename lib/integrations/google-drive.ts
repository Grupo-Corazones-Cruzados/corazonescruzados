/**
 * API de Google Drive con el token DEL USUARIO (ver google-oauth.ts).
 *
 * Se habla con la API REST a pelo (`fetch`), sin el cliente `googleapis`: son media docena
 * de llamadas y así no se carga el SDK entero en cada ruta.
 *
 * Los bytes de los archivos NUNCA pasan por nuestro servidor:
 *  · subida  → sesión REANUDABLE que abre el servidor y que el navegador rellena directo
 *              contra Google (un video de 1 GB no toca Railway);
 *  · vista   → miniatura (unos KB, se sirve por proxy porque el enlace exige el token) y
 *              el archivo se abre en Drive (`webViewLink`). Sin visor propio.
 */

const API = 'https://www.googleapis.com/drive/v3';
const CARPETA = 'application/vnd.google-apps.folder';

export const NOMBRE_RAIZ = 'GCC World';
export const NOMBRE_EXPERIENCIAS = 'Experiencias';

/** Lo que se acepta subir desde el dispositivo. */
export function tipoPermitido(mime: string): boolean {
  return mime === 'application/pdf' || mime.startsWith('image/') || mime.startsWith('video/');
}

export class DriveSinEspacio extends Error {
  code = 'drive_sin_espacio' as const;
  constructor() { super('Tu Google Drive no tiene espacio suficiente. Libera espacio o amplía tu almacenamiento en Google.'); }
}
export class DriveNoEncontrado extends Error {
  code = 'drive_no_encontrado' as const;
  constructor(que = 'La carpeta') { super(`${que} ya no está en tu Google Drive (¿se borró o se movió a la papelera?).`); }
}

async function drive(token: string, path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(path.startsWith('http') ? path : `${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) },
    cache: 'no-store',
  });
  if (res.ok) return res.status === 204 ? null : res.json();
  const j = await res.json().catch(() => ({}));
  const reason = j?.error?.errors?.[0]?.reason || '';
  if (reason === 'storageQuotaExceeded') throw new DriveSinEspacio();
  if (res.status === 404) throw new DriveNoEncontrado('El elemento');
  throw new Error(`Google Drive: ${j?.error?.message || res.status}`);
}

const q = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export async function crearCarpeta(token: string, nombre: string, padre: string | null): Promise<string> {
  const j = await drive(token, '/files?fields=id', {
    method: 'POST',
    body: JSON.stringify({ name: nombre, mimeType: CARPETA, ...(padre ? { parents: [padre] } : {}) }),
  });
  return j.id;
}

async function buscarCarpeta(token: string, nombre: string, padre: string): Promise<string | null> {
  const query = `name = '${q(nombre)}' and mimeType = '${CARPETA}' and '${q(padre)}' in parents and trashed = false`;
  const j = await drive(token, `/files?fields=files(id)&pageSize=1&q=${encodeURIComponent(query)}`);
  return j.files?.[0]?.id ?? null;
}

/** ¿La carpeta existe y no está en la papelera? */
export async function carpetaViva(token: string, id: string): Promise<boolean> {
  try {
    const j = await drive(token, `/files/${encodeURIComponent(id)}?fields=trashed,mimeType`);
    return !j.trashed && j.mimeType === CARPETA;
  } catch (e) {
    if (e instanceof DriveNoEncontrado) return false;
    throw e;
  }
}

/**
 * «GCC World / Experiencias» en la raíz de su Drive. Si ya existe (p. ej. reconectó la
 * misma cuenta y la base perdió el id), se reutiliza en vez de duplicarla.
 */
export async function asegurarCarpetaExperiencias(token: string, guardada: string | null): Promise<string> {
  if (guardada && (await carpetaViva(token, guardada))) return guardada;
  const raiz = (await buscarCarpeta(token, NOMBRE_RAIZ, 'root')) ?? (await crearCarpeta(token, NOMBRE_RAIZ, 'root'));
  return (await buscarCarpeta(token, NOMBRE_EXPERIENCIAS, raiz)) ?? (await crearCarpeta(token, NOMBRE_EXPERIENCIAS, raiz));
}

export async function renombrar(token: string, id: string, nombre: string): Promise<void> {
  await drive(token, `/files/${encodeURIComponent(id)}?fields=id`, { method: 'PATCH', body: JSON.stringify({ name: nombre }) });
}

/** A la papelera de Drive (recuperable 30 días), nunca borrado definitivo. */
export async function aLaPapelera(token: string, id: string): Promise<void> {
  try {
    await drive(token, `/files/${encodeURIComponent(id)}?fields=id`, { method: 'PATCH', body: JSON.stringify({ trashed: true }) });
  } catch (e) {
    if (!(e instanceof DriveNoEncontrado)) throw e; // ya no estaba: objetivo cumplido
  }
}

export interface ArchivoDrive {
  id: string;
  nombre: string;
  mime: string;
  tamano: number | null;
  carpetaId: string;
  verUrl: string;
  tieneMiniatura: boolean;
  creado: string;
}

export async function infoArchivo(token: string, id: string): Promise<{ parents: string[]; mime: string; trashed: boolean }> {
  const j = await drive(token, `/files/${encodeURIComponent(id)}?fields=parents,mimeType,trashed`);
  return { parents: j.parents || [], mime: j.mimeType, trashed: !!j.trashed };
}

/** Archivos (no carpetas) directamente dentro de cualquiera de las carpetas dadas. */
export async function listarArchivos(token: string, carpetas: string[]): Promise<ArchivoDrive[]> {
  if (carpetas.length === 0) return [];
  const padres = carpetas.map((c) => `'${q(c)}' in parents`).join(' or ');
  const query = `(${padres}) and trashed = false and mimeType != '${CARPETA}'`;
  const fields = 'nextPageToken,files(id,name,mimeType,size,parents,webViewLink,hasThumbnail,createdTime)';
  const out: ArchivoDrive[] = [];
  const set = new Set(carpetas);
  let pageToken = '';
  do {
    const j = await drive(token, `/files?pageSize=1000&orderBy=createdTime desc&fields=${encodeURIComponent(fields)}&q=${encodeURIComponent(query)}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`);
    for (const f of j.files || []) {
      out.push({
        id: f.id, nombre: f.name, mime: f.mimeType, tamano: f.size != null ? Number(f.size) : null,
        carpetaId: (f.parents || []).find((p: string) => set.has(p)) || f.parents?.[0] || '',
        verUrl: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
        tieneMiniatura: !!f.hasThumbnail, creado: f.createdTime,
      });
    }
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  return out;
}

/** Mueve un archivo de una carpeta a otra (asignar/cambiar evento). */
export async function mover(token: string, id: string, a: string, desde: string[]): Promise<void> {
  const p = new URLSearchParams({ addParents: a, fields: 'id' });
  const quitar = desde.filter((d) => d !== a);
  if (quitar.length) p.set('removeParents', quitar.join(','));
  await drive(token, `/files/${encodeURIComponent(id)}?${p}`, { method: 'PATCH', body: '{}' });
}

export interface Cuota {
  /** null = almacenamiento ilimitado (algunas cuentas de Workspace). */
  limite: number | null;
  uso: number;
  libre: number | null;
}

export async function cuota(token: string): Promise<Cuota> {
  const j = await drive(token, '/about?fields=storageQuota');
  const s = j.storageQuota || {};
  const limite = s.limit != null ? Number(s.limit) : null;
  const uso = Number(s.usage || 0);
  return { limite, uso, libre: limite != null ? Math.max(0, limite - uso) : null };
}

/**
 * Abre una sesión de subida reanudable y devuelve su URL. El navegador hace el PUT con los
 * bytes directamente a esa URL. `origin` es el del navegador: Google responde con las
 * cabeceras CORS de ese origen solo si la sesión se abrió declarándolo.
 */
export async function abrirSubida(token: string, opts: { nombre: string; mime: string; tamano: number; carpeta: string; origin: string }): Promise<string> {
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': opts.mime,
      'X-Upload-Content-Length': String(opts.tamano),
      Origin: opts.origin,
    },
    body: JSON.stringify({ name: opts.nombre, parents: [opts.carpeta] }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    const reason = j?.error?.errors?.[0]?.reason || '';
    if (reason === 'storageQuotaExceeded') throw new DriveSinEspacio();
    throw new Error(`Google Drive: ${j?.error?.message || res.status}`);
  }
  const location = res.headers.get('location');
  if (!location) throw new Error('Google Drive no abrió la sesión de subida.');
  return location;
}

/**
 * La miniatura (imagen pequeña) de un archivo. `token` es el del usuario o, para el almacén de
 * la empresa (lib/media/drive.ts), el de la cuenta de servicio. `lado` = lado mayor en px.
 */
export async function miniatura(token: string, id: string, lado = 220): Promise<Response | null> {
  const j = await drive(token, `/files/${encodeURIComponent(id)}?fields=thumbnailLink`);
  if (!j.thumbnailLink) return null;
  // `=s220` → lado mayor de 220 px: suficiente para la cuadrícula y unos pocos KB.
  const url = String(j.thumbnailLink).replace(/=s\d+$/, `=s${lado}`);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  return res.ok ? res : null;
}
