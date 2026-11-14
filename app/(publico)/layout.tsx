import { Marca } from "@/components/app/logo";
import { ProcessarLinkAcesso } from "@/components/app/processar-link-acesso";

const Item = ({ titulo, texto, d }: { titulo: string; texto: string; d: string }) => (
  <li className="flex items-start gap-3">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0">
      <path d={d} />
    </svg>
    <span>
      <strong className="block text-[15px]">{titulo}</strong>
      <span className="mt-0.5 block text-[14px] leading-normal">{texto}</span>
    </span>
  </li>
);

// Telas de acesso (entrar, recuperar senha, definir senha, verificação): uma coluna central em fundo
// branco com a marca e o formulário, e a mensagem do sistema numa faixa azul no fim da página.
export default function LayoutPublico({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col bg-card">
      <main id="conteudo" className="mx-auto flex w-full max-w-[460px] flex-1 flex-col gap-6 px-6 pt-16 pb-14 max-sm:px-4 max-sm:pt-10">
        <div className="mb-2 flex justify-center">
          <Marca altura={24} subtitulo={false} />
        </div>
        <ProcessarLinkAcesso />
        {children}
      </main>
      <footer className="bg-primary px-6 pt-12 pb-14 text-primary-foreground max-sm:px-4 max-sm:pt-9 max-sm:pb-10" aria-label="Sobre o Nexus">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-8">
          <h2 className="text-balance text-center font-heading text-[28px] leading-tight font-bold max-sm:text-[22px]">Documentos em dia, equipe liberada para a obra.</h2>
          <ul className="grid grid-cols-3 gap-10 max-[859px]:grid-cols-1 max-[859px]:gap-5">
            <Item d="M7 3h7l4 4v14H7zM14 3v4h4M10 13h5M10 17h5" titulo="Documentos da empresa e da equipe" texto="Envio pelo portal, com vencimento calculado e avisos 30, 15 e 0 dias antes." />
            <Item d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-4 9.5 3 3 5-6" titulo="Análise do RH" texto="Cada documento é aprovado ou devolvido com o motivo." />
            <Item d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6zm-3 9 2.2 2.2L15 10" titulo="Integração e liberação" texto="Presença marcada pela segurança do trabalho e pessoa liberada para a obra." />
          </ul>
        </div>
      </footer>
    </div>
  );
}
