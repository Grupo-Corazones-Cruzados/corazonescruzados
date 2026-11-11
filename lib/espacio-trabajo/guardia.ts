import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser, type TokenPayload } from '@/lib/auth/jwt';

/**
 * EL CANDADO DEL ESPACIO DE TRABAJO. Solo existe en la instancia local que arranca launchd.
 *
 * ⚠️ En Railway no hay variable ni servicio: todo responde 404. Y en local la sesión de GCC no
 * basta, porque sin `JWT_SECRET` se firma con el secreto por defecto y un token de administrador
 * se puede fabricar. Por eso lleva contraseña y cookie propias, firmadas con el token del servicio.
 */
export function espacioHabilitado(): boolean {
  const e = process.env;
  if (e['RAILWAY_ENVIRONMENT'] || e['RAILWAY_ENVIRONMENT_ID'] || e['RAILWAY_PROJECT_ID'] || e['RAILWAY_SERVICE_ID']) return false;
  return e['ESPACIO_TRABAJO_LOCAL'] === '1';
}

const COOKIE = 'espacio_sesion';
export const SERVICIO = `http://127.0.0.1:${process.env['ESPACIO_PUERTO'] || 3791}`;

export function tokenServicio(): string {
  const dir = process.env['ESPACIO_DATOS'] || path.join(os.homedir(), '.gcc-espacio');
  return fs.readFileSync(path.join(dir, 'token'), 'utf8').trim();
}

const secreto = () => crypto.createHash('sha256').update(`cookie:${tokenServicio()}`).digest();

export async function emitirSesion(seguro: boolean) {
  const jwt = await new SignJWT({ espacio: true }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('7d').sign(secreto());
  (await cookies()).set(COOKIE, jwt, { httpOnly: true, sameSite: 'strict', secure: seguro, maxAge: 7 * 24 * 3600, path: '/' });
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE);
}

/**
 * Dentro de la app, el espacio va en un marco de otro dominio. Safari no le da cookies a un marco
 * así, de modo que ahí la sesión es un token que el navegador manda en una cabecera.
 */
export async function emitirToken(): Promise<string> {
  return new SignJWT({ espacio: true }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('30d').sign(secreto());
}

/**
 * `enUrl`: el token del marco cuando llega en la dirección. Solo para lo que el navegador pide sin poder
 * añadir cabeceras (un `<img>` o un `<video>` dentro del marco de la app); lo usa una ruta que lo pida.
 */
export async function sesionValida(enUrl?: string | null): Promise<boolean> {
  const c = (await cookies()).get(COOKIE)?.value || (await headers()).get('x-espacio-token') || enUrl;
  if (!c) return false;
  try { await jwtVerify(c, secreto()); return true; } catch { return false; }
}

/**
 * Quién pregunta. Dentro del marco de las apps no hay cookie de GCC World, pero la contraseña del
 * Espacio de trabajo es del administrador: la misma equivalencia que hace `/api/espacio-trabajo/acceso`.
 * En la web no cambia nada, porque ahí `espacioHabilitado()` es falso.
 */
export async function usuarioLocal(enUrl?: string | null): Promise<TokenPayload | null> {
  const usuario = await getCurrentUser();
  if (usuario) return usuario;
  const email = process.env['ESPACIO_ADMIN_EMAIL'];
  if (!espacioHabilitado() || !email || !(await sesionValida(enUrl))) return null;
  const { rows: [u] } = await pool.query(`SELECT id, email, role FROM gcc_world.users WHERE lower(email) = lower($1) AND role = 'admin'`, [email]);
  return u ? { userId: String(u.id), email: u.email, role: u.role } : null;
}

const NO_EXISTE = () => new NextResponse('Not Found', { status: 404 });

/** Otra web no puede mandar órdenes usando la cookie de quien la visita. */
export function mismoOrigen(req: Request, h: Headers): boolean {
  const origen = req.headers.get('origin');
  if (!origen) return false;
  const anfitrion = h.get('x-forwarded-host') || h.get('host');
  try { return new URL(origen).host === anfitrion; } catch { return false; }
}

/** Devuelve la respuesta de rechazo, o null si puede pasar. */
export async function rechazo(req: Request, { sinSesion = false, enUrl = null as string | null } = {}): Promise<Response | null> {
  if (!espacioHabilitado()) return NO_EXISTE();
  const h = await headers();
  if (req.method !== 'GET' && !mismoOrigen(req, h)) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  if (!sinSesion && !(await sesionValida(enUrl))) return NextResponse.json({ error: 'Hay que entrar con la contraseña.' }, { status: 401 });
  return null;
}

export async function llamarServicio(ruta: string, init: RequestInit = {}) {
  return fetch(`${SERVICIO}${ruta}`, {
    ...init, cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}), Authorization: `Bearer ${tokenServicio()}` },
  });
}
