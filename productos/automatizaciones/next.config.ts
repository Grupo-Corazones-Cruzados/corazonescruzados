import type { NextConfig } from 'next';
import { BASE } from './src/lib/base';

const nextConfig: NextConfig = {
  // El directorio de build se puede desviar para comprobar un `build` sin parar el
  // `dev` de nadie: NEXT_DIST_DIR=.next-build npm run build. Misma trampa (y mismo
  // remedio) que en GCC WORLD: `next dev` y `next build` comparten .next y se pisan.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Servido desde GCC World bajo /p/automatizaciones (pasarela `app/p/[producto]` de la plataforma), sin subdominio.
  basePath: BASE,
  // Las Server Actions llegan por la pasarela: el Origin es el de GCC World.
  experimental: { serverActions: { allowedOrigins: ['app.grupocc.org', 'www.grupocc.org', 'localhost:3000', 'localhost:3099'] } },
  // Los logos de los inquilinos viven en Cloudinary y se sirven con <img>, no con
  // next/image, para no tener que declarar aquí el dominio de cada cuenta.
  eslint: { ignoreDuringBuilds: true },
  // Solo GCC World puede mostrarlo dentro de un marco (Accesos de las apps, 2026-11-08). Antes cualquier
  // web podía enmarcarlo.
  // ⚠️ META NO SIGUE REDIRECCIONES. Mientras su webhook apunte al subdominio viejo
  // (`automatizaciones.grupocc.org/api/agente/webhook`), ese camino se REENVÍA de servidor a servidor a la
  // dirección nueva; si se redirigiera, los mensajes de WhatsApp se perderían. Lo demás del subdominio viejo
  // redirige a la dirección nueva. Al cambiar la URL en Meta a `app.grupocc.org/p/automatizaciones/…`,
  // esto deja de usarse y se va con el subdominio.
  async rewrites() {
    const viejo = [{ type: 'host' as const, value: 'automatizaciones.grupocc.org' }];
    return {
      // Next no deja reenviar dentro de la app fuera del basePath: se reenvía (de servidor a servidor, sin
      // redirección y con el cuerpo intacto para la firma) a la dirección nueva, que sirve la pasarela.
      beforeFiles: [{ source: '/api/agente/webhook', has: viejo, destination: `https://app.grupocc.org${BASE}/api/agente/webhook`, basePath: false as const }],
      afterFiles: [],
      fallback: [],
    };
  },
  async redirects() {
    const viejo = [{ type: 'host' as const, value: 'automatizaciones.grupocc.org' }];
    return [
      { source: `${BASE}/:ruta*`, has: viejo, destination: `https://app.grupocc.org${BASE}/:ruta*`, permanent: false, basePath: false as const },
      { source: '/:ruta((?!api/agente/webhook).*)', has: viejo, destination: `https://app.grupocc.org${BASE}/:ruta`, permanent: false, basePath: false as const },
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://app.grupocc.org" }] }];
  },
};

export default nextConfig;
