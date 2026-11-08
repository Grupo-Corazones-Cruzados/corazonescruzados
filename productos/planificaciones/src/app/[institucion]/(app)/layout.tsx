import type { CSSProperties } from 'react';
import { exigirContexto } from '@/lib/inquilino';
import { AplicaMarca } from '@/componentes/Marca';
import { urlLogo } from '@/lib/marca';
import { BarraLateral, BarraInferior, HuecoBarraAcciones } from '@/componentes/Navegacion';
import { AvisoEscaparate } from '@/componentes/AvisoEscaparate';
import { estaEmbebido } from '@/lib/sesion';

export const dynamic = 'force-dynamic';

/**
 * Armazón de la aplicación. `exigirContexto` decide si esta pantalla llega a
 * existir: sin sesión manda a acceder y con la mensualidad vencida manda a
 * suscripción. Las páginas de dentro ya no comprueban nada de eso.
 *
 * El mismo armazón que Automatizaciones (2026-11-08): la columna mide exactamente la ventana,
 * `main` se queda con lo que sobra y se desplaza por dentro, y cada pantalla llena su alto con
 * `flex-1` (el último bloque llega siempre hasta el pie).
 */
export default async function LayoutApp({ children, params }: { children: React.ReactNode; params: Promise<{ institucion: string }> }) {
  const { institucion } = await params;
  const { inquilino, sesion } = await exigirContexto(institucion);
  // Dentro de GCC World el menú lo pone la plataforma (`/<slug>/entrar`, `lib/sesion.ts`).
  const embebido = await estaEmbebido();
  const logoUrl = urlLogo(inquilino);

  // La franja de la demostración. En escritorio va a TODO el ancho, por encima del menú y del
  // contenido, para que las dos cabeceras sigan alineadas (Fernando, 2026-11-08); en el
  // teléfono, dentro de la columna.
  const aviso = inquilino.soloLectura ? <AvisoEscaparate /> : null;

  return (
    <AplicaMarca>
      <div className="contents" style={{ '--alto-aviso': aviso ? '2rem' : '0px' } as CSSProperties}>
        {aviso && !embebido && <div className="hidden h-8 overflow-hidden lg:block print:hidden [&>*]:h-8 [&>*]:py-0">{aviso}</div>}
        {!embebido && <BarraLateral slug={institucion} institucion={inquilino.nombre} logoUrl={logoUrl} usuario={sesion.nombre} rol={sesion.rol} />}
        {/*
          ⭐ EL ALTO SE HEREDA; NO SE CALCULA RESTANDO PÍXELES A MANO (regla de Automatizaciones).
          Esta columna mide la ventana, el aviso ocupa lo suyo y `main` se queda con lo que sobre.
          ⚠️ `min-h-0` no es decorativo: sin él, un hijo alto estira el `flex-1`. El menú se monta
          ENCIMA, así que el contenido conserva el margen del raíl estrecho (64 px). El `pb-`
          reserva la barra táctil y la barrita de inicio del iPhone. `main` es `flex-col` por la
          barra de acciones del teléfono: su hueco va como ÚLTIMO hijo y con `mt-auto` baja al fondo.
          Al imprimir, todo vuelve al flujo normal.
        */}
        <div className={embebido ? 'flex h-dvh flex-col print:block print:h-auto' : 'flex h-[calc(100dvh-env(safe-area-inset-top))] flex-col lg:ml-16 lg:h-[calc(100dvh-env(safe-area-inset-top)-var(--alto-aviso,0px))] print:ml-0 print:block print:h-auto'}>
          {aviso && <div className={embebido ? 'print:hidden' : 'lg:hidden print:hidden'}>{aviso}</div>}
          <main className={embebido ? 'desplaza flex min-h-0 flex-1 flex-col overflow-y-auto print:block print:overflow-visible' : 'desplaza flex min-h-0 flex-1 flex-col overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0 print:block print:overflow-visible print:pb-0'}>
            {children}
            <HuecoBarraAcciones />
          </main>
        </div>
        {!embebido && <BarraInferior slug={institucion} institucion={inquilino.nombre} logoUrl={logoUrl} usuario={sesion.nombre} rol={sesion.rol} />}
      </div>
    </AplicaMarca>
  );
}
