'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura, contextoApi, AVISO_VISTA } from '@/lib/inquilino';
import { verificarCuentaGcc } from '@/lib/cuentaGcc';

export type Resultado = { ok: true; mensaje?: string; url?: string } | { ok: false; error: string };

const opcional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

/**
 * CONFIGURACIÓN ▸ NEGOCIO (Fernando, 2026-11-08). Lo que antes era «Marca» sin el color ni
 * el tema —el producto tiene un solo tema—: el nombre, la zona horaria, los datos de
 * facturación y los de contacto.
 */
const Negocio = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre del negocio.').max(80),
  zonaHoraria: z.string().trim().min(3),
  razonSocial: opcional(160),
  identificacion: z.string().trim().max(20).optional()
    .transform((v) => (v ? v.replace(/\s/g, '') : null))
    .refine((v) => v === null || /^[0-9A-Za-z-]{5,20}$/.test(v), 'La identificación solo lleva números, letras o guiones.'),
  direccion: opcional(240),
  correoFacturacion: z.string().trim().max(160).optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'El correo de facturación no es válido.'),
  contactoNombre: opcional(120),
  contactoEmail: z.string().trim().max(160).optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'El correo de contacto no es válido.'),
  contactoTelefono: opcional(40),
});

export async function guardarNegocio(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'ADMIN');
  if (!permiso.ok) return { ok: false, error: permiso.error };

  const leido = Negocio.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };

  await prisma.inquilino.update({ where: { id: permiso.ctx.inquilino.id }, data: leido.data });
  // 'layout': el nombre vive en el armazón (menú, título).
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true, mensaje: 'Datos del negocio guardados.' };
}

/** PNG, JPEG o WebP, reconocidos por sus primeros bytes (no por lo que diga el navegador). */
function tipoDeImagen(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

const MAX_LOGO = 512 * 1024;

/**
 * EL LOGO SE SUBE COMO ARCHIVO, NUNCA COMO DIRECCIÓN (Fernando, 2026-11-08). Se guarda en la
 * base (tabla `logos`) y se sirve desde `/<cliente>/logo?v=N`. SVG no: un SVG puede llevar
 * código, y se serviría desde nuestro propio dominio.
 */
export async function subirLogo(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'ADMIN');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const archivo = datos.get('archivo');
  if (!(archivo instanceof File) || !archivo.size) return { ok: false, error: 'Elige una imagen.' };
  if (archivo.size > MAX_LOGO) return { ok: false, error: 'El logo pesa más de 512 KB. Usa una imagen más pequeña.' };

  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const tipo = tipoDeImagen(bytes);
  if (!tipo) return { ok: false, error: 'El logo tiene que ser PNG, JPG o WebP.' };

  const id = permiso.ctx.inquilino.id;
  await prisma.$transaction([
    prisma.logo.upsert({
      where: { inquilinoId: id },
      create: { inquilinoId: id, datos: Buffer.from(bytes), tipo },
      update: { datos: Buffer.from(bytes), tipo, actualizado: new Date() },
    }),
    // El antiguo logo por dirección deja de usarse en cuanto hay uno subido.
    prisma.inquilino.update({ where: { id }, data: { logoVersion: { increment: 1 }, logoUrl: null } }),
  ]);
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true, mensaje: 'Logo subido.' };
}

export async function quitarLogo(slug: string): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'ADMIN');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const id = permiso.ctx.inquilino.id;
  await prisma.$transaction([
    prisma.logo.deleteMany({ where: { inquilinoId: id } }),
    prisma.inquilino.update({ where: { id }, data: { logoVersion: 0, logoUrl: null } }),
  ]);
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true, mensaje: 'Logo quitado.' };
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
  if (ctx.sesion.suplantadoPor) return { ok: false, error: AVISO_VISTA };

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
