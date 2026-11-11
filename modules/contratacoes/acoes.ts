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
  eap: z.uuid().nullable(),
  servico: z.string().trim().min(3, "Descreva o serviço ou escopo.").max(200),
  valor: z.number().positive("Informe o valor orçado ou marque \"Não informar\".").max(1e11).nullable(),
  tipo: z.enum(["unico", "contrato", "aditivo"], { message: "Escolha o tipo de contrato." }),
  negociacao: z.enum(["obra", "suprimentos"], { message: "Escolha quem negocia." }),
});

export async function abrirContratacao(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirPapel("coordenador_obra");
  const semValor = dados.get("sem_valor") === "on";
  const valor = semValor ? null : lerValor(dados.get("valor"));
  if (!semValor && Number.isNaN(valor)) return { erro: "Informe o valor orçado ou marque \"Não informar\"." };
  const eap = dados.get("eap");
  const lido = esquemaAbertura.safeParse({
    obra: dados.get("obra"),
    eap: typeof eap === "string" && eap ? eap : null,
    servico: dados.get("servico"),
    valor,
    tipo: dados.get("tipo"),
    negociacao: dados.get("negociacao"),
  });
  if (!lido.success) return { erro: lido.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("abrir_contratacao", {
    p_obra: lido.data.obra,
    p_servico: lido.data.servico,
    p_eap_item: lido.data.eap as string,
    p_valor: lido.data.valor as number,
    p_tipo: lido.data.tipo,
    p_negociacao: lido.data.negociacao,
  });
  if (error || !data) return { erro: mensagemDeErro(error, error?.message ?? "Não foi possível abrir a contratação.") };
  recarregar(data);
  redirect(`/contratacoes/${data}`);
}

export async function marcarItem(contratacao: string, numeroEtapa: number, item: number, marcado: boolean): Promise<EstadoFormulario> {
  await exigirInterno();
  if (!uuid.safeParse(contratacao).success || !etapa.safeParse(numeroEtapa).success) return { erro: "Dados inválidos." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("marcar_item", { p_contratacao: contratacao, p_etapa: numeroEtapa, p_item: item, p_marcado: marcado });
  if (error) return { erro: mensagemDeErro(error, "Não foi possível marcar.") };
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

export async function definirFornecedor(contratacao: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirInterno();
  const cotacao = String(dados.get("cotacao") ?? "");
  if (!uuid.safeParse(cotacao).success) return { erro: "Escolha a empresa." };
  const valor = lerValor(dados.get("valor"));
  if (!Number.isFinite(valor) || valor <= 0) return { erro: "Informe o valor final negociado." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("definir_fornecedor", { p_cotacao: cotacao, p_valor: Number(valor.toFixed(2)) });
  if (error) return { erro: mensagemDeErro(error, error.message ?? "Não foi possível salvar a escolha.") };
  recarregar(contratacao);
  return { ok: "Fornecedor e valor final salvos." };
}

const simNao = (v: FormDataEntryValue | null) => (v === "sim" ? true : v === "nao" ? false : null);
const numeroOuNulo = (v: FormDataEntryValue | null) => {
  const n = lerValor(v);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : null;
};

export async function salvarCondicoesGerente(contratacao: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirInterno();
  if (!uuid.safeParse(contratacao).success) return { erro: "Dados inválidos." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("salvar_condicoes_gerente", {
    p_contratacao: contratacao,
    p_permuta: simNao(dados.get("permuta")) as boolean,
    p_permuta_valor: numeroOuNulo(dados.get("permuta_valor")) as number,
    p_permuta_formato: String(dados.get("permuta_formato") ?? "").trim().slice(0, 160),
    p_fat_direto: simNao(dados.get("fat_direto")) as boolean,
    p_fat_direto_valor: numeroOuNulo(dados.get("fat_direto_valor")) as number,
    p_fat_direto_percentual: numeroOuNulo(dados.get("fat_direto_percentual")) as number,
    p_sinal: simNao(dados.get("sinal")) as boolean,
    p_sinal_valor: numeroOuNulo(dados.get("sinal_valor")) as number,
    p_caucao: String(dados.get("caucao") ?? "") || (null as unknown as string),
  });
  if (error) return { erro: mensagemDeErro(error, error.message ?? "Não foi possível salvar.") };
  recarregar(contratacao);
  return { ok: "Condições salvas." };
}

export async function novaProposta(contratacao: string, cotacao: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirInterno();
  if (!uuid.safeParse(cotacao).success) return { erro: "Cotação inválida." };
  const valor = lerValor(dados.get("valor"));
  if (!Number.isFinite(valor) || valor <= 0) return { erro: "Informe o valor da nova proposta." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("nova_proposta", { p_cotacao: cotacao, p_valor: Number(valor.toFixed(2)) });
  if (error) return { erro: mensagemDeErro(error, error.message ?? "Não foi possível registrar a proposta.") };
  recarregar(contratacao);
  return { ok: `${data}ª proposta registrada.` };
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
