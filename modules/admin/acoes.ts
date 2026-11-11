"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirPapel } from "@/modules/acesso/sessao";
import { PAPEIS, type Papel } from "@/modules/acesso/papeis";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { envPublico } from "@/lib/env";
import { mensagemDeErro, type EstadoFormulario } from "@/lib/formulario";
import { ehChaveParametro, lerParametroDoFormulario, PARAMETROS_SOMENTE_LEITURA } from "./parametros";

// Todas as ações exigem papel admin com verificação em duas etapas (exigirPapel redireciona se faltar).
// A gravação usa o cliente do próprio usuário, então a RLS confere de novo (app.admin_verificado).

const uuid = z.uuid("Registro inválido.");
const papeisDoFormulario = (dados: FormData): Papel[] =>
  dados.getAll("papeis").filter((p): p is Papel => typeof p === "string" && (PAPEIS as readonly string[]).includes(p));

// Usuários ---------------------------------------------------------------------

const esquemaConvite = z.object({
  nome: z.string().trim().min(2, "Informe o nome completo.").max(120),
  email: z.email("Informe um e-mail válido.").transform((e) => e.toLowerCase()),
});

export async function convidarUsuario(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirPapel("admin");
  const lido = esquemaConvite.safeParse({ nome: dados.get("nome"), email: dados.get("email") });
  if (!lido.success) return { erro: lido.error.issues[0].message };
  const papeis = papeisDoFormulario(dados);
  if (papeis.length === 0) return { erro: "Escolha pelo menos um perfil." };

  // Convite pelo Auth precisa da chave de servidor; o papel admin já foi conferido acima.
  const { data, error } = await criarClienteAdmin().auth.admin.inviteUserByEmail(lido.data.email, {
    data: { nome: lido.data.nome },
    redirectTo: `${envPublico.NEXT_PUBLIC_SITE_URL}/login`,
  });
  if (error) {
    return { erro: /already|registered|exists/i.test(error.message) ? "Este e-mail já tem cadastro." : "Não foi possível enviar o convite. Tente de novo em alguns minutos." };
  }

  const supabase = await criarClienteServidor();
  const { error: erroPapeis } = await supabase
    .from("usuario_papeis")
    .insert(papeis.map((papel) => ({ usuario_id: data.user.id, papel })));
  revalidatePath("/admin/usuarios");
  if (erroPapeis) return { erro: `Convite enviado, mas os perfis não foram salvos: ${mensagemDeErro(erroPapeis, "tente pela tela do usuário")}.` };
  return { ok: `Convite enviado para ${lido.data.email}.` };
}

export async function salvarPerfis(usuarioId: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirPapel("admin");
  if (!uuid.safeParse(usuarioId).success) return { erro: "Usuário inválido." };
  const desejados = new Set(papeisDoFormulario(dados));

  const supabase = await criarClienteServidor();
  const { data: atuais, error } = await supabase.from("usuario_papeis").select("papel").eq("usuario_id", usuarioId);
  if (error) return { erro: mensagemDeErro(error, "Não foi possível carregar os perfis.") };

  const atuaisSet = new Set(atuais.map((p) => p.papel));
  const incluir = [...desejados].filter((p) => !atuaisSet.has(p));
  const remover = [...atuaisSet].filter((p) => !desejados.has(p));

  if (incluir.length) {
    const r = await supabase.from("usuario_papeis").insert(incluir.map((papel) => ({ usuario_id: usuarioId, papel })));
    if (r.error) return { erro: mensagemDeErro(r.error, "Não foi possível incluir os perfis.") };
  }
  if (remover.length) {
    const r = await supabase.from("usuario_papeis").delete().eq("usuario_id", usuarioId).in("papel", remover);
    if (r.error) return { erro: mensagemDeErro(r.error, "Não foi possível remover os perfis.") };
  }
  revalidatePath(`/admin/usuarios/${usuarioId}`);
  revalidatePath("/admin/usuarios");
  return { ok: "Perfis salvos." };
}

export async function salvarObrasDoUsuario(usuarioId: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirPapel("admin");
  if (!uuid.safeParse(usuarioId).success) return { erro: "Usuário inválido." };
  const desejadas = new Set(dados.getAll("obras").filter((o): o is string => typeof o === "string" && uuid.safeParse(o).success));

  const supabase = await criarClienteServidor();
  const { data: atuais, error } = await supabase.from("usuario_obras").select("obra_id").eq("usuario_id", usuarioId);
  if (error) return { erro: mensagemDeErro(error, "Não foi possível carregar as obras.") };

  const atuaisSet = new Set(atuais.map((o) => o.obra_id));
  const incluir = [...desejadas].filter((o) => !atuaisSet.has(o));
  const remover = [...atuaisSet].filter((o) => !desejadas.has(o));

  if (incluir.length) {
    const r = await supabase.from("usuario_obras").insert(incluir.map((obra_id) => ({ usuario_id: usuarioId, obra_id })));
    if (r.error) return { erro: mensagemDeErro(r.error, "Não foi possível ligar as obras.") };
  }
  if (remover.length) {
    const r = await supabase.from("usuario_obras").delete().eq("usuario_id", usuarioId).in("obra_id", remover);
    if (r.error) return { erro: mensagemDeErro(r.error, "Não foi possível desligar as obras.") };
  }
  revalidatePath(`/admin/usuarios/${usuarioId}`);
  return { ok: "Obras salvas." };
}

export async function alterarSituacaoUsuario(usuarioId: string, ativo: boolean): Promise<EstadoFormulario> {
  const admin = await exigirPapel("admin");
  if (!uuid.safeParse(usuarioId).success) return { erro: "Usuário inválido." };
  if (usuarioId === admin.id && !ativo) return { erro: "Você não pode desativar o próprio usuário." };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("usuarios").update({ ativo }).eq("id", usuarioId);
  if (error) return { erro: mensagemDeErro(error, "Não foi possível alterar a situação.") };

  // Bloqueia (ou libera) o login no Auth, além de marcar no cadastro.
  await criarClienteAdmin().auth.admin.updateUserById(usuarioId, { ban_duration: ativo ? "none" : "876000h" });

  revalidatePath(`/admin/usuarios/${usuarioId}`);
  revalidatePath("/admin/usuarios");
  return { ok: ativo ? "Usuário reativado." : "Usuário desativado. Ele não consegue mais entrar." };
}

// Obras -----------------------------------------------------------------------

const esquemaObra = z.object({
  codigo: z.string().trim().toUpperCase().min(1, "Informe o código.").max(20),
  nome: z.string().trim().min(2, "Informe o nome da obra.").max(120),
  cidade: z.string().trim().min(2, "Informe a cidade.").max(80),
  uf: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "UF com 2 letras, ex.: SC."),
});
const lerObra = (dados: FormData) =>
  esquemaObra.safeParse({ codigo: dados.get("codigo"), nome: dados.get("nome"), cidade: dados.get("cidade"), uf: dados.get("uf") });

export async function criarObra(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirPapel("admin");
  const lido = lerObra(dados);
  if (!lido.success) return { erro: lido.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("obras").insert(lido.data);
  if (error) return { erro: error.code === "23505" ? "Já existe uma obra com esse código." : mensagemDeErro(error, "Não foi possível salvar a obra.") };
  revalidatePath("/admin/obras");
  return { ok: `Obra ${lido.data.nome} cadastrada.` };
}

export async function atualizarObra(obraId: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirPapel("admin");
  if (!uuid.safeParse(obraId).success) return { erro: "Obra inválida." };
  const lido = lerObra(dados);
  if (!lido.success) return { erro: lido.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("obras")
    .update({ ...lido.data, ativa: dados.get("ativa") === "on" })
    .eq("id", obraId);
  if (error) return { erro: error.code === "23505" ? "Já existe uma obra com esse código." : mensagemDeErro(error, "Não foi possível salvar a obra.") };
  revalidatePath("/admin/obras");
  revalidatePath(`/admin/obras/${obraId}`);
  return { ok: "Obra salva." };
}

// Parâmetros --------------------------------------------------------------------

export async function salvarParametro(chave: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirPapel("admin");
  if (!ehChaveParametro(chave) || PARAMETROS_SOMENTE_LEITURA.includes(chave)) return { erro: "Este parâmetro não pode ser alterado." };
  const lido = lerParametroDoFormulario(chave, dados);
  if ("erro" in lido) return { erro: lido.erro };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("parametros").update({ valor: lido.valor as never }).eq("chave", chave);
  if (error) return { erro: mensagemDeErro(error, "Não foi possível salvar o parâmetro.") };
  revalidatePath("/admin/parametros");
  return { ok: "Salvo. Vale para as próximas contratações; as que estão em andamento mantêm o prazo de quando foram abertas." };
}

// Feriados --------------------------------------------------------------------

const esquemaFeriado = z
  .object({
    data: z.iso.date("Informe a data."),
    descricao: z.string().trim().min(2, "Informe a descrição.").max(120),
    abrangencia: z.enum(["nacional", "estadual", "municipal"]),
    uf: z.string().trim().toUpperCase().optional(),
    cidade: z.string().trim().optional(),
  })
  .transform((f) => ({
    ...f,
    uf: f.abrangencia === "nacional" ? null : f.uf || null,
    cidade: f.abrangencia === "municipal" ? f.cidade || null : null,
  }))
  .refine((f) => f.abrangencia === "nacional" || (f.uf && /^[A-Z]{2}$/.test(f.uf)), { message: "Informe a UF com 2 letras." })
  .refine((f) => f.abrangencia !== "municipal" || (f.cidade && f.cidade.length >= 2), { message: "Informe a cidade." });

export async function criarFeriado(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await exigirPapel("admin");
  const lido = esquemaFeriado.safeParse({
    data: dados.get("data"),
    descricao: dados.get("descricao"),
    abrangencia: dados.get("abrangencia"),
    uf: dados.get("uf") ?? undefined,
    cidade: dados.get("cidade") ?? undefined,
  });
  if (!lido.success) return { erro: lido.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("feriados").insert(lido.data);
  if (error) return { erro: error.code === "23505" ? "Esse feriado já está cadastrado." : mensagemDeErro(error, "Não foi possível salvar o feriado.") };
  revalidatePath("/admin/feriados");
  return { ok: "Feriado cadastrado." };
}

export async function excluirFeriado(feriadoId: string): Promise<EstadoFormulario> {
  await exigirPapel("admin");
  if (!uuid.safeParse(feriadoId).success) return { erro: "Feriado inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("feriados").delete().eq("id", feriadoId);
  if (error) return { erro: mensagemDeErro(error, "Não foi possível excluir o feriado.") };
  revalidatePath("/admin/feriados");
  return { ok: "Feriado excluído." };
}
