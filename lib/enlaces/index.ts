import crypto from 'crypto';
import { pool } from '@/lib/db';
import { authDrive } from '@/lib/integrations/google-workspace';
import { aPapelera, carpeta } from '@/lib/media/drive';
import { limpiarNombre } from '@/lib/media';

/**
 * ⇒ ENLACES DE UN SOLO USO (Herramientas → Gestión; Fernando, 2026-10-16).
 *
 * Un miembro genera un enlace que pide un texto y hasta 10 archivos (100 MB cada uno). Quien
 * lo abre responde UNA vez y el enlace se cierra solo. Opcionalmente el enlace va atado a un
 * cliente y entonces solo entra quien inicie sesión con la cuenta de GCC World de ese cliente.
 *
 * - Se consume al ENVIAR, no al abrir: WhatsApp, Gmail o Slack abren el enlace para sacar la
 *   vista previa, y si abrir lo gastara llegaría al cliente ya usado.
 * - Los archivos NO pasan por el servidor: Railway/Cloudflare cortan cuerpos de ~100 MB. El
 *   servidor abre una sesión de subida «resumable» en el Drive de la empresa con el tamaño ya
 *   declarado y el navegador sube directo a Google (CORS con `Origin`). Drive rechaza un cuerpo
 *   mayor que lo declarado (medido el 2026-10-16), así que el tope se cumple de verdad.
 * - Los archivos no se registran en `media_drive`: `/api/media` sirve a cualquiera con el id, y
 *   esto puede ser información privada del cliente. Se bajan por `/api/enlaces/<id>/archivos`.
 * - Los ve quien creó el enlace y el admin (Fernando, 2026-10-16).
 */

export const MAX_ARCHIVOS = 10;
export const MAX_BYTES = 100 * 1024 * 1024;
/** Sesiones de subida por enlace: 10 archivos y margen para reintentos, no un disco gratis. */
export const MAX_SUBIDAS = 40;
export const MAX_TEXTO = 20000;

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.grupocc.org').replace(/\/$/, '');
export const urlEnlace = (token: string) => `${APP_URL}/enlace/${token}`;

export type Archivo = { id: string; nombre: string; mime: string; tamano: number };
export type EstadoEnlace = 'vigente' | 'usado' | 'cerrado' | 'vencido';

let asegurando: Promise<void> | null = null;
export function asegurarTablaEnlaces(): Promise<void> {
  if (asegurando) return asegurando;
  const p = pool
    .query(`
      CREATE TABLE IF NOT EXISTS gcc_world.enlaces_unicos (
        id SERIAL PRIMARY KEY,
        token VARCHAR(64) NOT NULL UNIQUE,
        titulo TEXT NOT NULL,
        indicaciones TEXT NOT NULL DEFAULT '',
        client_id BIGINT,
        exige_cuenta BOOLEAN NOT NULL DEFAULT FALSE,
        estado TEXT NOT NULL DEFAULT 'vigente',
        vence_en TIMESTAMPTZ NOT NULL,
        enviado_a TEXT,
        creado_por UUID NOT NULL,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        subidas INT NOT NULL DEFAULT 0,
        respuesta TEXT,
        archivos JSONB NOT NULL DEFAULT '[]',
        respondido_en TIMESTAMPTZ,
        respondido_por UUID,
        cerrado_en TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS enlaces_unicos_creado_por_idx ON gcc_world.enlaces_unicos(creado_por);
    `)
    .then(() => undefined)
    .catch((e: unknown) => { asegurando = null; throw e; });
  asegurando = p;
  return p;
}

export const nuevoToken = () => crypto.randomBytes(24).toString('base64url');

/** Vigente en la base pero pasado de fecha se muestra «vencido»: no hace falta un cron. */
export function estadoDe(e: { estado: string; vence_en: string | Date }): EstadoEnlace {
  if (e.estado === 'vigente' && new Date(e.vence_en).getTime() <= Date.now()) return 'vencido';
  return e.estado as EstadoEnlace;
}

/** Quien puede crear enlaces: el equipo (miembros y admin), no clientes ni candidatos. */
export const esEquipo = (role?: string) => role === 'admin' || role === 'member';

/** Lo ve quien lo creó y el admin. */
export const puedeVer = (u: { userId: string; role: string }, e: { creado_por: string }) =>
  u.role === 'admin' || String(e.creado_por) === String(u.userId);

/** Ruta de su carpeta en el Drive de la empresa. El id va delante: el título puede repetirse. */
export const rutaDe = (e: { id: number; titulo: string }) =>
  ['Enlaces de un solo uso', `${e.id} · ${limpiarNombre(e.titulo) || 'Enlace'}`];

export async function porToken(token: string) {
  await asegurarTablaEnlaces();
  const { rows: [e] } = await pool.query(
    `SELECT e.*, c.user_id AS cliente_user_id, COALESCE(c.name, c.full_name) AS cliente_nombre
       FROM gcc_world.enlaces_unicos e
       LEFT JOIN gcc_world.clients c ON c.id = e.client_id
      WHERE e.token = $1`,
    [token],
  );
  return e ?? null;
}

export type Acceso =
  | { ok: true }
  | { ok: false; motivo: 'no_existe' | 'usado' | 'cerrado' | 'vencido' | 'necesita_sesion' | 'otra_cuenta' };

/**
 * ¿Puede responder quien tiene esta sesión? Se pregunta al abrir, al pedir cada subida y al
 * enviar: el estado y la cuenta pueden cambiar entre una cosa y otra.
 */
export function acceso(e: any, user: { userId: string } | null): Acceso {
  if (!e) return { ok: false, motivo: 'no_existe' };
  const estado = estadoDe(e);
  if (estado !== 'vigente') return { ok: false, motivo: estado };
  if (e.exige_cuenta) {
    if (!user) return { ok: false, motivo: 'necesita_sesion' };
    if (!e.cliente_user_id || String(e.cliente_user_id) !== String(user.userId)) return { ok: false, motivo: 'otra_cuenta' };
  }
  return { ok: true };
}

/**
 * Abre una sesión de subida en Drive para UN archivo, con nombre, tipo y tamaño ya fijados.
 * Devuelve la URL a la que el navegador hace `PUT` con los bytes.
 */
export async function abrirSubida(o: {
  /** Carpeta de destino en el Drive de la empresa (`rutaDe`, o la de una entrega). */
  ruta: string[]; nombre: string; mime: string; tamano: number; origin: string;
}): Promise<string> {
  const padre = await carpeta(o.ruta);
  const { token } = await authDrive().getAccessToken();
  if (!token) throw new Error('Drive no respondió');
  const r = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,parents',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': o.mime,
        'X-Upload-Content-Length': String(o.tamano),
        // Sin `Origin`, Google no deja que el navegador suba a esta sesión (CORS).
        Origin: o.origin,
      },
      body: JSON.stringify({ name: limpiarNombre(o.nombre) || 'archivo', parents: [padre] }),
    },
  );
  const url = r.headers.get('location');
  if (!r.ok || !url) throw new Error(`Drive no abrió la subida (${r.status})`);
  return url;
}

/**
 * Comprueba en Drive que cada archivo existe, vive en la carpeta `ruta` (la de ESTE enlace) y no pasa del
 * tope. Lo que manda el navegador no se cree: un id de otro enlace o de otra carpeta se rechaza.
 */
export async function verificarArchivos(ruta: string[], ids: string[]): Promise<Archivo[]> {
  if (ids.length === 0) return [];
  const padre = await carpeta(ruta);
  const { token } = await authDrive().getAccessToken();
  const out: Archivo[] = [];
  for (const id of ids) {
    if (!/^[\w-]{10,200}$/.test(id)) throw new Error('Archivo no válido');
    const r = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType,size,parents,trashed`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!r.ok) throw new Error('Uno de los archivos no terminó de subir');
    const f = await r.json();
    if (f.trashed || !(f.parents || []).includes(padre)) throw new Error('Archivo no válido');
    const tamano = Number(f.size) || 0;
    if (tamano > MAX_BYTES) throw new Error(`«${f.name}» pasa de 100 MB`);
    out.push({ id: f.id, nombre: f.name, mime: f.mimeType || 'application/octet-stream', tamano });
  }
  return out;
}

/** Manda a la papelera de Drive lo que haya en la carpeta y no esté en `quedan` (subido y quitado). */
export async function limpiarCarpeta(ruta: string[], quedan: Set<string>) {
  const padre = await carpeta(ruta);
  const { token } = await authDrive().getAccessToken();
  const q = encodeURIComponent(`'${padre}' in parents and trashed = false`);
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&pageSize=100`, { headers: { Authorization: `Bearer ${token}` } });
  const { files = [] } = await r.json();
  for (const f of files as { id: string }[]) if (!quedan.has(f.id)) await aPapelera(f.id);
}
