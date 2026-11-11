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
};

export const obterUsuarioAtual = cache(async (): Promise<UsuarioAtual | null> => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  // Duas consultas: usuario_papeis tem duas ligações com usuarios (usuario_id e created_by),
  // e o embed do PostgREST fica ambíguo.
  const [{ data: linha, error: erroUsuario }, { data: papeis, error: erroPapeis }] = await Promise.all([
    supabase.from("usuarios").select("id, nome, email, tipo, ativo").eq("id", claims.sub).maybeSingle<LinhaUsuario>(),
    supabase.from("usuario_papeis").select("papel").eq("usuario_id", claims.sub),
  ]);
  if (erroUsuario || erroPapeis) throw new Error("Falha ao carregar o usuário logado.");
  if (!linha || !linha.ativo) return null;

  return {
    id: linha.id,
    nome: linha.nome,
    email: linha.email,
    tipo: linha.tipo,
    papeis: (papeis ?? []).map((p) => p.papel as string).filter(ehPapel),
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
  if (usuario.tipo !== "interno") redirect("/portal");
  return usuario;
}

export type AcessoExterno = { usuario: UsuarioAtual; empresaId: string };

/** Usuário da empresa terceirizada, com a empresa a que está ligado. */
export async function exigirExterno(): Promise<AcessoExterno> {
  const usuario = await exigirUsuario();
  if (usuario.tipo !== "externo") redirect("/painel");
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("empresa_usuarios").select("empresa_id").eq("usuario_id", usuario.id).limit(1).maybeSingle();
  if (!data) redirect("/sem-permissao");
  return { usuario, empresaId: data.empresa_id };
}

export async function exigirPapel(...papeis: Papel[]): Promise<UsuarioAtual> {
  const usuario = await exigirInterno();
  if (!temAlgumPapel(usuario.papeis, papeis)) redirect("/sem-permissao");
  return usuario;
}
