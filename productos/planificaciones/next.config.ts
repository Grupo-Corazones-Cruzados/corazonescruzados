import type { NextConfig } from 'next';
import { BASE } from './src/lib/base';

const nextConfig: NextConfig = {
  // El directorio de build se puede desviar para comprobar un `build` sin parar el
  // `dev` de nadie: NEXT_DIST_DIR=.next-build npm run build. Misma trampa (y mismo
  // remedio) que en GCC WORLD: `next dev` y `next build` comparten .next y se pisan.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Servido desde GCC World bajo /p/planificaciones (pasarela `app/p/[producto]` de la plataforma), sin subdominio.
  basePath: BASE,
  // Los logos de los inquilinos viven en Cloudinary y se sirven con <img>, no con
  // next/image, para no tener que declarar aquí el dominio de cada cuenta.
  eslint: { ignoreDuringBuilds: true },
  // Las acciones reciben archivos (adjuntos, formatos, el currículo del Ministerio: 3 MB);
  // el tope por defecto de Next es 1 MB y el del producto, 10 MB (`MAX_TAMANO`).
  experimental: { serverActions: { bodySizeLimit: '12mb', allowedOrigins: ['app.grupocc.org', 'www.grupocc.org', 'localhost:3000', 'localhost:3099'] } },
  // Solo GCC World puede mostrarlo dentro de un marco (Accesos de las apps, 2026-11-08). Antes cualquier
  // web podía enmarcarlo.
  // Mientras exista el subdominio viejo, quien llegue por él (marcadores, correos) va a la dirección nueva.
  async redirects() {
    const viejo = [{ type: 'host' as const, value: 'planificaciones.grupocc.org' }];
    return [
      { source: `${BASE}/:ruta*`, has: viejo, destination: `https://app.grupocc.org${BASE}/:ruta*`, permanent: false, basePath: false as const },
      { source: '/:ruta*', has: viejo, destination: `https://app.grupocc.org${BASE}/:ruta*`, permanent: false, basePath: false as const },
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://app.grupocc.org" }] }];
  },
};

export default nextConfig;
