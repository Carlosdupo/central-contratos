"use client";

import type { ReactNode } from "react";
import { Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger } from "@ui-sdk/react/drawer";

// Janela lateral (Drawer do UI SDK): prende o foco, fecha com Esc ou clique fora e devolve o foco ao botão.
export function JanelaLateral({ textoBotao, titulo, descricao, children }: { textoBotao: string; titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <Drawer side="right">
      <DrawerTrigger className="botao botao-primario">
        <span aria-hidden="true">+</span> {textoBotao}
      </DrawerTrigger>
      <DrawerBackdrop />
      <DrawerContent>
        <div className="flex items-start justify-between gap-3 border-b border-sep px-5 py-4">
          <div>
            <DrawerTitle className="subtitulo">{titulo}</DrawerTitle>
            {descricao && <DrawerDescription className="mt-1 text-[13px] text-muted-foreground">{descricao}</DrawerDescription>}
          </div>
          <DrawerClose className="grid size-10 shrink-0 place-items-center rounded-[10px] hover:bg-fill" aria-label="Fechar janela">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </DrawerClose>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
