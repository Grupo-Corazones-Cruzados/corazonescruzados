'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura } from '@/lib/inquilino';

export type Resultado = { ok: true; url?: string } | { ok: false; error: string };

// ── Negocio ─────────────────────────────────────────────────────────────────
/**
 * NEGOCIO (antes «Marca» y «Facturación», 2026-11-08, como en Automatizaciones): sin color ni
 * tema —el producto tiene un solo tema— y sin dirección del logo escrita a mano: el logo se
 * SUBE como archivo y se guarda al subirlo (`subirLogo`). Las columnas `color_acento` y `tema`
 * se quedan como están, sin uso.
 */
const Negocio = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre del negocio.').max(80),
  moneda: z.string().trim().length(3, 'La moneda son tres letras (USD, EUR…).').toUpperCase(),
});

/**
 * El nombre, la moneda y cómo factura el negocio, en un solo «Guardar».
 *
 * ⚠️ Cambiar el IVA **no reescribe pedidos pasados**: cada pedido guarda la tasa que se le
 * aplicó. Si al cambiarla se recalculara el histórico, la caja de ayer dejaría de cuadrar con
 * lo que se cobró de verdad.
 */
export async function guardarNegocio(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const leido = Negocio.safeParse({ nombre: datos.get('nombre'), moneda: datos.get('moneda') });
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;

  const aplicaIva = datos.get('aplicaIva') === 'on' || datos.get('aplicaIva') === 'true';
  const precioConIva = datos.get('precioConIva') === 'on' || datos.get('precioConIva') === 'true';
  const porcentaje = Number(datos.get('ivaPorcentaje') || 0);

  if (aplicaIva && (!(porcentaje > 0) || porcentaje > 99))
    return { ok: false, error: 'El IVA tiene que estar entre 0 y 99 %.' };

  await prisma.inquilino.update({
    where: { id: ctx.inquilino.id },
    data: {
      nombre: d.nombre,
      moneda: d.moneda,
      aplicaIva,
      precioConIva,
      ivaPorcentaje: aplicaIva ? porcentaje : 0,
    },
  });
  // 'layout' porque el nombre lo pinta el armazón (el menú).
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

/** El tipo real de la imagen, por sus primeros bytes (no por lo que diga el navegador). */
function tipoDeImagen(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

const MAX_LOGO = 512 * 1024;

/**
 * EL LOGO SE SUBE COMO ARCHIVO (2026-11-08, como en Planificaciones). Cloudinary no está en
 * producción: se guarda como `data:` en la columna `logo_url` de siempre y se sirve desde
 * `/<slug>/logo` (`lib/marca.ts › urlLogo`). SVG no: puede llevar código y se serviría desde
 * nuestro propio dominio. Queda puesto al subirlo: no hace falta pulsar «Guardar».
 */
export async function subirLogo(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  const archivo = datos.get('archivo');
  if (!(archivo instanceof File) || !archivo.size) return { ok: false, error: 'Elige una imagen.' };
  if (archivo.size > MAX_LOGO) return { ok: false, error: 'El logo pesa más de 512 KB.' };

  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const tipo = tipoDeImagen(bytes);
  if (!tipo) return { ok: false, error: 'El logo tiene que ser PNG, JPG o WebP.' };

  await prisma.inquilino.update({
    where: { id: ctx.inquilino.id },
    data: { logoUrl: `data:${tipo};base64,${Buffer.from(bytes).toString('base64')}` },
  });
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

/** Quita el logo: en su lugar se ve la inicial del negocio. */
export async function quitarLogo(slug: string): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  await prisma.inquilino.update({ where: { id: ctx.inquilino.id }, data: { logoUrl: null } });
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}
