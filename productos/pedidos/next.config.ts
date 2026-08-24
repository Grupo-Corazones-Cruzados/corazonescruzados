import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // El directorio de build se puede desviar para comprobar un `build` sin parar el
  // `dev` de nadie: NEXT_DIST_DIR=.next-build npm run build. Misma trampa (y mismo
  // remedio) que en GCC WORLD: `next dev` y `next build` comparten .next y se pisan.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Los logos de los inquilinos viven en Cloudinary y se sirven con <img>, no con
  // next/image, para no tener que declarar aquí el dominio de cada cuenta.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
