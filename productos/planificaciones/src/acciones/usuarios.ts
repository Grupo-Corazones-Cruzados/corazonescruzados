'use server';

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura } from '@/lib/inquilino';
import { faltaCupoDeCuenta, topesDe } from '@/lib/limites';

export type ResultadoUsuario = { ok: true; clave?: string } | { ok: false; error: string };

const NOMBRE_USUARIO = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'El usuario necesita al menos 3 caracteres.')
  .max(60)
  .regex(/^[a-z0-9._-]+$/, 'El usuario solo admite letras, números, punto, guion y guion bajo.');

const Alta = z.object({
  usuario: NOMBRE_USUARIO,
  nombre: z.string().trim().min(2, 'Escribe el nombre de la persona.'),
  profesion: z.string().trim().max(80).optional().or(z.literal('')),
  email: z.string().trim().email('El correo no es válido.').optional().or(z.literal('')),
  clave: z.string().min(8, 'La contraseña necesita al menos 8 caracteres.').optional().or(z.literal('')),
});

const claveAlAzar = () => randomBytes(9).toString('base64url');

/**
 * Alta de un profesor. Todas las cuentas que crea el cliente son PROFESOR
 * (Fernando, 2026-09-15): no hay selector de rol.
 */
export async function crearUsuario(slug: string, datos: FormData): Promise<ResultadoUsuario> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const leido = Alta.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;

  // El tope del plan se comprueba ANTES de crear nada.
  const sinCupo = await faltaCupoDeCuenta(ctx.inquilino.id, topesDe(ctx.inquilino).cuentas);
  if (sinCupo) return { ok: false, error: sinCupo };

  const repetido = await prisma.usuario.findUnique({
    where: { inquilinoId_usuario: { inquilinoId: ctx.inquilino.id, usuario: d.usuario } },
    select: { id: true },
  });
  if (repetido) return { ok: false, error: `Ya existe una cuenta llamada «${d.usuario}».` };

  const clave = d.clave || claveAlAzar();
  await prisma.usuario.create({
    data: {
      inquilinoId: ctx.inquilino.id,
      usuario: d.usuario,
      nombre: d.nombre,
      profesion: d.profesion || null,
      email: d.email || null,
      rol: 'PROFESOR',
      passwordHash: await bcrypt.hash(clave, 10),
    },
  });

  revalidatePath(`/${slug}/usuarios`);
  return { ok: true, clave: d.clave ? undefined : clave };
}

export async function editarUsuario(slug: string, id: number, datos: FormData): Promise<ResultadoUsuario> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const cuenta = await prisma.usuario.findFirst({ where: { id, inquilinoId: ctx.inquilino.id } });
  if (!cuenta) return { ok: false, error: 'La cuenta no existe.' };

  const nombre = String(datos.get('nombre') || '').trim();
  const profesion = String(datos.get('profesion') || '').trim().slice(0, 80);
  const email = String(datos.get('email') || '').trim();
  const activo = datos.get('activo') === 'on' || datos.get('activo') === 'true';
  if (nombre.length < 2) return { ok: false, error: 'Escribe el nombre de la persona.' };

  // Nadie se desactiva a sí mismo: sería quedarse fuera de la propia casa.
  if (cuenta.id === ctx.sesion.uid && !activo) return { ok: false, error: 'No puedes desactivar tu propia cuenta.' };
  if (cuenta.rol === 'ADMIN' && !activo) {
    const otros = await prisma.usuario.count({ where: { inquilinoId: ctx.inquilino.id, rol: 'ADMIN', activo: true, id: { not: id } } });
    if (otros === 0) return { ok: false, error: 'Tiene que quedar al menos un administrador activo.' };
  }

  // Reactivar ocupa cupo igual que crear: si no, el tope se saltaría desactivando y activando.
  if (activo && !cuenta.activo) {
    const sinCupo = await faltaCupoDeCuenta(ctx.inquilino.id, topesDe(ctx.inquilino).cuentas);
    if (sinCupo) return { ok: false, error: sinCupo };
  }

  await prisma.usuario.update({ where: { id }, data: { nombre, profesion: profesion || null, email: email || null, activo } });
  revalidatePath(`/${slug}/usuarios`);
  return { ok: true };
}

export async function restablecerClave(slug: string, id: number): Promise<ResultadoUsuario> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const cuenta = await prisma.usuario.findFirst({ where: { id, inquilinoId: ctx.inquilino.id }, select: { id: true } });
  if (!cuenta) return { ok: false, error: 'La cuenta no existe.' };

  const clave = claveAlAzar();
  await prisma.usuario.update({ where: { id }, data: { passwordHash: await bcrypt.hash(clave, 10) } });
  revalidatePath(`/${slug}/usuarios`);
  return { ok: true, clave };
}
