import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  serverExternalPackages: ['@ffmpeg-installer/ffmpeg', 'puppeteer'],
};

export default nextConfig;
