import { exigirContexto } from '@/lib/inquilino';
import { hayCloudinary } from '@/lib/imagenes';
import ConfiguracionCliente from './ConfiguracionCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configuración' };

export default async function PaginaConfiguracion({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = await params;
  const { inquilino } = await exigirContexto(negocio, 'administrar');

  return (
    <ConfiguracionCliente
      slug={negocio}
      hayCloudinary={hayCloudinary}
      marca={{ nombre: inquilino.nombre, colorAcento: inquilino.colorAcento, tema: inquilino.tema, logoUrl: inquilino.logoUrl, moneda: inquilino.moneda }}
      operativa={{
        tiposComida: inquilino.tiposComida,
        diasServicio: inquilino.diasServicio,
        horaLimiteCancelacion: inquilino.horaLimiteCancelacion,
        porcentajeCancelacion: inquilino.porcentajeCancelacion,
        registroAbierto: inquilino.registroAbierto,
      }}
      plan={
        inquilino.suscripcion
          ? {
              nombre: inquilino.suscripcion.plan.nombre,
              precioMensual: Number(inquilino.suscripcion.plan.precioMensual),
              moneda: inquilino.suscripcion.plan.moneda,
              pagadoHasta: inquilino.suscripcion.pagadoHasta?.toISOString() ?? null,
              mesesRetencion: inquilino.suscripcion.plan.mesesRetencion,
              caracteristicas: inquilino.suscripcion.plan.caracteristicas,
            }
          : null
      }
    />
  );
}
