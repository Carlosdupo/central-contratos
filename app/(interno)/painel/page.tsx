import type { Metadata } from "next";
import { exigirInterno } from "@/modules/acesso/sessao";

export const metadata: Metadata = { title: "Painel" };

export default async function PaginaPainel() {
  const usuario = await exigirInterno();
  const primeiroNome = usuario.nome.split(" ")[0];

  return (
    <>
      <div>
        <h1 className="titulo">Olá, {primeiroNome}</h1>
        <p className="mt-1.5 max-w-[66ch] text-[15px] text-muted">
          Aqui vão aparecer as contratações e os envios de documentos que dependem de você.
        </p>
      </div>
      {usuario.papeis.length === 0 && (
        <section className="painel">
          <h2 className="subtitulo">Seu usuário ainda não tem perfil</h2>
          <p className="text-[14px] text-muted">Peça ao administrador para atribuir seus perfis de acesso.</p>
        </section>
      )}
    </>
  );
}
