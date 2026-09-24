import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import type { RolUsuario } from '@/generated/prisma/enums';

/**
 * Sesión del producto. Tres clases de sesión en DOS cookies:
 *  - `catering_sesion` → la gente del negocio. Lleva `tipo`: el PERSONAL (con su
 *    oficio) o un CLIENTE final (con su id de cliente). Son la misma cookie porque
 *    son el mismo negocio y nunca conviven en un navegador; se distinguen por
 *    `tipo` y `lib/inquilino.ts` no deja que uno entre por la puerta del otro.
 *  - `catering_gcc` → quien opera el producto. Cookie distinta a propósito: un
 *    operador que abre el panel de un negocio no debe heredar permisos dentro.
 */

export const COOKIE_SESION = 'catering_sesion';
/**
 * La cookie del PASO INTERMEDIO. Vive entre «la contraseña es correcta» y «se hizo el
 * segundo paso», y no es una sesión: no abre nada.
 */
export const COOKIE_PASO2 = 'catering_paso2';
/** Lo que se espera para completar el segundo paso. Pasado eso, se vuelve a empezar. */
const MINUTOS_PASO2 = 10;
export const COOKIE_GCC = 'catering_gcc';
const DIAS = 7;

function secreto() {
  const s = process.env.JWT_SECRETO;
  if (!s) throw new Error('Falta JWT_SECRETO');
  return new TextEncoder().encode(s);
}

export type SesionPersonal = {
  tipo: 'personal';
  uid: number;
  inquilinoId: number;
  slug: string;
  nombre: string;
  rol: RolUsuario;
};

export type SesionCliente = {
  tipo: 'cliente';
  cid: number;
  inquilinoId: number;
  slug: string;
  nombre: string;
};

export type SesionUsuario = SesionPersonal | SesionCliente;

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
    if (payload.tipo === 'personal' && typeof payload.uid === 'number')
      return payload as unknown as SesionPersonal;
    if (payload.tipo === 'cliente' && typeof payload.cid === 'number')
      return payload as unknown as SesionCliente;
    return null;
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

// Los permisos del personal NO viven aquí: son oficios, no una escalera.
// Ver `lib/permisos.ts`.


// ── EL SEGUNDO PASO ──────────────────────────────────────────────────────────

/**
 * ⚠️ POR QUÉ HACE FALTA GUARDAR ALGO ENTRE LOS DOS PASOS.
 *
 * Entre escribir la contraseña y escribir el código pasa una petición nueva, y el
 * navegador podría llegar a la segunda diciendo «ya hice la primera». Si se le creyera,
 * el segundo paso sería el ÚNICO paso: bastaría con tener un código —o una passkey— para
 * entrar sin saber ninguna contraseña.
 *
 * Así que el paso 1 deja un testigo **firmado por el servidor**, corto de vida y que no
 * abre nada por sí mismo: dice qué cuenta pasó la contraseña, y el paso 2 solo continúa
 * esa. Se borra en cuanto se completa.
 */
export type PasoDos = { uid: number; inquilinoId: number; slug: string; email: string };

export async function abrirPasoDos(p: PasoDos) {
  const token = await new SignJWT({ ...p, paso: 2 })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MINUTOS_PASO2}m`)
    .sign(secreto());
  (await cookies()).set(COOKIE_PASO2, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MINUTOS_PASO2 * 60,
  });
}

export async function leerPasoDos(): Promise<PasoDos | null> {
  const token = (await cookies()).get(COOKIE_PASO2)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secreto());
    // `paso: 2` impide que una sesión normal —firmada con el mismo secreto— sirva como
    // testigo del primer paso, y al revés.
    if (payload.paso !== 2 || typeof payload.uid !== 'number') return null;
    return payload as unknown as PasoDos;
  } catch {
    return null;
  }
}

export async function cerrarPasoDos() {
  (await cookies()).delete(COOKIE_PASO2);
}
