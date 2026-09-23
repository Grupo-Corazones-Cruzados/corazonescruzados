import { exigirContexto, evaluarAcceso, topeUsuarios } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { hayCloudinary } from '@/lib/imagenes';
import { miOrigen } from '@/acciones/configuracion';
import ConfiguracionCliente, { type MarcaVista, type PlanVista, type PagoVista } from './ConfiguracionCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configuración' };

export default async function PaginaConfiguracion({ params }: { params: Promise<{ cliente: string }> }) {
  const { cliente } = await params;
  const { inquilino } = await exigirContexto(cliente, 'ADMIN');

  const pagos = await prisma.pagoMensual.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: { periodo: 'desc' },
    take: 12,
  });

  const marca: MarcaVista = {
    nombre: inquilino.nombre,
    colorAcento: inquilino.colorAcento,
    tema: inquilino.tema,
    logoUrl: inquilino.logoUrl,
    zonaHoraria: inquilino.zonaHoraria,
  };

  const s = inquilino.suscripcion;
  const plan: PlanVista = {
    cortesia: inquilino.cortesia,
    acceso: evaluarAcceso(inquilino),
    plan: s?.plan.nombre ?? null,
    precio: s ? Number(s.plan.precioMensual) : 0,
    moneda: s?.plan.moneda ?? 'USD',
    pagadoHasta: s?.pagadoHasta ? s.pagadoHasta.toLocaleDateString('es-EC') : null,
    maxUsuarios: topeUsuarios(inquilino),
    mesesRetencion: inquilino.cortesia ? null : (s?.plan.mesesRetencion ?? null),
  };

  const historial: PagoVista[] = pagos.map((p) => ({
    id: p.id,
    periodo: p.periodo,
    monto: Number(p.monto),
    moneda: p.moneda,
    estado: p.estado,
    metodo: p.metodo,
    pagadoEn: p.pagadoEn ? p.pagadoEn.toLocaleDateString('es-EC') : null,
  }));

  return (
    <ConfiguracionCliente
      slug={cliente}
      marca={marca}
      plan={plan}
      pagos={historial}
      hayCloudinary={hayCloudinary}
      miOrigen={await miOrigen(cliente)}
    />
  );
}
