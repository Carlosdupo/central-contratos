"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirPapel } from "@/modules/acesso/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { carregarFeriados, lerParametros } from "@/lib/configuracao";
import { agoraNoFuso, formatarData } from "@/lib/datas";
import { envPublico } from "@/lib/env";
import { mensagemDeErro, type EstadoFormulario } from "@/lib/formulario";
import { despacharPendentes } from "@/modules/notificacoes/enviar";
import { detalheDoEnvio } from "./analise";
import { dataDaIntegracao } from "./dominio/integracao";
import { nomeArquivoFoto } from "./dominio/documentos";

// Análise de documentos: RH e Segurança, cada um os itens do seu tipo (o banco confere quem decide o quê). Visitas: só RH.

const uuid = z.uuid();
const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const diaPorExtenso = (data: string) => `${DIAS[new Date(`${data}T12:00:00Z`).getUTCDay()]}, ${formatarData(data)}`;
const rodape = () => `\n\nAcesse o portal: ${envPublico.NEXT_PUBLIC_SITE_URL}/portal\n\nNexus`;

export async function aprovarDocumento(itemId: string): Promise<EstadoFormulario> {
  await exigirPapel("rh", "sst");
  if (!uuid.safeParse(itemId).success) return { erro: "Item inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("decidir_documento", { p_item: itemId, p_decisao: "aprovado" });
  if (error) return { erro: mensagemDeErro(error, "Não foi possível aprovar.") };
  revalidatePath("/terceiros/analise", "layout");
  return {};
}

export async function aproveitarDocumento(origemId: string, vinculoId: string): Promise<EstadoFormulario> {
  await exigirPapel("rh", "sst");
  if (!uuid.safeParse(origemId).success || !uuid.safeParse(vinculoId).success) return { erro: "Documento inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("aproveitar_documento", { p_origem: origemId, p_vinculo: vinculoId });
  if (error) return { erro: mensagemDeErro(error, "Não foi possível aproveitar o documento.") };
  revalidatePath(`/terceiros/pessoas/${vinculoId}`);
  return { ok: "Documento aproveitado." };
}

export async function reprovarDocumento(itemId: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirPapel("rh", "sst");
  if (!uuid.safeParse(itemId).success) return { erro: "Item inválido." };
  const motivo = String(dados.get("motivo") ?? "").trim().slice(0, 300);
  if (motivo.length < 3) return { erro: "Escreva o motivo para a empresa saber o que corrigir." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("decidir_documento", { p_item: itemId, p_decisao: "reprovado", p_motivo: motivo });
  if (error) return { erro: mensagemDeErro(error, "Não foi possível reprovar.") };
  revalidatePath("/terceiros/analise", "layout");
  return {};
}

export async function concluirAnalise(envioId: string): Promise<EstadoFormulario> {
  await exigirPapel("rh", "sst");
  if (!uuid.safeParse(envioId).success) return { erro: "Envio inválido." };
  const detalhe = await detalheDoEnvio(envioId);
  if (!detalhe || detalhe.envio.situacao !== "aberto") return { erro: "Envio não encontrado ou já concluído." };
  if (detalhe.itens.some((i) => !i.decisao)) return { erro: "Decida todos os documentos antes de concluir." };

  const [parametros, feriados] = await Promise.all([lerParametros(), carregarFeriados()]);
  const integracao = dataDaIntegracao(agoraNoFuso(), parametros.horarioCorte, feriados, parametros.diasIntegracao);
  const reprovados = detalhe.itens.filter((i) => i.decisao === "reprovado");
  const pendencias = reprovados.map((i) => `- ${i.nome}: ${i.motivo}`).join("\n");
  const obras = detalhe.obras.join(", ") || "a obra";

  // O texto segue o resultado que o banco vai aplicar (mesma regra de concluir_envio).
  let assunto: string;
  let texto: string;
  const soMensal = detalhe.itens.every((i) => i.etapa === "mensal");
  const competencia = detalhe.itens.find((i) => i.competencia)?.competencia;
  const mes = competencia ? `${competencia.slice(5, 7)}/${competencia.slice(0, 4)}` : "do mês";
  const quem = detalhe.pessoa ? ` de ${detalhe.pessoa}` : "";
  if (soMensal) {
    assunto = reprovados.length ? `Documentação mensal ${mes}${quem} com pendência` : `Documentação mensal ${mes}${quem} aprovada`;
    texto = reprovados.length
      ? `A documentação mensal ${mes}${quem} tem pendências:
${pendencias}

Corrija pelo portal e envie de novo. Enquanto houver pendência, o pagamento do mês não é liberado.`
      : `A documentação mensal ${mes}${quem} foi aprovada.`;
  } else if (!detalhe.pessoa) {
    assunto = reprovados.length ? "Documentos da empresa com pendência" : "Documentos da empresa aprovados";
    texto = reprovados.length
      ? `Os documentos de ${detalhe.empresa} foram analisados e há pendências:\n${pendencias}\n\nCorrija pelo portal e envie de novo.`
      : `Os documentos de ${detalhe.empresa} foram aprovados. Quem já estava aprovado aguardando a empresa entra na integração de segurança de ${diaPorExtenso(integracao)}.`;
  } else if (reprovados.length) {
    assunto = `Documentos pendentes: ${detalhe.pessoa}`;
    texto = `Documentos pendentes de ${detalhe.pessoa}:\n${pendencias}\n\nCorrija pelo portal e envie de novo.`;
  } else if (detalhe.empresaAprovada) {
    assunto = `${detalhe.pessoa} aprovado(a) para entrar na obra`;
    texto = `${detalhe.pessoa} foi aprovado(a) para entrar na obra ${obras}. Integração de segurança: ${diaPorExtenso(integracao)}.`;
  } else {
    assunto = `${detalhe.pessoa} aprovado(a), aguardando a empresa`;
    texto = `Os documentos de ${detalhe.pessoa} foram aprovados. A liberação para a obra aguarda a aprovação dos documentos da empresa.`;
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("concluir_envio", { p_envio: envioId, p_data_integracao: integracao, p_assunto: assunto, p_texto: texto + rodape() });
  if (error) return { erro: mensagemDeErro(error, "Não foi possível concluir.") };
  after(() => despacharPendentes(5).catch(() => undefined)); // depois da resposta: não faz o usuário esperar o e-mail
  revalidatePath("/terceiros/analise", "layout");
  redirect("/terceiros/analise");
}

export async function decidirVisita(visitaId: string, aprovar: boolean, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirPapel("rh");
  if (!uuid.safeParse(visitaId).success) return { erro: "Pedido inválido." };
  const motivo = String(dados.get("motivo") ?? "").trim().slice(0, 300);
  if (!aprovar && motivo.length < 3) return { erro: "Escreva o motivo da recusa." };

  const supabase = await criarClienteServidor();
  const { data: v } = await supabase.from("visitas").select("data, obras(nome), vinculos(pessoas(nome))").eq("id", visitaId).maybeSingle();
  if (!v) return { erro: "Pedido não encontrado." };
  const pessoa = v.vinculos?.pessoas?.nome ?? "Sócio";
  const assunto = aprovar ? `Visita aprovada: ${pessoa}` : `Visita recusada: ${pessoa}`;
  const texto = aprovar
    ? `A visita de ${pessoa} à obra ${v.obras?.nome} em ${diaPorExtenso(v.data)} foi aprovada.`
    : `A visita de ${pessoa} à obra ${v.obras?.nome} em ${diaPorExtenso(v.data)} foi recusada. Motivo: ${motivo}`;
  const { error } = await supabase.rpc("decidir_visita", { p_visita: visitaId, p_aprovar: aprovar, p_motivo: motivo, p_assunto: assunto, p_texto: texto + rodape() });
  if (error) return { erro: mensagemDeErro(error, "Não foi possível registrar a decisão.") };
  after(() => despacharPendentes(5).catch(() => undefined)); // depois da resposta: não faz o usuário esperar o e-mail
  revalidatePath("/terceiros/analise", "layout");
  return { ok: aprovar ? "Visita aprovada. A empresa foi avisada." : "Visita recusada. A empresa foi avisada." };
}

// Foto do funcionário para cadastrar na catraca (RH ou Segurança). O banco confere o perfil e registra o download.
export async function baixarFotoPessoa(vinculoId: string): Promise<{ url?: string; erro?: string }> {
  await exigirPapel("rh", "sst");
  if (!uuid.safeParse(vinculoId).success) return { erro: "Pessoa inválida." };
  const supabase = await criarClienteServidor();
  const { data: v } = await supabase.from("vinculos").select("pessoas(nome)").eq("id", vinculoId).maybeSingle();
  if (!v) return { erro: "Pessoa não encontrada." };
  const { data: caminho, error } = await supabase.rpc("registrar_download_foto", { p_vinculo: vinculoId });
  if (error || !caminho) return { erro: mensagemDeErro(error, "Não foi possível baixar a foto.") };
  const { data: link } = await criarClienteAdmin()
    .storage.from("documentos")
    .createSignedUrl(caminho, 60, { download: nomeArquivoFoto(v.pessoas?.nome ?? "foto", caminho) });
  return link ? { url: link.signedUrl } : { erro: "Não foi possível baixar a foto." };
}

/** Documento com foto anexado ao pedido de visita (só RH). */
export async function abrirDocumentoDaVisita(visitaId: string): Promise<{ url?: string; erro?: string }> {
  await exigirPapel("rh");
  if (!uuid.safeParse(visitaId).success) return { erro: "Pedido inválido." };
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("visitas").select("documento_foto_path").eq("id", visitaId).maybeSingle();
  if (!data) return { erro: "Pedido não encontrado." };
  const { data: link } = await criarClienteAdmin().storage.from("documentos").createSignedUrl(data.documento_foto_path, 60);
  return link ? { url: link.signedUrl } : { erro: "Não foi possível abrir." };
}
