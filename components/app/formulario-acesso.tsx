"use client";

import { useActionState, type ReactNode } from "react";
import { Button } from "@ui-sdk/react/button";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { PasswordInput, PasswordInputControl, PasswordInputToggle } from "@ui-sdk/react/password-input";
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
      <Button type="submit" className="botao botao-primario mt-1" disabled={enviando}>
        {enviando ? "Aguarde…" : textoBotao}
      </Button>
    </form>
  );
}

export function Campo(props: { id: string; rotulo: string; tipo?: string; autoComplete?: string; padrao?: string }) {
  return (
    <Field name={props.id} className="flex flex-col gap-1.5">
      <FieldLabel className="text-[13px] font-semibold">{props.rotulo}</FieldLabel>
      {props.tipo === "password" ? (
        <PasswordInput required autoComplete={props.autoComplete as "current-password" | "new-password" | undefined} defaultValue={props.padrao} className="relative block">
          <PasswordInputControl className="campo pr-12" />
          <PasswordInputToggle aria-label={`Mostrar ${props.rotulo.toLowerCase()}`} className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-fill hover:text-foreground">
            {(s) => (s.visible ? "Ocultar" : "Ver")}
          </PasswordInputToggle>
        </PasswordInput>
      ) : (
        <Input type={props.tipo ?? "text"} autoComplete={props.autoComplete} defaultValue={props.padrao} required className="campo" />
      )}
    </Field>
  );
}
