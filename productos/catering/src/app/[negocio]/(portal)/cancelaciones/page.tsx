import { exigirContextoCliente } from '@/lib/inquilino';
import { cargarServicios, feriadosDelNegocio } from '@/lib/servicios-db';
import { calendarioServicio } from '@/lib/servicios';
import { aDia, hoyEn } from '@/lib/fechas';
import CancelacionesCliente from './CancelacionesCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cancelaciones' };

export default async function PaginaCancelaciones({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = await params;
  const { inquilino, cliente } = await exigirContextoCliente(negocio);
  const hoy = hoyEn(inquilino.zonaHoraria);
  const [servicios, feriados] = await Promise.all([cargarServicios(inquilino, { clienteId: cliente.id }), feriadosDelNegocio(inquilino.id)]);
  const vigente = servicios.find((s) => s.estado === 'ACTIVO') ?? null;
  const anteriores = servicios.filter((s) => s.id !== vigente?.id);

  return (
    <CancelacionesCliente
      slug={negocio}
      hoy={hoy}
      horaLimite={inquilino.horaLimiteCancelacion}
      vigente={vigente ? {
        id: vigente.id,
        resumen: vigente.resumen,
        calendario: calendarioServicio(vigente, hoy, feriados, vigente.cancelaciones.filter((c) => c.activa).map((c) => ({ id: c.id, dia: aDia(c.fecha), motivo: c.motivo }))),
        cancelaciones: vigente.cancelaciones.map((c) => ({ id: c.id, dia: aDia(c.fecha), motivo: c.motivo, activa: c.activa, autor: c.autor })),
      } : null}
      anteriores={anteriores.flatMap((s) => s.cancelaciones.map((c) => ({ id: c.id, dia: aDia(c.fecha), motivo: c.motivo, activa: c.activa, autor: c.autor })))}
    />
  );
}
