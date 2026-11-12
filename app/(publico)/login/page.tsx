import type { Metadata } from "next";
import Link from "next/link";
import { entrar } from "@/modules/acesso/acoes";
import { FormularioEntrar } from "@/components/app/formulario-entrar";

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
        <h1 className="titulo">Acesse sua conta</h1>
        <p className="mt-1.5 text-[13.5px] text-muted-foreground">Use o e-mail cadastrado no convite. Depois da senha, o sistema pede o código de verificação em duas etapas.</p>
      </div>
      {erro && (
        <p className="rounded-[10px] bg-warn-soft px-3.5 py-2.5 text-[13px] text-warn">
          {erro} <Link href="/recuperar-senha?novo=1" className="font-semibold underline">Pedir um novo link de acesso</Link>
        </p>
      )}
      <FormularioEntrar acao={entrar} proximo={proximo} />
      <Link href="/recuperar-senha" className="-mt-2 py-3 text-center text-[13.5px] font-medium text-primary">
        Esqueci minha senha
      </Link>
      <p className="text-[13px] text-muted-foreground">Sua empresa foi convidada e ainda não tem acesso? Peça ao contato de Suprimentos para reenviar o convite.</p>
    </>
  );
}
