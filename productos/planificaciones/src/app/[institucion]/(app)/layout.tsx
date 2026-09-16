import { exigirContexto } from '@/lib/inquilino';
import { AplicaMarca } from '@/componentes/Marca';
import { BarraLateral, BarraInferior } from '@/componentes/Navegacion';
import { AvisoEscaparate } from '@/componentes/AvisoEscaparate';

export const dynamic = 'force-dynamic';

/**
 * Armazón de la aplicación. `exigirContexto` decide si esta pantalla llega a
 * existir: sin sesión manda a acceder y con la mensualidad vencida manda a
 * suscripción. Las páginas de dentro ya no comprueban nada de eso.
 */
export default async function LayoutApp({ children, params }: { children: React.ReactNode; params: Promise<{ institucion: string }> }) {
  const { institucion } = await params;
  const { inquilino, sesion } = await exigirContexto(institucion);

  return (
    <AplicaMarca colorAcento={inquilino.colorAcento} tema={inquilino.tema}>
      <BarraLateral slug={institucion} institucion={inquilino.nombre} logoUrl={inquilino.logoUrl} usuario={sesion.nombre} rol={sesion.rol} />
      <div className="pb-16 lg:ml-16 lg:pb-0 print:ml-0 print:pb-0">
        {inquilino.soloLectura && <AvisoEscaparate />}
        {children}
      </div>
      <BarraInferior slug={institucion} rol={sesion.rol} />
    </AplicaMarca>
  );
}
