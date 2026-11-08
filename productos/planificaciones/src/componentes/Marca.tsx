import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Envuelve la aplicación. El tema ya no lo pone este componente: está en `@theme`
 * (globals.css) y vale en toda página. Queda como el contenedor de alto completo y como
 * DESTINO de los portales que tienen que salir de un padre con `transform` (`.app-producto`).
 */
export function AplicaMarca({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('app-producto min-h-[calc(100dvh-env(safe-area-inset-top))] bg-fondo text-texto', className)}>
      {children}
    </div>
  );
}

/** Logo de la institución, o su inicial cuando todavía no ha subido ninguno. */
export function LogoNegocio({
  nombre,
  logoUrl,
  tamano = 36,
}: {
  nombre: string;
  logoUrl: string | null;
  tamano?: number;
}) {
  if (logoUrl) {
    // <img> a propósito: el logo se sirve desde `/<slug>/logo` (o una dirección antigua) y
    // next/image obligaría a declarar cada dominio.
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={logoUrl}
        alt={nombre}
        width={tamano}
        height={tamano}
        className="rounded-md object-cover"
        style={{ width: tamano, height: tamano }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-md bg-acento text-acento-contraste font-bold"
      style={{ width: tamano, height: tamano, fontSize: tamano * 0.45 }}
    >
      {nombre.trim().charAt(0).toUpperCase() || 'P'}
    </div>
  );
}
