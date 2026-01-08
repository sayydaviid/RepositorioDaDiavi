/** @type {import('next').NextConfig} */
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
  'https://sayydaviid-avalia-backend.hf.space';

const nextConfig = {
  reactStrictMode: true,

  // 1. ATIVAÇÃO EXPLÍCITA DA COMPRESSÃO
  // Isso garante que o Next.js utilize Gzip/Brotli para compactar o JSON de 3MB.
  // Em produção (Vercel ou next start), isso reduz os 3MB para ~400KB.
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
        // 2. AJUSTE DE CACHE PARA O BACKEND
        // Para dados dinâmicos do R (Hugging Face), o no-store é perfeito.
        source: '/backend/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
      {
        // 3. OTIMIZAÇÃO PARA O ARQUIVO LOCAL (DISCENTE.json)
        // Como o arquivo tem 3MB e não muda a cada segundo, permitimos 
        // que o navegador use o ETag para validar se o arquivo mudou antes de baixar tudo de novo.
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