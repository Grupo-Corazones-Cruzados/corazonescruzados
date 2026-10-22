import { exigirContextoCliente } from '@/lib/inquilino';
import { AplicaMarca } from '@/componentes/Marca';
import { BarraLateral, BarraInferior, HuecoBarraAcciones } from '@/componentes/Navegacion';
import { AvisoEscaparate } from '@/componentes/AvisoEscaparate';

export const dynamic = 'force-dynamic';

/** Armazón del PORTAL del cliente final. Misma marca del negocio, otra puerta. */
export default async function LayoutPortal({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ negocio: string }>;
}) {
  const { negocio } = await params;
  const { inquilino, cliente } = await exigirContextoCliente(negocio);
  const quien = { tipo: 'cliente' as const };

  return (
    <AplicaMarca colorAcento={inquilino.colorAcento} tema={inquilino.tema}>
      <BarraLateral slug={negocio} negocio={inquilino.nombre} logoUrl={inquilino.logoUrl} usuario={cliente.nombre} quien={quien} />
      <div className="flex min-h-dvh flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:ml-16 lg:block lg:min-h-0 lg:pb-0">
        {inquilino.soloLectura && <AvisoEscaparate />}
        {children}
        <HuecoBarraAcciones />
      </div>
      <BarraInferior slug={negocio} negocio={inquilino.nombre} logoUrl={inquilino.logoUrl} usuario={cliente.nombre} quien={quien} />
    </AplicaMarca>
  );
}
