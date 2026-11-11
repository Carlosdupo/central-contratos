import "server-only";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Feriados, Prazo } from "@/lib/datas";

// Leitura de parâmetros de negócio e feriados (tabelas editáveis pelo admin).

export async function lerParametros() {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("parametros").select("chave, valor");
  const p = new Map((data ?? []).map((x) => [x.chave, x.valor]));
  return {
    prazoAnaliseRh: (p.get("prazo_analise_rh") ?? { dias: 2, uteis: true }) as Prazo,
    horarioCorte: Number(p.get("horario_corte_integracao") ?? 18),
    antecedenciaVisita: Number(p.get("antecedencia_visita_dias") ?? 1),
  };
}

/** Feriados cadastrados (P27 pendente: hoje todos contam, sem separar por cidade da obra). */
export async function carregarFeriados(): Promise<Feriados> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("feriados").select("data");
  return new Set((data ?? []).map((f) => f.data));
}
