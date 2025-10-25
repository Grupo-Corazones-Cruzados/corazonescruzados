/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // No detener el build por errores de lint
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;