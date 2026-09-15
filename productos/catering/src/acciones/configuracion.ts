'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura } from '@/lib/inquilino';
import { esHexValido } from '@/lib/marca';
import { subirImagen } from '@/lib/imagenes';
import { TIPOS_COMIDA, DIAS_SEMANA } from '@/lib/catalogo';

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
 * Cómo trabaja el negocio: qué comidas ofrece, qué días reparte, hasta qué hora
 * se puede cancelar y qué porcentaje de cancelaciones trae un servicio nuevo.
 * Todo lo que el proyecto de referencia llevaba escrito a mano.
 */
export async function guardarOperativa(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const comidas = datos.getAll('tiposComida').map(String).filter((t) => (TIPOS_COMIDA as string[]).includes(t));
  const dias = datos.getAll('diasServicio').map(String).filter((d) => (DIAS_SEMANA as string[]).includes(d));
  const hora = Number(datos.get('horaLimiteCancelacion'));
  const porcentaje = Number(datos.get('porcentajeCancelacion'));
  const registroAbierto = datos.get('registroAbierto') === 'on' || datos.get('registroAbierto') === 'true';

  if (!comidas.length) return { ok: false, error: 'Elige al menos una comida que ofrezca el negocio.' };
  if (!dias.length) return { ok: false, error: 'Elige al menos un día de reparto.' };
  if (!Number.isInteger(hora) || hora < 0 || hora > 23)
    return { ok: false, error: 'La hora límite tiene que estar entre 0 y 23.' };
  if (!Number.isInteger(porcentaje) || porcentaje < 0 || porcentaje > 100)
    return { ok: false, error: 'El porcentaje de cancelación tiene que estar entre 0 y 100.' };

  await prisma.inquilino.update({
    where: { id: ctx.inquilino.id },
    data: {
      tiposComida: comidas as never,
      diasServicio: dias as never,
      horaLimiteCancelacion: hora,
      porcentajeCancelacion: porcentaje,
      registroAbierto,
    },
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
