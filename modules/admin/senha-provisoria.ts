"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirPapel } from "@/modules/acesso/sessao";
import { dentroDoLimite } from "@/modules/acesso/limites";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { gerarSenhaProvisoria } from "@/lib/senha-provisoria";
import { lerPerfisDoFormulario } from "@/modules/admin/perfis-formulario";
import { mensagemDeErro, type EstadoFormulario } from "@/lib/formulario";

// Acesso por senha provisória, sem e-mail. Só administrador com verificação em duas etapas (exigirPapel confere).
// A senha é gerada aqui, volta UMA vez para a tela de quem gerou e não é gravada em lugar nenhum: nem no banco, nem na
// auditoria (só "gerada para fulano por sicrano"), nem em log, nem em URL. A pessoa é obrigada a trocá-la no primeiro acesso
// (app_metadata.trocar_senha, que só o servidor consegue gravar).

export type EstadoSenha = EstadoFormulario & { senha?: string; email?: string };

const LIMITE_POR_15_MIN = 15;
const MENSAGEM_LIMITE = "Muitas senhas provisórias em pouco tempo. Espere alguns minutos e tente de novo.";

const esquemaNovo = z.object({
  nome: z.string().trim().min(2, "Informe o nome completo.").max(120),
  email: z.email("Informe um e-mail válido.").transform((e) => e.toLowerCase()),
});

export async function criarUsuarioComSenhaProvisoria(_: EstadoSenha, dados: FormData): Promise<EstadoSenha> {
  const admin = await exigirPapel("admin");
  if (!(await dentroDoLimite("senha-provisoria", admin.id, LIMITE_POR_15_MIN, 900))) return { erro: MENSAGEM_LIMITE };
  const lido = esquemaNovo.safeParse({ nome: dados.get("nome"), email: dados.get("email") });
  if (!lido.success) return { erro: lido.error.issues[0].message };
  const perfis = lerPerfisDoFormulario(dados);
  if ("erro" in perfis) return perfis;
  const { papeis, obrasAuxiliar } = perfis;

  const senha = gerarSenhaProvisoria();
  const adminAuth = criarClienteAdmin().auth.admin;
  const { data, error } = await adminAuth.createUser({
    email: lido.data.email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome: lido.data.nome },
    app_metadata: { trocar_senha: true },
  });
  if (error || !data.user) {
    return { erro: /already|registered|exists/i.test(error?.message ?? "") ? "Este e-mail já tem cadastro." : "Não foi possível criar o acesso. Tente de novo em alguns minutos." };
  }
  const id = data.user.id;

  // Sem perfis ou sem auditoria, o acesso não vale: desfaz a conta (o cadastro em usuarios sai junto, por cascata).
  const desfazer = async (motivo: string): Promise<EstadoSenha> => {
    const { error: erroRemocao } = await adminAuth.deleteUser(id);
    return { erro: erroRemocao ? `${motivo} A conta foi criada: remova-a em Usuários antes de tentar de novo.` : `${motivo} O acesso foi desfeito; tente de novo.` };
  };
  const supabase = await criarClienteServidor();
  const { error: erroPapeis } = await supabase.from("usuario_papeis").insert(papeis.map((papel) => ({ usuario_id: id, papel })));
  if (erroPapeis) return desfazer(`Os perfis não foram salvos: ${mensagemDeErro(erroPapeis, "tente de novo")}.`);
  if (obrasAuxiliar.length) {
    const { error: erroObras } = await supabase.from("usuario_obras").insert(obrasAuxiliar.map((obra_id) => ({ usuario_id: id, obra_id, nivel: "auxiliar" })));
    if (erroObras) return desfazer(`As obras do Auxiliar Obra não foram salvas: ${mensagemDeErro(erroObras, "tente de novo")}.`);
  }
  const { error: erroAuditoria } = await supabase.rpc("registrar_senha_provisoria", { p_usuario: id, p_conta_nova: true });
  if (erroAuditoria) return desfazer("Não foi possível registrar na auditoria.");

  revalidatePath("/admin/usuarios");
  return { ok: `Acesso criado para ${lido.data.email}.`, senha, email: lido.data.email };
}

export async function gerarNovaSenhaProvisoria(usuarioId: string): Promise<EstadoSenha> {
  const admin = await exigirPapel("admin");
  if (!z.uuid().safeParse(usuarioId).success) return { erro: "Usuário inválido." };
  if (usuarioId === admin.id) return { erro: "Para a sua própria senha, use \"Esqueci minha senha\" ou peça a outro administrador." };
  if (!(await dentroDoLimite("senha-provisoria", admin.id, LIMITE_POR_15_MIN, 900))) return { erro: MENSAGEM_LIMITE };

  const supabase = await criarClienteServidor();
  const { data: alvo } = await supabase.from("usuarios").select("id, email, ativo, tipo").eq("id", usuarioId).maybeSingle();
  if (!alvo || alvo.tipo !== "interno") return { erro: "Usuário não encontrado." };
  if (!alvo.ativo) return { erro: "Este usuário está desativado. Reative antes de gerar a senha." };

  // A auditoria vem primeiro: se não conseguir registrar, a senha não muda.
  const { error: erroAuditoria } = await supabase.rpc("registrar_senha_provisoria", { p_usuario: usuarioId, p_conta_nova: false });
  if (erroAuditoria) return { erro: "Não foi possível registrar na auditoria. A senha não foi alterada." };

  const adminAuth = criarClienteAdmin().auth.admin;
  const { data: atual } = await adminAuth.getUserById(usuarioId);
  if (!atual?.user) return { erro: "Usuário não encontrado." };
  const senha = gerarSenhaProvisoria();
  // app_metadata vai inteiro (com a flag), porque a API pode substituir em vez de mesclar.
  const { error } = await adminAuth.updateUserById(usuarioId, { password: senha, app_metadata: { ...atual.user.app_metadata, trocar_senha: true } });
  if (error) return { erro: "Não foi possível gerar a senha. Tente de novo em alguns minutos." };

  revalidatePath(`/admin/usuarios/${usuarioId}`);
  return { ok: `Nova senha provisória gerada para ${alvo.email}.`, senha, email: alvo.email };
}
