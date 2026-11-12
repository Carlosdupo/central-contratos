"use server";

import { criarClienteAdmin } from "@/lib/supabase/admin";
import { reenviarAcesso } from "./reenvio";
import { redirect } from "next/navigation";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";

import type { EstadoFormulario } from "@/lib/formulario";
import { after } from "next/server";
import { destinoSeguro } from "@/lib/destino-seguro";
import { dentroDoLimite, ipDoCliente } from "./limites";

const esquemaEntrar = z.object({
  email: z.email("Informe um e-mail válido."),
  senha: z.string().min(1, "Informe a senha."),
});

export async function entrar(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const lido = esquemaEntrar.safeParse({ email: dados.get("email"), senha: dados.get("senha") });
  if (!lido.success) return { erro: lido.error.issues[0].message };

  // Limite por IP e por IP+e-mail: segura tentativa de adivinhar senha sem trancar quem digitou errado uma vez.
  const ip = await ipDoCliente();
  const [okIp, okConta] = await Promise.all([
    // Sem IP conhecido não há como separar um cliente do outro: o limite por IP não se aplica (o por conta continua).
    ip ? dentroDoLimite("login-ip", ip, 40, 15 * 60) : true,
    dentroDoLimite("login-conta", `${ip ?? "sem-ip"}|${lido.data.email}`, 8, 15 * 60),
  ]);
  if (!okIp || !okConta) return { erro: "Muitas tentativas. Espere alguns minutos e tente de novo." };

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

  // Limite por IP e por e-mail. Passou do limite, a resposta continua igual (não revela nada) e nada é enviado.
  const email = lido.data.email.toLowerCase();
  const ip = await ipDoCliente();
  const [okIp, okEmail] = await Promise.all([
    ip ? dentroDoLimite("recuperar-ip", ip, 10, 15 * 60) : true,
    dentroDoLimite("recuperar-email", email, 3, 60 * 60),
  ]);

  // O envio roda depois da resposta: o tempo de resposta é o mesmo exista a conta ou não.
  if (okIp && okEmail) {
    after(async () => {
      try {
        // Quem ainda não entrou recebe o convite de novo; quem já entrou, o link de nova senha.
        // Os links funcionam em qualquer navegador (inclusive se a pessoa abrir o e-mail no celular).
        const { data: usuario } = await criarClienteAdmin().from("usuarios").select("id, ativo").eq("email", email).maybeSingle();
        if (usuario?.ativo) await reenviarAcesso(usuario.id);
      } catch (e) {
        console.error("[recuperar-senha] falha ao reenviar acesso:", e instanceof Error ? e.message : e);
      }
    });
  }
  // Resposta igual exista ou não a conta.
  return { ok: "Se o e-mail estiver cadastrado, você vai receber um link de acesso em alguns minutos. Confira também a caixa de spam." };
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

  redirect("/");
}
