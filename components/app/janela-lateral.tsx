"use client";

import { useId, useRef, type ReactNode } from "react";

// Janela lateral com <dialog> nativo em modo modal: prende o foco, fecha com Esc e devolve o foco ao botão.
export function JanelaLateral({ textoBotao, titulo, descricao, children }: { textoBotao: string; titulo: string; descricao?: string; children: ReactNode }) {
  const janela = useRef<HTMLDialogElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const id = useId();
  const fechar = () => {
    janela.current?.close();
  };

  return (
    <>
      <button ref={botao} type="button" className="botao botao-primario" aria-haspopup="dialog" onClick={() => janela.current?.showModal()}>
        <span aria-hidden="true">+</span> {textoBotao}
      </button>
      <dialog
        ref={janela}
        aria-labelledby={`${id}-titulo`}
        aria-describedby={descricao ? `${id}-descricao` : undefined}
        onClose={() => botao.current?.focus()}
        onClick={(e) => {
          if (e.target === janela.current) fechar(); // clique no fundo escuro
        }}
        className="fixed inset-y-0 right-0 left-auto m-0 h-full max-h-none w-[min(100vw,440px)] max-w-none border-l border-sep bg-card p-0 text-foreground backdrop:bg-black/45"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-sep px-5 py-4">
            <div>
              <h2 id={`${id}-titulo`} className="subtitulo">{titulo}</h2>
              {descricao && <p id={`${id}-descricao`} className="mt-1 text-[13px] text-muted-foreground">{descricao}</p>}
            </div>
            <button type="button" onClick={fechar} className="grid size-10 shrink-0 place-items-center rounded-[10px] hover:bg-fill" aria-label="Fechar janela">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        </div>
      </dialog>
    </>
  );
}
