import { exigirContexto } from '@/lib/inquilino';
import { AplicaMarca } from '@/componentes/Marca';
import { BarraLateral, BarraInferior, HuecoBarraAcciones } from '@/componentes/Navegacion';
import { AvisoEscaparate } from '@/componentes/AvisoEscaparate';

export const dynamic = 'force-dynamic';

/**
 * Armazón de la aplicación del negocio. `exigirContexto` decide si esta pantalla
 * llega a existir: sin sesión manda a acceder y con la mensualidad vencida manda a
 * la pantalla de suscripción. Las páginas de dentro ya no comprueban nada de eso.
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
  const menu = {
    slug: negocio,
    negocio: inquilino.nombre,
    logoUrl: inquilino.logoUrl,
    usuario: sesion.nombre,
    rol: sesion.rol,
  };

  return (
    <AplicaMarca colorAcento={inquilino.colorAcento} tema={inquilino.tema}>
      <BarraLateral {...menu} />
      {/* En el teléfono el contenido llena la pantalla para que el hueco de la barra de
          acciones (último hijo, `mt-auto`) quede abajo aunque la página sea corta. */}
      <div className="flex min-h-[calc(100dvh-env(safe-area-inset-top))] flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:ml-16 lg:block lg:min-h-0 lg:pb-0 print:ml-0 print:pb-0">
        {inquilino.soloLectura && <AvisoEscaparate />}
        {children}
        <HuecoBarraAcciones />
      </div>
      <BarraInferior {...menu} />
    </AplicaMarca>
  );
}
