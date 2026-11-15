"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirInterno, exigirPapel } from "@/modules/acesso/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { cnpjValido, somenteDigitos } from "@/lib/documentos-br";
import { lerValor, numeroOuNulo } from "@/lib/valor-reais";
import { mensagemDeErro, type EstadoFormulario } from "@/lib/formulario";
import { despacharPendentes } from "@/modules/notificacoes/enviar";
import { liberarPortalDaContratacao } from "@/modules/terceiros/acesso-portal";

// Ações do fluxo de contratação. Quem pode agir em cada etapa é conferido no banco (app.pode_agir_como),
// inclusive o coordenador só nas obras dele.

const uuid = z.uuid();
const simNao = (v: FormDataEntryValue | null) => (v === "sim" ? true : v === "nao" ? false : null);
const etapa = z.number().int().min(1).max(12);
const recarregar = (id: string) => {
  after(() => despacharPendentes(10).catch(() => undefined)); // os avisos por e-mail geram-se no banco; sai depois da resposta
  revalidatePath(`/contratacoes/${id}`);
  revalidatePath("/contratacoes");
  revalidatePath("/painel");
};

const esquemaAbertura = z.object({
  obra: z.uuid("Escolha a obra."),
  matriz: z.uuid("Escolha a atividade da matriz."),
  servico: z.string().trim().min(3, "Descreva o escopo.").max(200),
  valor: z.number().positive("Informe o Valor Orçamento ou marque \"Não informar\".").max(1e11).nullable(),
  aditivo: z.boolean(),
  negociacao: z.enum(["obra", "suprimentos"], { message: "Escolha quem negocia." }),
  planejamento_item: z.uuid().optional(),
  contrato_original: z.string().trim().max(40, "Nº do contrato original grande demais.").optional(),
  urgente: z.boolean(),
  urgente_motivo: z.string().trim().max(300, "Motivo da urgência grande demais.").optional(),
  urgente_data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de necessidade.").optional(),
}).refine(
  (data) => !data.urgente || (data.urgente_motivo ?? "").length >= 5,
  { message: "Explique o motivo da urgência.", path: ["urgente_motivo"] },
).refine(
  (data) => !data.urgente || !!data.urgente_data,
  { message: "Informe a data de necessidade.", path: ["urgente_data"] },
).refine(
  (data) => !data.aditivo || !!data.contrato_original,
  { message: "Informe o nº do contrato original no Sienge.", path: ["contrato_original"] },
);

export async function abrirContratacao(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirPapel("coordenador_obra");
  const semValor = dados.get("sem_valor") === "on";
  const valor = semValor ? null : lerValor(dados.get("valor"));
  if (!semValor && Number.isNaN(valor)) return { erro: "Informe o Valor Orçamento ou marque \"Não informar\"." };
  const lido = esquemaAbertura.safeParse({
    obra: dados.get("obra"),
    matriz: dados.get("matriz"),
    servico: dados.get("servico"),
    valor,
    aditivo: dados.get("aditivo") === "on",
    negociacao: dados.get("negociacao"),
    contrato_original: dados.get("contrato_original") ?? undefined,
    planejamento_item: String(dados.get("planejamento_item") ?? "") || undefined,
    urgente: dados.get("urgente") === "on",
    urgente_motivo: String(dados.get("urgente_motivo") ?? "") || undefined,
    urgente_data: String(dados.get("urgente_data") ?? "") || undefined,
  });
  if (!lido.success) return { erro: lido.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("abrir_contratacao", {
    p_obra: lido.data.obra,
    p_servico: lido.data.servico,
    p_matriz: lido.data.matriz,
    p_valor: lido.data.valor as number,
    p_aditivo: lido.data.aditivo,
    p_negociacao: lido.data.negociacao,
    p_contrato_original: lido.data.aditivo ? lido.data.contrato_original : undefined,
    p_planejamento_item: lido.data.planejamento_item,
  });
  if (error || !data) return { erro: mensagemDeErro(error, error?.message ?? "Não foi possível abrir a contratação.") };
  if (lido.data.urgente) {
    // Os campos já foram conferidos acima; se mesmo assim falhar, a pessoa marca de novo na tela da contratação.
    await supabase.rpc("marcar_urgencia", { p_contratacao: data, p_urgente: true, p_motivo: lido.data.urgente_motivo as string, p_data: lido.data.urgente_data as string });
  }
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

// Botão único da etapa 6: o banco grava as condições e conclui a etapa na mesma transação (autorizar_contratacao),
// conferindo permissão e regras. Aqui só sai o convite do portal.
export async function autorizarContratoGerente(contratacao: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirInterno();
  if (!uuid.safeParse(contratacao).success) return { erro: "Dados inválidos." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("autorizar_contratacao", {
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
  if (error) return { erro: mensagemDeErro(error, error.message ?? "Não foi possível autorizar.") };
  const ok = await liberarPortalDaContratacao(contratacao);
  recarregar(contratacao);
  return { ok };
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
  await exigirPapel("admin", "coordenador_obra"); // o banco confere se o coordenador é da obra
  if (!uuid.safeParse(contratacao).success) return { erro: "Dados inválidos." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("cancelar_contratacao", { p_contratacao: contratacao, p_motivo: String(dados.get("motivo") ?? "") });
  if (error) return { erro: mensagemDeErro(error, error.message ?? "Não foi possível cancelar.") };
  recarregar(contratacao);
  return { ok: "Contratação cancelada." };
}

export async function devolverEtapa(contratacao: string, de: number, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirInterno();
  const para = Number(dados.get("para"));
  if (!uuid.safeParse(contratacao).success || !etapa.safeParse(de).success || !etapa.safeParse(para).success) return { erro: "Escolha para qual etapa devolver." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("devolver_etapa", { p_contratacao: contratacao, p_de: de, p_para: para, p_motivo: String(dados.get("motivo") ?? "") });
  if (error) return { erro: mensagemDeErro(error, error.message ?? "Não foi possível devolver.") };
  recarregar(contratacao);
  return { ok: "Etapa devolvida para ajuste." };
}

export async function definirFornecedorAditivo(contratacao: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirInterno();
  if (!uuid.safeParse(contratacao).success) return { erro: "Dados inválidos." };
  const lido = z
    .object({
      nome: z.string().trim().min(2, "Informe o fornecedor.").max(160),
      cnpj: z.string().transform(somenteDigitos).refine(cnpjValido, "CNPJ inválido."),
      valor: z.number({ message: "Informe o valor negociado." }).positive("Informe o valor negociado."),
    })
    .safeParse({ nome: dados.get("fornecedor"), cnpj: dados.get("cnpj") ?? "", valor: lerValor(dados.get("valor")) });
  if (!lido.success) return { erro: lido.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("definir_fornecedor_aditivo", { p_contratacao: contratacao, p_nome: lido.data.nome, p_cnpj: lido.data.cnpj, p_valor: Number(lido.data.valor.toFixed(2)) });
  if (error) return { erro: mensagemDeErro(error, error.message ?? "Não foi possível salvar.") };
  recarregar(contratacao);
  return { ok: "Fornecedor e valor salvos." };
}

export async function definirDestinoAditivo(contratacao: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirInterno();
  const destino = z.enum(["guarda_chuva", "contrato_novo"], { message: "Escolha guarda-chuva ou contrato novo." }).safeParse(dados.get("destino"));
  if (!uuid.safeParse(contratacao).success || !destino.success) return { erro: destino.success ? "Dados inválidos." : destino.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("definir_destino_aditivo", { p_contratacao: contratacao, p_destino: destino.data });
  if (error) return { erro: mensagemDeErro(error, error.message ?? "Não foi possível salvar.") };
  recarregar(contratacao);
  return { ok: destino.data === "guarda_chuva" ? "Cabe em contrato guarda-chuva: a assinatura não se aplica." : "Contrato novo: segue para assinatura." };
}

export async function marcarUrgencia(contratacao: string, urgente: boolean, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirInterno();
  if (!uuid.safeParse(contratacao).success) return { erro: "Dados inválidos." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("marcar_urgencia", {
    p_contratacao: contratacao,
    p_urgente: urgente,
    p_motivo: urgente ? String(dados.get("motivo") ?? "") : "",
    p_data: urgente ? String(dados.get("data") ?? "") : (null as unknown as string),
  });
  if (error) return { erro: mensagemDeErro(error, error.message ?? "Não foi possível salvar a urgência.") };
  recarregar(contratacao);
  return { ok: urgente ? "Marcada como urgente. O gerente de suprimentos foi avisado." : "Urgência retirada." };
}

export async function reabrirEtapa(contratacao: string, numeroEtapa: number, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirPapel("admin");
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("reabrir_etapa", { p_contratacao: contratacao, p_etapa: numeroEtapa, p_motivo: String(dados.get("motivo") ?? "") });
  if (error) return { erro: mensagemDeErro(error, error.message ?? "Não foi possível reabrir.") };
  recarregar(contratacao);
  return { ok: "Etapa reaberta." };
}
