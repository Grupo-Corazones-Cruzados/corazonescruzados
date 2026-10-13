/**
 * CONEXIÓN DE GOOGLE POR USUARIO (OAuth 2.0 de tres patas).
 *
 * No confundir con `google-workspace.ts`: aquella es la cuenta de SERVICIO de GCC con
 * delegación de dominio (`@grupocc.org`), que actúa en nombre de la casa. Esta es la de
 * cada persona —miembro o candidato, con su Gmail o su cuenta del dominio— que autoriza
 * a la app a usar SU Drive (y, para lo que venga, su Gmail y su Calendar).
 *
 * Cliente OAuth: proyecto `grupo-corazones-cruzados` (`GOOGLE_OAUTH_CLIENT_ID` /
 * `GOOGLE_OAUTH_CLIENT_SECRET`). El refresh token se guarda CIFRADO (lib/cifrado.ts).
 *
 * Decisión de Fernando (2026-10-13): se piden TODOS los permisos de una vez —Drive
 * completo (para sincronizar lo que el usuario añada desde la app de Drive), Gmail y
 * Calendar—.
 */
import { pool } from '@/lib/db';
import { cifrar, descifrar, contextoGoogle } from '@/lib/cifrado';

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
] as const;

export const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive';

/** El usuario no tiene conexión (nunca conectó, o la quitó). */
export class GoogleNoConectado extends Error {
  code = 'google_no_conectado' as const;
  constructor() { super('Conecta tu cuenta de Google en Configuración → Conexiones.'); }
}
/** Google revocó el acceso (el usuario lo quitó desde su cuenta, cambió la clave…). */
export class GoogleReconectar extends Error {
  code = 'google_reconectar' as const;
  constructor() { super('Google retiró el acceso de la app. Vuelve a conectar tu cuenta en Configuración → Conexiones.'); }
}

export function googleOAuthConfigurado(): boolean {
  return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

/**
 * La URI de retorno sale del host de la petición: así sirve en local (localhost:3002) y en
 * producción (app.grupocc.org) sin variables distintas. Las dos están registradas en el
 * cliente OAuth; una que no lo esté la rechaza Google, no nosotros.
 */
export function redirectUri(headers: Headers): string {
  const host = headers.get('x-forwarded-host') || headers.get('host') || 'localhost:3002';
  const proto = headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto.split(',')[0].trim()}://${host.split(',')[0].trim()}/api/google/callback`;
}

export function urlAutorizacion(opts: { redirectUri: string; state: string; loginHint?: string }): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    // offline + consent: es lo que garantiza que Google devuelva un refresh token también
    // cuando el usuario ya había autorizado antes (si no, solo lo da la primera vez).
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: opts.state,
  });
  if (opts.loginHint) p.set('login_hint', opts.loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

async function pedirToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      ...body,
    }),
    cache: 'no-store',
  });
  const j = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok) {
    const e = new Error(j.error_description || j.error || `Google respondió ${res.status}`) as Error & { googleError?: string };
    e.googleError = j.error;
    throw e;
  }
  return j;
}

/** El correo de la cuenta viene en el id_token (JWT firmado por Google, recibido por TLS directo de Google). */
function emailDelIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.email === 'string' ? payload.email : null;
  } catch { return null; }
}

/** Canjea el código del callback y guarda (o reemplaza) la conexión del usuario. */
export async function guardarConexion(userId: string, code: string, redirect: string): Promise<{ email: string; scopes: string[] }> {
  const t = await pedirToken({ code, redirect_uri: redirect, grant_type: 'authorization_code' });
  if (!t.refresh_token) {
    throw new Error('Google no entregó un permiso permanente. Vuelve a intentarlo.');
  }
  const email = emailDelIdToken(t.id_token);
  if (!email) throw new Error('Google no informó el correo de la cuenta.');
  const scopes = t.scope.split(' ').filter(Boolean);
  await pool.query(
    `INSERT INTO gcc_world.google_conexiones
       (user_id, google_email, scopes, refresh_token_cifrado, access_token_cifrado, access_expira, estado, conectada_en, actualizada_en)
     VALUES ($1, $2, $3, $4, $5, now() + make_interval(secs => $6), 'activa', now(), now())
     ON CONFLICT (user_id) DO UPDATE SET
       -- Otra cuenta de Google ⇒ las carpetas de la anterior no existen en esta: se olvida la raíz.
       carpeta_raiz_id = CASE WHEN gcc_world.google_conexiones.google_email = EXCLUDED.google_email
                              THEN gcc_world.google_conexiones.carpeta_raiz_id ELSE NULL END,
       google_email = EXCLUDED.google_email,
       scopes = EXCLUDED.scopes,
       refresh_token_cifrado = EXCLUDED.refresh_token_cifrado,
       access_token_cifrado = EXCLUDED.access_token_cifrado,
       access_expira = EXCLUDED.access_expira,
       estado = 'activa',
       conectada_en = now(),
       actualizada_en = now()`,
    [
      userId, email, scopes,
      cifrar(t.refresh_token, contextoGoogle(userId, 'refresh_token')),
      cifrar(t.access_token, contextoGoogle(userId, 'access_token')),
      Math.max(0, t.expires_in - 60),
    ],
  );
  return { email, scopes };
}

export interface ConexionGoogle {
  email: string;
  scopes: string[];
  estado: 'activa' | 'revocada';
  conectadaEn: string;
  carpetaRaizId: string | null;
}

export async function leerConexion(userId: string): Promise<ConexionGoogle | null> {
  const { rows } = await pool.query(
    `SELECT google_email, scopes, estado, conectada_en, carpeta_raiz_id
       FROM gcc_world.google_conexiones WHERE user_id = $1`,
    [userId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    email: r.google_email, scopes: r.scopes || [], estado: r.estado,
    conectadaEn: new Date(r.conectada_en).toISOString(), carpetaRaizId: r.carpeta_raiz_id,
  };
}

export async function guardarCarpetaRaiz(userId: string, folderId: string): Promise<void> {
  await pool.query(`UPDATE gcc_world.google_conexiones SET carpeta_raiz_id = $2, actualizada_en = now() WHERE user_id = $1`, [userId, folderId]);
}

/**
 * Token de acceso vigente del usuario. Reutiliza el guardado mientras le quede más de un
 * minuto; si no, lo renueva con el refresh token. `invalid_grant` ⇒ la conexión se marca
 * revocada y se lanza `GoogleReconectar` (nunca un error genérico ni una lista vacía).
 */
export async function tokenDeAcceso(userId: string): Promise<string> {
  const { rows } = await pool.query(
    `SELECT refresh_token_cifrado, access_token_cifrado, access_expira, estado
       FROM gcc_world.google_conexiones WHERE user_id = $1`,
    [userId],
  );
  const r = rows[0];
  if (!r) throw new GoogleNoConectado();
  if (r.estado === 'revocada') throw new GoogleReconectar();

  if (r.access_token_cifrado && r.access_expira && new Date(r.access_expira).getTime() > Date.now() + 60_000) {
    return descifrar(r.access_token_cifrado, contextoGoogle(userId, 'access_token'));
  }

  const refresh = descifrar(r.refresh_token_cifrado, contextoGoogle(userId, 'refresh_token'));
  let t: TokenResponse;
  try {
    t = await pedirToken({ refresh_token: refresh, grant_type: 'refresh_token' });
  } catch (e: any) {
    if (e?.googleError === 'invalid_grant') {
      await pool.query(`UPDATE gcc_world.google_conexiones SET estado = 'revocada', actualizada_en = now() WHERE user_id = $1`, [userId]);
      throw new GoogleReconectar();
    }
    throw e;
  }
  await pool.query(
    `UPDATE gcc_world.google_conexiones
        SET access_token_cifrado = $2, access_expira = now() + make_interval(secs => $3), actualizada_en = now()
      WHERE user_id = $1`,
    [userId, cifrar(t.access_token, contextoGoogle(userId, 'access_token')), Math.max(0, t.expires_in - 60)],
  );
  return t.access_token;
}

/** Desconecta: revoca en Google (si se puede) y borra la fila. No borra nada del Drive. */
export async function desconectar(userId: string): Promise<void> {
  const { rows } = await pool.query(`SELECT refresh_token_cifrado FROM gcc_world.google_conexiones WHERE user_id = $1`, [userId]);
  const blob = rows[0]?.refresh_token_cifrado;
  if (blob) {
    try {
      const refresh = descifrar(blob, contextoGoogle(userId, 'refresh_token'));
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: refresh }),
      });
    } catch (e: any) {
      // Si Google ya lo había revocado, no hay nada que revocar: se borra igual.
      console.log('Google revoke (ignorado):', e?.message);
    }
  }
  await pool.query(`DELETE FROM gcc_world.google_conexiones WHERE user_id = $1`, [userId]);
}

/** Respuesta HTTP uniforme para los errores de conexión (el cliente muestra «Conectar/Reconectar»). */
export function esErrorDeConexion(e: unknown): e is GoogleNoConectado | GoogleReconectar {
  return e instanceof GoogleNoConectado || e instanceof GoogleReconectar;
}
