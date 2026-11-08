import type { CSSProperties } from 'react';
import { HuecoBarraAcciones } from '@/componentes/Navegacion';

/**
 * ⭐⭐ EL ALTO SE HEREDA; NO SE CALCULA RESTANDO PÍXELES A MANO (la regla de Automatizaciones).
 * Esta columna mide exactamente la ventana, el aviso ocupa lo suyo y `main` se queda con lo que
 * sobra. ⚠️ `min-h-0` no es decorativo: sin él, un hijo alto estira el `flex-1`.
 * Dentro de GCC World no hay raíl ni barra táctil: la columna es la ventana entera.
 * Lo usa también el portal del cliente final (`(portal)/layout.tsx`).
 */
export function Armazon({
  aviso,
  embebido,
  lateral,
  inferior,
  children,
}: {
  aviso: React.ReactNode;
  embebido: boolean;
  lateral: React.ReactNode;
  inferior: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="contents" style={{ '--alto-aviso': aviso ? '2rem' : '0px' } as CSSProperties}>
      {aviso && !embebido && <div className="hidden h-8 overflow-hidden lg:block print:hidden [&>*]:h-8 [&>*]:py-0">{aviso}</div>}
      {!embebido && lateral}
      <div className={embebido ? 'flex h-dvh flex-col print:h-auto' : 'flex h-[calc(100dvh-env(safe-area-inset-top))] flex-col lg:ml-16 lg:h-[calc(100dvh-env(safe-area-inset-top)-var(--alto-aviso,0px))] print:ml-0 print:h-auto'}>
        {aviso && <div className={embebido ? undefined : 'lg:hidden'}>{aviso}</div>}
        <main className={embebido ? 'desplaza flex min-h-0 flex-1 flex-col overflow-y-auto print:overflow-visible' : 'desplaza flex min-h-0 flex-1 flex-col overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0 print:overflow-visible print:pb-0'}>
          {children}
          <HuecoBarraAcciones />
        </main>
      </div>
      {!embebido && inferior}
    </div>
  );
}
