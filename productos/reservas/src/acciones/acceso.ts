'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import {
  abrirSesionUsuario,
  abrirSesionOperador,
  cerrarSesion,
  COOKIE_GCC,
  COOKIE_SESION,
} from '@/lib/sesion';

export type ResultadoAcceso = { error?: string };

/**
 * Entrar a un hotel. El mensaje de error es DELIBERADAMENTE el mismo para usuario
 * inexistente y contraseña incorrecta: distinguirlos revela qué cuentas existen.
 */
export async function entrar(slug: string, datos: FormData): Promise<ResultadoAcceso> {
  const usuario = String(datos.get('usuario') || '').trim().toLowerCase();
  const clave = String(datos.get('clave') || '');
  if (!usuario || !clave) return { error: 'Escribe tu usuario y tu contraseña.' };

  const inquilino = await prisma.inquilino.findUnique({ where: { slug } });
  if (!inquilino) return { error: 'Ese alojamiento no existe.' };

  const cuenta = await prisma.usuario.findUnique({
    where: { inquilinoId_usuario: { inquilinoId: inquilino.id, usuario } },
  });

  // Se compara igual aunque la cuenta no exista, para no delatar por el tiempo de
  // respuesta cuáles sí existen.
  const hash = cuenta?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
  const vale = await bcrypt.compare(clave, hash);

  if (!cuenta || !vale || !cuenta.activo) {
    return { error: 'Usuario o contraseña incorrectos.' };
  }

  await prisma.usuario.update({ where: { id: cuenta.id }, data: { ultimoAcceso: new Date() } });
  await abrirSesionUsuario({
    uid: cuenta.id,
    inquilinoId: inquilino.id,
    slug: inquilino.slug,
    nombre: cuenta.nombre,
    rol: cuenta.rol,
  });
  redirect(`/${slug}/panel`);
}

export async function salir(slug: string) {
  await cerrarSesion(COOKIE_SESION);
  redirect(`/${slug}/acceso`);
}

export async function entrarOperador(datos: FormData): Promise<ResultadoAcceso> {
  const email = String(datos.get('email') || '').trim().toLowerCase();
  const clave = String(datos.get('clave') || '');
  if (!email || !clave) return { error: 'Escribe tu correo y tu contraseña.' };

  const op = await prisma.operadorGcc.findUnique({ where: { email } });
  const hash = op?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
  const vale = await bcrypt.compare(clave, hash);
  if (!op || !vale || !op.activo) return { error: 'Correo o contraseña incorrectos.' };

  await prisma.operadorGcc.update({ where: { id: op.id }, data: { ultimoAcceso: new Date() } });
  await abrirSesionOperador({ oid: op.id, nombre: op.nombre, email: op.email });
  redirect('/gcc');
}

export async function salirOperador() {
  await cerrarSesion(COOKIE_GCC);
  redirect('/gcc/acceso');
}
