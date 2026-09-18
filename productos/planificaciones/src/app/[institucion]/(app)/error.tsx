'use client';

import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Boton, Tarjeta } from '@/componentes/ui';

/**
 * LA PANTALLA DE ERROR DEL ÁREA DE LA INSTITUCIÓN (Fernando, 2026-09-17: «al guardar
 * un cambio salió un error en la app aunque después de recargar sí se guardaron»).
 * Lo más habitual es que la aplicación se haya actualizado mientras la pestaña
 * seguía abierta con la versión anterior: el cambio se guardó, pero la pantalla
 * ya no pudo refrescarse. Recargar lo resuelve, así que se ofrece aquí mismo en
 * vez de la página en blanco de Next.
 */
export default function ErrorApp({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app]', error);
  }, [error]);
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Tarjeta className="max-w-md p-6 text-center">
        <p className="text-[15px] font-semibold text-texto">La pantalla no se pudo actualizar</p>
        <p className="mt-2 text-[13px] text-tenue">
          Lo que guardaste sí quedó guardado. Suele pasar cuando la aplicación se actualizó mientras tenías esta pestaña abierta: recárgala y sigue donde estabas.
        </p>
        {error.digest && <p className="mt-2 font-mono text-[11px] text-tenue">{error.digest}</p>}
        <div className="mt-4 flex justify-center gap-2">
          <Boton variante="secundario" onClick={() => reset()}>
            Intentar de nuevo
          </Boton>
          <Boton icono={RefreshCw} onClick={() => window.location.reload()}>
            Recargar la página
          </Boton>
        </div>
      </Tarjeta>
    </div>
  );
}
