import type { CSSProperties } from 'react';
import { exigirContexto } from '@/lib/inquilino';
import { AplicaMarca } from '@/componentes/Marca';
import { BarraLateral, BarraInferior, HuecoBarraAcciones } from '@/componentes/Navegacion';
import { AvisoEscaparate } from '@/componentes/AvisoEscaparate';
import { estaEmbebido } from '@/lib/sesion';

export const dynamic = 'force-dynamic';

/**
 * Armazón de la aplicación del hotel. `exigirContexto` es quien decide si esta
 * pantalla llega a existir: sin sesión manda a acceder, y con la mensualidad
 * vencida manda a la pantalla de suscripción. Las páginas de dentro ya no
 * comprueban nada de eso.
 *
 * Desde el 2026-11-08 es el MISMO armazón que Automatizaciones (la referencia de diseño de los
 * productos): una columna de alto exacto con `main` que se desplaza, para que cada página pueda
 * llegar hasta abajo con `flex-1` sin restar píxeles a mano.
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
  // Dentro de GCC World el menú lo pone la plataforma (`/<slug>/entrar`, `lib/sesion.ts`).
  const embebido = await estaEmbebido();

  // La franja de demostración. En escritorio va a TODO el ancho, por encima del menú y del
  // contenido, para que las dos cabeceras (68 px) sigan alineadas (Fernando, 2026-11-08); en el
  // teléfono, dentro de la columna, como siempre.
  const aviso = inquilino.soloLectura ? <AvisoEscaparate /> : null;
  const menu = {
    slug: hotel,
    hotel: inquilino.nombre,
    logoUrl: inquilino.logoUrl,
    usuario: sesion.nombre,
    rol: sesion.rol,
  };

  return (
    <AplicaMarca>
      <div className="contents" style={{ '--alto-aviso': aviso ? '2rem' : '0px' } as CSSProperties}>
        {aviso && !embebido && <div className="hidden h-8 overflow-hidden lg:block [&>*]:h-8 [&>*]:py-0">{aviso}</div>}
        {!embebido && <BarraLateral {...menu} />}
        {/*
          ⭐ EL ALTO SE HEREDA; NO SE CALCULA RESTANDO PÍXELES A MANO (lo mismo que Automatizaciones).
          Esta columna mide exactamente la ventana (menos la franja de aviso en escritorio), y `main`
          se queda con lo que sobre y se desplaza. Una pantalla que quiera llegar hasta abajo pide
          `flex-1` (o `h-full`) y el navegador hace la resta. ⚠️ `min-h-0` no es decorativo: sin él,
          un hijo alto estira el `flex-1` y el desbordamiento vuelve por la puerta de atrás.

          `main` es `flex-col` por la barra de acciones del teléfono: su hueco va como ÚLTIMO hijo y
          con `mt-auto` baja al fondo aunque la página sea corta. El `pb-` reserva la barra táctil y
          la barrita de inicio del iPhone. Dentro de GCC World no hay raíl ni barra táctil: la
          columna es la ventana entera y el aviso va dentro de ella en todos los anchos.
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
