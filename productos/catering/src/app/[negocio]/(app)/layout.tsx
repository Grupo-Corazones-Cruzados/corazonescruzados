import { exigirContexto } from '@/lib/inquilino';
import { AplicaMarca } from '@/componentes/Marca';
import { BarraLateral, BarraInferior } from '@/componentes/Navegacion';
import { AvisoEscaparate } from '@/componentes/AvisoEscaparate';

export const dynamic = 'force-dynamic';

/**
 * Armazón de la aplicación del PERSONAL. `exigirContexto` decide si esta pantalla
 * llega a existir: sin sesión manda a acceder, con la mensualidad vencida manda a
 * suscripción y a un cliente final lo devuelve a su portal. Las páginas de dentro
 * ya no comprueban nada de eso.
 */
export default async function LayoutApp({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ negocio: string }>;
}) {
  const { negocio } = await params;
  const { inquilino, sesion } = await exigirContexto(negocio);
  const quien = { tipo: 'personal' as const, rol: sesion.rol };

  return (
    <AplicaMarca colorAcento={inquilino.colorAcento} tema={inquilino.tema}>
      <BarraLateral slug={negocio} negocio={inquilino.nombre} logoUrl={inquilino.logoUrl} usuario={sesion.nombre} quien={quien} />
      <div className="pb-16 lg:ml-60 lg:pb-0 print:ml-0 print:pb-0">
        {inquilino.soloLectura && <AvisoEscaparate />}
        {children}
      </div>
      <BarraInferior slug={negocio} quien={quien} />
    </AplicaMarca>
  );
}
