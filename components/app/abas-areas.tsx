"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type Aba = { chave: string; rotulo: string; contador?: number; conteudo: ReactNode };

// Abas por área (Suprimentos, RH, Segurança) para quem tem vários perfis.
// Padrão WAI-ARIA: setas esquerda/direita, Home e End trocam de aba; só a aba atual entra no Tab.
export function AbasAreas({ abas }: { abas: Aba[] }) {
  const [atual, setAtual] = useState(0);
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  if (abas.length === 0) return null;
  if (abas.length === 1) return <>{abas[0].conteudo}</>;

  const ir = (i: number) => {
    const n = (i + abas.length) % abas.length;
    setAtual(n);
    refs.current[n]?.focus();
  };
  const tecla = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") ir(atual + 1);
    else if (e.key === "ArrowLeft") ir(atual - 1);
    else if (e.key === "Home") ir(0);
    else if (e.key === "End") ir(abas.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Áreas" className="flex flex-wrap gap-2" onKeyDown={tecla}>
        {abas.map((a, i) => (
          <button
            key={a.chave}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`${base}-aba-${a.chave}`}
            aria-selected={i === atual}
            aria-controls={`${base}-painel-${a.chave}`}
            tabIndex={i === atual ? 0 : -1}
            onClick={() => setAtual(i)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-[13.5px] font-semibold ${
              i === atual ? "border-foreground bg-foreground text-background" : "border-sep-strong bg-card text-foreground hover:bg-fill"
            }`}
          >
            {a.rotulo}
            {!!a.contador && <span className="tabular-nums opacity-80">{a.contador}</span>}
          </button>
        ))}
      </div>
      {abas.map((a, i) => (
        <div key={a.chave} role="tabpanel" id={`${base}-painel-${a.chave}`} aria-labelledby={`${base}-aba-${a.chave}`} hidden={i !== atual} tabIndex={0} className="outline-offset-4">
          {a.conteudo}
        </div>
      ))}
    </div>
  );
}
