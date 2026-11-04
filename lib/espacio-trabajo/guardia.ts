import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';

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

export async function sesionValida(): Promise<boolean> {
  const c = (await cookies()).get(COOKIE)?.value;
  if (!c) return false;
  try { await jwtVerify(c, secreto()); return true; } catch { return false; }
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
export async function rechazo(req: Request, { sinSesion = false } = {}): Promise<Response | null> {
  if (!espacioHabilitado()) return NO_EXISTE();
  const h = await headers();
  if (req.method !== 'GET' && !mismoOrigen(req, h)) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  if (!sinSesion && !(await sesionValida())) return NextResponse.json({ error: 'Hay que entrar con la contraseña.' }, { status: 401 });
  return null;
}

export async function llamarServicio(ruta: string, init: RequestInit = {}) {
  return fetch(`${SERVICIO}${ruta}`, {
    ...init, cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}), Authorization: `Bearer ${tokenServicio()}` },
  });
}
