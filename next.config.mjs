/** @type {import('next').NextConfig} */
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
  'https://sayydaviid-avalia-backend.hf.space';

const nextConfig = {
  reactStrictMode: true,

  // Proxy: qualquer chamada a /backend/* vai pro seu serviço R
  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: `${API_BASE}/:path*`,
      },
    ];
  },

  // (opcional) headers extras pra evitar cache agressivo das respostas da API
  async headers() {
    return [
      {
        source: '/backend/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },

  // (opcional) se algum pacote usa 'fs' no client, evita polyfill
  webpack: (config) => {
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
    };
    return config;
  },
};

export default nextConfig;
