"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirExterno, exigirPapel, obterUsuarioAtual } from "@/modules/acesso/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { envPublico } from "@/lib/env";
import { cnpjValido, somenteDigitos } from "@/lib/documentos-br";
import { mensagemDeErro, type EstadoFormulario } from "@/lib/formulario";
import { documentosDaEmpresa } from "./consultas";
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

  // Responsável da empresa: usuário externo convidado por e-mail.
  const { data: convite, error: erroConvite } = await criarClienteAdmin().auth.admin.inviteUserByEmail(email, {
    data: { nome: razao, tipo: "externo" },
    redirectTo: `${envPublico.NEXT_PUBLIC_SITE_URL}/login`,
  });
  let usuarioId = convite?.user?.id;
  if (erroConvite) {
    // E-mail já cadastrado: só liga se for de outra empresa terceirizada (nunca um usuário interno).
    const { data: existente } = await supabase.from("usuarios").select("id, tipo").eq("email", email).maybeSingle();
    if (!existente || existente.tipo !== "externo") {
      revalidatePath("/terceiros/empresas");
      return { erro: "Empresa cadastrada, mas o convite não foi enviado: este e-mail já é de um usuário interno ou houve falha no envio." };
    }
    usuarioId = existente.id;
  }
  const { error: erroVinculo } = await supabase.from("empresa_usuarios").insert({ usuario_id: usuarioId!, empresa_id: empresa.id });
  revalidatePath("/terceiros/empresas");
  if (erroVinculo) return { erro: mensagemDeErro(erroVinculo, "Convite enviado, mas o acesso não foi ligado à empresa.") };
  return { ok: erroConvite ? `Empresa cadastrada e ligada ao acesso que ${email} já tinha.` : `Empresa cadastrada. Convite enviado para ${email}.` };
}

// Portal: arquivos da empresa ------------------------------------------------------------

const esquemaPreparo = z.object({
  tipo: z.string().regex(/^[a-z][a-z0-9_]*$/),
  mime: z.enum(["application/pdf", "image/jpeg", "image/png"], { message: "Envie PDF, JPG ou PNG." }),
  tamanho: z.number().int().positive().max(TAMANHO_MAXIMO, "O arquivo passa de 10 MB."),
});

export type PreparoEnvio = { erro?: string; caminho?: string; token?: string };

/** Gera a URL assinada para o navegador enviar o arquivo direto ao Storage, num caminho definido aqui. */
export async function prepararEnvioArquivo(entrada: { tipo: string; mime: string; tamanho: number }): Promise<PreparoEnvio> {
  const { empresaId } = await exigirExterno();
  const lido = esquemaPreparo.safeParse(entrada);
  if (!lido.success) return { erro: lido.error.issues[0].message };
  const caminho = `empresas/${empresaId}/empresa/${lido.data.tipo}/${randomUUID()}.${EXTENSAO[lido.data.mime]}`;
  const { data, error } = await criarClienteAdmin().storage.from(BUCKET).createSignedUploadUrl(caminho);
  if (error) return { erro: "Não foi possível preparar o envio. Tente de novo." };
  return { caminho: data.path, token: data.token };
}

const esquemaConfirmacao = z.object({
  tipo: z.string().regex(/^[a-z][a-z0-9_]*$/),
  caminho: z.string().max(300),
  nome: z.string().trim().min(1).max(200),
  dataEmissao: z.iso.date().optional(),
  dataValidade: z.iso.date().optional(),
  competencia: z.iso.date().optional(),
});

// Assinatura dos primeiros bytes: confere se o conteúdo é mesmo PDF/JPG/PNG.
function tipoReal(bytes: Uint8Array): string | null {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  return null;
}

/** Depois do upload: confere tamanho e conteúdo real, calcula o hash e registra a versão do documento. */
export async function confirmarArquivo(entrada: z.input<typeof esquemaConfirmacao>): Promise<EstadoFormulario> {
  const { empresaId } = await exigirExterno();
  const lido = esquemaConfirmacao.safeParse(entrada);
  if (!lido.success) return { erro: "Dados do envio inválidos." };
  const { tipo, caminho, nome, dataEmissao, dataValidade, competencia } = lido.data;
  if (!caminho.startsWith(`empresas/${empresaId}/empresa/${tipo}/`)) return { erro: "Caminho de arquivo inválido." };

  const admin = criarClienteAdmin();
  const descartar = () => admin.storage.from(BUCKET).remove([caminho]);
  const { data: arquivo, error } = await admin.storage.from(BUCKET).download(caminho);
  if (error || !arquivo) return { erro: "O arquivo não chegou. Envie de novo." };

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const mime = tipoReal(bytes);
  if (!mime || bytes.byteLength > TAMANHO_MAXIMO) {
    await descartar();
    return { erro: "O conteúdo não é um PDF, JPG ou PNG válido, ou passa de 10 MB." };
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const supabase = await criarClienteServidor();
  const { error: erroRegistro } = await supabase.rpc("registrar_arquivo_empresa", {
    p_empresa: empresaId,
    p_tipo: tipo,
    p_storage_path: caminho,
    p_nome: nome,
    p_mime: mime,
    p_tamanho: bytes.byteLength,
    p_sha256: sha256,
    p_data_emissao: dataEmissao,
    p_data_validade: dataValidade,
    p_competencia: competencia,
  });
  if (erroRegistro) {
    await descartar();
    return { erro: mensagemDeErro(erroRegistro, "Não foi possível registrar o documento.") };
  }
  revalidatePath("/portal");
  return { ok: "Documento anexado." };
}

export async function salvarTextoEmpresa(tipo: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const { empresaId } = await exigirExterno();
  const texto = String(dados.get("texto") ?? "").trim();
  if (texto.length < 3) return { erro: "Preencha o nome e o telefone." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("salvar_texto_empresa", { p_empresa: empresaId, p_tipo: tipo, p_texto: texto.slice(0, 300) });
  if (error) return { erro: mensagemDeErro(error, "Não foi possível salvar.") };
  revalidatePath("/portal");
  return { ok: "Salvo." };
}

export async function enviarDocumentosEmpresa(): Promise<EstadoFormulario> {
  const { empresaId } = await exigirExterno();
  const { itens } = await documentosDaEmpresa(empresaId);
  if (!podeEnviarParaAnalise(itens.map((i) => i.estado))) return { erro: "Anexe todos os documentos pendentes antes de enviar." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("enviar_documentos_empresa", { p_empresa: empresaId });
  if (error) return { erro: mensagemDeErro(error, "Não foi possível enviar.") };
  revalidatePath("/portal");
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
