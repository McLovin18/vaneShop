import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Deshabilitar pre-rendering estático por defecto para evitar errores con hooks de cliente
  output: undefined, // No usar 'export' para permitir renderizado dinámico
  experimental: {
    // Deshabilitar pre-rendering estático para rutas específicas
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    unoptimized: true, // Desactivar optimización de imágenes remotas para evitar timeouts
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "imagedelivery.net",
      },
      {
        protocol: "https",
        hostname: "*.firebase.google.com",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "guayaquil.gob.ec",
      },
      {
        protocol: "https",
        hostname: "*.gob.ec",
      },
      {
        protocol: "https",
        hostname: "*.expreso.ec",
      },

      {
        protocol: "https",
        hostname: "*.partner-it.ec",
      },
      {
        protocol: "https",
        hostname: "partner-it.ec",
      },
     ],
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 año para assets versionados
  },
  
  // Headers SEO y seguridad
  async headers() {
    return [
      // API routes: no cache to avoid stale data in admin pages
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=(), camera=()",
          },
          // Cache headers para mejor rendimiento
          {
            key: "Cache-Control",
            value: "public, max-age=3600, must-revalidate",
          },
        ],
      },
      // Cache más agresivo para assets estáticos
      {
        source: "/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Cache para imágenes
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, must-revalidate",
          },
        ],
      },
    ];
  },

  // Redireccionamientos SEO
  async redirects() {
    return [
      // Redirigir URLs antiguas si las tienes
      {
        source: "/tienda",
        destination: "/productos",
        permanent: true,
      },
    ];
  },

  // Rewrites para mejorar URLs
  async rewrites() {
    return {
      beforeFiles: [
        // Rewrite para sitemap dinámico
        {
          source: "/sitemap.xml",
          destination: "/api/sitemap",
        },
      ],
    };
  },

};


export default nextConfig;