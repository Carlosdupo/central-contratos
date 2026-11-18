import "server-only";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { DataISO } from "@/lib/datas";
import type { LinhaFinanceiro } from "./dominio";

// Quem vê a aba: financeiro, RH, Segurança, direção e admin (o banco confere de novo em painel_financeiro).
export const PAPEIS_FINANCEIRO = ["financeiro", "rh", "sst", "direcao", "admin"] as const;

export async function painelFinanceiro(competencia: DataISO): Promise<LinhaFinanceiro[]> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("painel_financeiro", { p_competencia: competencia });
  if (error) throw new Error("Falha ao carregar a liberação financeira.");
  return (data ?? []).map((l) => ({
    empresaId: l.empresa_id,
    razaoSocial: l.razao_social,
    cnpj: l.cnpj,
    obras: l.obras,
    exigidos: l.exigidos,
    aprovados: l.aprovados,
    emAnalise: l.em_analise,
    reprovados: l.reprovados,
    liberadaEm: l.liberada_em,
  }));
}
