/** @type {import('next').NextConfig} */

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE ||
  'https://sayydaviid-avalia-backend.hf.space'
).replace(/\/$/, '');

const nextConfig = {
  reactStrictMode: true,

  turbopack: {},

  // ✅ FIX para ECONNRESET (HF Spaces / rewrites instável)
  httpAgentOptions: {
    keepAlive: false,
  },

  experimental: {
    workerThreads: false,
    cpus: 1,

    // ✅ substitui a ideia do "timeout" por controles suportados no Next 16
    // (ajuste fino se quiser)
    staticGenerationRetryCount: 1,
    staticGenerationMaxConcurrency: 4,
    staticGenerationMinPagesPerWorker: 25,
  },

  // (mantém)
  typescript: { ignoreBuildErrors: true },

  compress: true,

  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: `${API_BASE}/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/backend/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=10, stale-while-revalidate=59',
          },
        ],
      },
    ];
  },

  serverExternalPackages: [],

  webpack: (config) => {
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
    };
    return config;
  },
};

export default nextConfig;