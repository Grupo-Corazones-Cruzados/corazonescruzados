import { exigirContexto } from '@/lib/inquilino';
import { hayCloudinary } from '@/lib/imagenes';
import { listaDePlantillas } from '@/plantillas';
import ConfiguracionCliente from './ConfiguracionCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configuración' };

export default async function PaginaConfiguracion({ params }: { params: Promise<{ institucion: string }> }) {
  const { institucion } = await params;
  const { inquilino } = await exigirContexto(institucion, 'administrar');
  const plan = inquilino.suscripcion?.plan;

  return (
    <ConfiguracionCliente
      slug={institucion}
      hayCloudinary={hayCloudinary}
      marca={{ nombre: inquilino.nombre, colorAcento: inquilino.colorAcento, tema: inquilino.tema, logoUrl: inquilino.logoUrl, plantillaPorDefecto: inquilino.plantillaPorDefecto }}
      plantillas={listaDePlantillas()}
      plan={
        plan
          ? {
              nombre: plan.nombre,
              precioMensual: Number(plan.precioMensual),
              moneda: plan.moneda,
              pagadoHasta: inquilino.suscripcion?.pagadoHasta?.toISOString() ?? null,
              mesesRetencion: plan.mesesRetencion,
              maxUsuarios: plan.maxUsuarios,
              maxGeneracionesSemana: plan.maxGeneracionesSemana,
              caracteristicas: plan.caracteristicas,
            }
          : null
      }
    />
  );
}
