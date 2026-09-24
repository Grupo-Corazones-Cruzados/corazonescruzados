import { exigirContexto } from '@/lib/inquilino';
import { EXIGE_ROL } from '@/lib/modulos';
import { prisma } from '@/lib/db';
import { hayCloudinary } from '@/lib/imagenes';
import { miOrigen } from '@/acciones/configuracion';
import { vistaSuscripcion } from '@/lib/vistaSuscripcion';
import ConfiguracionCliente, { type MarcaVista, type PagoVista } from './ConfiguracionCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configuración' };

export default async function PaginaConfiguracion({ params }: { params: Promise<{ cliente: string }> }) {
  const { cliente } = await params;
  const ctx = await exigirContexto(cliente, EXIGE_ROL.configuracion, 'configuracion');
  const { inquilino } = ctx;

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

  // El mismo objeto que recibe la pantalla de impago: una sola forma de contar lo que
  // se debe, y por tanto un solo sitio donde aparece el botón de pagar.
  const suscripcion = vistaSuscripcion(ctx);

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
      suscripcion={suscripcion}
      pagos={historial}
      hayCloudinary={hayCloudinary}
      miOrigen={await miOrigen(cliente)}
    />
  );
}
