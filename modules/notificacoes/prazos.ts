import "server-only";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { agoraNoFuso, situacaoPrazo, type Prazo } from "@/lib/datas";
import { tipoDeAvisoDePrazo } from "./prazos-regra";

/**
 * Tarefa diária: para cada etapa em andamento, avisa quem age nela quando o prazo vence hoje, amanhã ou já venceu.
 * O banco guarda um aviso por pessoa, etapa, tipo e dia (gerar_aviso_prazo), então rodar de novo no mesmo dia não repete.
 */
export async function gerarAvisosDePrazo(): Promise<{ avaliadas: number; avisadas: number }> {
  const admin = criarClienteAdmin();
  const hoje = agoraNoFuso().data;
  const [{ data: etapas }, { data: feriados }] = await Promise.all([
    admin
      .from("contratacao_etapas")
      .select("etapa, iniciada_em, contratacoes!inner(id, prazos, situacao)")
      .eq("situacao", "em_andamento")
      .eq("contratacoes.situacao", "em_andamento"),
    admin.from("feriados").select("data"),
  ]);
  const feriadosSet = new Set((feriados ?? []).map((f) => f.data));
  let avisadas = 0;
  for (const e of etapas ?? []) {
    const prazo = ((e.contratacoes.prazos as Record<string, Prazo | undefined> | null)?.[String(e.etapa)] ?? null) as Prazo | null;
    if (!prazo || !e.iniciada_em) continue;
    const situacao = situacaoPrazo({ inicio: agoraNoFuso(new Date(e.iniciada_em)).data, hoje, prazo, feriados: feriadosSet });
    const tipo = tipoDeAvisoDePrazo(situacao.tipo);
    if (!tipo) continue;
    const { error } = await admin.rpc("gerar_aviso_prazo", { p_contratacao: e.contratacoes.id, p_etapa: e.etapa, p_tipo: tipo, p_dia: hoje });
    if (!error) avisadas++;
  }
  return { avaliadas: (etapas ?? []).length, avisadas };
}
