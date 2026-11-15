"use client";

import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@ui-sdk/react/dialog";
import { CampoSelecao, CampoTexto, Formulario } from "@/components/app/formulario";
import type { EstadoFormulario } from "@/lib/formulario";

type Acao = (estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>;

// "Devolver para ajuste": o responsável da etapa em andamento escolhe a etapa anterior e escreve o motivo.
export function DevolverEtapa({ acao, etapas, etapaAtual }: { acao: Acao; etapas: { etapa: number; nome: string; posicao?: number }[]; etapaAtual: string }) {
  return (
    <Dialog>
      <DialogTrigger className="botao">Devolver para ajuste</DialogTrigger>
      <DialogBackdrop />
      <DialogContent>
        <DialogTitle className="subtitulo">Devolver para ajuste</DialogTitle>
        <DialogDescription className="text-[14px] text-muted-foreground">
          A etapa escolhida reabre com o prazo recomeçando, e as etapas que dependem dela voltam a ficar aguardando. {etapaAtual} fica aguardando. O motivo fica no histórico.
        </DialogDescription>
        <Formulario acao={acao} textoBotao="Devolver etapa" variante="perigo" sensivel="Devolve a contratação para uma etapa anterior e refaz as etapas seguintes.">
          <CampoSelecao nome="para" rotulo="Devolver para a etapa" placeholder="Escolha a etapa" opcoes={etapas.map((e) => ({ value: String(e.etapa), label: `${e.posicao ?? e.etapa}. ${e.nome}` }))} />
          <CampoTexto nome="motivo" rotulo="Motivo da devolução" dica="Pelo menos 5 letras. Quem recebe a etapa vê este texto." />
        </Formulario>
        <div className="flex justify-end">
          <DialogClose className="botao">Voltar</DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
