"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { IconeApp } from "./icones";

export type ItemMenu = { href: string; rotulo: string; icone: ReactNode };
export type GrupoMenu = { titulo?: string; itens: ItemMenu[] };

// Barra lateral translúcida do protótipo. Os grupos chegam já filtrados pelos papéis (no servidor).
export function BarraLateral({ grupos, rodape }: { grupos: GrupoMenu[]; rodape: ReactNode }) {
  const caminho = usePathname();
  // O item mais específico vence (ex.: "Panorama" em /contratacoes/panorama não acende "Contratações").
  const todos = grupos.flatMap((g) => g.itens.map((i) => i.href));
  const ativo = (href: string) =>
    (caminho === href || caminho.startsWith(`${href}/`)) && !todos.some((h) => h !== href && h.startsWith(`${href}/`) && (caminho === h || caminho.startsWith(`${h}/`)));

  return (
    <aside className="sticky top-0 flex h-screen flex-col gap-5 border-r-[.5px] border-sep bg-[var(--lateral)] px-3.5 py-5 backdrop-blur-xl backdrop-saturate-[1.8] max-md:static max-md:h-auto max-md:flex-row max-md:flex-wrap max-md:items-center max-md:border-r-0 max-md:border-b-[.5px]">
      <div className="flex items-center gap-2.5 px-1.5">
        <IconeApp />
        <div className="leading-tight max-md:hidden">
          <div className="text-[15px] font-semibold tracking-tight">Central de Contratos</div>
          <div className="text-xs text-muted-foreground">Contratação de empreiteiros</div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-px max-md:w-full max-md:flex-row max-md:overflow-x-auto" aria-label="Menu principal">
        {grupos.map((grupo, i) => (
          <div key={grupo.titulo ?? i} className="contents">
            {grupo.titulo && <div className="px-2.5 pt-4 pb-1.5 text-[11.5px] font-semibold text-faint max-md:hidden">{grupo.titulo}</div>}
            {grupo.itens.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={ativo(item.href) ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] whitespace-nowrap transition-colors ${
                  ativo(item.href) ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-fill-2"
                }`}
              >
                <span className={ativo(item.href) ? "" : "text-primary"}>{item.icone}</span>
                {item.rotulo}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="max-md:hidden">{rodape}</div>
    </aside>
  );
}
