import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { criarClienteAdmin } from "@/lib/supabase/admin";

// Limite de tentativas contado no banco (public.consumir_limite), então vale entre todas as instâncias da Vercel.
// A chave guarda só um hash: nunca ficam IP nem e-mail em claro.

const hash = (valor: string) => createHash("sha256").update(valor).digest("hex").slice(0, 32);

/**
 * IP do cliente, ou null quando a plataforma não informa (ex.: desenvolvimento local).
 * Na Vercel, x-forwarded-for é sobrescrito pela plataforma e não vem do navegador.
 */
export async function ipDoCliente(): Promise<string | null> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

/**
 * Conta uma tentativa. Devolve false quando passou do limite da janela.
 * Se o banco falhar, libera (melhor que trancar todo mundo para fora) e deixa o erro no log.
 */
export async function dentroDoLimite(escopo: string, identificador: string, max: number, janelaSegundos: number): Promise<boolean> {
  const { data, error } = await criarClienteAdmin().rpc("consumir_limite", {
    p_chave: `${escopo}:${hash(identificador.toLowerCase())}`,
    p_max: max,
    p_janela_seg: janelaSegundos,
  });
  if (error) {
    console.error("[limites] falha ao contar tentativa:", error.message);
    return true;
  }
  return data === true;
}
