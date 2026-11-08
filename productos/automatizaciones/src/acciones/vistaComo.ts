'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { contextoApi } from '@/lib/inquilino';
import { abrirSesionUsuario, cerrarSesion, leerSesionUsuario, COOKIE_SESION } from '@/lib/sesion';

export type Resultado = { ok: false; error: string };

export type Candidato = { id: number; nombre: string; usuario: string; rol: 'ADMIN' | 'OPERADOR' | 'CONSULTA' };

/** A quién se puede ver: las cuentas ACTIVAS del propio negocio, menos la tuya. */
export async function candidatosVerComo(slug: string): Promise<{ ok: true; lista: Candidato[] } | Resultado> {
  const ctx = await contextoApi(slug, 'ADMIN');
  if (!ctx || ctx.sesion.suplantadoPor) return { ok: false, error: 'Solo un administrador puede ver la app como otro usuario.' };
  const lista = await prisma.usuario.findMany({
    where: { inquilinoId: ctx.inquilino.id, activo: true, id: { not: ctx.sesion.uid } },
    select: { id: true, nombre: true, usuario: true, rol: true },
    orderBy: { nombre: 'asc' },
  });
  return { ok: true, lista };
}

/**
 * «VER COMO ESTE USUARIO» (Fernando, 2026-11-08: «como tenemos en administrador de gcc world
 * para ver como cliente… el administrador del negocio pueda ver la app como un usuario de su
 * tenant»). Portado de `app/api/admin/suplantar/route.ts` de la plataforma, con sus reglas:
 *
 *  1. **Solo la empieza un ADMIN del inquilino**, comprobado en la BASE (el token puede ser
 *     viejo) y solo sobre una cuenta ACTIVA de SU inquilino.
 *  2. **Mientras dura, el administrador NO es administrador**: la sesión lleva el rol del
 *     otro, así ve sus menús y sus negativas. Y como ya no es admin, no puede encadenar vistas.
 *  3. **Queda anotada** en `vistas_como`, al entrar y al salir.
 *  4. (Del producto) **Es de solo lectura**: `contextoEscritura` lo niega todo mientras dure.
 */
export async function verComo(slug: string, usuarioId: number): Promise<Resultado> {
  const ctx = await contextoApi(slug, 'ADMIN');
  if (!ctx || ctx.sesion.suplantadoPor) return { ok: false, error: 'Solo un administrador puede ver la app como otro usuario.' };

  const inquilinoId = ctx.inquilino.id;
  const admin = await prisma.usuario.findFirst({ where: { id: ctx.sesion.uid, inquilinoId, activo: true, rol: 'ADMIN' } });
  if (!admin) return { ok: false, error: 'Solo un administrador puede ver la app como otro usuario.' };
  if (usuarioId === admin.id) return { ok: false, error: 'Esa ya es tu cuenta.' };

  const destino = await prisma.usuario.findFirst({ where: { id: usuarioId, inquilinoId, activo: true } });
  if (!destino) return { ok: false, error: 'Ese usuario no existe o está desactivado.' };

  // Se anota ANTES de entregar la sesión: un intento anotado de más es mejor que un acceso sin rastro.
  await prisma.vistaComo.create({ data: { inquilinoId, adminId: admin.id, usuarioId: destino.id } });
  await abrirSesionUsuario({
    uid: destino.id,
    inquilinoId,
    slug,
    nombre: destino.nombre,
    rol: destino.rol,
    suplantadoPor: admin.id,
    suplantadoPorNombre: admin.nombre,
  });
  redirect(`/${slug}/panel`);
}

/** Vuelve a la cuenta del administrador. El permiso es el `suplantadoPor` firmado, no el rol. */
export async function volverAMiCuenta(slug: string): Promise<Resultado> {
  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== slug || !sesion.suplantadoPor) {
    return { ok: false, error: 'Esta sesión no es una vista de otro usuario.' };
  }
  await prisma.vistaComo.updateMany({
    where: { adminId: sesion.suplantadoPor, usuarioId: sesion.uid, terminada: null },
    data: { terminada: new Date() },
  });

  const admin = await prisma.usuario.findFirst({
    where: { id: sesion.suplantadoPor, inquilinoId: sesion.inquilinoId, activo: true, rol: 'ADMIN' },
  });
  if (!admin) {
    // Le quitaron el rol (o la cuenta) mientras miraba: no se le devuelve una sesión de administrador.
    await cerrarSesion(COOKIE_SESION);
    redirect(`/${slug}/acceso`);
  }
  await abrirSesionUsuario({ uid: admin.id, inquilinoId: admin.inquilinoId, slug, nombre: admin.nombre, rol: admin.rol });
  redirect(`/${slug}/configuracion?seccion=usuarios`);
}
