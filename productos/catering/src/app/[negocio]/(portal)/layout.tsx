import { exigirContextoCliente } from '@/lib/inquilino';
import { urlLogo } from '@/lib/marca';
import { AplicaMarca } from '@/componentes/Marca';
import { BarraLateral, BarraInferior } from '@/componentes/Navegacion';
import { Armazon } from '@/componentes/Armazon';
import { AvisoEscaparate } from '@/componentes/AvisoEscaparate';

export const dynamic = 'force-dynamic';

/** Armazón del PORTAL del cliente final. El mismo tema y el mismo armazón que el personal, otra puerta. */
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
  const menu = { slug: negocio, negocio: inquilino.nombre, logoUrl: urlLogo(inquilino), usuario: cliente.nombre, quien };

  return (
    <AplicaMarca>
      <Armazon aviso={inquilino.soloLectura ? <AvisoEscaparate /> : null} embebido={false}
        lateral={<BarraLateral {...menu} />} inferior={<BarraInferior {...menu} />}>
        {children}
      </Armazon>
    </AplicaMarca>
  );
}
