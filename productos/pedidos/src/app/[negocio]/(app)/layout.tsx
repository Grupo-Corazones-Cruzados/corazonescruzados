import type { CSSProperties } from 'react';
import { exigirContexto } from '@/lib/inquilino';
import { AplicaMarca } from '@/componentes/Marca';
import { BarraLateral, BarraInferior, HuecoBarraAcciones } from '@/componentes/Navegacion';
import { AvisoEscaparate } from '@/componentes/AvisoEscaparate';
import { estaEmbebido } from '@/lib/sesion';
import { urlLogo } from '@/lib/marca';

export const dynamic = 'force-dynamic';

/**
 * Armazón de la aplicación del negocio. `exigirContexto` decide si esta pantalla
 * llega a existir: sin sesión manda a acceder y con la mensualidad vencida manda a
 * la pantalla de suscripción. Las páginas de dentro ya no comprueban nada de eso.
 *
 * El mismo armazón que Automatizaciones de WhatsApp (referencia de diseño, 2026-11-08).
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
  // Dentro de GCC World el menú lo pone la plataforma (`/<slug>/entrar`, `lib/sesion.ts`).
  const embebido = await estaEmbebido();
  const menu = {
    slug: negocio,
    negocio: inquilino.nombre,
    logoUrl: urlLogo(inquilino),
    usuario: sesion.nombre,
    rol: sesion.rol,
  };

  // La franja de demostración. En escritorio va a TODO el ancho, por encima del menú y del
  // contenido, para que las dos cabeceras sigan alineadas; en el teléfono, dentro de la columna.
  const aviso = inquilino.soloLectura ? <AvisoEscaparate /> : null;

  return (
    <AplicaMarca>
      <div className="contents" style={{ '--alto-aviso': aviso ? '2rem' : '0px' } as CSSProperties}>
        {aviso && !embebido && <div className="hidden h-8 overflow-hidden lg:block [&>*]:h-8 [&>*]:py-0">{aviso}</div>}
        {!embebido && <BarraLateral {...menu} />}
        {/*
          EL ALTO SE HEREDA; NO SE CALCULA RESTANDO PÍXELES A MANO. Esta columna mide la ventana,
          el aviso ocupa lo suyo y `main` se queda con lo que sobra. `main` es `flex-col`: cada
          página es `flex flex-1 flex-col` y su último bloque crece hasta el pie (Fernando,
          2026-11-08: «el componente debe alargarse hasta el final»). El hueco de la barra de
          acciones del teléfono va como último hijo y con `mt-auto` baja al fondo.
          ⚠️ `min-h-0` no es decorativo: sin él un hijo alto estira el `flex-1`.
        */}
        <div className={embebido ? 'flex h-dvh flex-col' : 'flex h-[calc(100dvh-env(safe-area-inset-top))] flex-col lg:ml-16 lg:h-[calc(100dvh-env(safe-area-inset-top)-var(--alto-aviso,0px))] print:ml-0 print:h-auto'}>
          {aviso && <div className={embebido ? undefined : 'lg:hidden'}>{aviso}</div>}
          <main className={embebido ? 'desplaza flex min-h-0 flex-1 flex-col overflow-y-auto' : 'desplaza flex min-h-0 flex-1 flex-col overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0 print:overflow-visible print:pb-0'}>
            {children}
            <HuecoBarraAcciones />
          </main>
        </div>
        {!embebido && <BarraInferior {...menu} />}
      </div>
    </AplicaMarca>
  );
}
