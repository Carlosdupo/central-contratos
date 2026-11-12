import "server-only";
import { cache } from "react";
import { criarClienteServidor } from "@/lib/supabase/server";
import { temAlgumPapel, type Papel } from "@/modules/acesso/papeis";
import { etapasEmAberto, type EtapaAberta } from "@/modules/contratacoes/consultas";

// O que espera a pessoa logada, com a mesma regra de papéis do sistema (app.pode_agir_como).
// Usado no contador do menu e no bloco "O que precisa de você hoje" do Painel.

/** A etapa é de um papel que a pessoa tem? (Suprimentos vale para o gerente também.) */
export const etapaEhMinha = (a: EtapaAberta, papeis: Papel[]) =>
  a.etapa.etapa !== 9 &&
  (a.etapa.papel === "suprimentos" ? temAlgumPapel(papeis, ["suprimentos", "gerente_suprimentos"]) : !!a.etapa.papel && papeis.includes(a.etapa.papel));

export type AssinaturaMinha = { contratacaoId: string; codigo: string; servico: string; obra: string; rotulo: string; prazo: EtapaAberta["prazo"]; uteis: boolean };

/** Contratações na etapa de assinaturas em que é a vez de um papel da pessoa. */
export const assinaturasMinhas = cache(async (papeis: Papel[]): Promise<AssinaturaMinha[]> => {
  const abertas = (await etapasEmAberto()).filter((a) => a.etapa.etapa === 9);
  if (abertas.length === 0) return [];
  const supabase = await criarClienteServidor();
  const [{ data: assinantes }, { data: feitas }] = await Promise.all([
    supabase.from("assinantes_fluxo").select("ordem, rotulo, papel").order("ordem"),
    supabase.from("assinaturas").select("contratacao_id, ordem").in("contratacao_id", abertas.map((a) => a.contratacaoId)),
  ]);
  return abertas.flatMap((a) => {
    const assinadas = new Set((feitas ?? []).filter((f) => f.contratacao_id === a.contratacaoId).map((f) => f.ordem));
    const proximo = (assinantes ?? []).find((s) => !assinadas.has(s.ordem));
    const papel = proximo?.papel as Papel | undefined;
    const minha = !!papel && (papel === "suprimentos" ? temAlgumPapel(papeis, ["suprimentos", "gerente_suprimentos"]) : papeis.includes(papel));
    return minha ? [{ contratacaoId: a.contratacaoId, codigo: a.codigo, servico: a.servico, obra: a.obra, rotulo: proximo!.rotulo, prazo: a.prazo, uteis: a.uteis }] : [];
  });
});

/** Número para o contador do menu: etapas e assinaturas da pessoa + fila do RH + integrações de hoje ou atrasadas. */
export const contarPendencias = cache(async (papeis: Papel[]): Promise<number> => {
  const supabase = await criarClienteServidor();
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const [abertas, assinaturas, rh, sst] = await Promise.all([
    etapasEmAberto(),
    assinaturasMinhas(papeis),
    papeis.includes("rh") ? supabase.from("envios_analise").select("id", { count: "exact", head: true }).eq("situacao", "aberto") : null,
    papeis.includes("sst")
      ? supabase.from("alocacoes").select("id", { count: "exact", head: true }).eq("situacao", "integracao_agendada").lte("integracao_data", hoje)
      : null,
  ]);
  return abertas.filter((a) => etapaEhMinha(a, papeis)).length + assinaturas.length + (rh?.count ?? 0) + (sst?.count ?? 0);
});
