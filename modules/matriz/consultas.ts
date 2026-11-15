import { cache } from "react";
import { criarClienteServidor } from "@/lib/supabase/server";

export type AtividadeMatriz = {
  id: string;
  grupo: string;
  subgrupo: string | null;
  atividade: string;
  formaLegal: string;
  unidadeNegociacao: string | null;
  tipo: string | null;
  lotes: string | null;
  unidadeMedicao: string | null;
  observacoes: string | null;
};

// A matriz é a mesma para todas as obras; os usuários internos só leem.
export const listarMatriz = cache(async (): Promise<AtividadeMatriz[]> => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("matriz_contratacao")
    .select("id, grupo_codigo, grupo, subgrupo_codigo, subgrupo, atividade, forma_legal, unidade_negociacao, tipo, lotes, unidade_medicao, observacoes")
    .order("ordem");
  return (data ?? []).map((m) => ({
    id: m.id,
    grupo: `${m.grupo_codigo} ${m.grupo}`,
    subgrupo: m.subgrupo ? `${m.subgrupo_codigo} ${m.subgrupo}` : null,
    atividade: m.atividade,
    formaLegal: m.forma_legal,
    unidadeNegociacao: m.unidade_negociacao,
    tipo: m.tipo,
    lotes: m.lotes,
    unidadeMedicao: m.unidade_medicao,
    observacoes: m.observacoes,
  }));
});
