'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { contextoEscritura, contextoApi } from '@/lib/inquilino';
import { canalPorId, secretoDelCanal } from '@/lib/agente/canales';
import { enviarTexto } from '@/lib/agente/whatsapp';
import { registrarSaliente } from '@/lib/agente/ingesta';

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

/** Las 24 horas de WhatsApp: fuera de ellas solo se escribe con una plantilla aprobada. */
const VENTANA_MS = 24 * 60 * 60 * 1000;

/**
 * ETIQUETAS DE UN CONTACTO (Fernando, 2026-11-08). Se mandan los NOMBRES que debe llevar; las que
 * no existen en el negocio se crean, y las que deja de llevar se le quitan (la etiqueta sigue
 * existiendo para los demás). Todo dentro del inquilino: un id de otro no toca nada.
 */
export async function etiquetarContacto(slug: string, contactoId: number, nombres: string[]): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'OPERADOR');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const inquilinoId = permiso.ctx.inquilino.id;

  const contacto = await prisma.contacto.findFirst({ where: { id: contactoId, inquilinoId }, select: { id: true } });
  if (!contacto) return { ok: false, error: 'Ese contacto no existe.' };

  const limpios = [...new Map(
    nombres.map((n) => n.trim().replace(/\s+/g, ' ')).filter((n) => n.length > 0 && n.length <= 40).map((n) => [n.toLowerCase(), n]),
  ).values()].slice(0, 20);

  const existentes = await prisma.etiqueta.findMany({ where: { inquilinoId } });
  const porNombre = new Map(existentes.map((e) => [e.nombre.toLowerCase(), e.id]));
  const ids: number[] = [];
  for (const n of limpios) {
    let id = porNombre.get(n.toLowerCase());
    if (!id) id = (await prisma.etiqueta.create({ data: { inquilinoId, nombre: n } })).id;
    ids.push(id);
  }

  await prisma.$transaction([
    prisma.contactoEtiqueta.deleteMany({ where: { contactoId: contacto.id } }),
    prisma.contactoEtiqueta.createMany({ data: ids.map((etiquetaId) => ({ contactoId: contacto.id, etiquetaId })) }),
  ]);
  revalidatePath(`/${slug}/conversaciones`);
  return { ok: true };
}

/**
 * CONTESTAR DESDE LA APP (Fernando, 2026-11-08: «que se pueda contestar desde la app a las
 * conversaciones cuando el control está tomado por el usuario y no por el agente»).
 *
 *  · Solo con la conversación TOMADA (agente apagado en ella): si el agente la lleva, dos voces
 *    contestando a la vez confunden al contacto.
 *  · Solo dentro de las 24 h desde el último mensaje del contacto: es la regla de WhatsApp, y
 *    fuera de ella Meta lo rechaza (131047).
 *  · Se guarda como `herramienta = 'equipo'`, igual que lo que escribe el equipo desde el
 *    teléfono: no es del agente, y no cuenta en sus fallos ni en su consumo.
 */
export async function responder(slug: string, conversacionId: number, texto: string): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'OPERADOR');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const cuerpo = texto.trim();
  if (!cuerpo) return { ok: false, error: 'Escribe un mensaje.' };
  if (cuerpo.length > 4000) return { ok: false, error: 'El mensaje es demasiado largo (máximo 4.000 caracteres).' };

  const conv = await prisma.conversacion.findFirst({
    where: { id: conversacionId, inquilinoId: permiso.ctx.inquilino.id },
    select: { id: true, botActivo: true, canalId: true, contacto: { select: { waId: true } } },
  });
  if (!conv) return { ok: false, error: 'Esa conversación no existe.' };
  if (conv.botActivo) return { ok: false, error: 'La lleva el agente. Tómala para contestar.' };

  const ultimo = await prisma.mensaje.findFirst({
    where: { conversacionId: conv.id, direccion: 'ENTRANTE' },
    orderBy: { creado: 'desc' },
    select: { creado: true },
  });
  if (!ultimo || Date.now() - ultimo.creado.getTime() > VENTANA_MS)
    return { ok: false, error: 'Pasaron más de 24 horas desde su último mensaje: WhatsApp solo deja escribirle con una plantilla.' };

  const canal = await canalPorId(conv.canalId);
  if (!canal?.phone_number_id) return { ok: false, error: 'No hay un número conectado.' };
  const token = secretoDelCanal(canal, 'wa_token');
  if (!token) return { ok: false, error: 'El número no tiene token. Vuelve a conectarlo en Configuración ▸ WhatsApp.' };

  const envio = await enviarTexto({ phoneNumberId: canal.phone_number_id, token, para: conv.contacto.waId, texto: cuerpo });
  await registrarSaliente({
    conversacionId: conv.id,
    texto: cuerpo,
    waMessageId: envio.waMessageId,
    herramienta: 'equipo',
    motivo: `Escrito en la app por ${permiso.ctx.sesion.nombre}`,
    enviadoOk: envio.ok,
    errorEnvio: envio.error,
  });
  revalidatePath(`/${slug}/conversaciones`);
  return envio.ok ? { ok: true } : { ok: false, error: envio.error ?? 'No salió.' };
}

/**
 * Abrir una conversación la marca como VISTA: lo entrante hasta ahora deja de contar como «sin
 * leer» (el círculo verde de la lista). No se marca en el modo demostración ni durante «ver
 * como», que no escriben nada.
 */
export async function marcarVista(slug: string, conversacionId: number): Promise<void> {
  const ctx = await contextoApi(slug);
  if (!ctx || ctx.sesion.suplantadoPor || ctx.inquilino.soloLectura) return;
  await prisma.conversacion.updateMany({
    where: { id: conversacionId, inquilinoId: ctx.inquilino.id },
    data: { vistoEn: new Date() },
  });
}
