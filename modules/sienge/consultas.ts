import "server-only";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { esquemaItemSienge, totalDoItem, type ItemSienge, type ServicoEap } from "@/lib/solicitacao-sienge";

export type ResumoSolicitacao = { id: string; obraId: string; obra: string; titulo: string; itens: number; total: number; atualizadoEm: string; autor: string };

export type SolicitacaoCompleta = {
  id: string;
  obraId: string;
  obra: string;
  titulo: string;
  unidadeConstrutiva: string;
  contaFinanceira: string;
  itens: ItemSienge[];
  eap: ServicoEap[];
  podeEditar: boolean;
  /** Último código do serviço usado por referência da EAP nas solicitações da obra (para preencher o item novo). */
  codigosAnteriores: Record<string, string>;
};

/** Itens gravados que não passam no formato atual são deixados de fora (não quebram a tela nem o CSV). */
export function lerItensGravados(json: unknown): ItemSienge[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((i) => {
    const lido = esquemaItemSienge.safeParse(i);
    return lido.success ? [lido.data] : [];
  });
}

export async function listaDeSolicitacoes(usuarioId: string) {
  const supabase = await criarClienteServidor();
  const [{ data: lista }, { data: obras }, { data: minhas }] = await Promise.all([
    supabase.from("solicitacoes_sienge").select("id, obra_id, titulo, itens, atualizado_em, atualizado_por, criado_por").order("atualizado_em", { ascending: false }).limit(200),
    supabase.from("obras").select("id, nome").eq("ativa", true).order("nome"),
    supabase.from("usuario_obras").select("obra_id").eq("usuario_id", usuarioId),
  ]);
  const nomeObra = new Map((obras ?? []).map((o) => [o.id, o.nome]));
  const editaveis = new Set((minhas ?? []).map((m) => m.obra_id));
  const autores = [...new Set((lista ?? []).map((s) => s.atualizado_por ?? s.criado_por))];
  // A RLS só deixa cada um ler o próprio cadastro; o nome de quem alterou é lido no servidor, só para estes autores.
  const { data: pessoas } = autores.length ? await criarClienteAdmin().from("usuarios").select("id, nome").in("id", autores) : { data: [] };
  const nome = new Map((pessoas ?? []).map((p) => [p.id, p.nome]));
  const resumos: ResumoSolicitacao[] = (lista ?? []).map((s) => {
    const itens = lerItensGravados(s.itens);
    return {
      id: s.id,
      obraId: s.obra_id,
      obra: nomeObra.get(s.obra_id) ?? "Obra",
      titulo: s.titulo,
      itens: itens.length,
      total: itens.reduce((t, i) => t + totalDoItem(i), 0),
      atualizadoEm: s.atualizado_em,
      autor: nome.get(s.atualizado_por ?? s.criado_por) ?? "—",
    };
  });
  return { resumos, obrasQueEdita: (obras ?? []).filter((o) => editaveis.has(o.id)) };
}

export async function solicitacaoCompleta(id: string, usuarioId: string): Promise<SolicitacaoCompleta | null> {
  const supabase = await criarClienteServidor();
  const { data: s } = await supabase.from("solicitacoes_sienge").select("*").eq("id", id).maybeSingle();
  if (!s) return null;
  const [{ data: obra }, { data: eap }, { data: vinculo }, { data: anteriores }] = await Promise.all([
    supabase.from("obras").select("nome").eq("id", s.obra_id).maybeSingle(),
    supabase.from("obra_eap").select("referencia, descricao, nivel").eq("obra_id", s.obra_id).order("ordem"),
    supabase.from("usuario_obras").select("obra_id").eq("usuario_id", usuarioId).eq("obra_id", s.obra_id).maybeSingle(),
    supabase.from("solicitacoes_sienge").select("itens").eq("obra_id", s.obra_id).neq("id", id).order("atualizado_em", { ascending: true }).limit(30),
  ]);
  const codigosAnteriores: Record<string, string> = {};
  for (const item of [...(anteriores ?? []).flatMap((a) => lerItensGravados(a.itens)), ...lerItensGravados(s.itens)]) {
    if (item.codigo_servico) codigosAnteriores[item.referencia] = item.codigo_servico;
  }
  return {
    id: s.id,
    obraId: s.obra_id,
    obra: obra?.nome ?? "Obra",
    titulo: s.titulo,
    unidadeConstrutiva: s.unidade_construtiva ?? "",
    contaFinanceira: s.conta_financeira ?? "",
    itens: lerItensGravados(s.itens),
    eap: eap ?? [],
    podeEditar: !!vinculo,
    codigosAnteriores,
  };
}

/** Cabeçalho padrão de uma solicitação nova: o da última solicitação da obra. */
export async function padroesDaObra(obraId: string): Promise<{ unidade_construtiva: string | null; conta_financeira: string | null }> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("solicitacoes_sienge")
    .select("unidade_construtiva, conta_financeira")
    .eq("obra_id", obraId)
    .order("atualizado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { unidade_construtiva: data?.unidade_construtiva ?? null, conta_financeira: data?.conta_financeira ?? null };
}
