/** @type {import('next').NextConfig} */

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
  'https://sayydaviid-avalia-backend.hf.space';

const nextConfig = {
  reactStrictMode: true,
  
  // SOLUÇÃO PARA O ERRO DO TURBOPACK
  // Define uma config vazia para silenciar o erro de detecção automática
  turbopack: {},

  // SOLUÇÃO PARA O WORKERERROR (Call retries exceeded)
  // Limita o paralelismo para não esgotar a memória RAM da Vercel
  experimental: {
    workerThreads: false,
    cpus: 1
  },

  // Aumenta o tempo de tolerância para processar os arquivos CSV
  staticGenerationTimeout: 180,

  // Pula checagens pesadas para economizar memória durante o build
  eslint: { ignoreDuringBuilds: true },
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
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=10, stale-while-revalidate=59' }],
      },
    ];
  },

  webpack: (config) => {
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
    };
    return config;
  },
};

export default nextConfig;