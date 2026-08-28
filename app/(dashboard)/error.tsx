'use client';

/**
 * QUÉ VE ALGUIEN CUANDO UNA PANTALLA DEL PANEL SE ROMPE.
 *
 * ── POR QUÉ EXISTE (2026-08-28) ───────────────────────────────────────────────────────
 * A Peter Tours le salió, al entrar a su agente:
 *
 *     «Application error: a client-side exception has occurred
 *      (see the browser console for more information)»
 *
 * Ese cartel es el de Next.js cuando NO hay un `error.tsx` en la ruta. Está en inglés,
 * no dice qué hacer, y manda a la consola del navegador a un cliente que nunca ha abierto
 * una. Para él la aplicación simplemente se rompió.
 *
 * ── LA CAUSA MÁS PROBABLE, Y LA QUE ESTO CURA SOLA ────────────────────────────────────
 * Se comprobó después con su propia sesión: la página respondía 200, sus cuatro APIs
 * respondían 200 y **los 16 trozos de JavaScript existían**. O sea que en ese momento ya
 * no estaba roto.
 *
 * Lo que había en medio: **ocho despliegues en un par de horas, con él usando la app**.
 * Cada despliegue publica trozos de JavaScript con un nombre nuevo y retira los viejos.
 * Una pestaña abierta desde antes sigue pidiendo los de antes, recibe un 404 y revienta —
 * y el usuario ve un fallo de la aplicación cuando lo único que le pasa es que tiene en
 * la mano una versión que ya no existe.
 *
 * Por eso aquí no solo se avisa: **un error de carga de trozo se resuelve recargando**, y
 * eso puede hacerlo la propia pantalla. Se recarga UNA vez y se deja marca en
 * `sessionStorage`; si vuelve a pasar, ya no es un despliegue y se enseña el aviso en vez
 * de dejar al navegador dando vueltas en un bucle de recargas.
 */

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';

const mf = { fontFamily: 'var(--font-body)' } as const;

/** La marca de «ya recargué por esto». Vive en la pestaña, no en el navegador entero. */
const YA_RECARGUE = 'gcc:recarga-por-version';

/**
 * ¿Es de los que se curan recargando?
 *
 * Next.js y los navegadores no se ponen de acuerdo en el mensaje —cada uno lo escribe a su
 * manera—, así que se reconocen por lo que tienen en común: hablan de un *chunk* o de un
 * módulo que no se pudo importar.
 */
function esVersionVieja(error: Error): boolean {
  const texto = `${error?.name ?? ''} ${error?.message ?? ''}`.toLowerCase();
  return texto.includes('chunkloaderror')
    || texto.includes('loading chunk')
    || texto.includes('failed to fetch dynamically imported module')
    || texto.includes('importing a module script failed');
}

export default function ErrorDelPanel({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Queda en los registros del navegador para poder investigarlo; el usuario ve el texto
    // de abajo, no esto.
    console.error('[panel] la pantalla falló', error);

    if (!esVersionVieja(error)) return;
    try {
      if (sessionStorage.getItem(YA_RECARGUE)) return;   // ya lo intentamos: no insistir
      sessionStorage.setItem(YA_RECARGUE, '1');
      window.location.reload();
    } catch {
      /* Sin `sessionStorage` —modo privado, permisos— se prefiere NO recargar: mejor un
         aviso que un bucle. */
    }
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6">
      <div className="w-12 h-12 rounded-full bg-accent-light flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-accent" />
      </div>

      <h1 className="text-[18px] font-semibold text-digi-text mb-1.5" style={mf}>
        Esta pantalla no se pudo mostrar
      </h1>
      <p className="text-[13px] text-digi-muted max-w-md leading-relaxed mb-5" style={mf}>
        Suele pasar cuando se publicó una versión nueva mientras la tenías abierta. Vuelve a
        intentarlo; si sigue igual, recarga la página y avísanos.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button className={BTN_PRIMARY} onClick={reset}>
          <RotateCcw className="w-4 h-4" /> Volver a intentar
        </button>
        <button className={BTN_SECONDARY} onClick={() => window.location.reload()}>
          Recargar la página
        </button>
      </div>

      {/* El `digest` es el identificador con el que el fallo queda en los registros del
          servidor. No dice nada al usuario, pero si lo copia en un mensaje, nosotros
          encontramos su caso exacto en vez de adivinar. */}
      {error?.digest && (
        <p className="text-[11px] text-digi-muted/70 mt-5" style={mf}>
          Referencia: <code>{error.digest}</code>
        </p>
      )}
    </div>
  );
}
