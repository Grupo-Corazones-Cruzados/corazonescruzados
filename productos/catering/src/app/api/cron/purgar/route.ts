import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calcularCorte, esLaUltimaHoraDelMes } from '@/lib/purga';
import { cargarServicios } from '@/lib/servicios-db';

export const dynamic = 'force-dynamic';

/**
 * Purga de fin de mes. La dispara el cron de la plataforma (`nightly-cron`, cada
 * 10 min) con el token compartido; el que decide si toca correr es ESTE endpoint,
 * porque la hora que importa es la del negocio, no la del servidor.
 *
 * Es IDEMPOTENTE: dispararlo seis veces dentro de la misma hora borra lo mismo la
 * primera vez y nada las otras cinco. Con un cron cada 10 minutos, eso no es un
 * detalle: va a pasar todos los meses.
 *
 *   POST /api/cron/purgar            → corre solo si es la última hora del mes
 *   POST /api/cron/purgar?forzar=1   → corre igualmente (para comprobarlo)
 */
export async function POST(peticion: Request) {
  // Se aceptan las dos formas: `x-cron-token` es la que usa el cron de la
  // plataforma; `Authorization: Bearer` es la cómoda para probar a mano.
  const token = process.env.CRON_TOKEN;
  const cabecera = peticion.headers.get('authorization') || '';
  const suelto = peticion.headers.get('x-cron-token') || '';
  if (!token || (cabecera !== `Bearer ${token}` && suelto !== token))
    return NextResponse.json({ error: 'Sin autorización' }, { status: 401 });

  const forzar = new URL(peticion.url).searchParams.get('forzar') === '1';

  const inquilinos = await prisma.inquilino.findMany({
    include: { suscripcion: { include: { plan: true } } },
  });

  const informe: Record<string, unknown>[] = [];
  let borradosTotal = 0;

  for (const inq of inquilinos) {
    // Un escaparate no se purga: sus datos son justo lo que hay que conservar
    // para el siguiente visitante. Además, sus disparadores lo impedirían.
    if (inq.soloLectura) {
      informe.push({ negocio: inq.slug, omitido: 'escaparate' });
      continue;
    }

    const meses = inq.suscripcion?.plan.mesesRetencion ?? null;
    if (!meses || meses < 1) {
      informe.push({ negocio: inq.slug, omitido: 'plan sin límite de retención' });
      continue;
    }

    if (!forzar && !esLaUltimaHoraDelMes(inq.zonaHoraria)) {
      informe.push({ negocio: inq.slug, omitido: 'no es la última hora del mes aquí' });
      continue;
    }

    const corte = calcularCorte(inq.zonaHoraria, meses);

    // Antes de cortar, que el calendario diga qué venció: un servicio que terminó
    // hace dos meses pero que nadie ha abierto desde entonces sigue ACTIVO en la
    // base hasta que alguien lo lee. `cargarServicios` lo marca.
    await cargarServicios(inq, { estado: { in: ['ACTIVO'] } });

    // Solo lo que YA TERMINÓ. Un servicio vigente sigue vivo aunque empezara hace
    // meses; los clientes, alimentos, motorizados y feriados son datos maestros y
    // NUNCA se purgan.
    //
    // ⚠️ LAS CANCELACIONES NO SE PURGAN POR SU FECHA: se van CON su servicio (en
    // cascada). Una cancelación vieja de un servicio vigente forma parte de su
    // aritmética —corre la fecha de fin un día— y borrarla sola le quitaría al
    // cliente un día que pagó. Se midió: la primera versión lo hacía.
    const aBorrar = { inquilinoId: inq.id, estado: 'VENCIDO' as const, terminoEn: { not: null, lt: corte } };
    const cancelacionesEnCascada = await prisma.cancelacion.count({ where: { servicio: aBorrar } });
    const [servicios, menus, mensajes] = await prisma.$transaction([
      prisma.servicio.deleteMany({ where: aBorrar }),
      prisma.menu.deleteMany({ where: { inquilinoId: inq.id, fecha: { lt: corte } } }),
      prisma.mensaje.deleteMany({ where: { inquilinoId: inq.id, creado: { lt: corte } } }),
    ]);
    const cancelaciones = { count: servicios.count ? cancelacionesEnCascada : 0 };

    const total = servicios.count + cancelaciones.count + menus.count + mensajes.count;
    if (total)
      await prisma.purga.create({
        data: {
          inquilinoId: inq.id,
          corte,
          servicios: servicios.count,
          cancelaciones: cancelaciones.count,
          menus: menus.count,
          mensajes: mensajes.count,
        },
      });

    borradosTotal += total;
    informe.push({
      negocio: inq.slug,
      corte: corte.toISOString().slice(0, 10),
      meses,
      servicios: servicios.count,
      cancelaciones: cancelaciones.count,
      menus: menus.count,
      mensajes: mensajes.count,
    });
  }

  return NextResponse.json({ ok: true, forzado: forzar, borrados: borradosTotal, informe });
}
