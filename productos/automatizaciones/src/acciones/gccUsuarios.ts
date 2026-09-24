'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { leerSesionOperador } from '@/lib/sesion';
import { existeCuentaGcc } from '@/lib/cuentaGcc';

/**
 * ENLAZAR UNA CUENTA DE GCC WORLD CON UN INQUILINO — SOLO EL EQUIPO DE GCC.
 *
 * ── POR QUÉ ESTO VIVE AQUÍ Y NO EN EL PANEL DEL CLIENTE ─────────────────────────
 * Fernando, 2026-09-24: «las cuentas de usuarios de los tenants que no son el cliente de
 * gcc world que compró el producto son cuentas de gente externa que no conocemos ni
 * confiamos… Solamente si alguien se crea cuenta de cliente en gcc world confiamos su
 * acceso».
 *
 * Enlazar un correo de la plataforma no es dar de alta a un empleado: es decir «esta
 * persona entra con la contraseña de GCC World», y con ello convertir la pantalla de
 * acceso del inquilino en un sitio donde esa contraseña se comprueba. Quién merece eso lo
 * decide GCC, no el dueño de un inquilino.
 *
 * Es también el único sitio del producto donde se puede preguntar `existeCuentaGcc`: esa
 * pregunta, puesta delante de un cliente, es un listín de la clientela de GCC.
 *
 * Queda escrito QUIÉN enlazó (`enlazadoPor`), y sin ese dato la cuenta no entra —lo exige
 * `acciones/acceso.ts` y lo exige la base (`usuarios_enlace_coherente`, migración 012)—.
 */

export type ResultadoGcc = { ok: true; mensaje: string } | { ok: false; error: string };

const Enlace = z.object({
  inquilinoId: z.coerce.number().int().positive(),
  nombre: z.string().trim().min(2, 'Escribe el nombre de la persona.'),
  email: z.string().trim().toLowerCase().email('Escribe el correo de su cuenta de GCC World.'),
  rol: z.enum(['ADMIN', 'OPERADOR', 'CONSULTA']),
});

export async function enlazarCuentaGcc(datos: FormData): Promise<ResultadoGcc> {
  const op = await leerSesionOperador();
  if (!op) return { ok: false, error: 'Tu sesión del equipo caducó. Vuelve a entrar.' };

  const leido = Enlace.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;

  const inquilino = await prisma.inquilino.findUnique({
    where: { id: d.inquilinoId },
    select: { id: true, slug: true, nombre: true, soloLectura: true },
  });
  if (!inquilino) return { ok: false, error: 'Ese cliente no existe.' };
  // En un escaparate no se escribe nada (ver el modo escaparate, migración 010).
  if (inquilino.soloLectura)
    return { ok: false, error: 'Ese cliente es un escaparate: no se le crean cuentas.' };

  if (!(await existeCuentaGcc(d.email)))
    return {
      ok: false,
      error: `No hay ninguna cuenta de GCC World con el correo ${d.email}. Que se registre primero en la plataforma.`,
    };

  const repetido = await prisma.usuario.findUnique({
    where: { inquilinoId_usuario: { inquilinoId: inquilino.id, usuario: d.email } },
    select: { id: true },
  });
  if (repetido) return { ok: false, error: 'Ese correo ya tiene cuenta en este cliente.' };

  await prisma.usuario.create({
    data: {
      inquilinoId: inquilino.id,
      usuario: d.email,
      nombre: d.nombre,
      email: d.email,
      origen: 'GCC',
      // La contraseña NO se copia: vive en GCC World y allí se comprueba cada vez.
      claveHash: null,
      enlazadoPor: op.email,
      rol: d.rol,
    },
  });

  revalidatePath('/gcc');
  return { ok: true, mensaje: `${d.nombre} ya entra a ${inquilino.nombre} con su cuenta de GCC World.` };
}

/** Quitar el enlace desactivando la cuenta. No se borra: el histórico se conserva. */
export async function cambiarActivoGcc(id: number, activo: boolean): Promise<ResultadoGcc> {
  const op = await leerSesionOperador();
  if (!op) return { ok: false, error: 'Tu sesión del equipo caducó. Vuelve a entrar.' };

  const cuenta = await prisma.usuario.findUnique({
    where: { id },
    select: { id: true, nombre: true, inquilino: { select: { soloLectura: true } } },
  });
  if (!cuenta) return { ok: false, error: 'Esa cuenta no existe.' };
  if (cuenta.inquilino.soloLectura)
    return { ok: false, error: 'Ese cliente es un escaparate: no se le tocan las cuentas.' };

  await prisma.usuario.update({
    where: { id },
    // Reactivar limpia el freno: si se cerró por intentos fallidos, quien la reactiva
    // está diciendo justamente que vuelva a poder entrar.
    data: activo
      ? { activo: true, intentosFallidos: 0, bloqueadoHasta: null }
      : { activo: false },
  });
  revalidatePath('/gcc');
  return { ok: true, mensaje: `${cuenta.nombre}: cuenta ${activo ? 'activada' : 'desactivada'}.` };
}
