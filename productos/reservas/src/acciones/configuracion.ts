'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura } from '@/lib/inquilino';
import { esHexValido } from '@/lib/marca';
import { subirImagen } from '@/lib/imagenes';

export type Resultado = { ok: true; url?: string } | { ok: false; error: string };

// ── Marca ───────────────────────────────────────────────────────────────────
const Marca = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre del alojamiento.').max(80),
  colorAcento: z.string().trim(),
  tema: z.enum(['CLARO', 'OSCURO']),
  logoUrl: z.string().trim().url('La dirección del logo no es válida.').optional().or(z.literal('')),
  moneda: z.string().trim().length(3, 'La moneda son tres letras (USD, EUR…).').toUpperCase(),
});

export async function guardarMarca(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'ADMIN');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const leido = Marca.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;

  if (!esHexValido(d.colorAcento))
    return { ok: false, error: 'El color tiene que ser un hexadecimal como #4B2D8E.' };

  await prisma.inquilino.update({
    where: { id: ctx.inquilino.id },
    data: {
      nombre: d.nombre,
      colorAcento: d.colorAcento.toUpperCase(),
      tema: d.tema,
      logoUrl: d.logoUrl || null,
      moneda: d.moneda,
    },
  });

  // 'layout' porque la marca la pinta el armazón: cambiar solo esta página dejaría
  // la barra lateral con el color viejo hasta la siguiente navegación completa.
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

export async function subirLogo(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'ADMIN');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  const archivo = datos.get('archivo');
  if (!(archivo instanceof File) || !archivo.size)
    return { ok: false, error: 'Elige una imagen.' };
  return subirImagen(archivo, `${ctx.inquilino.slug}/marca`);
}

export async function subirFoto(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'ADMIN');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  const archivo = datos.get('archivo');
  if (!(archivo instanceof File) || !archivo.size)
    return { ok: false, error: 'Elige una imagen.' };
  return subirImagen(archivo, `${ctx.inquilino.slug}/lugares`);
}

// ── Ubicaciones ─────────────────────────────────────────────────────────────
export async function guardarUbicacion(
  slug: string,
  id: number | null,
  datos: FormData,
): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'ADMIN');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const nombre = String(datos.get('nombre') || '').trim();
  const fotoUrl = String(datos.get('fotoUrl') || '').trim();
  if (nombre.length < 2) return { ok: false, error: 'Escribe el nombre de la ubicación.' };

  const repetida = await prisma.ubicacion.findFirst({
    where: { inquilinoId: ctx.inquilino.id, nombre, id: id ? { not: id } : undefined },
    select: { id: true },
  });
  if (repetida) return { ok: false, error: `Ya existe una ubicación llamada «${nombre}».` };

  if (id) {
    const propia = await prisma.ubicacion.findFirst({
      where: { id, inquilinoId: ctx.inquilino.id },
      select: { id: true },
    });
    if (!propia) return { ok: false, error: 'La ubicación no existe.' };
    await prisma.ubicacion.update({ where: { id }, data: { nombre, fotoUrl: fotoUrl || null } });
  } else {
    const cuantas = await prisma.ubicacion.count({ where: { inquilinoId: ctx.inquilino.id } });
    await prisma.ubicacion.create({
      data: { inquilinoId: ctx.inquilino.id, nombre, fotoUrl: fotoUrl || null, orden: cuantas },
    });
  }

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

export async function eliminarUbicacion(slug: string, id: number): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'ADMIN');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  // Se comprueba ANTES de borrar: la cascada del esquema se llevaría las suites y,
  // con ellas, reservas que alguien todavía necesita. Mejor negarse y decir por qué.
  const conSuites = await prisma.suite.count({ where: { ubicacionId: id, inquilinoId: ctx.inquilino.id } });
  if (conSuites)
    return {
      ok: false,
      error: `Esta ubicación tiene ${conSuites} suite(s). Elimínalas o muévelas antes.`,
    };

  const r = await prisma.ubicacion.deleteMany({ where: { id, inquilinoId: ctx.inquilino.id } });
  if (!r.count) return { ok: false, error: 'La ubicación no existe.' };

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

// ── Suites ──────────────────────────────────────────────────────────────────
export async function guardarSuite(
  slug: string,
  id: number | null,
  datos: FormData,
): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'ADMIN');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const nombre = String(datos.get('nombre') || '').trim();
  const ubicacionId = Number(datos.get('ubicacionId') || 0);
  const fotoUrl = String(datos.get('fotoUrl') || '').trim();
  const capacidadTxt = String(datos.get('capacidad') || '').trim();
  const precioTxt = String(datos.get('precioNoche') || '').trim();

  if (nombre.length < 1) return { ok: false, error: 'Escribe el nombre de la suite.' };

  const ubicacion = await prisma.ubicacion.findFirst({
    where: { id: ubicacionId, inquilinoId: ctx.inquilino.id },
    select: { id: true },
  });
  if (!ubicacion) return { ok: false, error: 'Elige una ubicación de este alojamiento.' };

  const repetida = await prisma.suite.findFirst({
    where: { ubicacionId, nombre, id: id ? { not: id } : undefined },
    select: { id: true },
  });
  if (repetida)
    return { ok: false, error: `Esa ubicación ya tiene una suite llamada «${nombre}».` };

  const comun = {
    nombre,
    ubicacionId,
    fotoUrl: fotoUrl || null,
    capacidad: capacidadTxt ? Number(capacidadTxt) : null,
    precioNoche: precioTxt ? Number(precioTxt) : null,
  };

  if (id) {
    const propia = await prisma.suite.findFirst({
      where: { id, inquilinoId: ctx.inquilino.id },
      select: { id: true },
    });
    if (!propia) return { ok: false, error: 'La suite no existe.' };
    await prisma.suite.update({ where: { id }, data: comun });
  } else {
    const cuantas = await prisma.suite.count({ where: { ubicacionId } });
    await prisma.suite.create({
      data: { ...comun, inquilinoId: ctx.inquilino.id, orden: cuantas },
    });
  }

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

export async function eliminarSuite(slug: string, id: number): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'ADMIN');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const conReservas = await prisma.reserva.count({
    where: { suiteId: id, inquilinoId: ctx.inquilino.id },
  });
  if (conReservas)
    return {
      ok: false,
      error: `Esta suite tiene ${conReservas} reserva(s) en el histórico y no se puede eliminar sin perderlas.`,
    };

  const r = await prisma.suite.deleteMany({ where: { id, inquilinoId: ctx.inquilino.id } });
  if (!r.count) return { ok: false, error: 'La suite no existe.' };

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}
