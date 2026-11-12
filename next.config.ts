import type { NextConfig } from "next";

// Cache Components fica desligado: toda tela depende do usuário logado e da RLS,
// e não queremos dado de terceiros (CPF, ASO) em cache do servidor. Ver docs/adr/0001.
// A Content-Security-Policy (com nonce por requisição) é montada no proxy.ts / lib/csp.ts.
const cabecalhosSeguranca = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  cacheComponents: false,
  poweredByHeader: false,
  // Importação da EAP em PDF pelo administrador.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: cabecalhosSeguranca }];
  },
};

export default nextConfig;
