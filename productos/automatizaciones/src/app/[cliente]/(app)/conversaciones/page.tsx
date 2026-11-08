import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { pool } from '@/lib/db';
import Bandeja, { type ConversacionLista, type MensajeVista, type Gasto } from './Bandeja';

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
  searchParams: Promise<{ c?: string; q?: string; e?: string; f?: string }>;
}) {
  const { cliente } = await params;
  const { c, q, e, f } = await searchParams;
  const soloNoLeidos = f === 'noleidos';
  const { inquilino, sesion } = await exigirContexto(cliente);

  const busca = (q || '').trim();
  // Las etiquetas del negocio, y la elegida en el filtro (`?e=`), solo si es SUYA.
  const etiquetas = await prisma.etiqueta.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: { nombre: 'asc' },
    select: { id: true, nombre: true },
  });
  const etiquetaId = e && etiquetas.some((x) => String(x.id) === e) ? Number(e) : null;

  const conversaciones = await prisma.conversacion.findMany({
    where: {
      inquilinoId: inquilino.id,
      contacto: {
        ...(busca
          ? {
              OR: [
                { nombreAgenda: { contains: busca, mode: 'insensitive' } },
                { nombrePerfil: { contains: busca, mode: 'insensitive' } },
                { waId: { contains: busca } },
              ],
            }
          : {}),
        ...(etiquetaId ? { etiquetas: { some: { etiquetaId } } } : {}),
      },
    },
    orderBy: { ultimoMensajeEn: 'desc' },
    take: 100,
    include: {
      contacto: {
        select: { nombreAgenda: true, nombrePerfil: true, waId: true, etiquetas: { select: { etiqueta: { select: { nombre: true } } } } },
      },
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
          contacto: { include: { etiquetas: { select: { etiqueta: { select: { nombre: true } } } } } },
          tomadaPor: { select: { nombre: true } },
          mensajes: { orderBy: { creado: 'asc' }, take: 200 },
        },
      })
    : null;

  /**
   * Lo que WhatsApp enseña en cada fila de la lista (2026-11-08): el ÚLTIMO mensaje (con sus ✓ si
   * es nuestro) y cuántos ENTRANTES llegaron después de que el equipo la abriera. Una consulta
   * para todas las conversaciones de la lista, no una por fila.
   */
  const ids = conversaciones.map((x) => x.id);
  const { rows: resumenes } = ids.length
    ? await pool.query<{ id: number; direccion: 'ENTRANTE' | 'SALIENTE'; texto: string | null; tipo: string; estado: string | null; enviado_ok: boolean | null; sin_leer: number }>(
        `SELECT c.id, u.direccion, u.texto, u.tipo, u.estado, u.enviado_ok,
                (SELECT COUNT(*)::int FROM mensajes e
                  WHERE e.conversacion_id = c.id AND e.direccion = 'ENTRANTE'
                    AND e.creado_en > COALESCE(c.visto_en, '-infinity')) AS sin_leer
           FROM conversaciones c
           LEFT JOIN LATERAL (
             SELECT direccion, texto, tipo, estado, enviado_ok FROM mensajes m
              WHERE m.conversacion_id = c.id ORDER BY m.creado_en DESC LIMIT 1
           ) u ON true
          WHERE c.id = ANY($1)`,
        [ids],
      )
    : { rows: [] };
  const resumen = new Map(resumenes.map((r) => [r.id, r]));

  const todas: ConversacionLista[] = conversaciones.map((x) => ({
    id: x.id,
    nombre: x.contacto.nombreAgenda || x.contacto.nombrePerfil || x.contacto.waId,
    numero: x.contacto.waId,
    ultimo: x.ultimoMensajeEn ? x.ultimoMensajeEn.toISOString() : null,
    botActivo: x.botActivo,
    tomadaPor: x.tomadaPor?.nombre ?? null,
    etiquetas: x.contacto.etiquetas.map((t) => t.etiqueta.nombre).sort(),
    vistaPrevia: resumen.get(x.id)
      ? {
          nuestro: resumen.get(x.id)!.direccion === 'SALIENTE',
          texto: resumen.get(x.id)!.texto,
          tipo: resumen.get(x.id)!.tipo,
          estado: resumen.get(x.id)!.enviado_ok === false ? 'failed' : resumen.get(x.id)!.estado,
        }
      : null,
    sinLeer: x.id === abiertaId ? 0 : resumen.get(x.id)?.sin_leer ?? 0,
  }));
  // «No leídos», como el filtro de WhatsApp. La abierta se queda aunque ya no tenga pendientes.
  const lista = soloNoLeidos ? todas.filter((x) => x.sinLeer > 0 || x.id === abiertaId) : todas;

  // ¿Sigue abierta la ventana de 24 h de WhatsApp? Decide si se puede escribir libremente.
  const ultimoEntrante = abierta
    ? [...abierta.mensajes].reverse().find((m) => m.direccion === 'ENTRANTE')?.creado ?? null
    : null;
  const ventanaAbierta = !!ultimoEntrante && Date.now() - ultimoEntrante.getTime() < 24 * 60 * 60 * 1000;

  /**
   * LO QUE HA COSTADO ESTA CONVERSACIÓN (Fernando, 2026-09-23: «un contador de tokens o
   * costo del agente […] a la derecha de su número de teléfono»).
   *
   * Se suma aquí y no en el cliente porque son miles de filas de `uso_modelo`: mandarlas
   * al navegador para sumarlas allí sería mover un kilo de datos para enseñar un número.
   */
  const gasto: Gasto | null = abierta
    ? await pool
        .query(
          `SELECT COUNT(*)::int corridas,
                  COALESCE(SUM(tokens_entrada), 0)::int entrada,
                  COALESCE(SUM(tokens_salida), 0)::int salida,
                  COALESCE(SUM(tokens_cache_lectura), 0)::int cache_lectura
             FROM uso_modelo WHERE conversacion_id = $1`,
          [abierta.id],
        )
        .then((r) => r.rows[0] as Gasto)
    : null;

  const mensajes: MensajeVista[] =
    abierta?.mensajes.map((m) => ({
      id: m.id,
      direccion: m.direccion,
      texto: m.texto,
      tipo: m.tipo,
      herramienta: m.herramienta,
      enviadoOk: m.enviadoOk,
      errorEnvio: m.errorEnvio,
      estado: m.estado,
      creado: m.creado.toISOString(),
    })) ?? [];

  return (
    <Bandeja
      slug={cliente}
      lista={lista}
      busca={busca}
      etiquetas={etiquetas}
      etiquetaId={etiquetaId}
      soloNoLeidos={soloNoLeidos}
      abierta={
        abierta
          ? {
              id: abierta.id,
              nombre:
                abierta.contacto.nombreAgenda || abierta.contacto.nombrePerfil || abierta.contacto.waId,
              numero: abierta.contacto.waId,
              botActivo: abierta.botActivo,
              tomadaPor: abierta.tomadaPor?.nombre ?? null,
              contactoId: abierta.contactoId,
              etiquetas: abierta.contacto.etiquetas.map((t) => t.etiqueta.nombre).sort(),
              ventanaAbierta,
            }
          : null
      }
      mensajes={mensajes}
      zona={inquilino.zonaHoraria}
      gasto={gasto}
      puedeOperar={sesion.rol !== 'CONSULTA'}
    />
  );
}
