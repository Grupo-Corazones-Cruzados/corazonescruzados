import { exigirContexto } from '@/lib/inquilino';
import { AplicaMarca } from '@/componentes/Marca';
import { BarraLateral, BarraInferior, HuecoBarraAcciones } from '@/componentes/Navegacion';
import { AvisoEscaparate } from '@/componentes/AvisoEscaparate';
import { estaEmbebido } from '@/lib/sesion';

export const dynamic = 'force-dynamic';

/**
 * Armazón de la aplicación. `exigirContexto` decide si esta pantalla llega a
 * existir: sin sesión manda a acceder y con la mensualidad vencida manda a
 * suscripción. Las páginas de dentro ya no comprueban nada de eso.
 */
export default async function LayoutApp({ children, params }: { children: React.ReactNode; params: Promise<{ institucion: string }> }) {
  const { institucion } = await params;
  const { inquilino, sesion } = await exigirContexto(institucion);
  // Dentro de GCC World el menú lo pone la plataforma (`/<slug>/entrar`, `lib/sesion.ts`).
  const embebido = await estaEmbebido();

  return (
    <AplicaMarca colorAcento={inquilino.colorAcento} tema={inquilino.tema}>
      {!embebido && <BarraLateral slug={institucion} institucion={inquilino.nombre} logoUrl={inquilino.logoUrl} usuario={sesion.nombre} rol={sesion.rol} />}
      <div className={embebido ? 'flex min-h-dvh flex-col' : 'flex min-h-[calc(100dvh-env(safe-area-inset-top))] flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:ml-16 lg:block lg:min-h-0 lg:pb-0 print:ml-0 print:pb-0'}>
        {inquilino.soloLectura && <AvisoEscaparate />}
        {children}
        <HuecoBarraAcciones />
      </div>
      {!embebido && <BarraInferior slug={institucion} institucion={inquilino.nombre} logoUrl={inquilino.logoUrl} usuario={sesion.nombre} rol={sesion.rol} />}
    </AplicaMarca>
  );
}
