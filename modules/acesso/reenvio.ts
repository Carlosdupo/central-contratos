import "server-only";
import { createClient } from "@supabase/supabase-js";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { envPublico } from "@/lib/env";
import type { EstadoFormulario } from "@/lib/formulario";

// Reenvia o e-mail de acesso de um usuário. Quem chama já conferiu o papel de quem pede.
// - Ainda não entrou nenhuma vez: manda o convite de novo (o link anterior deixa de valer).
// - Já entrou antes: manda o link de criar nova senha.
// Os dois links voltam para /login, onde ProcessarLinkAcesso cria a sessão e leva para /definir-senha.
export async function reenviarAcesso(usuarioId: string): Promise<EstadoFormulario> {
  const admin = criarClienteAdmin();
  const { data, error } = await admin.auth.admin.getUserById(usuarioId);
  const email = data?.user?.email;
  if (error || !email) return { erro: "Usuário não encontrado." };
  const destino = `${envPublico.NEXT_PUBLIC_SITE_URL}/login`;

  if (!data.user.last_sign_in_at) {
    const r = await admin.auth.admin.inviteUserByEmail(email, { data: data.user.user_metadata, redirectTo: destino });
    if (!r.error) return { ok: `Convite reenviado para ${email}. O link anterior não vale mais.` };
    if (!/already|registered|exists/i.test(r.error.message)) return { erro: erroDeEnvio(r.error.message) };
    // E-mail já confirmado sem nunca ter entrado: segue para o link de nova senha.
  }

  // Cliente sem sessão e com fluxo "implicit": o link funciona em qualquer navegador
  // (o fluxo PKCE só funcionaria no navegador de quem pediu, que aqui é o administrador).
  const anonimo = createClient(envPublico.NEXT_PUBLIC_SUPABASE_URL, envPublico.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" },
  });
  const r = await anonimo.auth.resetPasswordForEmail(email, { redirectTo: destino });
  if (r.error) return { erro: erroDeEnvio(r.error.message) };
  return { ok: `Link para criar nova senha enviado para ${email}.` };
}

function erroDeEnvio(mensagem: string): string {
  return /rate|limit|seconds/i.test(mensagem)
    ? "Muitos e-mails enviados em pouco tempo. Espere alguns minutos e tente de novo."
    : "Não foi possível enviar o e-mail. Tente de novo em alguns minutos.";
}
