"use client";

import { useActionState, type ReactNode } from "react";
import type { EstadoFormulario } from "@/lib/formulario";

type Props = {
  acao: (estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>;
  textoBotao: string;
  children: ReactNode;
};

// Formulário simples das telas de acesso: mostra erro ou confirmação devolvidos pela Server Action.
export function FormularioAcesso({ acao, textoBotao, children }: Props) {
  const [estado, enviar, enviando] = useActionState(acao, {});
  return (
    <form action={enviar} className="flex flex-col gap-4" noValidate>
      {children}
      {estado.erro && <p role="alert" className="rounded-[10px] bg-bad-soft px-3 py-2 text-[13px] font-medium text-bad">{estado.erro}</p>}
      {estado.ok && <p role="status" className="rounded-[10px] bg-ok-soft px-3.5 py-2.5 text-[13px] text-ok">{estado.ok}</p>}
      <button type="submit" className="botao botao-primario mt-1" disabled={enviando}>
        {enviando ? "Aguarde…" : textoBotao}
      </button>
    </form>
  );
}

export function Campo(props: { id: string; rotulo: string; tipo?: string; autoComplete?: string; padrao?: string }) {
  return (
    <label htmlFor={props.id} className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold">{props.rotulo}</span>
      <input
        id={props.id}
        name={props.id}
        type={props.tipo ?? "text"}
        autoComplete={props.autoComplete}
        defaultValue={props.padrao}
        required
        className="campo"
      />
    </label>
  );
}
