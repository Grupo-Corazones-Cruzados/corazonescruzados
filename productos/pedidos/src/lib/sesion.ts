import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import type { RolUsuario } from '@/generated/prisma/enums';

/**
 * Sesión del producto. Dos tipos de sesión que NO se mezclan:
 *  - la de una persona del hotel   → cookie `pedidos_sesion`, lleva su inquilino;
 *  - la de quien opera el producto → cookie `pedidos_gcc`.
 * Son cookies distintas a propósito: un operador que abre el panel de un hotel no
 * debe heredar permisos dentro de él, y al revés tampoco.
 */

export const COOKIE_SESION = 'pedidos_sesion';
export const COOKIE_GCC = 'pedidos_gcc';
const DIAS = 7;

function secreto() {
  const s = process.env.JWT_SECRETO;
  if (!s) throw new Error('Falta JWT_SECRETO');
  return new TextEncoder().encode(s);
}

export type SesionUsuario = {
  uid: number;
  inquilinoId: number;
  slug: string;
  nombre: string;
  rol: RolUsuario;
};

export type SesionOperador = { oid: number; nombre: string; email: string };

async function firmar(carga: Record<string, unknown>) {
  return new SignJWT(carga)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${DIAS}d`)
    .sign(secreto());
}

async function guardar(nombre: string, token: string) {
  (await cookies()).set(nombre, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DIAS * 24 * 60 * 60,
  });
}

export async function abrirSesionUsuario(s: SesionUsuario) {
  await guardar(COOKIE_SESION, await firmar({ ...s }));
}

export async function abrirSesionOperador(s: SesionOperador) {
  await guardar(COOKIE_GCC, await firmar({ ...s }));
}

export async function leerSesionUsuario(): Promise<SesionUsuario | null> {
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secreto());
    if (typeof payload.uid !== 'number') return null;
    return payload as unknown as SesionUsuario;
  } catch {
    return null;
  }
}

export async function leerSesionOperador(): Promise<SesionOperador | null> {
  const token = (await cookies()).get(COOKIE_GCC)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secreto());
    if (typeof payload.oid !== 'number') return null;
    return payload as unknown as SesionOperador;
  } catch {
    return null;
  }
}

export async function cerrarSesion(nombre = COOKIE_SESION) {
  (await cookies()).delete(nombre);
}

// Los permisos NO viven aquí: en este producto no son una escalera sino oficios
// distintos. Ver `lib/permisos.ts`.
