import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Envuelve la aplicación. El tema ya no lo pone este componente: está en `@theme`
 * (globals.css) y vale en toda página, igual en el personal que en el portal del cliente
 * final. Queda como el contenedor de alto completo (Fernando, 2026-11-08: un solo tema, el de
 * Automatizaciones; el negocio ya no elige color ni tema).
 */
export function AplicaMarca({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('app-producto min-h-[calc(100dvh-env(safe-area-inset-top))] bg-fondo text-texto', className)}>
      {children}
    </div>
  );
}

/** Logo del negocio, o su inicial cuando todavía no ha subido ninguno. */
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
    // <img> a propósito: el logo vive en la cuenta de Cloudinary del producto y
    // next/image obligaría a declarar el dominio de cada cuenta.
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
      {nombre.trim().charAt(0).toUpperCase() || 'H'}
    </div>
  );
}
