'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { contextoEscritura } from '@/lib/inquilino';

export type Resultado = { ok: true; mensaje?: string } | { ok: false; error: string };

/** El tipo real de la imagen, por sus primeros bytes (no por lo que diga el navegador). */
function tipoDeImagen(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

const MAX_LOGO = 512 * 1024;

/**
 * EL LOGO SE SUBE COMO ARCHIVO, NUNCA COMO DIRECCIÓN (Fernando, 2026-11-08, como en
 * Automatizaciones). Se guarda como `data:` en la columna `logo_url` de siempre y se sirve desde
 * `/<slug>/logo` (`lib/marca.ts › urlLogo`). SVG no: un SVG puede llevar código, y se serviría
 * desde nuestro propio dominio. Ya no hay color ni tema: el producto tiene uno solo.
 */
export async function subirLogo(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const archivo = datos.get('archivo');
  if (!(archivo instanceof File) || !archivo.size) return { ok: false, error: 'Elige una imagen.' };
  if (archivo.size > MAX_LOGO) return { ok: false, error: 'El logo pesa más de 512 KB.' };

  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const tipo = tipoDeImagen(bytes);
  if (!tipo) return { ok: false, error: 'El logo tiene que ser PNG, JPG o WebP.' };

  await prisma.inquilino.update({
    where: { id: permiso.ctx.inquilino.id },
    data: { logoUrl: `data:${tipo};base64,${Buffer.from(bytes).toString('base64')}` },
  });
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true, mensaje: 'Logo subido.' };
}

export async function quitarLogo(slug: string): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  await prisma.inquilino.update({ where: { id: permiso.ctx.inquilino.id }, data: { logoUrl: null } });
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true, mensaje: 'Logo quitado.' };
}
