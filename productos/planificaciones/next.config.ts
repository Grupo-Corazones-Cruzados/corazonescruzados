import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // El directorio de build se puede desviar para comprobar un `build` sin parar el
  // `dev` de nadie: NEXT_DIST_DIR=.next-build npm run build. Misma trampa (y mismo
  // remedio) que en GCC WORLD: `next dev` y `next build` comparten .next y se pisan.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Los logos de los inquilinos viven en Cloudinary y se sirven con <img>, no con
  // next/image, para no tener que declarar aquí el dominio de cada cuenta.
  eslint: { ignoreDuringBuilds: true },
  // Las acciones reciben archivos (adjuntos, formatos, el currículo del Ministerio: 3 MB);
  // el tope por defecto de Next es 1 MB y el del producto, 10 MB (`MAX_TAMANO`).
  experimental: { serverActions: { bodySizeLimit: '12mb' } },
};

export default nextConfig;
