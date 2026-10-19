import crypto from 'crypto';
import { pool } from '@/lib/db';
import { estadoDe, type Archivo } from '@/lib/enlaces';

/**
 * ⇒ ENTREGAS DE UN SOLO USO (Herramientas → Gestión; Fernando, 2026-10-19).
 *
 * La otra cara del «Enlace de un solo uso» (`lib/enlaces`): allí el de fuera ENVÍA; aquí RECIBE.
 * Un miembro sube un mensaje y hasta 10 archivos (100 MB cada uno) y comparte un enlace; quien lo
 * abre los ve y los descarga una sola vez, y después pierde el acceso. «Tiene que funcionar igual»
 * que el otro (Fernando), así que reutiliza sus piezas: vigencia, cuenta del cliente opcional,
 * subida directa a Drive, quién lo ve (creador y admin), cerrar y eliminar.
 *
 * - Se gasta con un gesto, no al abrir: WhatsApp o Gmail abren el enlace para la vista previa. La
 *   página enseña el título y cuántos archivos hay; el mensaje y las descargas aparecen al pulsar
 *   «Ver y descargar», que es lo que lo gasta (como «Enviar» gasta el otro).
 * - Gastado, ESE navegador tiene `VENTANA_MIN` para bajar todo (cookie con un secreto cuyo hash
 *   se guarda en la fila): si una descarga de 100 MB se corta, se puede repetir. Cualquier otro
 *   navegador ve «ya se usó».
 * - Estados: `preparando` (el miembro aún está subiendo; para fuera no existe) → `vigente` →
 *   `usado` | `cerrado` (a mano) | vencido (calculado, como en enlaces).
 * - Archivos en el Drive de la empresa, carpeta «Entregas de un solo uso/<id>», fuera de
 *   `media_drive` (es información privada). Se bajan por rutas que comprueban la sesión.
 */

export const VENTANA_MIN = 60;
export const COOKIE = (id: number) => `entrega_${id}`;

export type EstadoEntrega = 'preparando' | 'vigente' | 'usado' | 'cerrado' | 'vencido';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.grupocc.org').replace(/\/$/, '');
export const urlEntrega = (token: string) => `${APP_URL}/entrega/${token}`;

/** Carpeta en Drive: por id, porque el título se pone al final (los archivos suben antes). */
export const rutaEntrega = (e: { id: number }) => ['Entregas de un solo uso', String(e.id)];

let asegurando: Promise<void> | null = null;
export function asegurarTablaEntregas(): Promise<void> {
  if (asegurando) return asegurando;
  const p = pool
    .query(`
      CREATE TABLE IF NOT EXISTS gcc_world.entregas_unicas (
        id SERIAL PRIMARY KEY,
        token VARCHAR(64) NOT NULL UNIQUE,
        titulo TEXT NOT NULL DEFAULT '',
        mensaje TEXT NOT NULL DEFAULT '',
        client_id BIGINT,
        exige_cuenta BOOLEAN NOT NULL DEFAULT FALSE,
        estado TEXT NOT NULL DEFAULT 'preparando',
        vence_en TIMESTAMPTZ,
        enviado_a TEXT,
        creado_por UUID NOT NULL,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        subidas INT NOT NULL DEFAULT 0,
        archivos JSONB NOT NULL DEFAULT '[]',
        abierto_en TIMESTAMPTZ,
        abierto_por UUID,
        sesion_hash TEXT,
        descargas JSONB NOT NULL DEFAULT '[]',
        cerrado_en TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS entregas_unicas_creado_por_idx ON gcc_world.entregas_unicas(creado_por);
    `)
    .then(() => undefined)
    .catch((e: unknown) => { asegurando = null; throw e; });
  asegurando = p;
  return p;
}

export const hashSesion = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export function estadoEntrega(e: { estado: string; vence_en: string | Date | null }): EstadoEntrega {
  if (e.estado === 'preparando') return 'preparando';
  return estadoDe({ estado: e.estado, vence_en: e.vence_en as any }) as EstadoEntrega;
}

export async function entregaPorToken(token: string) {
  await asegurarTablaEntregas();
  const { rows: [e] } = await pool.query(
    `SELECT e.*, c.user_id AS cliente_user_id
       FROM gcc_world.entregas_unicas e
       LEFT JOIN gcc_world.clients c ON c.id = e.client_id
      WHERE e.token = $1`,
    [token],
  );
  return e ?? null;
}

type Motivo = 'no_existe' | 'usado' | 'cerrado' | 'vencido' | 'necesita_sesion' | 'otra_cuenta';

/** La cuenta pedida (si la hay): se comprueba al abrir y en CADA descarga. */
function motivoCuenta(e: any, user: { userId: string } | null): Motivo | null {
  if (!e.exige_cuenta) return null;
  if (!user) return 'necesita_sesion';
  if (!e.cliente_user_id || String(e.cliente_user_id) !== String(user.userId)) return 'otra_cuenta';
  return null;
}

/** ¿Puede GASTARLO ahora quien tiene esta sesión? (pulsar «Ver y descargar»). */
export function puedeAbrir(e: any, user: { userId: string } | null): { ok: true } | { ok: false; motivo: Motivo } {
  if (!e) return { ok: false, motivo: 'no_existe' };
  const estado = estadoEntrega(e);
  if (estado === 'preparando') return { ok: false, motivo: 'no_existe' };
  if (estado !== 'vigente') return { ok: false, motivo: estado };
  const m = motivoCuenta(e, user);
  return m ? { ok: false, motivo: m } : { ok: true };
}

/** ¿Este navegador está dentro de su ventana de descarga? */
export function enVentana(e: any, cookie: string | undefined, user: { userId: string } | null): boolean {
  if (!e || e.estado !== 'usado' || !e.abierto_en || !e.sesion_hash || !cookie) return false;
  if (new Date(e.abierto_en).getTime() + VENTANA_MIN * 60000 <= Date.now()) return false;
  if (motivoCuenta(e, user)) return false;
  const a = Buffer.from(hashSesion(cookie)), b = Buffer.from(String(e.sesion_hash));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Lo que se mandó a borrador y nunca se publicó (se cerró el panel): fuera pasado un día. */
export async function purgarBorradores() {
  await asegurarTablaEntregas();
  const { rows } = await pool.query(
    `DELETE FROM gcc_world.entregas_unicas WHERE estado = 'preparando' AND creado_en < NOW() - INTERVAL '1 day'
     RETURNING id, subidas`,
  );
  if (!rows.length) return;
  const { aPapelera, carpeta } = await import('@/lib/media/drive');
  for (const e of rows) {
    if (Number(e.subidas) > 0) {
      try { await aPapelera(await carpeta(rutaEntrega(e))); }
      catch (err: any) { console.error('[entregas] borrador a la papelera', e.id, err?.message); }
    }
  }
}

/** Lo que ve quien ya la abrió en este navegador: el mensaje, los archivos y hasta cuándo. */
export function contenido(e: any) {
  return {
    titulo: e.titulo, mensaje: e.mensaje,
    archivos: (e.archivos as Archivo[]).map((a) => ({ id: a.id, nombre: a.nombre, tamano: a.tamano })),
    cierra_en: new Date(new Date(e.abierto_en).getTime() + VENTANA_MIN * 60000).toISOString(),
  };
}
