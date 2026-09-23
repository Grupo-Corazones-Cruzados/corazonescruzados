'use server';

import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura, topeUsuarios } from '@/lib/inquilino';
import { existeCuentaGcc } from '@/lib/cuentaGcc';

export type ResultadoUsuario =
  | { ok: true; mensaje?: string; clave?: string }
  | { ok: false; error: string };

const claveAlAzar = () => randomBytes(9).toString('base64url');

const Alta = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre de la persona.'),
  origen: z.enum(['PRODUCTO', 'GCC']),
  usuario: z.string().trim().toLowerCase().min(3, 'El usuario necesita al menos 3 caracteres.'),
  rol: z.enum(['ADMIN', 'OPERADOR', 'CONSULTA']),
});

/**
 * CREAR UNA CUENTA PARA ALGUIEN DEL CLIENTE (Fernando, 2026-09-23: «dejaremos en este
 * producto nuevo una sección para que el administrador o dueño del tenant pueda crear
 * usuarios»).
 *
 * Dos clases de cuenta, y la diferencia es de dónde sale la contraseña:
 *
 *  · `GCC`      — la persona ya tiene cuenta de cliente en GCC World. Aquí NO se le
 *                 pone contraseña: entra con la suya de siempre. Se comprueba que la
 *                 cuenta exista, porque una cuenta enlazada a un correo que no está en
 *                 la plataforma **no podría entrar nunca** y nadie se enteraría hasta
 *                 que la persona lo intentara.
 *  · `PRODUCTO` — no tiene cuenta en GCC World. Se le genera una contraseña aquí y se
 *                 enseña UNA vez: guardarla para volver a mostrarla obligaría a poder
 *                 descifrarla, y entonces no estaría protegida.
 */
export async function crearUsuario(slug: string, datos: FormData): Promise<ResultadoUsuario> {
  const permiso = await contextoEscritura(slug, 'ADMIN');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const leido = Alta.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;

  if (d.origen === 'GCC') {
    if (!z.string().email().safeParse(d.usuario).success)
      return { ok: false, error: 'Para una cuenta de GCC World hay que escribir su correo.' };
    if (!(await existeCuentaGcc(d.usuario)))
      return {
        ok: false,
        error: `No hay ninguna cuenta de GCC World con el correo ${d.usuario}. Que la cree primero en la plataforma, o dale una cuenta de este producto.`,
      };
  }

  // EL TOPE SE COMPRUEBA AL CREAR, y se cuentan solo las ACTIVAS: contar también las
  // desactivadas obligaría a borrar personas del histórico para dar de alta a otra.
  // `topeUsuarios` ya sabe que la cortesía no topa y que con varios productos manda el
  // plan más generoso.
  const tope = topeUsuarios(ctx.inquilino);
  if (tope !== null) {
    const activas = await prisma.usuario.count({
      where: { inquilinoId: ctx.inquilino.id, activo: true },
    });
    if (activas >= tope)
      return {
        ok: false,
        error: `Tu plan permite ${tope} cuentas activas y ya tienes ${activas}. Desactiva una o amplía el plan.`,
      };
  }

  const repetido = await prisma.usuario.findUnique({
    where: { inquilinoId_usuario: { inquilinoId: ctx.inquilino.id, usuario: d.usuario } },
    select: { id: true },
  });
  if (repetido) return { ok: false, error: 'Ya hay una cuenta con ese usuario.' };

  const clave = d.origen === 'PRODUCTO' ? claveAlAzar() : null;

  await prisma.usuario.create({
    data: {
      inquilinoId: ctx.inquilino.id,
      usuario: d.usuario,
      nombre: d.nombre,
      email: d.usuario.includes('@') ? d.usuario : null,
      origen: d.origen,
      claveHash: clave ? await bcrypt.hash(clave, 10) : null,
      rol: d.rol,
    },
  });

  revalidatePath(`/${slug}/usuarios`);
  return clave
    ? { ok: true, mensaje: `Cuenta creada para ${d.nombre}.`, clave }
    : {
        ok: true,
        mensaje: `${d.nombre} ya puede entrar con su cuenta de GCC World y su contraseña de siempre.`,
      };
}

/** Activar o desactivar. No se borra: el histórico de quién atendió qué se conserva. */
export async function cambiarActivo(slug: string, id: number, activo: boolean): Promise<ResultadoUsuario> {
  const permiso = await contextoEscritura(slug, 'ADMIN');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  if (id === ctx.sesion.uid)
    return { ok: false, error: 'No puedes desactivar tu propia cuenta: te quedarías fuera.' };

  const cuenta = await prisma.usuario.findFirst({
    where: { id, inquilinoId: ctx.inquilino.id },
    select: { id: true, rol: true },
  });
  if (!cuenta) return { ok: false, error: 'Esa cuenta no existe.' };

  // Un cliente sin ningún administrador activo se queda sin quien gestione nada.
  if (!activo && cuenta.rol === 'ADMIN') {
    const admins = await prisma.usuario.count({
      where: { inquilinoId: ctx.inquilino.id, rol: 'ADMIN', activo: true },
    });
    if (admins <= 1)
      return { ok: false, error: 'Es el único administrador activo: nombra a otro antes.' };
  }

  await prisma.usuario.update({ where: { id: cuenta.id }, data: { activo } });
  revalidatePath(`/${slug}/usuarios`);
  return { ok: true, mensaje: activo ? 'Cuenta activada.' : 'Cuenta desactivada.' };
}

/** Generar una contraseña nueva. Solo para cuentas del producto. */
export async function regenerarClave(slug: string, id: number): Promise<ResultadoUsuario> {
  const permiso = await contextoEscritura(slug, 'ADMIN');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const cuenta = await prisma.usuario.findFirst({
    where: { id, inquilinoId: ctx.inquilino.id },
    select: { id: true, origen: true, nombre: true },
  });
  if (!cuenta) return { ok: false, error: 'Esa cuenta no existe.' };
  if (cuenta.origen === 'GCC')
    return {
      ok: false,
      error: 'Esa cuenta entra con su contraseña de GCC World: se cambia en la plataforma, no aquí.',
    };

  const clave = claveAlAzar();
  await prisma.usuario.update({
    where: { id: cuenta.id },
    data: { claveHash: await bcrypt.hash(clave, 10) },
  });
  revalidatePath(`/${slug}/usuarios`);
  return { ok: true, mensaje: `Contraseña nueva de ${cuenta.nombre}.`, clave };
}
