'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura, contextoApi } from '@/lib/inquilino';
import { esHexValido } from '@/lib/marca';
import { subirImagen } from '@/lib/imagenes';
import { verificarCuentaGcc } from '@/lib/cuentaGcc';

export type Resultado = { ok: true; mensaje?: string; url?: string } | { ok: false; error: string };

const Marca = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre.').max(80),
  colorAcento: z.string().trim(),
  tema: z.enum(['CLARO', 'OSCURO']),
  logoUrl: z.string().trim().url('La dirección del logo no es válida.').optional().or(z.literal('')),
  zonaHoraria: z.string().trim().min(3),
});

export async function guardarMarca(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'ADMIN');
  if (!permiso.ok) return { ok: false, error: permiso.error };

  const leido = Marca.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;
  if (!esHexValido(d.colorAcento))
    return { ok: false, error: 'El color tiene que ser un hexadecimal como #4B2D8E.' };

  await prisma.inquilino.update({
    where: { id: permiso.ctx.inquilino.id },
    data: {
      nombre: d.nombre,
      colorAcento: d.colorAcento.toUpperCase(),
      tema: d.tema,
      logoUrl: d.logoUrl || null,
      zonaHoraria: d.zonaHoraria,
    },
  });
  // 'layout' porque la marca vive en el armazón: el menú y el papel cambian de color.
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true, mensaje: 'Marca guardada.' };
}

export async function subirLogo(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'ADMIN');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const archivo = datos.get('archivo');
  if (!(archivo instanceof File) || !archivo.size) return { ok: false, error: 'Elige una imagen.' };
  return subirImagen(archivo, `${permiso.ctx.inquilino.slug}/marca`);
}

/**
 * CAMBIAR LA PROPIA CONTRASEÑA.
 *
 * ⚠️ Solo tiene sentido para las cuentas de este producto. Quien entra con su cuenta de
 * GCC World la cambia **en la plataforma**, porque aquí no hay ninguna que cambiar — y
 * decírselo claro evita que lo intente y crea que está roto.
 */
export async function cambiarMiClave(slug: string, datos: FormData): Promise<Resultado> {
  const ctx = await contextoApi(slug);
  if (!ctx) return { ok: false, error: 'No tienes sesión.' };

  const actual = String(datos.get('actual') || '');
  const nueva = String(datos.get('nueva') || '');
  if (nueva.length < 8) return { ok: false, error: 'La contraseña nueva necesita al menos 8 caracteres.' };

  const cuenta = await prisma.usuario.findUnique({ where: { id: ctx.sesion.uid } });
  if (!cuenta) return { ok: false, error: 'Tu cuenta ya no existe.' };

  if (cuenta.origen === 'GCC') {
    return {
      ok: false,
      error: 'Tu contraseña es la de tu cuenta de GCC World: se cambia allí, no aquí.',
    };
  }

  const vale = await bcrypt.compare(actual, cuenta.claveHash ?? '');
  if (!vale) return { ok: false, error: 'La contraseña actual no es correcta.' };

  await prisma.usuario.update({
    where: { id: cuenta.id },
    data: { claveHash: await bcrypt.hash(nueva, 10) },
  });
  return { ok: true, mensaje: 'Contraseña cambiada.' };
}

/** Para avisar en la pantalla sin hacerle probar: ¿esta cuenta es de GCC World? */
export async function miOrigen(slug: string): Promise<'GCC' | 'PRODUCTO' | null> {
  const ctx = await contextoApi(slug);
  if (!ctx) return null;
  const u = await prisma.usuario.findUnique({ where: { id: ctx.sesion.uid }, select: { origen: true } });
  return u?.origen ?? null;
}
