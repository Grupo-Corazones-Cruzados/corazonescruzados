'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura } from '@/lib/inquilino';
import { esHexValido } from '@/lib/marca';
import { subirImagen } from '@/lib/imagenes';
import { PLANTILLAS } from '@/plantillas';

export type Resultado = { ok: true; url?: string } | { ok: false; error: string };

const Marca = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre de la institución.').max(120),
  colorAcento: z.string().trim(),
  tema: z.enum(['CLARO', 'OSCURO']),
  logoUrl: z.string().trim().url('La dirección del logo no es válida.').optional().or(z.literal('')),
  plantillaPorDefecto: z.string().trim(),
});

export async function guardarMarca(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const leido = Marca.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;
  if (!esHexValido(d.colorAcento)) return { ok: false, error: 'El color tiene que ser un hexadecimal como #4B2D8E.' };
  if (!PLANTILLAS[d.plantillaPorDefecto]) return { ok: false, error: 'Esa plantilla no existe.' };

  await prisma.inquilino.update({
    where: { id: ctx.inquilino.id },
    data: { nombre: d.nombre, colorAcento: d.colorAcento.toUpperCase(), tema: d.tema, logoUrl: d.logoUrl || null, plantillaPorDefecto: d.plantillaPorDefecto },
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
