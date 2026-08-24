import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calcularCorte, esLaUltimaHoraDelMes } from '@/lib/purga';

export const dynamic = 'force-dynamic';

/**
 * Purga de fin de mes. La dispara el cron de la plataforma con el token
 * compartido; quien decide si toca correr es ESTE endpoint, porque la hora que
 * importa es la del alojamiento, no la del servidor.
 *
 * IDEMPOTENTE: con un cron cada 10 minutos se va a disparar seis veces dentro de
 * la última hora del mes. La primera borra; las otras cinco no encuentran nada.
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
    if (inq.soloLectura) {
      informe.push({ alojamiento: inq.slug, omitido: 'escaparate' });
      continue;
    }

    const meses = inq.suscripcion?.plan.mesesRetencion ?? null;
    if (!meses || meses < 1) {
      informe.push({ alojamiento: inq.slug, omitido: 'plan sin límite de retención' });
      continue;
    }

    if (!forzar && !esLaUltimaHoraDelMes(inq.zonaHoraria)) {
      informe.push({ alojamiento: inq.slug, omitido: 'no es la última hora del mes aquí' });
      continue;
    }

    const corte = calcularCorte(inq.zonaHoraria, meses);

    // ⚠️ POR LA FECHA DE SALIDA. Una estancia futura anotada hace meses sigue
    // viva: mirar la fecha de alta la borraría y el hotel perdería la reserva.
    const borradas = await prisma.reserva.deleteMany({
      where: { inquilinoId: inq.id, salida: { lt: corte } },
    });

    if (borradas.count)
      await prisma.purga.create({
        data: { inquilinoId: inq.id, corte, reservas: borradas.count },
      });

    borradosTotal += borradas.count;
    informe.push({
      alojamiento: inq.slug,
      corte: corte.toISOString().slice(0, 10),
      meses,
      reservas: borradas.count,
    });
  }

  return NextResponse.json({ ok: true, forzado: forzar, borrados: borradosTotal, informe });
}
