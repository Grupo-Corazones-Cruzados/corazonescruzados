import { exigirContexto } from '@/lib/inquilino';
import { Tarjeta } from '@/componentes/ui';
import { CabeceraPagina } from '@/componentes/Navegacion';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configuración' };

export default async function PaginaConfiguracion({
  params,
}: {
  params: Promise<{ cliente: string }>;
}) {
  const { cliente } = await params;
  const { inquilino } = await exigirContexto(cliente, 'ADMIN');

  return (
    <>
      <CabeceraPagina titulo="Configuración" descripcion="La marca de tu espacio" />
      <div className="max-w-2xl px-4 py-5 sm:px-6">
      <Tarjeta className="p-4 sm:p-5">
        <h2 className="mb-3 text-[14px] font-semibold text-texto">Tu marca</h2>
        <dl className="space-y-2 text-[13px]">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-tenue">Nombre</dt>
            <dd className="font-medium text-texto">{inquilino.nombre}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-tenue">Color</dt>
            <dd className="flex items-center gap-2">
              <span
                className="inline-block h-5 w-5 rounded border border-borde"
                style={{ backgroundColor: inquilino.colorAcento }}
              />
              <span className="font-medium text-texto">{inquilino.colorAcento}</span>
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-tenue">Tema</dt>
            <dd className="font-medium text-texto">{inquilino.tema === 'OSCURO' ? 'Oscuro' : 'Claro'}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-tenue">Zona horaria</dt>
            <dd className="font-medium text-texto">{inquilino.zonaHoraria}</dd>
          </div>
        </dl>
        <p className="mt-3 rounded border border-borde bg-realce px-3 py-2 text-[12px] leading-relaxed text-tenue">
          Para cambiar el logo, el color o el tema, escríbenos a hola@grupocc.org. La
          edición desde aquí llega en la siguiente entrega.
        </p>
      </Tarjeta>
      </div>
    </>
  );
}
