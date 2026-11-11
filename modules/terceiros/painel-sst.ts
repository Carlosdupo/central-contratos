import "server-only";
import { criarClienteServidor } from "@/lib/supabase/server";
import { agoraNoFuso, type DataISO } from "@/lib/datas";

export type PessoaAgendada = { id: string; data: DataISO; pessoa: string; empresa: string; obra: string; funcao: string };

/** Resumo da segurança do trabalho: integrações agendadas, quem está chegando do RH, liberados e bloqueados. */
export async function resumoSst() {
  const supabase = await criarClienteServidor();
  const seteDias = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const contar = (situacao: "em_analise" | "bloqueado") =>
    supabase.from("alocacoes").select("id", { count: "exact", head: true }).eq("situacao", situacao);
  const [{ data, error }, { count: noRh }, { count: bloqueados }, { count: liberados }] = await Promise.all([
    supabase
      .from("alocacoes")
      .select("id, integracao_data, obras(nome), vinculos(funcao, empresas_terceiras(razao_social), pessoas(nome))")
      .eq("situacao", "integracao_agendada")
      .order("integracao_data"),
    contar("em_analise"),
    contar("bloqueado"),
    supabase.from("alocacoes").select("id", { count: "exact", head: true }).eq("situacao", "liberado").gte("liberado_em", seteDias),
  ]);
  if (error) throw new Error("Falha ao carregar as integrações.");
  const hoje = agoraNoFuso().data;
  const agendadas: PessoaAgendada[] = (data ?? []).map((a) => ({
    id: a.id,
    data: a.integracao_data ?? hoje,
    pessoa: a.vinculos?.pessoas?.nome ?? "—",
    empresa: a.vinculos?.empresas_terceiras?.razao_social ?? "—",
    obra: a.obras?.nome ?? "—",
    funcao: a.vinculos?.funcao ?? "",
  }));
  return { hoje, agendadas, noRh: noRh ?? 0, bloqueados: bloqueados ?? 0, liberados: liberados ?? 0 };
}
