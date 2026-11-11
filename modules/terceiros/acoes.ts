"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirExterno, exigirPapel, obterUsuarioAtual } from "@/modules/acesso/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { cnpjValido, cpfValido, somenteDigitos } from "@/lib/documentos-br";
import { mensagemDeErro, type EstadoFormulario } from "@/lib/formulario";
import { reenviarAcesso } from "@/modules/acesso/reenvio";
import { convidarResponsavel } from "./acesso-portal";
import { documentosDaEmpresa, documentosDoVinculo } from "./consultas";
import { podeEnviarParaAnalise } from "./dominio/documentos";

const BUCKET = "documentos";
const TAMANHO_MAXIMO = 10 * 1024 * 1024;
const EXTENSAO: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

// Convite de empresa (equipe interna) ---------------------------------------------------

const esquemaEmpresa = z.object({
  razao: z.string().trim().min(2, "Informe a razão social.").max(160),
  cnpj: z.string().transform(somenteDigitos).refine(cnpjValido, "CNPJ inválido. Confira os números."),
  email: z.email("Informe um e-mail válido.").transform((e) => e.toLowerCase()),
  telefone: z.string().trim().max(30).optional(),
  obra: z.uuid("Escolha a obra."),
});

export async function convidarEmpresa(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirPapel("admin", "suprimentos", "gerente_suprimentos", "contratos");
  const lido = esquemaEmpresa.safeParse({
    razao: dados.get("razao"),
    cnpj: dados.get("cnpj") ?? "",
    email: dados.get("email"),
    telefone: dados.get("telefone") ?? undefined,
    obra: dados.get("obra"),
  });
  if (!lido.success) return { erro: lido.error.issues[0].message };
  const { razao, cnpj, email, telefone, obra } = lido.data;

  const supabase = await criarClienteServidor();
  const { data: empresa, error } = await supabase
    .from("empresas_terceiras")
    .insert({ razao_social: razao, cnpj, email, telefone: telefone || null })
    .select("id")
    .single();
  if (error) return { erro: error.code === "23505" ? "Já existe empresa com este CNPJ." : mensagemDeErro(error, "Não foi possível cadastrar a empresa.") };

  const { error: erroObra } = await supabase.from("empresa_obras").insert({ empresa_id: empresa.id, obra_id: obra });
  if (erroObra) return { erro: mensagemDeErro(erroObra, "Empresa cadastrada, mas a obra não foi ligada.") };

  const acesso = await convidarResponsavel(empresa.id, email, razao);
  revalidatePath("/terceiros/empresas");
  if (acesso.erro) return { erro: `Empresa cadastrada, mas ${acesso.erro}` };
  return { ok: acesso.jaTinha ? `Empresa cadastrada e ligada ao acesso que ${email} já tinha.` : `Empresa cadastrada. Convite enviado para ${email}.` };
}

/** Reenvia o e-mail de acesso ao portal para os responsáveis da empresa. */
export async function reenviarConviteEmpresa(empresaId: string): Promise<EstadoFormulario> {
  await exigirPapel("admin", "suprimentos", "gerente_suprimentos", "contratos");
  if (!z.uuid().safeParse(empresaId).success) return { erro: "Empresa inválida." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("empresa_usuarios").select("usuario_id").eq("empresa_id", empresaId);
  if (error) return { erro: mensagemDeErro(error, "Não foi possível carregar o acesso da empresa.") };
  if (!data.length) return { erro: "Esta empresa ainda não tem acesso ao portal." };
  const resultados = [];
  for (const { usuario_id } of data) resultados.push(await reenviarAcesso(usuario_id));
  const falha = resultados.find((r) => r.erro);
  return falha ?? { ok: resultados.map((r) => r.ok).join(" ") };
}

// Portal: arquivos (empresa, pessoa, foto, visita) ----------------------------------------

const esquemaDono = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("empresa") }),
  z.object({ tipo: z.literal("pessoa"), vinculo: z.uuid() }),
  z.object({ tipo: z.literal("foto"), vinculo: z.uuid() }),
  z.object({ tipo: z.literal("visita"), vinculo: z.uuid() }),
]);
export type DonoArquivo = z.infer<typeof esquemaDono>;

const codigo = z.string().regex(/^[a-z][a-z0-9_]*$/);

/** Pasta do arquivo no Storage, definida sempre no servidor. */
function pastaDoArquivo(empresaId: string, dono: DonoArquivo, tipoDoc: string): string {
  if (dono.tipo === "empresa") return `empresas/${empresaId}/empresa/${tipoDoc}/`;
  const sub = dono.tipo === "pessoa" ? tipoDoc : dono.tipo;
  return `empresas/${empresaId}/vinculos/${dono.vinculo}/${sub}/`;
}

/** Confere (pela RLS) que o vínculo é da empresa do usuário logado. */
async function vinculoDaEmpresa(vinculo: string, empresaId: string): Promise<boolean> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("vinculos").select("id").eq("id", vinculo).eq("empresa_id", empresaId).maybeSingle();
  return !!data;
}

const esquemaPreparo = z.object({
  dono: esquemaDono,
  tipoDoc: codigo,
  mime: z.enum(["application/pdf", "image/jpeg", "image/png"], { message: "Envie PDF, JPG ou PNG." }),
  tamanho: z.number().int().positive().max(TAMANHO_MAXIMO, "O arquivo passa de 10 MB."),
});

export type PreparoEnvio = { erro?: string; caminho?: string; token?: string };

/** Gera a URL assinada para o navegador enviar o arquivo direto ao Storage, num caminho definido aqui. */
export async function prepararEnvioArquivo(entrada: z.input<typeof esquemaPreparo>): Promise<PreparoEnvio> {
  const { empresaId } = await exigirExterno();
  const lido = esquemaPreparo.safeParse(entrada);
  if (!lido.success) return { erro: lido.error.issues[0].message };
  const { dono, tipoDoc, mime } = lido.data;
  if (dono.tipo !== "empresa" && !(await vinculoDaEmpresa(dono.vinculo, empresaId))) return { erro: "Pessoa não encontrada." };
  if (dono.tipo === "foto" && mime === "application/pdf") return { erro: "A foto precisa ser JPG ou PNG." };

  const caminho = `${pastaDoArquivo(empresaId, dono, tipoDoc)}${randomUUID()}.${EXTENSAO[mime]}`;
  const { data, error } = await criarClienteAdmin().storage.from(BUCKET).createSignedUploadUrl(caminho);
  if (error) return { erro: "Não foi possível preparar o envio. Tente de novo." };
  return { caminho: data.path, token: data.token };
}

const esquemaConfirmacao = z.object({
  dono: esquemaDono,
  tipoDoc: codigo,
  caminho: z.string().max(300),
  nome: z.string().trim().min(1).max(200),
  dataEmissao: z.iso.date().optional(),
  dataValidade: z.iso.date().optional(),
  competencia: z.iso.date().optional(),
  obra: z.uuid().optional(),
  dataVisita: z.iso.date().optional(),
});

// Assinatura dos primeiros bytes: confere se o conteúdo é mesmo PDF/JPG/PNG.
function tipoReal(bytes: Uint8Array): string | null {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  return null;
}

/** Depois do upload: confere tamanho e conteúdo real, calcula o hash e registra no banco. */
export async function confirmarArquivo(entrada: z.input<typeof esquemaConfirmacao>): Promise<EstadoFormulario> {
  const { empresaId } = await exigirExterno();
  const lido = esquemaConfirmacao.safeParse(entrada);
  if (!lido.success) return { erro: "Dados do envio inválidos." };
  const { dono, tipoDoc, caminho, nome, dataEmissao, dataValidade, competencia, obra, dataVisita } = lido.data;
  if (!caminho.startsWith(pastaDoArquivo(empresaId, dono, tipoDoc))) return { erro: "Caminho de arquivo inválido." };

  const admin = criarClienteAdmin();
  const descartar = () => admin.storage.from(BUCKET).remove([caminho]);
  const { data: arquivo, error } = await admin.storage.from(BUCKET).download(caminho);
  if (error || !arquivo) return { erro: "O arquivo não chegou. Envie de novo." };

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const mime = tipoReal(bytes);
  if (!mime || bytes.byteLength > TAMANHO_MAXIMO || (dono.tipo === "foto" && mime === "application/pdf")) {
    await descartar();
    return { erro: "O conteúdo não é um arquivo válido do tipo pedido, ou passa de 10 MB." };
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const supabase = await criarClienteServidor();
  const { error: erroRegistro } =
    dono.tipo === "empresa"
      ? await supabase.rpc("registrar_arquivo_empresa", {
          p_empresa: empresaId, p_tipo: tipoDoc, p_storage_path: caminho, p_nome: nome, p_mime: mime,
          p_tamanho: bytes.byteLength, p_sha256: sha256, p_data_emissao: dataEmissao, p_data_validade: dataValidade, p_competencia: competencia,
        })
      : dono.tipo === "pessoa"
        ? await supabase.rpc("registrar_arquivo_pessoa", {
            p_vinculo: dono.vinculo, p_tipo: tipoDoc, p_storage_path: caminho, p_nome: nome, p_mime: mime,
            p_tamanho: bytes.byteLength, p_sha256: sha256, p_data_emissao: dataEmissao, p_data_validade: dataValidade,
          })
        : dono.tipo === "foto"
          ? await supabase.rpc("registrar_foto_pessoa", { p_vinculo: dono.vinculo, p_storage_path: caminho })
          : obra && dataVisita
            ? await supabase.rpc("solicitar_visita", { p_vinculo: dono.vinculo, p_obra: obra, p_data: dataVisita, p_storage_path: caminho, p_nome: nome })
            : { error: { message: "Informe a obra e a data da visita." } as { code?: string; message: string } };
  if (erroRegistro) {
    await descartar();
    return { erro: mensagemDeErro(erroRegistro, erroRegistro.message ?? "Não foi possível registrar.") };
  }
  revalidatePath("/portal", "layout");
  return { ok: dono.tipo === "visita" ? "Pedido de visita enviado ao RH." : "Arquivo registrado." };
}

// Portal: equipe ----------------------------------------------------------------------------

const esquemaPessoa = z.object({
  tipo: z.enum(["funcionario", "socio_diario", "socio_esporadico"], { message: "Escolha o tipo." }),
  nome: z.string().trim().min(3, "Informe o nome completo.").max(120),
  cpf: z.string().transform(somenteDigitos).refine(cpfValido, "CPF inválido. Confira os números."),
  telefone: z.string().trim().max(30).optional(),
  funcao: z.string().trim().max(80).optional(),
  eletricidade: z.boolean(),
  obra: z.uuid("Escolha a obra."),
});

export async function cadastrarPessoa(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const { empresaId } = await exigirExterno();
  const lido = esquemaPessoa.safeParse({
    tipo: dados.get("tipo"),
    nome: dados.get("nome"),
    cpf: dados.get("cpf") ?? "",
    telefone: dados.get("telefone") ?? undefined,
    funcao: dados.get("funcao") ?? undefined,
    eletricidade: dados.get("eletricidade") === "on",
    obra: dados.get("obra"),
  });
  if (!lido.success) return { erro: lido.error.issues[0].message };
  const p = lido.data;
  const funcao = p.tipo === "funcionario" ? p.funcao : "Sócio";
  if (!funcao || funcao.length < 2) return { erro: "Informe a função." };

  const supabase = await criarClienteServidor();
  const { data: vinculo, error } = await supabase.rpc("cadastrar_pessoa", {
    p_empresa: empresaId, p_cpf: p.cpf, p_nome: p.nome, p_telefone: p.telefone ?? "", p_tipo: p.tipo,
    p_funcao: funcao, p_eletricidade: p.eletricidade, p_obra: p.obra,
  });
  if (error || !vinculo) return { erro: mensagemDeErro(error, "Não foi possível cadastrar.") };
  revalidatePath("/portal", "layout");
  redirect(`/portal/equipe/${vinculo}`);
}

export async function enviarDocumentosPessoa(vinculo: string): Promise<EstadoFormulario> {
  const { empresaId } = await exigirExterno();
  if (!z.uuid().safeParse(vinculo).success || !(await vinculoDaEmpresa(vinculo, empresaId))) return { erro: "Pessoa não encontrada." };
  const dados = await documentosDoVinculo(vinculo);
  if (!dados || !podeEnviarParaAnalise(dados.itens.map((i) => i.estado))) return { erro: "Anexe todos os documentos pendentes antes de enviar." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("enviar_documentos_pessoa", { p_vinculo: vinculo });
  if (error) return { erro: mensagemDeErro(error, "Não foi possível enviar.") };
  revalidatePath("/portal", "layout");
  return { ok: "Enviado para o RH. O prazo de análise começa agora." };
}

export async function salvarTextoEmpresa(tipo: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const { empresaId } = await exigirExterno();
  const texto = String(dados.get("texto") ?? "").trim();
  if (texto.length < 3) return { erro: "Preencha o nome e o telefone." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("salvar_texto_empresa", { p_empresa: empresaId, p_tipo: tipo, p_texto: texto.slice(0, 300) });
  if (error) return { erro: mensagemDeErro(error, "Não foi possível salvar.") };
  revalidatePath("/portal", "layout");
  return { ok: "Salvo." };
}

export async function enviarDocumentosEmpresa(): Promise<EstadoFormulario> {
  const { empresaId } = await exigirExterno();
  const { itens } = await documentosDaEmpresa(empresaId);
  if (!podeEnviarParaAnalise(itens.map((i) => i.estado))) return { erro: "Anexe todos os documentos pendentes antes de enviar." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("enviar_documentos_empresa", { p_empresa: empresaId });
  if (error) return { erro: mensagemDeErro(error, "Não foi possível enviar.") };
  revalidatePath("/portal", "layout");
  return { ok: "Enviado para o RH. O prazo de análise começa agora." };
}

// Abrir arquivo (interno ou a própria empresa) ----------------------------------------------

/** Registra a abertura (LGPD) e devolve um link temporário de 60 segundos. */
export async function abrirArquivo(arquivoId: string): Promise<{ url?: string; erro?: string }> {
  const usuario = await obterUsuarioAtual();
  if (!usuario || !z.uuid().safeParse(arquivoId).success) return { erro: "Arquivo inválido." };
  const supabase = await criarClienteServidor();
  const { data: caminho, error } = await supabase.rpc("registrar_acesso_arquivo", { p_arquivo: arquivoId });
  if (error || !caminho) return { erro: "Você não tem permissão para abrir este arquivo." };
  const { data } = await criarClienteAdmin().storage.from(BUCKET).createSignedUrl(caminho, 60, { download: true });
  return data ? { url: data.signedUrl } : { erro: "Não foi possível abrir o arquivo." };
}
