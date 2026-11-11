import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ehPapel, exigeMfa, temAlgumPapel, type Papel } from "./papeis";

// Camada de acesso a dados (DAL): o único lugar que lê a sessão.
// Toda tela e toda Server Action passam por aqui antes de tocar em dados.

export type UsuarioAtual = {
  id: string;
  nome: string;
  email: string;
  tipo: "interno" | "externo";
  papeis: Papel[];
  verificado: boolean; // concluiu a verificação em duas etapas nesta sessão (aal2)
};

type LinhaUsuario = {
  id: string;
  nome: string;
  email: string;
  tipo: "interno" | "externo";
  ativo: boolean;
  usuario_papeis: { papel: string }[];
};

export const obterUsuarioAtual = cache(async (): Promise<UsuarioAtual | null> => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: linha } = await supabase
    .from("usuarios")
    .select("id, nome, email, tipo, ativo, usuario_papeis(papel)")
    .eq("id", claims.sub)
    .maybeSingle<LinhaUsuario>();
  if (!linha || !linha.ativo) return null;

  return {
    id: linha.id,
    nome: linha.nome,
    email: linha.email,
    tipo: linha.tipo,
    papeis: linha.usuario_papeis.map((p) => p.papel).filter(ehPapel),
    verificado: claims.aal === "aal2",
  };
});

/** Usuário logado e, se o papel exigir, com a verificação em duas etapas feita. */
export async function exigirUsuario(): Promise<UsuarioAtual> {
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect("/login");
  if (exigeMfa(usuario.papeis) && !usuario.verificado) redirect("/verificacao");
  return usuario;
}

export async function exigirInterno(): Promise<UsuarioAtual> {
  const usuario = await exigirUsuario();
  // O portal da empresa terceirizada chega na fase F1.
  if (usuario.tipo !== "interno") redirect("/sem-permissao");
  return usuario;
}

export async function exigirPapel(...papeis: Papel[]): Promise<UsuarioAtual> {
  const usuario = await exigirInterno();
  if (!temAlgumPapel(usuario.papeis, papeis)) redirect("/sem-permissao");
  return usuario;
}
