import "server-only";
import { cache } from "react";
import { criarClienteServidor } from "@/lib/supabase/server";
import { carregarFeriados } from "@/lib/configuracao";
import { agoraNoFuso, situacaoPrazo, type Prazo, type SituacaoPrazo } from "@/lib/datas";
import type { Papel } from "@/modules/acesso/papeis";

export type EtapaFluxo = {
  etapa: number;
  nome: string;
  trilha: "negociacao" | "contrato" | "documentacao" | "liberacao";
  papel: Papel | null;
  responsavel: string;
  dependencias: number[];
  itens: string[];
  pode_pular: boolean;
};

export async function carregarFluxo(): Promise<EtapaFluxo[]> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("etapas_fluxo").select("etapa, nome, trilha, papel, responsavel, dependencias, itens, pode_pular").eq("versao", 1).order("etapa");
  return (data ?? []) as EtapaFluxo[];
}

const prazoDaEtapa = (prazos: unknown, etapa: number): Prazo | null => {
  const p = (prazos as Record<string, Prazo | undefined> | null)?.[String(etapa)];
  return p ?? null;
};
const dataNoFuso = (instante: string) => agoraNoFuso(new Date(instante)).data;

export type EtapaAberta = {
  contratacaoId: string;
  codigo: string;
  servico: string;
  obra: string;
  obraId: string;
  etapa: EtapaFluxo;
  desde: string;
  prazo: SituacaoPrazo;
  uteis: boolean;
};

const ORDEM: Record<string, number> = { atrasada: 0, vence_hoje: 1, vence_amanha: 2, no_prazo: 3, sem_prazo: 4 };

/** Etapas em andamento das contratações que o usuário vê (a RLS filtra por obra para o coordenador). */
// cache(): na mesma requisição (menu + painel) a consulta roda uma vez só.
export const etapasEmAberto = cache(async (): Promise<EtapaAberta[]> => {
  const supabase = await criarClienteServidor();
  const [fluxo, feriados, { data }] = await Promise.all([
    carregarFluxo(),
    carregarFeriados(),
    supabase
      .from("contratacao_etapas")
      .select("etapa, iniciada_em, contratacoes!inner(id, codigo, servico, prazos, situacao, obra_id, obras(nome))")
      .eq("situacao", "em_andamento")
      .eq("contratacoes.situacao", "em_andamento"),
  ]);
  const hoje = agoraNoFuso().data;
  const porNumero = new Map(fluxo.map((f) => [f.etapa, f]));
  return (data ?? [])
    .map((l) => {
      const etapa = porNumero.get(l.etapa)!;
      const prazo = prazoDaEtapa(l.contratacoes.prazos, l.etapa);
      const desde = dataNoFuso(l.iniciada_em ?? new Date().toISOString());
      return {
        contratacaoId: l.contratacoes.id,
        codigo: l.contratacoes.codigo,
        servico: l.contratacoes.servico,
        obra: l.contratacoes.obras?.nome ?? "—",
        obraId: l.contratacoes.obra_id,
        etapa,
        desde,
        prazo: situacaoPrazo({ inicio: desde, hoje, prazo, feriados }),
        uteis: !!prazo?.uteis,
      };
    })
    .sort((a, b) => ORDEM[a.prazo.tipo] - ORDEM[b.prazo.tipo] || (b.prazo.usados - a.prazo.usados));
});

export async function detalheDaContratacao(id: string) {
  const supabase = await criarClienteServidor();
  const [{ data: c }, { data: etapas }, { data: checklist }, { data: cotacoes }, { data: assinaturas }, { data: assinantes }, fluxo, feriados] = await Promise.all([
    supabase.from("contratacoes").select("*, obras(nome), empresas_terceiras(id, razao_social, situacao)").eq("id", id).maybeSingle(),
    supabase.from("contratacao_etapas").select("etapa, situacao, iniciada_em, concluida_em, usuarios:concluida_por(nome)").eq("contratacao_id", id),
    supabase.from("etapa_checklist").select("etapa, item, marcado").eq("contratacao_id", id),
    supabase.from("cotacoes").select("id, fornecedor, cnpj, valor, prazo_dias, escolhida, cotacao_propostas(rodada, valor)").eq("contratacao_id", id).order("valor"),
    supabase.from("assinaturas").select("ordem, assinado_em, usuarios:assinado_por(nome)").eq("contratacao_id", id),
    supabase.from("assinantes_fluxo").select("ordem, rotulo, papel").order("ordem"),
    carregarFluxo(),
    carregarFeriados(),
  ]);
  if (!c) return null;
  const hoje = agoraNoFuso().data;
  const etapasDetalhe = fluxo.map((f) => {
    const e = (etapas ?? []).find((x) => x.etapa === f.etapa);
    const prazo = prazoDaEtapa(c.prazos, f.etapa);
    const desde = e?.iniciada_em ? dataNoFuso(e.iniciada_em) : null;
    return {
      ...f,
      situacao: (e?.situacao ?? "pendente") as "pendente" | "em_andamento" | "concluida" | "pulada",
      desde,
      concluidaEm: e?.concluida_em ? dataNoFuso(e.concluida_em) : null,
      concluidaPor: (e?.usuarios as { nome: string } | null)?.nome ?? null,
      prazoConfig: prazo,
      prazo: e?.situacao === "em_andamento" && desde ? situacaoPrazo({ inicio: desde, hoje, prazo, feriados }) : null,
      marcados: f.itens.map((_, i) => !!(checklist ?? []).find((k) => k.etapa === f.etapa && k.item === i + 1)?.marcado),
    };
  });
  return {
    c,
    etapas: etapasDetalhe,
    cotacoes: cotacoes ?? [],
    assinantes: (assinantes ?? []).map((a) => {
      const s = (assinaturas ?? []).find((x) => x.ordem === a.ordem);
      return { ...a, assinadoEm: s?.assinado_em ? dataNoFuso(s.assinado_em) : null, assinadoPor: (s?.usuarios as { nome: string } | null)?.nome ?? null };
    }),
  };
}

// Panorama da obra (no formato da planilha "Controle de status de contratos"): uma linha por
// contratação e uma coluna por área, preenchida pelas etapas.
export const COLUNAS_PANORAMA = [
  { chave: "obra", titulo: "Obra", etapas: [1, 2, 3, 4] },
  { chave: "suprimentos", titulo: "Suprimentos", etapas: [5, 6] },
  { chave: "contrato", titulo: "Contrato e minuta", etapas: [7, 8] },
  { chave: "assinaturas", titulo: "Assinaturas", etapas: [9] },
  { chave: "documentacao", titulo: "Documentação RH", etapas: [10] },
  { chave: "integracao", titulo: "Integração", etapas: [11] },
  { chave: "liberacao", titulo: "Liberação", etapas: [12] },
] as const;

export type CelulaPanorama =
  | { tipo: "ok"; data: string }
  | { tipo: "na" }
  | { tipo: "andamento"; etapa: string; prazo: SituacaoPrazo; uteis: boolean }
  | { tipo: "pendente" };

export type LinhaPanorama = {
  id: string;
  codigo: string;
  abertaEm: string;
  servico: string;
  pacote: string | null;
  obraId: string;
  obra: string;
  situacao: "em_andamento" | "liberada" | "cancelada";
  comQuem: string[];
  atrasada: boolean;
  celulas: CelulaPanorama[];
  siengeSolicitacao: string | null;
  siengeContrato: string | null;
  fornecedor: string | null;
  valorFinal: number | null;
};

export async function panoramaDasContratacoes(obraId?: string): Promise<LinhaPanorama[]> {
  const supabase = await criarClienteServidor();
  let consulta = supabase
    .from("contratacoes")
    .select("id, codigo, created_at, servico, pacote, obra_id, situacao, prazos, sienge_solicitacao, sienge_contrato, fornecedor_nome, valor_negociado, obras(nome), contratacao_etapas(etapa, situacao, iniciada_em, concluida_em)")
    .order("created_at", { ascending: false });
  if (obraId) consulta = consulta.eq("obra_id", obraId);
  const [{ data }, fluxo, feriados] = await Promise.all([consulta, carregarFluxo(), carregarFeriados()]);
  const hoje = agoraNoFuso().data;
  const porNumero = new Map(fluxo.map((f) => [f.etapa, f]));

  return (data ?? []).map((c) => {
    const etapas = new Map(c.contratacao_etapas.map((e) => [e.etapa, e]));
    let atrasada = false;
    const comQuem = new Set<string>();
    const celulas: CelulaPanorama[] = COLUNAS_PANORAMA.map((col) => {
      const lista = col.etapas.map((n) => ({ n, e: etapas.get(n) }));
      const andamento = lista.find((x) => x.e?.situacao === "em_andamento");
      if (andamento && c.situacao === "em_andamento") {
        const prazo = prazoDaEtapa(c.prazos, andamento.n);
        const desde = dataNoFuso(andamento.e!.iniciada_em ?? new Date().toISOString());
        const situacao = situacaoPrazo({ inicio: desde, hoje, prazo, feriados });
        if (situacao.tipo === "atrasada") atrasada = true;
        comQuem.add(porNumero.get(andamento.n)?.responsavel ?? "");
        return { tipo: "andamento", etapa: porNumero.get(andamento.n)?.nome ?? "", prazo: situacao, uteis: !!prazo?.uteis };
      }
      if (lista.every((x) => x.e?.situacao === "pulada")) return { tipo: "na" };
      if (lista.every((x) => x.e?.situacao === "concluida" || x.e?.situacao === "pulada")) {
        const ultima = lista.map((x) => x.e?.concluida_em).filter(Boolean).sort().at(-1);
        return { tipo: "ok", data: ultima ? dataNoFuso(ultima) : "" };
      }
      return { tipo: "pendente" };
    });
    return {
      id: c.id,
      codigo: c.codigo,
      abertaEm: dataNoFuso(c.created_at),
      servico: c.servico,
      pacote: c.pacote,
      obraId: c.obra_id,
      obra: c.obras?.nome ?? "—",
      situacao: c.situacao,
      comQuem: [...comQuem].filter(Boolean),
      atrasada,
      celulas,
      siengeSolicitacao: c.sienge_solicitacao,
      siengeContrato: c.sienge_contrato,
      fornecedor: c.fornecedor_nome,
      valorFinal: c.valor_negociado == null ? null : Number(c.valor_negociado),
    };
  });
}
