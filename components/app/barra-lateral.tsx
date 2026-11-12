"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Logo, Marca } from "./logo";

export type ItemMenu = { href: string; rotulo: string; icone: ReactNode; contador?: number };
export type GrupoMenu = { titulo: string; itens: ItemMenu[] };

// Menu lateral do Nexo. Os grupos chegam já filtrados pelos papéis (no servidor).
// Desktop (≥ 860 px): fixo à esquerda. Celular: barra no topo + gaveta.
// Gaveta fechada fica "inert" (fora do teclado e do leitor de tela); Esc fecha e devolve o foco ao botão.
export function BarraLateral({ grupos, rodape }: { grupos: GrupoMenu[]; rodape: ReactNode }) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  const [celular, setCelular] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const gaveta = useRef<HTMLElement>(null);

  // O item mais específico vence (ex.: "Panorama" em /contratacoes/panorama não acende "Contratações").
  const todos = grupos.flatMap((g) => g.itens.map((i) => i.href));
  const ativo = (href: string) =>
    (caminho === href || caminho.startsWith(`${href}/`)) && !todos.some((h) => h !== href && h.startsWith(`${href}/`) && (caminho === h || caminho.startsWith(`${h}/`)));

  useEffect(() => {
    const consulta = window.matchMedia("(max-width: 859px)");
    const atualizar = () => setCelular(consulta.matches);
    atualizar();
    consulta.addEventListener("change", atualizar);
    return () => consulta.removeEventListener("change", atualizar);
  }, []);

  // Fecha ao trocar de página (o foco vai para o título da nova página).
  const [caminhoAnterior, setCaminhoAnterior] = useState(caminho);
  if (caminho !== caminhoAnterior) {
    setCaminhoAnterior(caminho);
    setAberto(false);
  }

  useEffect(() => {
    if (!aberto) return;
    gaveta.current?.querySelector<HTMLElement>("a")?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAberto(false);
        botao.current?.focus();
      }
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aberto]);

  const fechado = celular && !aberto;

  return (
    <>
      <div className="sticky top-0 z-20 hidden items-center justify-between gap-3 border-b border-sep bg-card px-4 py-2.5 max-[859px]:flex">
        <span className="flex items-center gap-2.5">
          <Logo tamanho={30} />
          <span className="font-heading text-[18px] font-bold tracking-[.14em]">NEXO</span>
        </span>
        <button ref={botao} type="button" className="botao botao-pequeno" aria-controls="menu-principal" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          Menu
        </button>
      </div>

      {celular && aberto && <div className="fixed inset-0 z-30 bg-black/45" aria-hidden="true" onClick={() => setAberto(false)} />}

      <aside
        ref={gaveta}
        id="menu-principal"
        aria-label="Menu principal"
        inert={fechado}
        className={`flex flex-col gap-5 border-r border-sep bg-card px-3.5 py-5 min-[860px]:sticky min-[860px]:top-0 min-[860px]:h-screen min-[860px]:overflow-y-auto max-[859px]:fixed max-[859px]:inset-y-0 max-[859px]:left-0 max-[859px]:z-40 max-[859px]:w-[min(86vw,300px)] max-[859px]:overflow-y-auto max-[859px]:transition-transform max-[859px]:duration-200 motion-reduce:transition-none ${
          fechado ? "max-[859px]:invisible max-[859px]:-translate-x-[102%]" : ""
        }`}
      >
        <div className="px-2.5"><Marca /></div>
        {grupos.map((grupo) => (
          <nav key={grupo.titulo} aria-label={grupo.titulo} className="flex flex-col gap-0.5">
            <h2 className="px-2.5 pb-2 text-[11px] font-semibold tracking-[.09em] text-muted-foreground uppercase">{grupo.titulo}</h2>
            {grupo.itens.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={ativo(item.href) ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2.5 rounded-[10px] px-2.5 text-[14px] font-medium transition-colors ${
                  ativo(item.href) ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-fill hover:text-foreground"
                }`}
              >
                <span aria-hidden="true" className="contents">{item.icone}</span>
                {item.rotulo}
                {!!item.contador && (
                  <span className="ml-auto rounded-full bg-hot-soft px-2 text-[12px] font-semibold text-hot tabular-nums">
                    {item.contador}
                    <span className="sr-only"> {item.contador === 1 ? "pendência" : "pendências"}</span>
                  </span>
                )}
              </Link>
            ))}
          </nav>
        ))}
        <div className="mt-auto">{rodape}</div>
      </aside>
    </>
  );
}
