import { exigirContexto } from '@/lib/inquilino';
import { AplicaMarca } from '@/componentes/Marca';
import { BarraLateral, BarraInferior } from '@/componentes/Navegacion';
import { AvisoEscaparate } from '@/componentes/AvisoEscaparate';

export const dynamic = 'force-dynamic';

/**
 * Armazón de la aplicación del cliente. `exigirContexto` decide si esta pantalla
 * llega a existir: sin sesión manda a acceder y con la mensualidad vencida manda a la
 * pantalla de suscripción. Las páginas de dentro ya no comprueban nada de eso.
 */
export default async function LayoutApp({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ cliente: string }>;
}) {
  const { cliente } = await params;
  const { inquilino, sesion, montados } = await exigirContexto(cliente);

  return (
    <AplicaMarca colorAcento={inquilino.colorAcento} tema={inquilino.tema}>
      <BarraLateral
        slug={cliente}
        cliente={inquilino.nombre}
        logoUrl={inquilino.logoUrl}
        usuario={sesion.nombre}
        rol={sesion.rol}
        montados={montados}
      />
      {/* El hueco de abajo es el de la barra de teléfono (56 px) más aire. */}
      <div className="pb-20 lg:ml-16 lg:pb-0">
        {inquilino.soloLectura && <AvisoEscaparate />}
        {children}
      </div>
      <BarraInferior slug={cliente} rol={sesion.rol} montados={montados} />
    </AplicaMarca>
  );
}
