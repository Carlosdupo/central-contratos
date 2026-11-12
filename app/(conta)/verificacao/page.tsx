import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/modules/acesso/sessao";
import { VerificacaoDuasEtapas } from "./verificacao-duas-etapas";

export const metadata: Metadata = { title: "Verificação em duas etapas" };

export default async function PaginaVerificacao() {
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect("/login");
  if (usuario.verificado) redirect("/");

  return (
    <>
      <div>
        <h1 className="titulo">Verificação em duas etapas</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Seu perfil acessa dados sensíveis. Use um aplicativo autenticador (Google Authenticator, Microsoft
          Authenticator ou similar) para gerar o código de 6 dígitos.
        </p>
      </div>
      <VerificacaoDuasEtapas />
    </>
  );
}
