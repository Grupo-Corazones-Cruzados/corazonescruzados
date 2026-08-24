import { exigirContexto } from '@/lib/inquilino';
import { AplicaMarca } from '@/componentes/Marca';
import { BarraLateral, BarraInferior } from '@/componentes/Navegacion';

export const dynamic = 'force-dynamic';

/**
 * Armazón de la aplicación del hotel. `exigirContexto` es quien decide si esta
 * pantalla llega a existir: sin sesión manda a acceder, y con la mensualidad
 * vencida manda a la pantalla de suscripción. Las páginas de dentro ya no
 * comprueban nada de eso.
 */
export default async function LayoutApp({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ hotel: string }>;
}) {
  const { hotel } = await params;
  const { inquilino, sesion } = await exigirContexto(hotel);

  return (
    <AplicaMarca colorAcento={inquilino.colorAcento} tema={inquilino.tema}>
      <BarraLateral
        slug={hotel}
        hotel={inquilino.nombre}
        logoUrl={inquilino.logoUrl}
        usuario={sesion.nombre}
        rol={sesion.rol}
      />
      <div className="pb-16 lg:ml-60 lg:pb-0">{children}</div>
      <BarraInferior slug={hotel} rol={sesion.rol} />
    </AplicaMarca>
  );
}
