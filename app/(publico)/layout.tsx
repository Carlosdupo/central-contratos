import { Marca } from "@/components/app/logo";
import { ProcessarLinkAcesso } from "@/components/app/processar-link-acesso";

const Item = ({ titulo, texto, d }: { titulo: string; texto: string; d: string }) => (
  <li className="flex items-start gap-3.5">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0">
      <path d={d} />
    </svg>
    <span>
      <strong className="block">{titulo}</strong>
      <span className="text-[13px]">{texto}</span>
    </span>
  </li>
);

// Telas de acesso (entrar, recuperar senha, definir senha, verificação): formulário à esquerda
// e painel de destaque à direita; no celular o painel vai para baixo do formulário.
export default function LayoutPublico({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-full grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] max-[859px]:grid-cols-1">
      <main id="conteudo" className="mx-auto flex w-full max-w-[460px] flex-col justify-center gap-6 px-6 py-10">
        <Marca tamanho={38} grande />
        <ProcessarLinkAcesso />
        {children}
      </main>
      <aside className="relative flex flex-col justify-center gap-7 overflow-hidden bg-primary px-10 py-12 text-primary-foreground max-[859px]:px-4 max-[859px]:py-8" aria-label="Sobre o Nexo">
        <svg viewBox="0 0 200 200" aria-hidden="true" className="pointer-events-none absolute -right-14 -bottom-14 w-[380px] opacity-15">
          <path d="M30 40 100 100 170 60M100 100 60 170M100 100 160 160" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx="30" cy="40" r="9" fill="currentColor" />
          <circle cx="100" cy="100" r="12" fill="currentColor" />
          <circle cx="170" cy="60" r="9" fill="currentColor" />
          <circle cx="60" cy="170" r="9" fill="currentColor" />
          <circle cx="160" cy="160" r="9" fill="currentColor" />
        </svg>
        <h2 className="max-w-[16ch] font-heading text-[34px] leading-[1.1] font-semibold max-[859px]:text-[26px]">Ninguém entra na obra sem estar em dia.</h2>
        <ul className="relative flex max-w-[42ch] flex-col gap-4">
          <Item d="M7 3h7l4 4v14H7zM14 3v4h4M10 13h5M10 17h5" titulo="Documentos da empresa e da equipe" texto="Envio pelo portal, com vencimento calculado e avisos 30, 15 e 0 dias antes." />
          <Item d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-4 9.5 3 3 5-6" titulo="Análise do RH em 2 dias úteis" texto="Cada documento é aprovado ou devolvido com o motivo." />
          <Item d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6zm-3 9 2.2 2.2L15 10" titulo="Integração e liberação" texto="Presença marcada pela segurança do trabalho e pessoa liberada para a obra." />
        </ul>
      </aside>
    </div>
  );
}
