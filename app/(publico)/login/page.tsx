import type { Metadata } from "next";
import Link from "next/link";
import { entrar } from "@/modules/acesso/acoes";
import { Campo, FormularioAcesso } from "@/components/app/formulario-acesso";

export const metadata: Metadata = { title: "Entrar" };

const MENSAGENS: Record<string, string> = {
  link: "O link expirou ou já foi usado.",
};

export default async function PaginaLogin({ searchParams }: PageProps<"/login">) {
  const parametros = await searchParams;
  const proximo = typeof parametros.proximo === "string" ? parametros.proximo : "";
  const erro = typeof parametros.erro === "string" ? MENSAGENS[parametros.erro] : undefined;

  return (
    <>
      <div>
        <h1 className="subtitulo">Entrar</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">Use o e-mail do convite que você recebeu.</p>
      </div>
      {erro && (
        <p className="rounded-xl bg-warn-soft px-3.5 py-2.5 text-[13px] text-warn">
          {erro} <Link href="/recuperar-senha?novo=1" className="font-semibold underline">Pedir um novo link</Link>
        </p>
      )}
      <FormularioAcesso acao={entrar} textoBotao="Entrar">
        <input type="hidden" name="proximo" value={proximo} />
        <Campo id="email" rotulo="E-mail" tipo="email" autoComplete="username" />
        <Campo id="senha" rotulo="Senha" tipo="password" autoComplete="current-password" />
      </FormularioAcesso>
      <Link href="/recuperar-senha" className="text-center text-[13px] text-primary">
        Esqueci minha senha
      </Link>
    </>
  );
}
