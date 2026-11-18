"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirPapel } from "@/modules/acesso/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { numeroOuNulo } from "@/lib/valor-reais";
import { mensagemDeErro, type EstadoFormulario } from "@/lib/formulario";
import { ehColunaMovivel } from "@/lib/negociacoes";

// Quem mexe em cada obra é conferido no banco (RLS com app.pode_na_obra; o gatilho segura obra, autor e contratação).

const CAMINHO = "/contratacoes/negociacoes";
const opcional = (max: number, msg: string) => z.string().trim().max(max, msg).transform((v) => v || null);

const esquemaItem = z.object({
  titulo: z.string().trim().min(3, "Descreva o que negociar.").max(200, "Descrição grande demais."),
  coluna: z.string().refine(ehColunaMovivel, "Escolha a situação."),
  tipo: z.enum(["nova", "aditivo"], { message: "Escolha Nova contratação ou Aditivo." }),
  atividades: opcional(300, "Atividades: texto grande demais."),
  empresa: opcional(160, "Nome da empresa grande demais."),
  observacao: opcional(600, "Observação grande demais."),
  valor_estimado: z.number({ message: "Valor estimado inválido." }).positive("Valor estimado inválido.").max(1e11).nullable(),
  valor_negociado: z.number({ message: "Valor negociado inválido." }).positive("Valor negociado inválido.").max(1e11).nullable(),
  fora_da_matriz: z.boolean(),
});

const valor = (v: FormDataEntryValue | null) => {
  const n = numeroOuNulo(v);
  return n == null || Number.isNaN(n) ? (String(v ?? "").trim() ? NaN : null) : n;
};

const lerItem = (dados: FormData) =>
  esquemaItem.safeParse({
    titulo: dados.get("titulo") ?? "",
    coluna: dados.get("coluna") ?? "a_negociar",
    tipo: dados.get("tipo") ?? "nova",
    atividades: dados.get("atividades") ?? "",
    empresa: dados.get("empresa") ?? "",
    observacao: dados.get("observacao") ?? "",
    valor_estimado: valor(dados.get("valor_estimado")),
    valor_negociado: valor(dados.get("valor_negociado")),
    fora_da_matriz: dados.get("fora_da_matriz") === "on",
  });

export async function criarItemNegociacao(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirPapel("coordenador_obra");
  const obra = z.uuid().safeParse(dados.get("obra"));
  if (!obra.success) return { erro: "Escolha a obra." };
  const lido = lerItem(dados);
  if (!lido.success) return { erro: lido.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("negociacoes").insert({ obra_id: obra.data, ...lido.data });
  if (error) return { erro: mensagemDeErro(error, "Não foi possível adicionar o item.") };
  revalidatePath(CAMINHO);
  return { ok: "Item adicionado ao quadro." };
}

export async function salvarItemNegociacao(id: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirPapel("coordenador_obra");
  if (!z.uuid().safeParse(id).success) return { erro: "Item inválido." };
  const lido = lerItem(dados);
  if (!lido.success) return { erro: lido.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("negociacoes").update(lido.data).eq("id", id).select("id");
  if (error) return { erro: mensagemDeErro(error, "Não foi possível salvar o item.") };
  if (!data?.length) return { erro: "Você não pode alterar este item." };
  revalidatePath(CAMINHO);
  return { ok: "Item salvo." };
}

export async function moverItemNegociacao(id: string, coluna: string): Promise<EstadoFormulario> {
  await exigirPapel("coordenador_obra");
  if (!z.uuid().safeParse(id).success || !ehColunaMovivel(coluna)) return { erro: "Dados inválidos." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("negociacoes").update({ coluna }).eq("id", id).select("id");
  if (error) return { erro: mensagemDeErro(error, "Não foi possível mover o item.") };
  if (!data?.length) return { erro: "Você não pode mover este item." };
  revalidatePath(CAMINHO);
  return { ok: "Item movido." };
}

export async function excluirItemNegociacao(id: string): Promise<EstadoFormulario> {
  await exigirPapel("coordenador_obra");
  if (!z.uuid().safeParse(id).success) return { erro: "Item inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("negociacoes").delete().eq("id", id).select("id");
  if (error) return { erro: mensagemDeErro(error, "Não foi possível excluir o item.") };
  if (!data?.length) return { erro: "Você não pode excluir este item." };
  revalidatePath(CAMINHO);
  return { ok: "Item excluído." };
}
