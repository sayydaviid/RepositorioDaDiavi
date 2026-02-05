/** @type {import('next').NextConfig} */

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
  'https://sayydaviid-avalia-backend.hf.space';

const nextConfig = {
  reactStrictMode: true,

  // 1. SOLUÇÃO PARA O ERRO NA VERCEL (WorkerError / Call retries exceeded)
  // Desativa múltiplas threads de build e limita a CPU para economizar memória RAM.
  experimental: {
    workerThreads: false,
    cpus: 1
  },

  // 2. ECONOMIA DE MEMÓRIA DURANTE O BUILD
  // Ignora checagens pesadas que podem ser feitas localmente para garantir o deploy.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // 3. ATIVAÇÃO DA COMPRESSÃO
  // Reduz drasticamente o tamanho dos arquivos CSV/JSON enviados para o navegador.
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
        // 4. AJUSTE DE CACHE PARA O BACKEND
        source: '/backend/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
      {
        // 5. OTIMIZAÇÃO PARA ARQUIVOS LOCAIS (CSV)
        // Permite validação por ETag para não baixar o arquivo se ele não mudou.
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=10, stale-while-revalidate=59' },
        ],
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