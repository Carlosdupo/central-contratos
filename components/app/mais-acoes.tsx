"use client";

import { useState } from "react";
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@ui-sdk/react/dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@ui-sdk/react/menu";
import { CampoTexto, Formulario } from "@/components/app/formulario";
import type { EstadoFormulario } from "@/lib/formulario";

type Cancelar = (estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>;

// Menu "Mais ações" no topo da contratação. Hoje tem uma opção: cancelar, que abre a janela de confirmação com o motivo obrigatório.
export function MaisAcoes({ cancelar }: { cancelar: Cancelar }) {
  const [cancelando, setCancelando] = useState(false);
  return (
    <>
      <Menu onAction={(valor) => { if (valor === "cancelar") setCancelando(true); }}>
        <MenuTrigger className="botao">
          Mais ações <span aria-hidden="true">⋯</span>
        </MenuTrigger>
        <MenuContent className="menu-acoes">
          <MenuItem value="cancelar" className="item-menu-perigo">Cancelar contratação</MenuItem>
        </MenuContent>
      </Menu>
      <Dialog open={cancelando} onOpenChange={setCancelando}>
        <DialogBackdrop />
        <DialogContent className="janela-confirmacao">
          <DialogTitle className="subtitulo">Cancelar contratação?</DialogTitle>
          <DialogDescription className="text-[14px] text-muted-foreground">Não dá para desfazer. Escreva o motivo: ele fica registrado.</DialogDescription>
          <Formulario acao={cancelar} textoBotao="Cancelar contratação" variante="perigo" sensivel="Cancela esta contratação. Não dá para desfazer.">
            <CampoTexto nome="motivo" rotulo="Motivo do cancelamento" dica="Pelo menos 5 letras." />
          </Formulario>
          <div className="flex justify-end">
            <DialogClose className="botao">Voltar</DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
