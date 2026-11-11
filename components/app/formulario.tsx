"use client";

import { useActionState, type FormEvent, type ReactNode } from "react";
import type { EstadoFormulario } from "@/lib/formulario";

type Props = {
  acao: (estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>;
  textoBotao: string;
  children?: ReactNode;
  variante?: "primario" | "perigo" | "neutro";
  /** Pergunta de confirmação antes de enviar (ações difíceis de desfazer). */
  confirmar?: string;
  className?: string;
};

// Formulário com Server Action: mostra o resultado (erro ou confirmação) ao lado do botão.
export function Formulario({ acao, textoBotao, children, variante = "primario", confirmar, className }: Props) {
  const [estado, enviar, enviando] = useActionState(acao, {});
  const aoEnviar = (e: FormEvent) => {
    if (confirmar && !window.confirm(confirmar)) e.preventDefault();
  };
  const classeBotao = variante === "primario" ? "botao botao-primario" : variante === "perigo" ? "botao botao-perigo" : "botao";

  return (
    <form action={enviar} onSubmit={aoEnviar} className={className ?? "flex flex-col gap-4"} noValidate>
      {children}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {estado.erro && <p role="alert" className="mr-auto text-[13px] text-bad">{estado.erro}</p>}
        {estado.ok && <p role="status" className="mr-auto text-[13px] text-ok">{estado.ok}</p>}
        <button type="submit" className={classeBotao} disabled={enviando}>
          {enviando ? "Salvando…" : textoBotao}
        </button>
      </div>
    </form>
  );
}

export function CampoTexto(props: {
  nome: string;
  rotulo: string;
  padrao?: string | number | null;
  tipo?: string;
  dica?: string;
  className?: string;
  min?: number;
  max?: number;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${props.className ?? ""}`}>
      <span className="text-[12.5px] font-medium text-muted-foreground">{props.rotulo}</span>
      <input name={props.nome} type={props.tipo ?? "text"} defaultValue={props.padrao ?? ""} min={props.min} max={props.max} className="campo" />
      {props.dica && <span className="text-xs text-faint">{props.dica}</span>}
    </label>
  );
}

export function Marcador(props: { nome: string; valor?: string; rotulo: ReactNode; marcado?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 hover:bg-fill-2">
      <input type="checkbox" name={props.nome} value={props.valor ?? "on"} defaultChecked={props.marcado} className="size-[18px] accent-primary" />
      <span className="text-[14px]">{props.rotulo}</span>
    </label>
  );
}
