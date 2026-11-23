"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirPapel } from "@/modules/acesso/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro, type EstadoFormulario } from "@/lib/formulario";
import { esquemaSolicitacaoSienge, type SolicitacaoSienge } from "@/lib/solicitacao-sienge";
import { padroesDaObra } from "@/modules/sienge/consultas";

// Quem mexe em cada obra é conferido no banco (RLS com app.pode_na_obra: coordenador ou auxiliar da obra).

const CAMINHO = "/apoio/solicitacao-sienge";

export async function criarSolicitacaoSienge(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirPapel("coordenador_obra");
  const obra = z.uuid().safeParse(dados.get("obra"));
  if (!obra.success) return { erro: "Escolha a obra." };
  const titulo = z.string().trim().min(1, "Dê um nome à solicitação (ex.: BL0087).").max(80, "Nome grande demais (até 80).").safeParse(dados.get("titulo") ?? "");
  if (!titulo.success) return { erro: titulo.error.issues[0].message };
  const padroes = await padroesDaObra(obra.data);
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("solicitacoes_sienge")
    .insert({ obra_id: obra.data, titulo: titulo.data, ...padroes })
    .select("id")
    .single();
  if (error || !data) return { erro: mensagemDeErro(error, "Não foi possível criar a solicitação.") };
  revalidatePath(CAMINHO);
  redirect(`${CAMINHO}/${data.id}`);
}

export type ResultadoSalvar = { erro?: string; ok?: string };

export async function salvarSolicitacaoSienge(id: string, solicitacao: SolicitacaoSienge): Promise<ResultadoSalvar> {
  await exigirPapel("coordenador_obra");
  if (!z.uuid().safeParse(id).success) return { erro: "Solicitação inválida." };
  const lido = esquemaSolicitacaoSienge.safeParse(solicitacao);
  if (!lido.success) return { erro: lido.error.issues[0].message };
  const { titulo, unidade_construtiva, conta_financeira, itens } = lido.data;
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("solicitacoes_sienge")
    .update({ titulo, unidade_construtiva: unidade_construtiva || null, conta_financeira: conta_financeira || null, itens })
    .eq("id", id)
    .select("id");
  if (error) return { erro: mensagemDeErro(error, "Não foi possível salvar.") };
  if (!data?.length) return { erro: "Você não tem permissão para alterar esta solicitação." };
  revalidatePath(CAMINHO);
  return { ok: "Solicitação salva." };
}

export async function excluirSolicitacaoSienge(id: string): Promise<EstadoFormulario> {
  await exigirPapel("coordenador_obra");
  if (!z.uuid().safeParse(id).success) return { erro: "Solicitação inválida." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("solicitacoes_sienge").delete().eq("id", id).select("id");
  if (error || !data?.length) return { erro: mensagemDeErro(error, "Não foi possível excluir.") };
  revalidatePath(CAMINHO);
  redirect(CAMINHO);
}
