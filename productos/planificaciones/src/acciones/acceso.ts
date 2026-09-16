'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { evaluarAcceso } from '@/lib/inquilino';
import { INICIO_DE_ROL } from '@/lib/permisos';
import { abrirSesionUsuario, abrirSesionOperador, cerrarSesion, COOKIE_GCC, COOKIE_SESION } from '@/lib/sesion';

export type ResultadoAcceso = { error?: string };

const HASH_FALSO = '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';

/**
 * Entrar a una institución con usuario y contraseña. El mensaje de error es
 * DELIBERADAMENTE el mismo para cuenta inexistente y contraseña incorrecta:
 * distinguirlos revela qué cuentas existen.
 */
export async function entrar(slug: string, datos: FormData): Promise<ResultadoAcceso> {
  const usuario = String(datos.get('usuario') || '').trim().toLowerCase();
  const clave = String(datos.get('clave') || '');
  if (!usuario || !clave) return { error: 'Escribe tu usuario y tu contraseña.' };

  const inquilino = await prisma.inquilino.findUnique({ where: { slug }, include: { suscripcion: true } });
  if (!inquilino) return { error: 'Esa institución no existe.' };

  const cuenta = await prisma.usuario.findUnique({
    where: { inquilinoId_usuario: { inquilinoId: inquilino.id, usuario } },
  });
  // Se compara igual aunque la cuenta no exista, para no delatar por el tiempo de
  // respuesta cuáles sí existen.
  const vale = await bcrypt.compare(clave, cuenta?.passwordHash ?? HASH_FALSO);
  if (!cuenta || !vale || !cuenta.activo) return { error: 'Usuario o contraseña incorrectos.' };

  // En un escaparate no se escribe NADA, ni siquiera la hora del último acceso.
  if (!inquilino.soloLectura)
    await prisma.usuario.update({ where: { id: cuenta.id }, data: { ultimoAcceso: new Date() } });
  await abrirSesionUsuario({ uid: cuenta.id, inquilinoId: inquilino.id, slug: inquilino.slug, nombre: cuenta.nombre, rol: cuenta.rol });

  const abierto = evaluarAcceso(inquilino) === 'ok';
  redirect(abierto ? `/${slug}/${INICIO_DE_ROL[cuenta.rol]}` : `/${slug}/suscripcion`);
}

export async function salir(slug: string) {
  await cerrarSesion(COOKIE_SESION);
  redirect(`/${slug}/acceso`);
}

// ── Operador GCC ────────────────────────────────────────────────────────────

export async function entrarOperador(datos: FormData): Promise<ResultadoAcceso> {
  const email = String(datos.get('email') || '').trim().toLowerCase();
  const clave = String(datos.get('clave') || '');
  if (!email || !clave) return { error: 'Escribe tu correo y tu contraseña.' };

  const op = await prisma.operadorGcc.findUnique({ where: { email } });
  const vale = await bcrypt.compare(clave, op?.passwordHash ?? HASH_FALSO);
  if (!op || !vale || !op.activo) return { error: 'Correo o contraseña incorrectos.' };

  await prisma.operadorGcc.update({ where: { id: op.id }, data: { ultimoAcceso: new Date() } });
  await abrirSesionOperador({ oid: op.id, nombre: op.nombre, email: op.email });
  redirect('/gcc');
}

export async function salirOperador() {
  await cerrarSesion(COOKIE_GCC);
  redirect('/gcc/acceso');
}
