"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Drawer, DrawerBackdrop, DrawerContent, DrawerTitle, DrawerTrigger } from "@ui-sdk/react/drawer";
import { Logo, Marca } from "./logo";

export type ItemMenu = { href: string; rotulo: string; icone: ReactNode; contador?: number };
export type GrupoMenu = { titulo: string; itens: ItemMenu[] };

function Itens({ grupos, caminho }: { grupos: GrupoMenu[]; caminho: string }) {
  // O item mais específico vence (ex.: "Panorama" em /contratacoes/panorama não acende "Contratações").
  const todos = grupos.flatMap((g) => g.itens.map((i) => i.href));
  const ativo = (href: string) =>
    (caminho === href || caminho.startsWith(`${href}/`)) && !todos.some((h) => h !== href && h.startsWith(`${href}/`) && (caminho === h || caminho.startsWith(`${h}/`)));
  return (
    <>
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
    </>
  );
}

// Menu do Nexo. Os grupos chegam já filtrados pelos papéis (no servidor).
// Desktop (≥ 860 px): fixo à esquerda. Celular: barra no topo e o menu num Drawer do UI SDK
// (prende o foco, Esc fecha e devolve o foco ao botão, fecha ao trocar de página).
export function BarraLateral({ grupos, rodape }: { grupos: GrupoMenu[]; rodape: ReactNode }) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  const [caminhoAnterior, setCaminhoAnterior] = useState(caminho);
  if (caminho !== caminhoAnterior) {
    setCaminhoAnterior(caminho);
    setAberto(false);
  }

  return (
    <>
      <div className="sticky top-0 z-20 hidden items-center justify-between gap-3 border-b border-sep bg-card px-4 py-2.5 max-[859px]:flex">
        <span className="flex items-center gap-2.5">
          <Logo tamanho={30} />
          <span className="font-heading text-[18px] font-bold tracking-[.14em]">NEXO</span>
        </span>
        <Drawer side="left" open={aberto} onOpenChange={setAberto}>
          <DrawerTrigger className="botao botao-pequeno">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            Menu
          </DrawerTrigger>
          <DrawerBackdrop />
          <DrawerContent className="menu-gaveta">
            <DrawerTitle className="sr-only">Menu principal</DrawerTitle>
            <div className="flex h-full flex-col gap-5 overflow-y-auto px-3.5 py-5">
              <div className="px-2.5"><Marca /></div>
              <Itens grupos={grupos} caminho={caminho} />
              <div className="mt-auto">{rodape}</div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      <aside aria-label="Menu principal" className="sticky top-0 flex h-screen flex-col gap-5 overflow-y-auto border-r border-sep bg-card px-3.5 py-5 max-[859px]:hidden">
        <div className="px-2.5"><Marca /></div>
        <Itens grupos={grupos} caminho={caminho} />
        <div className="mt-auto">{rodape}</div>
      </aside>
    </>
  );
}
