/**
 * REDES SOCIALES POR TALENTO (Fernando, 2026-11-10: «en Configuración cada talento del usuario conecta sus
 * redes; una cuenta por red y talento; con métodos que cualquier usuario pueda usar en la web o la app»).
 *
 * ── QUÉ SE CONECTA ───────────────────────────────────────────────────────────────────────────────────────
 * YouTube, Instagram, Facebook, TikTok y LinkedIn. Facebook e Instagram salen de UNA autorización de Meta (la
 * página y su cuenta profesional de Instagram), así que conectar una conecta las dos.
 *
 * ── POR QUÉ EL `state` VIVE EN LA BASE Y NO EN UNA COOKIE ────────────────────────────────────────────────
 * Google, Meta y TikTok no dejan iniciar sesión dentro de un WebView: desde la app la conexión se abre en el
 * navegador del sistema, que no tiene la cookie de la app. El intento se guarda aquí con su dueño y se GASTA
 * al volver (un solo uso, 15 minutos). Si quien vuelve sí trae una sesión, tiene que ser la misma persona.
 *
 * Un proveedor sin credenciales en el servidor no se ofrece («pendiente de aprobación»): Meta, TikTok y
 * LinkedIn exigen revisión de la app antes de dejar publicar en cuentas de otros.
 */
import { randomBytes } from 'node:crypto';
import { pool } from '@/lib/db';
import { cifrar, descifrar } from '@/lib/cifrado';

export type RedTalento = 'youtube' | 'instagram' | 'facebook' | 'tiktok' | 'linkedin';
/** Lo que se autoriza: Meta trae Facebook e Instagram juntos. */
export type Proveedor = 'youtube' | 'meta' | 'tiktok' | 'linkedin';

export const REDES_TALENTO: { red: RedTalento; etiqueta: string; proveedor: Proveedor }[] = [
  { red: 'youtube', etiqueta: 'YouTube', proveedor: 'youtube' },
  { red: 'instagram', etiqueta: 'Instagram', proveedor: 'meta' },
  { red: 'facebook', etiqueta: 'Facebook', proveedor: 'meta' },
  { red: 'tiktok', etiqueta: 'TikTok', proveedor: 'tiktok' },
  { red: 'linkedin', etiqueta: 'LinkedIn', proveedor: 'linkedin' },
];
export const PROVEEDORES: Proveedor[] = ['youtube', 'meta', 'tiktok', 'linkedin'];
export const esProveedor = (v: string): v is Proveedor => (PROVEEDORES as string[]).includes(v);

const CADUCA_MIN = 15;
const contexto = (red: string, externo: string) => `redes_talento:${red}:${externo}`;

let lista = false;
export async function asegurarRedesTalento() {
  if (lista) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS gcc_world.redes_talento (
    id BIGSERIAL PRIMARY KEY, user_id UUID NOT NULL REFERENCES gcc_world.users (id) ON DELETE CASCADE,
    talento TEXT NOT NULL, red TEXT NOT NULL CHECK (red IN ('youtube', 'instagram', 'facebook', 'tiktok', 'linkedin')),
    externo_id TEXT NOT NULL, nombre TEXT NOT NULL, url TEXT, token_cifrado TEXT NOT NULL,
    extra JSONB NOT NULL DEFAULT '{}'::jsonb, estado TEXT NOT NULL DEFAULT 'activa',
    conectada_en TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (user_id, talento, red))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS gcc_world.redes_talento_intentos (
    nonce TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES gcc_world.users (id) ON DELETE CASCADE,
    talento TEXT NOT NULL, red TEXT NOT NULL, origen TEXT NOT NULL DEFAULT 'web', verificador TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now())`);
  lista = true;
}

/** Los talentos del CV de la persona, por su nombre. Sin ficha de miembro no hay talentos. */
export async function talentosDeUsuario(userId: string): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT cv.talents FROM gcc_world.users u JOIN gcc_world.member_cv_profiles cv ON cv.member_id = u.member_id WHERE u.id = $1`,
    [userId],
  );
  const t = rows[0]?.talents;
  return (Array.isArray(t) ? t : []).map((x: any) => String(x?.key ?? '').trim()).filter(Boolean);
}

export interface CuentaTalento {
  id: number; talento: string; red: RedTalento; externo_id: string; nombre: string; url: string | null; estado: string; conectada_en: string;
}

export async function cuentasDeUsuario(userId: string): Promise<CuentaTalento[]> {
  await asegurarRedesTalento();
  const { rows } = await pool.query(
    `SELECT id::int, talento, red, externo_id, nombre, url, estado, conectada_en FROM gcc_world.redes_talento WHERE user_id = $1 ORDER BY talento, red`,
    [userId],
  );
  return rows;
}

/** Las redes conectadas de un miembro, agrupadas por talento: las pinta su CV compartido. */
export async function redesPorTalentoDeMiembro(memberId: string): Promise<Map<string, { red: RedTalento; url: string }[]>> {
  await asegurarRedesTalento();
  const { rows } = await pool.query(
    `SELECT r.talento, r.red, r.url FROM gcc_world.redes_talento r JOIN gcc_world.users u ON u.id = r.user_id
      WHERE u.member_id = $1 AND r.estado = 'activa' AND r.url IS NOT NULL`,
    [memberId],
  );
  const orden = REDES_TALENTO.map((r) => r.red);
  const m = new Map<string, { red: RedTalento; url: string }[]>();
  for (const r of rows) {
    if (!m.has(r.talento)) m.set(r.talento, []);
    m.get(r.talento)!.push({ red: r.red, url: r.url });
  }
  for (const v of m.values()) v.sort((a, b) => orden.indexOf(a.red) - orden.indexOf(b.red));
  return m;
}

export async function guardarCuentaTalento(c: {
  userId: string; talento: string; red: RedTalento; externoId: string; nombre: string; url: string | null; token: unknown; extra?: Record<string, unknown>;
}) {
  await asegurarRedesTalento();
  await pool.query(
    `INSERT INTO gcc_world.redes_talento (user_id, talento, red, externo_id, nombre, url, token_cifrado, extra)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, talento, red) DO UPDATE SET externo_id = EXCLUDED.externo_id, nombre = EXCLUDED.nombre, url = EXCLUDED.url,
       token_cifrado = EXCLUDED.token_cifrado, extra = EXCLUDED.extra, estado = 'activa', conectada_en = now()`,
    [c.userId, c.talento, c.red, c.externoId, c.nombre, c.url, cifrar(JSON.stringify(c.token), contexto(c.red, c.externoId)), JSON.stringify(c.extra || {})],
  );
}

/** El permiso guardado de una cuenta (para publicar). */
export async function tokenDeCuenta(id: number): Promise<{ cuenta: CuentaTalento & { user_id: string; extra: any }; token: any } | null> {
  await asegurarRedesTalento();
  const { rows } = await pool.query(`SELECT *, id::int FROM gcc_world.redes_talento WHERE id = $1`, [id]);
  const r = rows[0];
  if (!r) return null;
  return { cuenta: r, token: JSON.parse(descifrar(r.token_cifrado, contexto(r.red, r.externo_id))) };
}

export async function actualizarToken(id: number, red: string, externo: string, token: unknown) {
  await pool.query(`UPDATE gcc_world.redes_talento SET token_cifrado = $2, estado = 'activa' WHERE id = $1`, [id, cifrar(JSON.stringify(token), contexto(red, externo))]);
}

export async function marcarReconectar(id: number) {
  await pool.query(`UPDATE gcc_world.redes_talento SET estado = 'reconectar' WHERE id = $1`, [id]);
}

/** Quita una cuenta. Solo la de su dueño: el `user_id` va en la condición, no se comprueba aparte. */
export async function quitarCuenta(userId: string, id: number): Promise<boolean> {
  await asegurarRedesTalento();
  const { rowCount } = await pool.query(`DELETE FROM gcc_world.redes_talento WHERE id = $1 AND user_id = $2`, [id, userId]);
  return (rowCount ?? 0) > 0;
}

export async function crearIntento(userId: string, talento: string, red: Proveedor, origen: 'web' | 'app'): Promise<string> {
  await asegurarRedesTalento();
  await pool.query(`DELETE FROM gcc_world.redes_talento_intentos WHERE creado_en < now() - make_interval(mins => $1)`, [CADUCA_MIN]);
  const nonce = randomBytes(24).toString('base64url');
  await pool.query(
    `INSERT INTO gcc_world.redes_talento_intentos (nonce, user_id, talento, red, origen) VALUES ($1, $2, $3, $4, $5)`,
    [nonce, userId, talento, red, origen],
  );
  return nonce;
}

/** El intento sin gastarlo (al salir hacia el proveedor). */
export async function leerIntento(nonce: string) {
  await asegurarRedesTalento();
  const { rows } = await pool.query(
    `SELECT user_id, talento, red, origen FROM gcc_world.redes_talento_intentos WHERE nonce = $1 AND creado_en > now() - make_interval(mins => $2)`,
    [nonce, CADUCA_MIN],
  );
  return rows[0] as { user_id: string; talento: string; red: Proveedor; origen: 'web' | 'app' } | undefined;
}

/** Al volver: se gasta, valga o no. Un `state` repetido ya no encuentra nada. */
export async function gastarIntento(nonce: string) {
  await asegurarRedesTalento();
  const { rows } = await pool.query(
    `DELETE FROM gcc_world.redes_talento_intentos WHERE nonce = $1 RETURNING user_id, talento, red, origen, creado_en > now() - make_interval(mins => $2) AS vigente`,
    [nonce, CADUCA_MIN],
  );
  const r = rows[0];
  return r?.vigente ? (r as { user_id: string; talento: string; red: Proveedor; origen: 'web' | 'app' }) : undefined;
}
