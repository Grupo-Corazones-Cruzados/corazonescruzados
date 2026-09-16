'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura } from '@/lib/inquilino';

export type Resultado = { ok: true } | { ok: false; error: string };

const Negocio = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre de la institución.').max(120),
  contactoNombre: z.string().trim().max(120).optional().or(z.literal('')),
  contactoEmail: z.string().trim().email('El correo no es válido.').optional().or(z.literal('')),
  contactoTelefono: z.string().trim().max(40).optional().or(z.literal('')),
  cabeceraLinea1: z.string().trim().max(160).optional().or(z.literal('')),
  cabeceraLinea2: z.string().trim().max(160).optional().or(z.literal('')),
  cabeceraLinea3: z.string().trim().max(160).optional().or(z.literal('')),
  anioLectivo: z.string().trim().max(40).optional().or(z.literal('')),
});

const MAX_LOGO = 600 * 1024;
const TIPOS = ['image/png', 'image/jpeg'];
const LOGOS = ['logoInstitucionUrl', 'logoOrganizacionUrl', 'logoOpcionalUrl'] as const;

/**
 * Un logo del formato: llega como archivo (→ `data:` URL, PNG/JPG hasta 600 KB) o
 * como dirección; «quitar» lo borra; sin nada, se conserva el que había.
 */
async function leerLogo(datos: FormData, clave: string, actual: string | null): Promise<{ ok: true; url: string | null } | { ok: false; error: string }> {
  const archivo = datos.get(`${clave}Archivo`);
  if (archivo instanceof File && archivo.size > 0) {
    if (!TIPOS.includes(archivo.type)) return { ok: false, error: 'Los logos tienen que ser PNG o JPG.' };
    if (archivo.size > MAX_LOGO) return { ok: false, error: 'Un logo no puede pasar de 600 KB.' };
    const b = Buffer.from(await archivo.arrayBuffer());
    return { ok: true, url: `data:${archivo.type};base64,${b.toString('base64')}` };
  }
  if (datos.get(`${clave}Quitar`) === 'true') return { ok: true, url: null };
  const url = String(datos.get(clave) || '').trim();
  return { ok: true, url: url || actual };
}

/**
 * EL MÓDULO «NEGOCIO» (Fernando, 2026-09-16): lo que la institución lleva impreso
 * en el formato —las tres líneas de la cabecera, el año lectivo y los tres logos—
 * además de su nombre y su contacto. Solo el administrador.
 */
export async function guardarNegocio(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const leido = Negocio.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;

  const logos: Record<string, string | null> = {};
  for (const clave of LOGOS) {
    const r = await leerLogo(datos, clave, ctx.inquilino[clave]);
    if (!r.ok) return r;
    logos[clave] = r.url;
  }

  await prisma.inquilino.update({
    where: { id: ctx.inquilino.id },
    data: {
      nombre: d.nombre,
      contactoNombre: d.contactoNombre || null,
      contactoEmail: d.contactoEmail || null,
      contactoTelefono: d.contactoTelefono || null,
      cabeceraLinea1: d.cabeceraLinea1 || null,
      cabeceraLinea2: d.cabeceraLinea2 || null,
      cabeceraLinea3: d.cabeceraLinea3 || null,
      anioLectivo: d.anioLectivo || null,
      ...logos,
    },
  });
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}
