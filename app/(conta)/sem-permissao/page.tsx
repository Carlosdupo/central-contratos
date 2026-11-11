import type { Metadata } from "next";
import { sair } from "@/modules/acesso/acoes";

export const metadata: Metadata = { title: "Sem permissão" };

export default function PaginaSemPermissao() {
  return (
    <>
      <div>
        <h1 className="subtitulo">Sem permissão</h1>
        <p className="mt-1 text-[13.5px] text-muted">
          Seu usuário não tem acesso a esta área. Se precisar, peça ao administrador para ajustar seus perfis.
        </p>
      </div>
      <form action={sair}>
        <button type="submit" className="botao w-full">Sair</button>
      </form>
    </>
  );
}
