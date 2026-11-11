"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirInterno, exigirPapel } from "@/modules/acesso/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { cnpjValido, somenteDigitos } from "@/lib/documentos-br";
import { mensagemDeErro, type EstadoFormulario } from "@/lib/formulario";
import { liberarPortalDaContratacao } from "@/modules/terceiros/acesso-portal";

// Ações do fluxo de contratação. Quem pode agir em cada etapa é conferido no banco (app.pode_agir_como),
// inclusive o coordenador só nas obras dele.

const uuid = z.uuid();
const etapa = z.number().int().min(1).max(12);
const recarregar = (id: string) => {
  revalidatePath(`/contratacoes/${id}`);
  revalidatePath("/contratacoes");
  revalidatePath("/painel");
};
const lerValor = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").trim().replace(/\./g, "").replace(",", ".");
  return t === "" ? NaN : Number(t);
};

const esquemaAbertura = z.object({
  obra: z.uuid("Escolha a obra."),
  servico: z.string().trim().min(3, "Descreva o serviço ou escopo.").max(200),
  pacote: z.string().trim().max(120).optional(),
  valor: z.number({ message: "Informe o valor orçado." }).positive("Informe o valor orçado.").max(1e11),
  tipo: z.enum(["unico", "contrato", "aditivo"], { message: "Escolha o tipo de contrato." }),
});

export async function abrirContratacao(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirPapel("coordenador_obra");
  const lido = esquemaAbertura.safeParse({
    obra: dados.get("obra"),
    servico: dados.get("servico"),
    pacote: dados.get("pacote") ?? undefined,
    valor: lerValor(dados.get("valor")),
    tipo: dados.get("tipo"),
  });
  if (!lido.success) return { erro: lido.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("abrir_contratacao", {
    p_obra: lido.data.obra, p_servico: lido.data.servico, p_pacote: lido.data.pacote ?? "", p_valor: lido.data.valor, p_tipo: lido.data.tipo,
  });
  if (error || !data) return { erro: mensagemDeErro(error, "Não foi possível abrir a contratação.") };
  recarregar(data);
  redirect(`/contratacoes/${data}`);
}

export async function marcarItem(contratacao: string, numeroEtapa: number, item: number, marcado: boolean): Promise<EstadoFormulario> {
  await exigirInterno();
  if (!uuid.safeParse(contratacao).success || !etapa.safeParse(numeroEtapa).success) return { erro: "Dados inválidos." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("marcar_item", { p_contratacao: contratacao, p_etapa: numeroEtapa, p_item: item, p_marcado: marcado });
  if (error) return { erro: mensagemDeErro(error, "Não foi possível marcar.") };
  recarregar(contratacao);
  return {};
}

export async function salvarCampoEtapa(contratacao: string, numeroEtapa: number, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirInterno();
  if (!uuid.safeParse(contratacao).success) return { erro: "Dados inválidos." };
  let valor = String(dados.get("valor") ?? "").trim().slice(0, 40);
  if (numeroEtapa === 5) {
    const n = lerValor(valor);
    if (!Number.isFinite(n) || n <= 0) return { erro: "Informe o valor negociado." };
    valor = n.toFixed(2);
  } else if (valor.length === 0) return { erro: "Preencha o campo." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("salvar_campo_etapa", { p_contratacao: contratacao, p_etapa: numeroEtapa, p_valor: valor });
  if (error) return { erro: mensagemDeErro(error, "Não foi possível salvar.") };
  recarregar(contratacao);
  return { ok: "Salvo." };
}

const esquemaCotacao = z.object({
  fornecedor: z.string().trim().min(2, "Informe o fornecedor.").max(160),
  cnpj: z.string().transform(somenteDigitos).refine(cnpjValido, "CNPJ inválido."),
  valor: z.number({ message: "Informe o valor." }).positive("Informe o valor."),
  prazo: z.number().int().min(1).max(3650).optional(),
});

export async function salvarEmailFornecedor(contratacao: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirInterno();
  if (!uuid.safeParse(contratacao).success) return { erro: "Dados inválidos." };
  const lido = z.email("Informe um e-mail válido.").safeParse(String(dados.get("email") ?? "").trim().toLowerCase());
  if (!lido.success) return { erro: lido.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("salvar_email_fornecedor", { p_contratacao: contratacao, p_email: lido.data });
  if (error) return { erro: mensagemDeErro(error, error.message ?? "Não foi possível salvar.") };
  recarregar(contratacao);
  return { ok: "E-mail salvo." };
}

export async function registrarCotacao(contratacao: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirInterno();
  if (!uuid.safeParse(contratacao).success) return { erro: "Dados inválidos." };
  const prazo = lerValor(dados.get("prazo"));
  const lido = esquemaCotacao.safeParse({
    fornecedor: dados.get("fornecedor"), cnpj: dados.get("cnpj") ?? "", valor: lerValor(dados.get("valor")), prazo: Number.isNaN(prazo) ? undefined : prazo,
  });
  if (!lido.success) return { erro: lido.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("registrar_cotacao", {
    p_contratacao: contratacao, p_fornecedor: lido.data.fornecedor, p_cnpj: lido.data.cnpj, p_valor: lido.data.valor, p_prazo: lido.data.prazo ?? 0,
  });
  if (error) return { erro: error.code === "23505" ? "Este CNPJ já tem cotação." : mensagemDeErro(error, "Não foi possível registrar.") };
  recarregar(contratacao);
  return { ok: "Cotação registrada." };
}

export async function escolherFornecedor(contratacao: string, cotacao: string): Promise<EstadoFormulario> {
  await exigirInterno();
  if (!uuid.safeParse(cotacao).success) return { erro: "Cotação inválida." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("escolher_fornecedor", { p_cotacao: cotacao });
  if (error) return { erro: mensagemDeErro(error, "Não foi possível escolher.") };
  recarregar(contratacao);
  return {};
}

export async function pularNegociacao(contratacao: string): Promise<EstadoFormulario> {
  await exigirInterno();
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("pular_negociacao", { p_contratacao: contratacao });
  if (error) return { erro: mensagemDeErro(error, "Não foi possível pular.") };
  recarregar(contratacao);
  return { ok: "Negociação deixada para Suprimentos." };
}

export async function concluirEtapa(contratacao: string, numeroEtapa: number): Promise<EstadoFormulario> {
  await exigirInterno();
  if (!uuid.safeParse(contratacao).success || !etapa.safeParse(numeroEtapa).success) return { erro: "Dados inválidos." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("concluir_etapa", { p_contratacao: contratacao, p_etapa: numeroEtapa });
  if (error) return { erro: mensagemDeErro(error, error.message ?? "Não foi possível concluir.") };
  // Autorização do gerente: o banco já ligou a empresa à obra; aqui sai o convite do portal.
  const ok = numeroEtapa === 6 ? await liberarPortalDaContratacao(contratacao) : "Etapa concluída.";
  recarregar(contratacao);
  return { ok };
}

export async function assinarContrato(contratacao: string, ordem: number): Promise<EstadoFormulario> {
  await exigirInterno();
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("assinar_contrato", { p_contratacao: contratacao, p_ordem: ordem });
  if (error) return { erro: mensagemDeErro(error, error.message ?? "Não foi possível assinar.") };
  recarregar(contratacao);
  return { ok: "Assinatura registrada." };
}

export async function cancelarContratacao(contratacao: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirPapel("admin");
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("cancelar_contratacao", { p_contratacao: contratacao, p_motivo: String(dados.get("motivo") ?? "") });
  if (error) return { erro: mensagemDeErro(error, error.message ?? "Não foi possível cancelar.") };
  recarregar(contratacao);
  return { ok: "Contratação cancelada." };
}

export async function reabrirEtapa(contratacao: string, numeroEtapa: number, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirPapel("admin");
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("reabrir_etapa", { p_contratacao: contratacao, p_etapa: numeroEtapa, p_motivo: String(dados.get("motivo") ?? "") });
  if (error) return { erro: mensagemDeErro(error, error.message ?? "Não foi possível reabrir.") };
  recarregar(contratacao);
  return { ok: "Etapa reaberta." };
}
