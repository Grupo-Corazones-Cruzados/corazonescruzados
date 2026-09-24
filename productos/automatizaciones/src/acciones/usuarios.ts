'use server';

import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura, topeUsuarios } from '@/lib/inquilino';

export type ResultadoUsuario =
  | { ok: true; mensaje?: string; clave?: string }
  | { ok: false; error: string };

const claveAlAzar = () => randomBytes(9).toString('base64url');

const Alta = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre de la persona.'),
  usuario: z.string().trim().toLowerCase().min(3, 'El usuario necesita al menos 3 caracteres.'),
  rol: z.enum(['ADMIN', 'OPERADOR', 'CONSULTA']),
});

/**
 * CREAR UNA CUENTA PARA ALGUIEN DEL CLIENTE (Fernando, 2026-09-23: «dejaremos en este
 * producto nuevo una sección para que el administrador o dueño del tenant pueda crear
 * usuarios»).
 *
 * ⚠️ LAS CUENTAS QUE SE CREAN AQUÍ SON **DEL INQUILINO**, Y SOLO DEL INQUILINO.
 *
 * Su contraseña vive en este esquema, no abren nada fuera de este producto y no tienen
 * ninguna relación con GCC World. Es lo que pidió Fernando el 2026-09-24: «todas las
 * cuentas que se crean en los productos pertenecen al tenant del cliente que compró el
 * producto… pero no son cuentas de clientes de gcc world», porque «son cuentas de gente
 * externa que no conocemos ni confiamos».
 *
 * ── POR QUÉ YA NO SE PUEDE ELEGIR «CUENTA DE GCC WORLD» ──────────────────────────
 * Antes esta misma acción aceptaba `origen: 'GCC'`, que enlaza la cuenta con la
 * plataforma y hace que la contraseña se compruebe contra `gcc_world.users`. Parecía una
 * comodidad; era una puerta:
 *
 *   · el formulario confirmaba si un correo cualquiera tiene cuenta en GCC World —un
 *     listín de nuestros clientes, consultable por cualquiera que tenga un inquilino—;
 *   · y después esa cuenta se podía usar para **probar contraseñas de GCC World** desde
 *     la pantalla de acceso del inquilino. Acertar una vez es entrar en la plataforma.
 *
 * Enlazar un correo de GCC World es decidir a quién confiamos, y eso no lo decide un
 * cliente: lo hace el equipo desde `/gcc` (`acciones/gccUsuarios.ts`). La base lo
 * respalda con la restricción `usuarios_enlace_coherente` (migración 012), así que
 * aunque alguien vuelva a abrir este camino por código, no se puede guardar.
 */
export async function crearUsuario(slug: string, datos: FormData): Promise<ResultadoUsuario> {
  const permiso = await contextoEscritura(slug, 'ADMIN');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const leido = Alta.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;

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

  const clave = claveAlAzar();

  await prisma.usuario.create({
    data: {
      inquilinoId: ctx.inquilino.id,
      usuario: d.usuario,
      nombre: d.nombre,
      // El correo se guarda solo para poder escribirle, nunca para enlazar nada: que
      // coincida con una cuenta de GCC World no le da ni un permiso más.
      email: d.usuario.includes('@') ? d.usuario : null,
      origen: 'PRODUCTO',
      claveHash: await bcrypt.hash(clave, 10),
      rol: d.rol,
    },
  });

  revalidatePath(`/${slug}/usuarios`);
  return { ok: true, mensaje: `Cuenta creada para ${d.nombre}.`, clave };
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
