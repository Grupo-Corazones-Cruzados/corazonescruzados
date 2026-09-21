'use client';

/**
 * EL LOGO DE LA CASA GIRANDO DESPACIO — la firma, no un indicador de carga.
 *
 * Es el mismo giro del logo del menú lateral del panel (`slowSpin 12s … reverse`).
 * Fernando (2026-09-21): encima del «GCC WORLD» de los diálogos de acceso había un
 * anillo de carga (`BrandLoader`), que dice «espera» donde debía decir «GCC». Esta es la
 * definición ÚNICA del logo girando: el menú, el indicador de guardado y los diálogos
 * de acceso lo usan de aquí. `BrandLoader` sigue siendo el reloj de arena de verdad.
 */
export default function LogoGirando({ tamano = 32, className = '' }: { tamano?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-gcc.png"
      alt=""
      width={tamano}
      height={tamano}
      draggable={false}
      className={`rounded-full select-none shrink-0 motion-reduce:animate-none ${className}`}
      style={{ width: tamano, height: tamano, animation: 'slowSpin 12s linear infinite reverse' }}
    />
  );
}
