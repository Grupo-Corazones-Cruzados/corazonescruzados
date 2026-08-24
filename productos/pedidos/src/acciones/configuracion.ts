'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura } from '@/lib/inquilino';
import { esHexValido } from '@/lib/marca';
import { subirImagen } from '@/lib/imagenes';

export type Resultado = { ok: true; url?: string } | { ok: false; error: string };

const Marca = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre del negocio.').max(80),
  colorAcento: z.string().trim(),
  tema: z.enum(['CLARO', 'OSCURO']),
  logoUrl: z.string().trim().url('La dirección del logo no es válida.').optional().or(z.literal('')),
  moneda: z.string().trim().length(3, 'La moneda son tres letras (USD, EUR…).').toUpperCase(),
});

export async function guardarMarca(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
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
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

/**
 * Cómo factura el negocio. ⚠️ Cambiar esto **no reescribe pedidos pasados**: cada
 * pedido guarda la tasa que se le aplicó. Si al cambiarla se recalculara el
 * histórico, la caja de ayer dejaría de cuadrar con lo que se cobró de verdad.
 */
export async function guardarFacturacion(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const aplicaIva = datos.get('aplicaIva') === 'on' || datos.get('aplicaIva') === 'true';
  const precioConIva = datos.get('precioConIva') === 'on' || datos.get('precioConIva') === 'true';
  const porcentaje = Number(datos.get('ivaPorcentaje') || 0);

  if (aplicaIva && (!(porcentaje > 0) || porcentaje > 99))
    return { ok: false, error: 'El porcentaje de IVA tiene que estar entre 0 y 99.' };

  await prisma.inquilino.update({
    where: { id: ctx.inquilino.id },
    data: { aplicaIva, precioConIva, ivaPorcentaje: aplicaIva ? porcentaje : 0 },
  });
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

export async function subirLogo(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  const archivo = datos.get('archivo');
  if (!(archivo instanceof File) || !archivo.size) return { ok: false, error: 'Elige una imagen.' };
  return subirImagen(archivo, `${ctx.inquilino.slug}/marca`);
}
