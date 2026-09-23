import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import Bandeja, { type ConversacionLista, type MensajeVista } from './Bandeja';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Conversaciones' };

/**
 * La bandeja. La conversación abierta viaja en la DIRECCIÓN (`?c=123`) y no en el
 * estado del cliente: así una conversación concreta se puede enviar por mensaje, y al
 * volver atrás en el navegador se cierra en vez de salir de la bandeja entera.
 */
export default async function PaginaConversaciones({
  params,
  searchParams,
}: {
  params: Promise<{ cliente: string }>;
  searchParams: Promise<{ c?: string; q?: string }>;
}) {
  const { cliente } = await params;
  const { c, q } = await searchParams;
  const { inquilino, sesion } = await exigirContexto(cliente);

  const busca = (q || '').trim();
  const conversaciones = await prisma.conversacion.findMany({
    where: {
      inquilinoId: inquilino.id,
      ...(busca
        ? {
            contacto: {
              OR: [
                { nombreAgenda: { contains: busca, mode: 'insensitive' } },
                { nombrePerfil: { contains: busca, mode: 'insensitive' } },
                { waId: { contains: busca } },
              ],
            },
          }
        : {}),
    },
    orderBy: { ultimoMensajeEn: 'desc' },
    take: 100,
    include: {
      contacto: { select: { nombreAgenda: true, nombrePerfil: true, waId: true } },
      tomadaPor: { select: { nombre: true } },
    },
  });

  const abiertaId = c && /^\d+$/.test(c) ? Number(c) : null;
  // ⚠️ La conversación abierta se busca CON el inquilino en el filtro. Cargarla solo
  // por id dejaría que `?c=` de otro cliente enseñara sus mensajes.
  const abierta = abiertaId
    ? await prisma.conversacion.findFirst({
        where: { id: abiertaId, inquilinoId: inquilino.id },
        include: {
          contacto: true,
          tomadaPor: { select: { nombre: true } },
          mensajes: { orderBy: { creado: 'asc' }, take: 200 },
        },
      })
    : null;

  const lista: ConversacionLista[] = conversaciones.map((x) => ({
    id: x.id,
    nombre: x.contacto.nombreAgenda || x.contacto.nombrePerfil || x.contacto.waId,
    numero: x.contacto.waId,
    ultimo: x.ultimoMensajeEn ? x.ultimoMensajeEn.toISOString() : null,
    botActivo: x.botActivo,
    tomadaPor: x.tomadaPor?.nombre ?? null,
  }));

  const mensajes: MensajeVista[] =
    abierta?.mensajes.map((m) => ({
      id: m.id,
      direccion: m.direccion,
      texto: m.texto,
      tipo: m.tipo,
      herramienta: m.herramienta,
      enviadoOk: m.enviadoOk,
      creado: m.creado.toISOString(),
    })) ?? [];

  return (
    <Bandeja
      slug={cliente}
      lista={lista}
      busca={busca}
      abierta={
        abierta
          ? {
              id: abierta.id,
              nombre:
                abierta.contacto.nombreAgenda || abierta.contacto.nombrePerfil || abierta.contacto.waId,
              numero: abierta.contacto.waId,
              botActivo: abierta.botActivo,
              tomadaPor: abierta.tomadaPor?.nombre ?? null,
            }
          : null
      }
      mensajes={mensajes}
      puedeOperar={sesion.rol !== 'CONSULTA'}
    />
  );
}
