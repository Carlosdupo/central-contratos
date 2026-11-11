"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { envPublico } from "@/lib/env";

export type EstadoFormulario = { erro?: string; ok?: string };

// Só aceita caminhos internos, para o "proximo" não virar redirecionamento para outro site.
function destinoSeguro(valor: FormDataEntryValue | null): string {
  const caminho = typeof valor === "string" ? valor : "";
  return caminho.startsWith("/") && !caminho.startsWith("//") && !caminho.startsWith("/\\") ? caminho : "/painel";
}

const esquemaEntrar = z.object({
  email: z.email("Informe um e-mail válido."),
  senha: z.string().min(1, "Informe a senha."),
});

export async function entrar(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const lido = esquemaEntrar.safeParse({ email: dados.get("email"), senha: dados.get("senha") });
  if (!lido.success) return { erro: lido.error.issues[0].message };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: lido.data.email.toLowerCase(), password: lido.data.senha });
  // Mensagem única para não revelar se o e-mail existe.
  if (error) return { erro: "E-mail ou senha incorretos." };

  redirect(destinoSeguro(dados.get("proximo")));
}

export async function sair(): Promise<void> {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}

const esquemaEmail = z.object({ email: z.email("Informe um e-mail válido.") });

export async function pedirNovaSenha(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const lido = esquemaEmail.safeParse({ email: dados.get("email") });
  if (!lido.success) return { erro: lido.error.issues[0].message };

  const supabase = await criarClienteServidor();
  await supabase.auth.resetPasswordForEmail(lido.data.email.toLowerCase(), {
    redirectTo: `${envPublico.NEXT_PUBLIC_SITE_URL}/auth/confirmar?proximo=/definir-senha`,
  });
  // Resposta igual exista ou não a conta.
  return { ok: "Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha." };
}

// Mesma regra do Supabase Auth (config.toml): 10+ caracteres, maiúscula, minúscula e número.
const esquemaSenha = z
  .object({
    senha: z
      .string()
      .min(10, "A senha precisa ter pelo menos 10 caracteres.")
      .regex(/[a-z]/, "Inclua pelo menos uma letra minúscula.")
      .regex(/[A-Z]/, "Inclua pelo menos uma letra maiúscula.")
      .regex(/\d/, "Inclua pelo menos um número."),
    confirmacao: z.string(),
  })
  .refine((v) => v.senha === v.confirmacao, { message: "As senhas não conferem.", path: ["confirmacao"] });

export async function definirSenha(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const lido = esquemaSenha.safeParse({ senha: dados.get("senha"), confirmacao: dados.get("confirmacao") });
  if (!lido.success) return { erro: lido.error.issues[0].message };

  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { erro: "O link expirou. Peça um novo." };

  const { error } = await supabase.auth.updateUser({ password: lido.data.senha });
  if (error) return { erro: "Não foi possível salvar a senha. Tente outra." };

  redirect("/painel");
}
