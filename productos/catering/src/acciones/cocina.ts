'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura } from '@/lib/inquilino';
import { CATEGORIAS } from '@/lib/catalogo';
import { aFechaSql, esDia } from '@/lib/fechas';

export type ResultadoCocina = { ok: true; id?: number } | { ok: false; error: string };

// ── Alimentos ───────────────────────────────────────────────────────────────

const AlimentoEntrada = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre del alimento.').max(80),
  categoria: z.enum(CATEGORIAS as [string, ...string[]]),
});

export async function guardarAlimento(slug: string, id: number | null, datos: FormData): Promise<ResultadoCocina> {
  const permiso = await contextoEscritura(slug, 'cocina');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const leido = AlimentoEntrada.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;
  const activo = datos.get('activo') !== 'false' && datos.get('activo') !== 'off';

  const repetido = await prisma.alimento.findFirst({
    where: { inquilinoId: ctx.inquilino.id, nombre: { equals: d.nombre, mode: 'insensitive' }, id: id ? { not: id } : undefined },
    select: { id: true },
  });
  if (repetido) return { ok: false, error: `Ya existe un alimento llamado «${d.nombre}».` };

  if (id) {
    const existe = await prisma.alimento.findFirst({ where: { id, inquilinoId: ctx.inquilino.id }, select: { id: true } });
    if (!existe) return { ok: false, error: 'El alimento no existe.' };
    await prisma.alimento.update({ where: { id }, data: { nombre: d.nombre, categoria: d.categoria as never, activo } });
  } else {
    const a = await prisma.alimento.create({
      data: { inquilinoId: ctx.inquilino.id, nombre: d.nombre, categoria: d.categoria as never, activo },
    });
    id = a.id;
  }
  revalidatePath(`/${slug}/alimentos`);
  return { ok: true, id };
}

/** Eliminar solo si nadie lo usa; si está en menús o restricciones, se desactiva. */
export async function eliminarAlimento(slug: string, id: number): Promise<ResultadoCocina> {
  const permiso = await contextoEscritura(slug, 'cocina');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  const a = await prisma.alimento.findFirst({
    where: { id, inquilinoId: ctx.inquilino.id },
    include: { _count: { select: { enMenus: true, restricciones: true } } },
  });
  if (!a) return { ok: false, error: 'El alimento no existe.' };
  if (a._count.enMenus || a._count.restricciones)
    return {
      ok: false,
      error: `«${a.nombre}» está en ${a._count.enMenus} menús y ${a._count.restricciones} restricciones. Desactívalo en vez de eliminarlo.`,
    };
  await prisma.alimento.delete({ where: { id } });
  revalidatePath(`/${slug}/alimentos`);
  return { ok: true };
}

// ── Menús ───────────────────────────────────────────────────────────────────

/** El menú de un día y una comida: se reemplaza entero. */
export async function guardarMenu(
  slug: string,
  dia: string,
  tipoComida: string,
  descripcion: string,
  alimentoIds: number[],
): Promise<ResultadoCocina> {
  const permiso = await contextoEscritura(slug, 'cocina');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  if (!esDia(dia)) return { ok: false, error: 'La fecha no es válida.' };
  if (!(ctx.inquilino.tiposComida as string[]).includes(tipoComida))
    return { ok: false, error: 'Ese tipo de comida no lo ofrece el negocio.' };
  const ids = [...new Set(alimentoIds.map(Number).filter(Boolean))];
  if (!ids.length) return { ok: false, error: 'Elige al menos un alimento.' };
  const validos = await prisma.alimento.count({ where: { id: { in: ids }, inquilinoId: ctx.inquilino.id } });
  if (validos !== ids.length) return { ok: false, error: 'Alguno de los alimentos no es de este negocio.' };

  const fecha = aFechaSql(dia);
  await prisma.$transaction(async (tx) => {
    const menu = await tx.menu.upsert({
      where: { inquilinoId_fecha_tipoComida: { inquilinoId: ctx.inquilino.id, fecha, tipoComida: tipoComida as never } },
      update: { descripcion: descripcion.trim() || null },
      create: { inquilinoId: ctx.inquilino.id, fecha, tipoComida: tipoComida as never, descripcion: descripcion.trim() || null },
    });
    await tx.menuAlimento.deleteMany({ where: { menuId: menu.id } });
    await tx.menuAlimento.createMany({ data: ids.map((alimentoId) => ({ menuId: menu.id, alimentoId })) });
  });
  revalidatePath(`/${slug}/menus`);
  revalidatePath(`/${slug}/etiquetas`);
  return { ok: true };
}

export async function eliminarMenu(slug: string, id: number): Promise<ResultadoCocina> {
  const permiso = await contextoEscritura(slug, 'cocina');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  const m = await prisma.menu.findFirst({ where: { id, inquilinoId: ctx.inquilino.id }, select: { id: true } });
  if (!m) return { ok: false, error: 'El menú no existe.' };
  await prisma.menu.delete({ where: { id } });
  revalidatePath(`/${slug}/menus`);
  return { ok: true };
}

/** Copiar los menús de un día a otro (lo típico: «igual que el lunes pasado»). */
export async function copiarMenus(slug: string, desde: string, hasta: string): Promise<ResultadoCocina> {
  const permiso = await contextoEscritura(slug, 'cocina');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  if (!esDia(desde) || !esDia(hasta)) return { ok: false, error: 'Las fechas no son válidas.' };
  if (desde === hasta) return { ok: false, error: 'Elige un día distinto.' };

  const origen = await prisma.menu.findMany({
    where: { inquilinoId: ctx.inquilino.id, fecha: aFechaSql(desde) },
    include: { alimentos: { select: { alimentoId: true } } },
  });
  if (!origen.length) return { ok: false, error: 'Ese día no tiene menús que copiar.' };

  await prisma.$transaction(async (tx) => {
    for (const m of origen) {
      const nuevo = await tx.menu.upsert({
        where: { inquilinoId_fecha_tipoComida: { inquilinoId: ctx.inquilino.id, fecha: aFechaSql(hasta), tipoComida: m.tipoComida } },
        update: { descripcion: m.descripcion },
        create: { inquilinoId: ctx.inquilino.id, fecha: aFechaSql(hasta), tipoComida: m.tipoComida, descripcion: m.descripcion },
      });
      await tx.menuAlimento.deleteMany({ where: { menuId: nuevo.id } });
      await tx.menuAlimento.createMany({ data: m.alimentos.map((a) => ({ menuId: nuevo.id, alimentoId: a.alimentoId })) });
    }
  });
  revalidatePath(`/${slug}/menus`);
  return { ok: true };
}
