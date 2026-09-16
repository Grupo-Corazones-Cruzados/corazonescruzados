'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura } from '@/lib/inquilino';

export type ResultadoPerfil = { ok: true } | { ok: false; error: string };

const Perfil = z.object({
  nombre: z.string().trim().min(2, 'Escribe tu nombre.').max(120),
  profesion: z.string().trim().max(80).optional().or(z.literal('')),
  email: z.string().trim().email('El correo no es válido.').optional().or(z.literal('')),
});

/** Mi perfil: nombre, profesión (la que sale en «Docente») y correo. */
export async function guardarPerfil(slug: string, datos: FormData): Promise<ResultadoPerfil> {
  const permiso = await contextoEscritura(slug, 'ver');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const leido = Perfil.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;

  // La contraseña va en el mismo formulario (Fernando, 2026-09-16): solo cambia si
  // se escribe la nueva, y entonces se exige la actual.
  const actual = String(datos.get('actual') || '');
  const nueva = String(datos.get('nueva') || '');
  let passwordHash: string | undefined;
  if (nueva) {
    if (nueva.length < 8) return { ok: false, error: 'La nueva contraseña necesita al menos 8 caracteres.' };
    const cuenta = await prisma.usuario.findUnique({ where: { id: ctx.sesion.uid } });
    if (!cuenta || !(await bcrypt.compare(actual, cuenta.passwordHash))) return { ok: false, error: 'La contraseña actual no es correcta.' };
    passwordHash = await bcrypt.hash(nueva, 10);
  }

  await prisma.usuario.update({
    where: { id: ctx.sesion.uid },
    data: { nombre: d.nombre, profesion: d.profesion || null, email: d.email || null, ...(passwordHash ? { passwordHash } : {}) },
  });
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

/** Cambiar la propia contraseña: exige la actual. */
export async function cambiarMiClave(slug: string, datos: FormData): Promise<ResultadoPerfil> {
  const permiso = await contextoEscritura(slug, 'ver');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const actual = String(datos.get('actual') || '');
  const nueva = String(datos.get('nueva') || '');
  if (nueva.length < 8) return { ok: false, error: 'La nueva contraseña necesita al menos 8 caracteres.' };

  const cuenta = await prisma.usuario.findUnique({ where: { id: ctx.sesion.uid } });
  if (!cuenta) return { ok: false, error: 'La cuenta no existe.' };
  if (!(await bcrypt.compare(actual, cuenta.passwordHash))) return { ok: false, error: 'La contraseña actual no es correcta.' };

  await prisma.usuario.update({ where: { id: cuenta.id }, data: { passwordHash: await bcrypt.hash(nueva, 10) } });
  return { ok: true };
}
