import "server-only";
import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { envPublico } from "@/lib/env";
import { mensagemDeErro } from "@/lib/formulario";

// Funções internas do servidor (não são ações chamáveis pelo navegador): quem chama confere o papel.

/**
 * Dá à empresa um responsável com acesso ao portal: convida o e-mail ou, se ele já for de uma
 * empresa terceirizada, só liga. Nunca liga um usuário interno. Quem chama já conferiu o papel.
 */
export async function convidarResponsavel(empresaId: string, email: string, nome: string): Promise<{ erro?: string; jaTinha?: boolean }> {
  const supabase = await criarClienteServidor();
  const { data: convite, error: erroConvite } = await criarClienteAdmin().auth.admin.inviteUserByEmail(email, {
    data: { nome, tipo: "externo" },
    redirectTo: `${envPublico.NEXT_PUBLIC_SITE_URL}/login`,
  });
  let usuarioId = convite?.user?.id;
  if (erroConvite) {
    const { data: existente } = await supabase.from("usuarios").select("id, tipo").eq("email", email).maybeSingle();
    if (!existente || existente.tipo !== "externo") {
      return { erro: "o convite não foi enviado: este e-mail já é de um usuário interno ou houve falha no envio." };
    }
    usuarioId = existente.id;
  }
  const { error } = await supabase.from("empresa_usuarios").upsert({ usuario_id: usuarioId!, empresa_id: empresaId }, { ignoreDuplicates: true });
  if (error) return { erro: mensagemDeErro(error, "o acesso não foi ligado à empresa.") };
  return { jaTinha: !!erroConvite };
}

/**
 * Depois da autorização do gerente (etapa 6): o banco já cadastrou/ligou a empresa à obra.
 * Se a empresa ainda não tem ninguém no portal, convida o e-mail do fornecedor.
 */
export async function liberarPortalDaContratacao(contratacaoId: string): Promise<string> {
  const supabase = await criarClienteServidor();
  const { data: c } = await supabase
    .from("contratacoes")
    .select("empresa_id, obras(nome), empresas_terceiras(razao_social, email)")
    .eq("id", contratacaoId)
    .maybeSingle();
  const empresa = c?.empresas_terceiras as { razao_social: string; email: string } | null;
  const obra = (c?.obras as { nome: string } | null)?.nome ?? "a obra";
  if (!c?.empresa_id || !empresa) return "Autorizado.";
  revalidatePath("/terceiros/empresas");
  const { count } = await supabase.from("empresa_usuarios").select("usuario_id", { count: "exact", head: true }).eq("empresa_id", c.empresa_id);
  if (count) return `Autorizado. ${empresa.razao_social} já tinha acesso ao portal e agora pode cadastrar a equipe para ${obra}.`;
  const r = await convidarResponsavel(c.empresa_id, empresa.email, empresa.razao_social);
  if (r.erro) return `Autorizado, mas ${r.erro} Use "Reenviar e-mail de acesso" na ficha da empresa.`;
  return r.jaTinha
    ? `Autorizado. ${empresa.razao_social} foi ligada ao acesso que ${empresa.email} já tinha.`
    : `Autorizado. Convite do portal enviado para ${empresa.email}.`;
}
