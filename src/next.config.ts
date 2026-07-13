import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.firebasestorage.app',
        port: '',
        pathname: '/**',
      },
    ],
    // Allow local proxy route with query strings (Next.js 16 requirement)
    localPatterns: [
      {
        pathname: '/api/storage/proxy-image/**',
        search: '*',
      },
    ],
  },
  experimental: {
    turbo: {
      resolveAlias: {
        'async_hooks': false,
      },
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Resolve 'async_hooks' to false for client-side builds
      config.resolve.fallback = {
        ...config.resolve.fallback,
        async_hooks: false,
      };
    }
    return config;
  },
};

export default nextConfig;
