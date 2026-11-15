// Regras do panorama das obras (só lógica, sem tela): área de cada etapa, trilha compacta, filtros e resumo.

export const AREAS = ["Obra", "Suprimentos", "Contratos", "Assinaturas", "RH", "Segurança"] as const;
export type Area = (typeof AREAS)[number];

export type SituacaoDoPasso = "pendente" | "em_andamento" | "concluida" | "pulada";
export type TipoDePrazo = "sem_prazo" | "no_prazo" | "vence_amanha" | "vence_hoje" | "atrasada";
export type PrazoDoPasso = { tipo: TipoDePrazo; restantes: number | null; uteis: boolean };

export type PassoPanorama = {
  etapa: number;
  chave: string;
  nome: string;
  area: Area;
  responsavel: string;
  situacao: SituacaoDoPasso;
  concluidaEm: string | null;
  prazo: PrazoDoPasso | null;
};

export type ContratacaoPanorama = {
  id: string;
  codigo: string;
  servico: string;
  obraId: string;
  obra: string;
  prefixoSienge: string | null;
  situacao: "em_andamento" | "liberada" | "cancelada";
  urgente: boolean;
  urgenteData: string | null;
  urgenteMotivo: string | null;
  aditivoDe: string | null;
  foraDoPrazo: boolean;
  abertaEm: string;
  fornecedor: string | null;
  valor: number | null;
  sienge: string | null;
  motivoCancelamento: string | null;
  empresaJaLiberada: boolean;
  /** Equipe da empresa nesta obra aprovada pelo RH (só existe depois que a empresa é ligada à contratação). */
  equipe: { aprovados: number; total: number } | null;
  devolucao: string | null;
  passos: PassoPanorama[];
};

/** Área que responde pela etapa (pelo papel; a etapa de assinaturas não tem papel único). */
export function areaDoPapel(papel: string | null): Area {
  switch (papel) {
    case "coordenador_obra": return "Obra";
    case "suprimentos":
    case "gerente_suprimentos": return "Suprimentos";
    case "contratos": return "Contratos";
    case "rh": return "RH";
    case "sst": return "Segurança";
    default: return "Assinaturas";
  }
}

/** Bloco da trilha compacta: etapas parecidas ficam juntas (a trilha tem 7 blocos, não 12 colunas). */
export function blocoDaChave(chave: string): number {
  if (["escopo", "solicitacao", "cotacao", "negociacao_obra", "fornecedor_valor", "solicitacao_sienge"].includes(chave)) return 0;
  if (["negociacao", "autorizacao"].includes(chave)) return 1;
  if (["contrato", "contrato_aditivo", "alcada"].includes(chave)) return 2;
  if (chave === "assinaturas") return 3;
  if (chave === "documentacao") return 4;
  if (chave === "integracao") return 5;
  return 6;
}

export const passosAtuais = (c: ContratacaoPanorama): PassoPanorama[] => (c.situacao === "em_andamento" ? c.passos.filter((p) => p.situacao === "em_andamento") : []);
export const posicaoDoPasso = (c: ContratacaoPanorama, p: PassoPanorama): number => c.passos.findIndex((x) => x.etapa === p.etapa) + 1;

/** O passo atual mais urgente (atraso primeiro); com etapas em paralelo, é o que mais precisa de atenção. */
const ORDEM_PRAZO: Record<TipoDePrazo, number> = { atrasada: 0, vence_hoje: 1, vence_amanha: 2, no_prazo: 3, sem_prazo: 4 };
export function passoPrincipal(c: ContratacaoPanorama): PassoPanorama | null {
  return [...passosAtuais(c)].sort((a, b) => ORDEM_PRAZO[a.prazo?.tipo ?? "sem_prazo"] - ORDEM_PRAZO[b.prazo?.tipo ?? "sem_prazo"])[0] ?? null;
}

export const estaAtrasada = (c: ContratacaoPanorama) => passosAtuais(c).some((p) => p.prazo?.tipo === "atrasada");
export const venceHoje = (c: ContratacaoPanorama) => passosAtuais(c).some((p) => p.prazo?.tipo === "vence_hoje");
export const estaEmAndamento = (c: ContratacaoPanorama) => c.situacao === "em_andamento";

/** Texto do prazo, sem depender de cor: "Atrasada 2 dias", "Vence hoje", "Faltam 5 dias". */
export function textoDoPrazo(prazo: PrazoDoPasso | null): string {
  if (!prazo || prazo.tipo === "sem_prazo" || prazo.restantes === null) return "Sem prazo definido";
  const un = prazo.uteis ? "dia útil" : "dia";
  const n = Math.abs(prazo.restantes);
  const plural = (q: number) => (q === 1 ? un : prazo.uteis ? "dias úteis" : "dias");
  if (prazo.tipo === "atrasada") return `Atrasada ${n} ${plural(n)}`;
  if (prazo.tipo === "vence_hoje") return "Vence hoje";
  if (prazo.tipo === "vence_amanha") return "Vence amanhã";
  return `Faltam ${n} ${plural(n)}`;
}

/** Um segmento da trilha: estado visual de um passo. */
export type EstadoDoSegmento = "feito" | "agora" | "tarde" | "pendente" | "na";
export function estadoDoSegmento(c: ContratacaoPanorama, p: PassoPanorama): EstadoDoSegmento {
  if (p.situacao === "pulada") return "na";
  if (p.situacao === "concluida") return "feito";
  if (c.situacao === "cancelada") return "pendente";
  if (p.situacao === "em_andamento") return p.prazo?.tipo === "atrasada" ? "tarde" : "agora";
  return c.situacao === "liberada" ? "feito" : "pendente";
}

export function blocosDaTrilha(c: ContratacaoPanorama): { bloco: number; segmentos: { passo: PassoPanorama; estado: EstadoDoSegmento }[] }[] {
  const porBloco = new Map<number, { passo: PassoPanorama; estado: EstadoDoSegmento }[]>();
  for (const passo of c.passos) {
    const b = blocoDaChave(passo.chave);
    porBloco.set(b, [...(porBloco.get(b) ?? []), { passo, estado: estadoDoSegmento(c, passo) }]);
  }
  return [...porBloco.entries()].sort((a, b) => a[0] - b[0]).map(([bloco, segmentos]) => ({ bloco, segmentos }));
}

/** Texto da trilha para leitor de tela: "etapa 5 de 11, com Suprimentos, 2 dias de atraso". */
export function descricaoDaTrilha(c: ContratacaoPanorama): string {
  if (c.situacao === "liberada") return "Todas as etapas concluídas. Equipe liberada para a obra.";
  if (c.situacao === "cancelada") return "Contratação cancelada.";
  const p = passoPrincipal(c);
  if (!p) return "Sem etapa em andamento.";
  const outras = passosAtuais(c).length - 1;
  return `Etapa ${posicaoDoPasso(c, p)} de ${c.passos.length}: ${p.nome}, com ${p.area}. ${textoDoPrazo(p.prazo)}.${outras > 0 ? ` Mais ${outras} em paralelo.` : ""}`;
}

export type FiltroSituacao = "todas" | "andamento" | "atraso" | "urgente" | "liberada";
export const SITUACOES: { chave: FiltroSituacao; rotulo: string; testa: (c: ContratacaoPanorama) => boolean }[] = [
  { chave: "todas", rotulo: "Todas", testa: () => true },
  { chave: "andamento", rotulo: "Em andamento", testa: estaEmAndamento },
  { chave: "atraso", rotulo: "Com atraso", testa: estaAtrasada },
  { chave: "urgente", rotulo: "Urgentes", testa: (c) => estaEmAndamento(c) && c.urgente },
  { chave: "liberada", rotulo: "Liberadas", testa: (c) => c.situacao === "liberada" },
];

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export type FiltrosPanorama = { obra: string | null; situacao: FiltroSituacao; area: Area | null; busca: string };

export function filtrar(lista: ContratacaoPanorama[], f: FiltrosPanorama): ContratacaoPanorama[] {
  const testa = SITUACOES.find((s) => s.chave === f.situacao)?.testa ?? (() => true);
  const q = semAcento(f.busca.trim());
  return lista.filter(
    (c) =>
      (!f.obra || c.obraId === f.obra) &&
      testa(c) &&
      (!f.area || passosAtuais(c).some((p) => p.area === f.area)) &&
      (!q || semAcento([c.servico, c.fornecedor ?? "", c.codigo, c.sienge ?? ""].join(" ")).includes(q)),
  );
}

/** Ordem na lista de cada obra: atrasadas, urgentes, vencendo, o resto; encerradas por último. */
export function pesoNaLista(c: ContratacaoPanorama): number {
  if (c.situacao !== "em_andamento") return 9;
  if (estaAtrasada(c)) return 0;
  if (c.urgente) return 1;
  const p = passoPrincipal(c);
  return p?.prazo?.tipo === "vence_hoje" || p?.prazo?.tipo === "vence_amanha" ? 2 : 3;
}

export function resumo(daObra: ContratacaoPanorama[]) {
  const andamento = daObra.filter(estaEmAndamento);
  return {
    emAndamento: andamento.length,
    obrasEmAndamento: new Set(andamento.map((c) => c.obraId)).size,
    comAtraso: andamento.filter(estaAtrasada).length,
    urgentes: andamento.filter((c) => c.urgente).length,
    vencemHoje: andamento.filter(venceHoje).length,
    liberadas: daObra.filter((c) => c.situacao === "liberada").length,
  };
}

export function contagemPorArea(daObra: ContratacaoPanorama[]): { area: Area; total: number; atrasadas: number }[] {
  const andamento = daObra.filter(estaEmAndamento);
  return AREAS.map((area) => {
    const da = andamento.filter((c) => passosAtuais(c).some((p) => p.area === area));
    return { area, total: da.length, atrasadas: da.filter((c) => passosAtuais(c).some((p) => p.area === area && p.prazo?.tipo === "atrasada")).length };
  });
}
