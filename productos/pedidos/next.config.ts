import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // El directorio de build se puede desviar para comprobar un `build` sin parar el
  // `dev` de nadie: NEXT_DIST_DIR=.next-build npm run build. Misma trampa (y mismo
  // remedio) que en GCC WORLD: `next dev` y `next build` comparten .next y se pisan.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Los logos de los inquilinos viven en Cloudinary y se sirven con <img>, no con
  // next/image, para no tener que declarar aquí el dominio de cada cuenta.
  eslint: { ignoreDuringBuilds: true },
  // Solo GCC World puede mostrarlo dentro de un marco (Accesos de las apps, 2026-11-08). Antes cualquier
  // web podía enmarcarlo.
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://app.grupocc.org" }] }];
  },
};

export default nextConfig;
