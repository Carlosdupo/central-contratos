import { z } from "zod";

// Variáveis públicas: vão para o navegador. Nunca coloque segredo aqui.
const esquemaPublico = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

// Variáveis só do servidor. Lidas por lib/env.server.ts.
export const esquemaServidor = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20),
  // Vazio no .env conta como não informado.
  CRON_SECRET: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(32).optional()),
});

// O Next só injeta NEXT_PUBLIC_* quando o nome aparece literalmente no código.
export const envPublico = esquemaPublico.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});
