import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  serverExternalPackages: ['@ffmpeg-installer/ffmpeg', 'puppeteer'],

  // Los archivos del juego se revalidan en cada carga: al desplegar un mundo
  // nuevo, el navegador debe descargar la versión nueva y no servir la vieja de
  // caché. El equivalente en producción de lo que hace server.cjs en desarrollo.
  async headers() {
    return [
      {
        source: '/game/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;
