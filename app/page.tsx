import { redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/modules/acesso/sessao";

// Porta de entrada: equipe interna vai para o painel; empresa terceirizada, para o portal.
export default async function Inicio() {
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect("/login");
  redirect(usuario.tipo === "externo" ? "/portal" : "/painel");
}
