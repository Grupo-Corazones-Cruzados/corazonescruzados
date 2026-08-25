'use server';

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura } from '@/lib/inquilino';
import { faltaCupoDeCuenta } from '@/lib/limites';

export type ResultadoUsuario =
  | { ok: true; clave?: string }
  | { ok: false; error: string };

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
  email: z.string().trim().email('El correo no es válido.').optional().or(z.literal('')),
  rol: z.enum(['ADMIN', 'MESERO', 'COCINERO']),
  clave: z.string().min(8, 'La contraseña necesita al menos 8 caracteres.').optional().or(z.literal('')),
});

const claveAlAzar = () => randomBytes(9).toString('base64url');

export async function crearUsuario(slug: string, datos: FormData): Promise<ResultadoUsuario> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const leido = Alta.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;

  // El tope del plan se comprueba ANTES de crear nada: crear y luego arrepentirse
  // dejaría la cuenta hecha y el mensaje sin sentido.
  const sinCupo = await faltaCupoDeCuenta(
    ctx.inquilino.id,
    ctx.inquilino.suscripcion?.plan.maxUsuarios ?? null,
  );
  if (sinCupo) return { ok: false, error: sinCupo };

  const repetido = await prisma.usuario.findUnique({
    where: { inquilinoId_usuario: { inquilinoId: ctx.inquilino.id, usuario: d.usuario } },
    select: { id: true },
  });
  if (repetido) return { ok: false, error: `Ya existe una cuenta llamada «${d.usuario}».` };

  // Si el administrador no escribe contraseña se genera una y se le enseña UNA vez.
  const clave = d.clave || claveAlAzar();
  await prisma.usuario.create({
    data: {
      inquilinoId: ctx.inquilino.id,
      usuario: d.usuario,
      nombre: d.nombre,
      email: d.email || null,
      rol: d.rol,
      passwordHash: await bcrypt.hash(clave, 10),
    },
  });

  revalidatePath(`/${slug}/usuarios`);
  return { ok: true, clave: d.clave ? undefined : clave };
}

export async function editarUsuario(
  slug: string,
  id: number,
  datos: FormData,
): Promise<ResultadoUsuario> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const cuenta = await prisma.usuario.findFirst({
    where: { id, inquilinoId: ctx.inquilino.id },
  });
  if (!cuenta) return { ok: false, error: 'La cuenta no existe.' };

  const nombre = String(datos.get('nombre') || '').trim();
  const email = String(datos.get('email') || '').trim();
  const rol = String(datos.get('rol') || cuenta.rol) as 'ADMIN' | 'MESERO' | 'COCINERO';
  const activo = datos.get('activo') === 'on' || datos.get('activo') === 'true';

  if (nombre.length < 2) return { ok: false, error: 'Escribe el nombre de la persona.' };

  // Nadie se quita a sí mismo la administración ni se desactiva: sería quedarse
  // fuera de la propia casa, y no habría quién lo deshiciera.
  if (cuenta.id === ctx.sesion.uid && (rol !== 'ADMIN' || !activo))
    return { ok: false, error: 'No puedes quitarte a ti mismo el acceso de administrador.' };

  // Y tampoco puede quedarse el alojamiento sin ningún administrador activo.
  if (cuenta.rol === 'ADMIN' && (rol !== 'ADMIN' || !activo)) {
    const otros = await prisma.usuario.count({
      where: { inquilinoId: ctx.inquilino.id, rol: 'ADMIN', activo: true, id: { not: id } },
    });
    if (otros === 0)
      return { ok: false, error: 'Tiene que quedar al menos un administrador activo.' };
  }

  // Reactivar una cuenta ocupa cupo igual que crearla: si no se comprobara aquí, el
  // tope se saltaría desactivando y volviendo a activar.
  if (activo && !cuenta.activo) {
    const sinCupo = await faltaCupoDeCuenta(
      ctx.inquilino.id,
      ctx.inquilino.suscripcion?.plan.maxUsuarios ?? null,
    );
    if (sinCupo) return { ok: false, error: sinCupo };
  }

  await prisma.usuario.update({
    where: { id },
    data: { nombre, email: email || null, rol, activo },
  });

  revalidatePath(`/${slug}/usuarios`);
  return { ok: true };
}

export async function restablecerClave(slug: string, id: number): Promise<ResultadoUsuario> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const cuenta = await prisma.usuario.findFirst({
    where: { id, inquilinoId: ctx.inquilino.id },
    select: { id: true },
  });
  if (!cuenta) return { ok: false, error: 'La cuenta no existe.' };

  const clave = claveAlAzar();
  await prisma.usuario.update({ where: { id }, data: { passwordHash: await bcrypt.hash(clave, 10) } });

  revalidatePath(`/${slug}/usuarios`);
  return { ok: true, clave };
}

/** Cambiar la propia contraseña: exige la actual. */
export async function cambiarMiClave(slug: string, datos: FormData): Promise<ResultadoUsuario> {
  const permiso = await contextoEscritura(slug, 'ver');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const actual = String(datos.get('actual') || '');
  const nueva = String(datos.get('nueva') || '');
  if (nueva.length < 8) return { ok: false, error: 'La nueva contraseña necesita al menos 8 caracteres.' };

  const cuenta = await prisma.usuario.findUnique({ where: { id: ctx.sesion.uid } });
  if (!cuenta) return { ok: false, error: 'La cuenta no existe.' };
  if (!(await bcrypt.compare(actual, cuenta.passwordHash)))
    return { ok: false, error: 'La contraseña actual no es correcta.' };

  await prisma.usuario.update({
    where: { id: cuenta.id },
    data: { passwordHash: await bcrypt.hash(nueva, 10) },
  });
  return { ok: true };
}
