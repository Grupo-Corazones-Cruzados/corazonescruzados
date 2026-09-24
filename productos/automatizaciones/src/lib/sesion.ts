import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import type { Rol } from '@/generated/prisma/enums';

/**
 * Sesión del producto. Dos tipos de sesión que NO se mezclan:
 *  - la de una persona del cliente → cookie `automatizaciones_sesion`, lleva su inquilino;
 *  - la de quien opera el producto → cookie `automatizaciones_gcc`.
 * Son cookies distintas a propósito: un operador que abre el panel de un hotel no
 * debe heredar permisos dentro de él, y al revés tampoco.
 */

export const COOKIE_SESION = 'automatizaciones_sesion';
export const COOKIE_GCC = 'automatizaciones_gcc';
/**
 * La cookie del PASO INTERMEDIO. Vive entre «la contraseña es correcta» y «se hizo el
 * segundo paso», y no es una sesión: no abre nada.
 */
export const COOKIE_PASO2 = 'automatizaciones_paso2';
const DIAS = 7;
/** Lo que se espera para completar el segundo paso. Pasado eso, se vuelve a empezar. */
const MINUTOS_PASO2 = 10;

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
  rol: Rol;
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

// En este producto los roles SÍ son una escalera (ADMIN > OPERADOR > CONSULTA):
// quien puede lo de arriba puede lo de abajo. Ver `lib/inquilino.ts`.


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
