import { exigirContextoCliente } from '@/lib/inquilino';
import { AplicaMarca } from '@/componentes/Marca';
import { BarraLateral, BarraInferior } from '@/componentes/Navegacion';
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
      <div className="pb-16 lg:ml-60 lg:pb-0">
        {inquilino.soloLectura && <AvisoEscaparate />}
        {children}
      </div>
      <BarraInferior slug={negocio} quien={quien} />
    </AplicaMarca>
  );
}
