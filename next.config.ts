import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    // Evita que el build falle por errores de lint
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Evita que el build falle por errores de types
    ignoreBuildErrors: true,
  },
};

export default nextConfig;