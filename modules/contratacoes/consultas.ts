import "server-only";
import { codigoExibicao } from "@/lib/sienge";
import { cache } from "react";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { nomeComPapelNaObra } from "@/lib/rotulo-usuario";
import { carregarFeriados } from "@/lib/configuracao";
import { agoraNoFuso, situacaoPrazo, type Prazo, type SituacaoPrazo } from "@/lib/datas";
import type { Papel } from "@/modules/acesso/papeis";

export type EtapaFluxo = {
  etapa: number;
  chave: string;
  nome: string;
  trilha: "negociacao" | "contrato" | "documentacao" | "liberacao";
  papel: Papel | null;
  responsavel: string;
  dependencias: number[];
  itens: string[];
  pode_pular: boolean;
};

/** Todas as versões do fluxo (1: contratações antigas, 2: normal, 3: aditivo), cada uma na ordem das etapas. */
export const carregarFluxos = cache(async (): Promise<Map<number, EtapaFluxo[]>> => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("etapas_fluxo").select("versao, etapa, chave, nome, trilha, papel, responsavel, dependencias, itens, pode_pular").order("etapa");
  const porVersao = new Map<number, EtapaFluxo[]>();
  for (const { versao, ...etapa } of data ?? []) porVersao.set(versao, [...(porVersao.get(versao) ?? []), etapa as EtapaFluxo]);
  return porVersao;
});

export async function carregarFluxo(versao = 1): Promise<EtapaFluxo[]> {
  return (await carregarFluxos()).get(versao) ?? [];
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
  urgente: boolean;
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
  const [fluxos, feriados, { data }] = await Promise.all([
    carregarFluxos(),
    carregarFeriados(),
    supabase
      .from("contratacao_etapas")
      .select("etapa, iniciada_em, contratacoes!inner(id, codigo, sienge_contrato, sienge_solicitacao, servico, prazos, situacao, obra_id, urgente, fluxo_versao, obras(nome))")
      .eq("situacao", "em_andamento")
      .eq("contratacoes.situacao", "em_andamento"),
  ]);
  const hoje = agoraNoFuso().data;
  return (data ?? [])
    .map((l) => {
      const etapa = (fluxos.get(l.contratacoes.fluxo_versao) ?? fluxos.get(1) ?? []).find((f) => f.etapa === l.etapa)!;
      const prazo = prazoDaEtapa(l.contratacoes.prazos, l.etapa);
      const desde = dataNoFuso(l.iniciada_em ?? new Date().toISOString());
      return {
        contratacaoId: l.contratacoes.id,
        codigo: codigoExibicao(l.contratacoes),
        servico: l.contratacoes.servico,
        obra: l.contratacoes.obras?.nome ?? "—",
        obraId: l.contratacoes.obra_id,
        urgente: l.contratacoes.urgente,
        etapa,
        desde,
        prazo: situacaoPrazo({ inicio: desde, hoje, prazo, feriados }),
        uteis: !!prazo?.uteis,
      };
    })
    .sort((a, b) => Number(b.urgente) - Number(a.urgente) || ORDEM[a.prazo.tipo] - ORDEM[b.prazo.tipo] || (b.prazo.usados - a.prazo.usados));
});

export async function detalheDaContratacao(id: string) {
  const supabase = await criarClienteServidor();
  const [{ data: c }, { data: etapas }, { data: checklist }, { data: cotacoes }, { data: assinaturas }, { data: assinantes }, { data: devolucoes }, { data: escopoRows }, fluxos, feriados] = await Promise.all([
    supabase.from("contratacoes").select("*, obras(nome, prefixo_sienge), empresas_terceiras(id, razao_social, situacao)").eq("id", id).maybeSingle(),
    supabase.from("contratacao_etapas").select("etapa, situacao, iniciada_em, concluida_em, concluida_por, usuarios:concluida_por(nome)").eq("contratacao_id", id),
    supabase.from("etapa_checklist").select("etapa, item, marcado").eq("contratacao_id", id),
    supabase.from("cotacoes").select("id, fornecedor, cnpj, valor, prazo_dias, escolhida, cotacao_propostas(rodada, valor)").eq("contratacao_id", id).order("valor"),
    supabase.from("assinaturas").select("ordem, assinado_em, usuarios:assinado_por(nome)").eq("contratacao_id", id),
    supabase.from("assinantes_fluxo").select("ordem, rotulo, papel").order("ordem"),
    supabase.from("contratacao_devolucoes").select("id, tipo, de_etapa, para_etapa, motivo, em, por, usuarios:por(nome)").eq("contratacao_id", id).order("em"),
    supabase.from("contratacao_atividades").select("matriz_contratacao(id, atividade, forma_legal, ordem)").eq("contratacao_id", id),
    carregarFluxos(),
    carregarFeriados(),
  ]);
  if (!c) return null;
  // Papel de quem agiu nesta obra (auxiliar ou coordenador). A RLS só deixa cada um ler o próprio vínculo; a leitura é feita no
  // servidor, depois de a pessoa já ter acesso à contratação, e só para quem agiu nela.
  const agentes = [...new Set([...(etapas ?? []).map((e) => e.concluida_por), ...(devolucoes ?? []).map((d) => d.por)].filter((x): x is string => !!x))];
  const { data: vinculos } = agentes.length
    ? await criarClienteAdmin().from("usuario_obras").select("usuario_id, nivel").eq("obra_id", c.obra_id).in("usuario_id", agentes)
    : { data: [] };
  const nivelDe = new Map((vinculos ?? []).map((v) => [v.usuario_id, v.nivel]));
  const quem = (id: string | null | undefined, u: unknown) => {
    const nome = (u as { nome: string } | null)?.nome;
    return nome ? nomeComPapelNaObra(nome, id ? nivelDe.get(id) : null) : null;
  };
  const fluxo = fluxos.get(c.fluxo_versao) ?? fluxos.get(1) ?? [];
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
      concluidaPor: quem(e?.concluida_por, e?.usuarios),
      concluidaEmIso: e?.concluida_em ?? null,
      prazoConfig: prazo,
      prazo: e?.situacao === "em_andamento" && desde ? situacaoPrazo({ inicio: desde, hoje, prazo, feriados }) : null,
      marcados: f.itens.map((_, i) => !!(checklist ?? []).find((k) => k.etapa === f.etapa && k.item === i + 1)?.marcado),
    };
  });
  const nomeDaEtapa = (n: number | null) => {
    const f = fluxo.find((x) => x.etapa === n);
    return f ? `etapa ${f.etapa} (${f.nome})` : "etapa";
  };
  // Quem abriu: quem concluiu a solicitação (a 1ª etapa), que é gravada na abertura.
  const solicitante = (etapasDetalhe.find((e) => e.chave === "solicitacao") ?? etapasDetalhe[0])?.concluidaPor ?? null;
  const eventos = [
    { id: "abertura", quando: c.created_at, texto: `Contratação ${c.codigo} aberta${solicitante ? ` por ${solicitante}` : ""}.` },
    ...etapasDetalhe
      .filter((e) => e.concluidaEmIso)
      .map((e) => ({ id: `etapa-${e.etapa}`, quando: e.concluidaEmIso as string, texto: `Etapa ${e.etapa} (${e.nome}) ${e.situacao === "pulada" ? "pulada" : "concluída"}${e.concluidaPor ? ` por ${e.concluidaPor}` : ""}.` })),
    ...(devolucoes ?? []).map((d) => ({
      id: `dev-${d.id}`,
      quando: d.em,
      destaque: true,
      texto:
        d.tipo === "reabertura"
          ? `${nomeDaEtapa(d.para_etapa)} reaberta por ${quem(d.por, d.usuarios) ?? "—"}: ${d.motivo}`
          : `${nomeDaEtapa(d.de_etapa)} devolvida para a ${nomeDaEtapa(d.para_etapa)} por ${quem(d.por, d.usuarios) ?? "—"}: ${d.motivo}`,
    })),
  ].sort((a, b) => a.quando.localeCompare(b.quando));
  return {
    c,
    solicitante,
    eventos,
    etapas: etapasDetalhe,
    cotacoes: cotacoes ?? [],
    atividadesDoEscopo: (escopoRows ?? [])
      .flatMap((r) => (r.matriz_contratacao ? [r.matriz_contratacao] : []))
      .sort((a, b) => a.ordem - b.ordem)
      .map((m) => ({ id: m.id, atividade: m.atividade, formaLegal: m.forma_legal })),
    devolucoes: (devolucoes ?? []).map((d) => ({
      id: d.id,
      tipo: d.tipo as "devolucao" | "reabertura",
      de: d.de_etapa,
      para: d.para_etapa,
      motivo: d.motivo,
      em: d.em,
      por: quem(d.por, d.usuarios) ?? "—",
    })),
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
  urgente: boolean;
  urgenteData: string | null;
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
    .select("id, codigo, created_at, servico, pacote, obra_id, urgente, urgente_data, situacao, prazos, sienge_solicitacao, sienge_contrato, fornecedor_nome, valor_negociado, fluxo_versao, obras(nome), contratacao_etapas(etapa, situacao, iniciada_em, concluida_em)")
    .order("created_at", { ascending: false });
  if (obraId) consulta = consulta.eq("obra_id", obraId);
  const [{ data }, fluxos, feriados] = await Promise.all([consulta, carregarFluxos(), carregarFeriados()]);
  const hoje = agoraNoFuso().data;

  return (data ?? []).map((c) => {
    const porNumero = new Map((fluxos.get(c.fluxo_versao) ?? fluxos.get(1) ?? []).map((f) => [f.etapa, f]));
    const etapas = new Map(c.contratacao_etapas.map((e) => [e.etapa, e]));
    let atrasada = false;
    const comQuem = new Set<string>();
    const celulas: CelulaPanorama[] = COLUNAS_PANORAMA.map((col) => {
      // Etapas que não existem neste fluxo (ex.: a 6 no fluxo 2) não entram na coluna.
      const lista = col.etapas.map((n) => ({ n, e: etapas.get(n) })).filter((x) => x.e);
      if (lista.length === 0) return { tipo: "na" };
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
      codigo: codigoExibicao(c),
      urgente: c.urgente,
      urgenteData: c.urgente_data,
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
