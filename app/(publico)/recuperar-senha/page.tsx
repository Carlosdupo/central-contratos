import type { Metadata } from "next";
import Link from "next/link";
import { pedirNovaSenha } from "@/modules/acesso/acoes";
import { Campo, FormularioAcesso } from "@/components/app/formulario-acesso";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function PaginaRecuperarSenha() {
  return (
    <>
      <div>
        <h1 className="subtitulo">Recuperar senha</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">Enviamos um link para você criar uma senha nova.</p>
      </div>
      <FormularioAcesso acao={pedirNovaSenha} textoBotao="Enviar link">
        <Campo id="email" rotulo="E-mail" tipo="email" autoComplete="username" />
      </FormularioAcesso>
      <Link href="/login" className="text-center text-[13px] text-primary">
        Voltar para o login
      </Link>
    </>
  );
}
