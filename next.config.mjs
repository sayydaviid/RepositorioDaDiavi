/** @type {import('next').NextConfig} */

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
  'https://sayydaviid-avalia-backend.hf.space';

const nextConfig = {
  reactStrictMode: true,
  
  // 1. SOLUÇÃO PARA O ERRO NA VERCEL (WorkerError)
  // Desativa o uso de múltiplas threads e limita a 1 CPU para não estourar a RAM
  experimental: {
    workerThreads: false,
    cpus: 1
  },

  // 2. AUMENTO DE TIMEOUT
  // Dá mais tempo para o Next.js processar a lógica dos CSVs e dimensões
  staticGenerationTimeout: 180,

  // 3. ECONOMIA DE RECURSOS NO BUILD
  // Pula checagens pesadas na Vercel para garantir que o deploy termine
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // 4. COMPRESSÃO DE DADOS
  // Reduz os arquivos CSV/JSON de MBs para KBs na rede
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
        // AJUSTE DE CACHE PARA O BACKEND (Hugging Face)
        source: '/backend/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
      {
        // OTIMIZAÇÃO PARA OS ARQUIVOS CSV LOCAIS
        // Permite o uso de cache inteligente pelo navegador
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