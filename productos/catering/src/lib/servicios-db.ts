import { prisma } from '@/lib/db';
import { aDia, aFechaSql, hoyEn, type Dia } from '@/lib/fechas';
import { resumirServicio, type ResumenServicio } from '@/lib/servicios';

/**
 * Lo que cualquier pantalla necesita saber de los servicios de un negocio, ya
 * resumido. Y de paso la única escritura que se permite al leer: marcar VENCIDO
 * lo que el calendario dice que venció, para que la purga tenga por dónde cortar.
 */

export async function feriadosDelNegocio(inquilinoId: number): Promise<Set<Dia>> {
  const f = await prisma.feriado.findMany({
    where: { inquilinoId, esLaborable: false },
    select: { fecha: true },
  });
  return new Set(f.map((x) => aDia(x.fecha)));
}

export type ServicioResumido = Awaited<ReturnType<typeof cargarServicios>>[number];

/**
 * Carga los servicios con sus cancelaciones y los resume. Marca VENCIDO en la
 * base lo que el calendario dice que ya terminó (una sola vez: `terminoEn`).
 * ⚠️ En un escaparate no se escribe ni esto.
 */
export async function cargarServicios(
  inquilino: { id: number; zonaHoraria: string; soloLectura: boolean },
  where: { clienteId?: number; estado?: { in: ('ACTIVO' | 'SUSPENDIDO' | 'VENCIDO')[] } } = {},
) {
  const hoy = hoyEn(inquilino.zonaHoraria);
  const [servicios, feriados] = await Promise.all([
    prisma.servicio.findMany({
      where: { inquilinoId: inquilino.id, ...where },
      include: {
        cliente: { select: { id: true, nombre: true, celular: true, email: true, estado: true, motorizado: { select: { nombre: true } } } },
        cancelaciones: { orderBy: { fecha: 'desc' } },
      },
      orderBy: [{ estado: 'asc' }, { cliente: { nombre: 'asc' } }],
    }),
    feriadosDelNegocio(inquilino.id),
  ]);

  const vencidos: { id: number; fin: Dia }[] = [];
  const resumidos = servicios.map((s) => {
    const canceladas = new Set(s.cancelaciones.filter((c) => c.activa).map((c) => aDia(c.fecha)));
    const r: ResumenServicio = resumirServicio(s, hoy, feriados, canceladas);
    if (s.estado === 'ACTIVO' && r.situacion === 'VENCIDO') vencidos.push({ id: s.id, fin: r.fechaFin });
    return { ...s, resumen: r, canceladas };
  });

  if (vencidos.length && !inquilino.soloLectura) {
    await prisma.$transaction(
      vencidos.map((v) =>
        prisma.servicio.update({
          where: { id: v.id },
          data: { estado: 'VENCIDO', terminoEn: aFechaSql(v.fin) },
        }),
      ),
    );
    for (const s of resumidos) {
      const v = vencidos.find((x) => x.id === s.id);
      if (v) { s.estado = 'VENCIDO'; s.terminoEn = aFechaSql(v.fin); }
    }
  }

  return resumidos;
}
