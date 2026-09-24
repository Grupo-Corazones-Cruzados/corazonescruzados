import { exigirContexto, accesoDelContexto, topeUsuarios } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { hayCloudinary } from '@/lib/imagenes';
import { miOrigen } from '@/acciones/configuracion';
import ConfiguracionCliente, { type MarcaVista, type PlanVista, type PagoVista } from './ConfiguracionCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configuración' };

export default async function PaginaConfiguracion({ params }: { params: Promise<{ cliente: string }> }) {
  const { cliente } = await params;
  const ctx = await exigirContexto(cliente, 'ADMIN');
  const { inquilino, suscripcionGcc: sus } = ctx;

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
    // ⚠️ La MISMA respuesta que da la puerta. Si esta pantalla calculara el estado por su
    // cuenta, diría «al día» a alguien a quien la aplicación está bloqueando —o al revés—,
    // que es justo lo que se quería evitar al enlazar la suscripción.
    acceso: accesoDelContexto(ctx),
    plan: sus?.titulo ?? s?.plan.nombre ?? null,
    precio: sus ? sus.costoMensual : (s ? Number(s.plan.precioMensual) : 0),
    moneda: sus?.moneda ?? s?.plan.moneda ?? 'USD',
    pagadoHasta: sus
      ? (sus.cubiertoHasta ? sus.cubiertoHasta.toLocaleDateString('es-EC') : null)
      : (s?.pagadoHasta ? s.pagadoHasta.toLocaleDateString('es-EC') : null),
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
