import type { ReactNode, CSSProperties } from 'react';
import { ACENTO_GCC, tokensDeMarca, neutrosDeTema } from '@/lib/marca';
import { cn } from '@/lib/utils';

/**
 * Envuelve la aplicación con el TEMA ÚNICO del producto: el Mixto de GCC World con el
 * violeta del grupo (Fernando, 2026-11-08). El cliente ya NO elige color ni tema; las
 * columnas `color_acento` y `tema` del inquilino quedan en la base sin uso.
 */
export function AplicaMarca({ className, children }: { className?: string; children: ReactNode }) {
  const n = neutrosDeTema(false);
  return (
    <>
      <style>{`html,body{background:${n.fondo};color:${n.texto};color-scheme:${n.esquema}}`}</style>
      <div
        className={cn('tema-mixto min-h-[calc(100dvh-env(safe-area-inset-top))] bg-fondo text-texto', className)}
        style={tokensDeMarca(ACENTO_GCC, false) as CSSProperties}
      >
        {children}
      </div>
    </>
  );
}

/** Logo del hotel, o su inicial cuando todavía no ha subido ninguno. */
export function LogoHotel({
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
