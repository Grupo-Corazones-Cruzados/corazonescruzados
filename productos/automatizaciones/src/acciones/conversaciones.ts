'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { contextoEscritura } from '@/lib/inquilino';

export type Resultado = { ok: true } | { ok: false; error: string };

/**
 * Encender o apagar el agente en UNA conversación.
 *
 * Es la acción más usada del producto: cuando el agente se atasca, una persona la
 * toma. Apagarlo deja constancia de QUIÉN la tomó y cuándo — si no, mañana nadie sabe
 * por qué esa conversación lleva dos días sin respuesta automática.
 *
 * ⚠️ La conversación se busca CON el inquilino en el filtro, no solo por id: un
 * identificador de otro cliente no puede tocar nada de este.
 */
export async function cambiarBot(slug: string, conversacionId: number, activo: boolean): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'OPERADOR');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const conv = await prisma.conversacion.findFirst({
    where: { id: conversacionId, inquilinoId: ctx.inquilino.id },
    select: { id: true },
  });
  if (!conv) return { ok: false, error: 'Esa conversación no existe.' };

  await prisma.conversacion.update({
    where: { id: conv.id },
    data: activo
      ? { botActivo: true, tomadaPorId: null, tomadaEn: null }
      : { botActivo: false, tomadaPorId: ctx.sesion.uid, tomadaEn: new Date() },
  });

  revalidatePath(`/${slug}/conversaciones`);
  return { ok: true };
}
