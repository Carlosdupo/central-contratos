import "server-only";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { nomeComPapelNaObra } from "@/lib/rotulo-usuario";
import { diasNaColuna } from "@/lib/negociacoes";

export type ItemNegociacao = {
  id: string;
  obraId: string;
  obra: string;
  titulo: string;
  coluna: string;
  tipo: "nova" | "aditivo";
  atividades: string | null;
  foraDaMatriz: boolean;
  empresa: string | null;
  valorEstimado: number | null;
  valorNegociado: number | null;
  observacao: string | null;
  autor: string;
  dias: number;
  contratacao: { id: string; codigo: string } | null;
  podeEditar: boolean;
};

// Quadro das obras que a pessoa vê (a RLS filtra). Edita quem é coordenador ou auxiliar da obra.
export async function quadroDeNegociacoes(usuarioId: string) {
  const supabase = await criarClienteServidor();
  const [{ data: itens }, { data: obras }, { data: minhas }] = await Promise.all([
    supabase.from("negociacoes").select("*").order("movido_em", { ascending: false }),
    supabase.from("obras").select("id, nome").eq("ativa", true).order("nome"),
    supabase.from("usuario_obras").select("obra_id").eq("usuario_id", usuarioId),
  ]);
  const lista = itens ?? [];
  const nomeObra = new Map((obras ?? []).map((o) => [o.id, o.nome]));
  const editaveis = new Set((minhas ?? []).map((m) => m.obra_id));

  const autores = [...new Set(lista.map((i) => i.criado_por))];
  const ctIds = lista.map((i) => i.contratacao_id).filter((x): x is string => !!x);
  // A RLS só deixa cada um ler o próprio vínculo de obra; o papel de quem anotou é lido no servidor, só para estes autores.
  const admin = criarClienteAdmin();
  const [{ data: pessoas }, { data: vinculos }, { data: cts }] = await Promise.all([
    autores.length ? admin.from("usuarios").select("id, nome").in("id", autores) : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
    autores.length
      ? admin.from("usuario_obras").select("usuario_id, obra_id, nivel").in("usuario_id", autores)
      : Promise.resolve({ data: [] as { usuario_id: string; obra_id: string; nivel: string }[] }),
    ctIds.length ? supabase.from("contratacoes").select("id, codigo").in("id", ctIds) : Promise.resolve({ data: [] as { id: string; codigo: string }[] }),
  ]);
  const nome = new Map((pessoas ?? []).map((p) => [p.id, p.nome]));
  const nivel = new Map((vinculos ?? []).map((v) => [`${v.usuario_id}:${v.obra_id}`, v.nivel]));
  const codigo = new Map((cts ?? []).map((c) => [c.id, c.codigo]));
  const agora = new Date();

  const resultado: ItemNegociacao[] = lista.map((i) => ({
    id: i.id,
    obraId: i.obra_id,
    obra: nomeObra.get(i.obra_id) ?? "Obra",
    titulo: i.titulo,
    coluna: i.coluna,
    tipo: i.tipo === "aditivo" ? "aditivo" : "nova",
    atividades: i.atividades,
    foraDaMatriz: i.fora_da_matriz,
    empresa: i.empresa,
    valorEstimado: i.valor_estimado == null ? null : Number(i.valor_estimado),
    valorNegociado: i.valor_negociado == null ? null : Number(i.valor_negociado),
    observacao: i.observacao,
    autor: nomeComPapelNaObra(nome.get(i.criado_por) ?? "—", nivel.get(`${i.criado_por}:${i.obra_id}`)),
    dias: diasNaColuna(i.movido_em, agora),
    contratacao: i.contratacao_id ? { id: i.contratacao_id, codigo: codigo.get(i.contratacao_id) ?? "Contratação" } : null,
    podeEditar: editaveis.has(i.obra_id),
  }));
  const comItens = new Set(lista.map((i) => i.obra_id));
  return {
    itens: resultado,
    obrasDoFiltro: (obras ?? []).filter((o) => editaveis.has(o.id) || comItens.has(o.id)),
    obrasQueEdita: (obras ?? []).filter((o) => editaveis.has(o.id)),
  };
}

export type ItemParaAbertura = { id: string; obraId: string; titulo: string; aditivo: boolean; valor: number | null };

export async function itemParaAbertura(id: string): Promise<ItemParaAbertura | null> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("negociacoes").select("id, obra_id, titulo, tipo, valor_estimado, valor_negociado, contratacao_id").eq("id", id).maybeSingle();
  if (!data || data.contratacao_id) return null;
  const valor = data.valor_negociado ?? data.valor_estimado;
  return { id: data.id, obraId: data.obra_id, titulo: data.titulo, aditivo: data.tipo === "aditivo", valor: valor == null ? null : Number(valor) };
}
