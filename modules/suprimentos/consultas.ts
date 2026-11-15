import "server-only";
import { cache } from "react";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/tipos";

type Linha = Database["public"]["Views"]["planejamento_calculado"]["Row"];

export type CicloSalvo = { mes: number; ciclo: number; limite: string; inicio: string };

export type ItemPlanejamento = {
  id: string;
  obraId: string;
  tipo: "MO" | "MAT";
  fase: string | null;
  idPacote: string | null;
  pacoteVinculado: string | null;
  responsavel: string | null;
  descricao: string;
  prazoCompras: number | null;
  prazoChegada: number | null;
  inicioManual: string | null;
  inicioPacote: string | null;
  dataEstudo: string | null;
  dataSolicitar: string | null;
  dataComprasFechar: string | null;
  dataDeveriaFechar: string | null;
  siengeSolicitacao: string | null;
  dataRealObra: string | null;
  dataRealCompras: string | null;
  observacao: string | null;
  contratacaoId: string | null;
};

export async function calendarioDoAno(ano: number): Promise<CicloSalvo[]> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("calendario_suprimentos").select("mes, ciclo, limite, inicio").eq("ano", ano).order("mes").order("ciclo");
  return data ?? [];
}

/** Todos os ciclos do calendário (a abertura mostra "será negociado a partir de" com eles). */
export const todosOsCiclos = cache(async (): Promise<{ limite: string; inicio: string }[]> => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("calendario_suprimentos").select("limite, inicio").order("limite");
  return data ?? [];
});

const paraItem = (r: {
  id: string; obra_id: string; tipo: string; fase: string | null; id_pacote: string | null; pacote_vinculado: string | null; responsavel: string | null; descricao: string;
  prazo_compras_dias: number | null; prazo_chegada_dias: number | null; inicio_manual: string | null; inicio_pacote: string | null; data_estudo: string | null;
  data_solicitar: string | null; data_compras_fechar: string | null; data_deveria_fechar: string | null; sienge_solicitacao: string | null; data_real_obra: string | null;
  data_real_compras: string | null; observacao: string | null; contratacao_id: string | null;
}): ItemPlanejamento => ({
  id: r.id, obraId: r.obra_id, tipo: r.tipo as "MO" | "MAT", fase: r.fase, idPacote: r.id_pacote, pacoteVinculado: r.pacote_vinculado, responsavel: r.responsavel, descricao: r.descricao,
  prazoCompras: r.prazo_compras_dias, prazoChegada: r.prazo_chegada_dias, inicioManual: r.inicio_manual, inicioPacote: r.inicio_pacote, dataEstudo: r.data_estudo,
  dataSolicitar: r.data_solicitar, dataComprasFechar: r.data_compras_fechar, dataDeveriaFechar: r.data_deveria_fechar, siengeSolicitacao: r.sienge_solicitacao,
  dataRealObra: r.data_real_obra, dataRealCompras: r.data_real_compras, observacao: r.observacao, contratacaoId: r.contratacao_id,
});

/** Itens da planilha (com as datas calculadas) de uma obra e de um tipo. A RLS limita às obras que a pessoa vê. */
export async function itensDaPlanilha(tipo: "MO" | "MAT", obraId: string): Promise<ItemPlanejamento[]> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("planejamento_calculado").select("*").eq("tipo", tipo).eq("obra_id", obraId).order("ordem").limit(1000);
  return (data ?? []).map((r) => paraItem(r as Parameters<typeof paraItem>[0]));
}

/** Itens ainda livres (sem contratação) das obras informadas, para a abertura escolher. */
export async function itensLivres(obraIds: string[]): Promise<{ id: string; obraId: string; tipo: "MO" | "MAT"; descricao: string; idPacote: string | null; dataSolicitar: string | null }[]> {
  if (obraIds.length === 0) return [];
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("planejamento_calculado").select("*").in("obra_id", obraIds).order("ordem").limit(2000);
  return ((data ?? []) as unknown as Linha[]).filter((r) => !r.contratacao_id).map((r) => ({ id: r.id, obraId: r.obra_id, tipo: r.tipo as "MO" | "MAT", descricao: r.descricao, idPacote: r.id_pacote, dataSolicitar: r.data_solicitar }));
}

export async function indicadoresDoMes(ano: number, mes: number) {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.rpc("indicadores_planejamento", { p_ano: ano, p_mes: mes });
  return data ?? [];
}

export async function obrasDaPlanilha(): Promise<{ id: string; nome: string }[]> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("obras").select("id, nome").eq("ativa", true).order("nome");
  return data ?? [];
}
