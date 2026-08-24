import type { ReactNode, CSSProperties } from 'react';
import { tokensDeMarca, neutrosDeTema } from '@/lib/marca';
import { cn } from '@/lib/utils';

/**
 * Envuelve la aplicación con la marca del inquilino: su color pasa a ser el acento
 * y su tema decide los neutros. Los componentes no se enteran — siguen usando
 * `bg-acento` y `text-tenue` como siempre.
 */
export function AplicaMarca({
  colorAcento,
  tema,
  className,
  children,
}: {
  colorAcento: string;
  tema: 'CLARO' | 'OSCURO';
  className?: string;
  children: ReactNode;
}) {
  const oscuro = tema === 'OSCURO';
  const n = neutrosDeTema(oscuro);
  return (
    <>
      {/* `color-scheme` además hace que los calendarios y las barras de
          desplazamiento nativas sigan el tema del inquilino. */}
      <style>{`html,body{background:${n.fondo};color:${n.texto};color-scheme:${n.esquema}}`}</style>
      <div
        className={cn(oscuro && 'oscuro', 'min-h-screen bg-fondo text-texto', className)}
        style={tokensDeMarca(colorAcento, oscuro) as CSSProperties}
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
