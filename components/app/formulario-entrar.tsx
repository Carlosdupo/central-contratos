"use client";

import { useActionState, useRef, useState, type FormEvent } from "react";
import { Button } from "@ui-sdk/react/button";
import { Field, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { PasswordInput, PasswordInputControl, PasswordInputToggle } from "@ui-sdk/react/password-input";
import type { EstadoFormulario } from "@/lib/formulario";

type Props = { acao: (estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>; proximo: string };

const Olho = ({ aberto }: { aberto: boolean }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {aberto && <path d="M4 4l16 16" />}
  </svg>
);

// Login: só a interface mudou. A Server Action `entrar` e a verificação em duas etapas continuam iguais.
// Erros de preenchimento aparecem em texto, ligados ao campo pelo Field do UI SDK, e o foco vai para o campo.
export function FormularioEntrar({ acao, proximo }: Props) {
  const [estado, enviar, enviando] = useActionState(acao, {});
  const [erro, setErro] = useState<{ campo: "email" | "senha"; texto: string } | null>(null);
  const email = useRef<HTMLInputElement>(null);
  const senha = useRef<HTMLInputElement>(null);

  const conferir = (e: FormEvent<HTMLFormElement>) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.current?.value.trim() ?? "")) {
      e.preventDefault();
      setErro({ campo: "email", texto: "Digite o e-mail cadastrado no convite, como nome@empresa.com.br." });
      email.current?.focus();
      return;
    }
    if (!senha.current?.value) {
      e.preventDefault();
      setErro({ campo: "senha", texto: "Digite sua senha. Se não lembra, use “Esqueci minha senha”." });
      senha.current?.focus();
      return;
    }
    setErro(null);
  };

  return (
    <form action={enviar} onSubmit={conferir} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="proximo" value={proximo} />
      <Field invalid={erro?.campo === "email"} className="flex flex-col gap-1.5">
        <FieldLabel className="text-[13px] font-semibold">E-mail</FieldLabel>
        <Input ref={email} name="email" type="email" autoComplete="username" placeholder="nome@empresa.com.br" className="campo min-h-[46px]" />
        <FieldError match={erro?.campo === "email"} role="alert" className="rounded-[10px] bg-bad-soft px-3 py-2 text-[13px] font-medium text-bad">{erro?.texto}</FieldError>
      </Field>
      <Field invalid={erro?.campo === "senha"} className="flex flex-col gap-1.5">
        <FieldLabel className="text-[13px] font-semibold">Senha</FieldLabel>
        <PasswordInput name="senha" autoComplete="current-password" className="relative block">
          <PasswordInputControl ref={senha} className="campo min-h-[46px] pr-12" />
          <PasswordInputToggle aria-label="Mostrar senha" className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-fill hover:text-foreground">
            {(s) => <Olho aberto={s.visible} />}
          </PasswordInputToggle>
        </PasswordInput>
        <FieldError match={erro?.campo === "senha"} role="alert" className="rounded-[10px] bg-bad-soft px-3 py-2 text-[13px] font-medium text-bad">{erro?.texto}</FieldError>
      </Field>
      {estado.erro && !erro && <p role="alert" className="rounded-[10px] bg-bad-soft px-3 py-2 text-[13px] font-medium text-bad">{estado.erro}</p>}
      <Button type="submit" className="botao botao-primario min-h-[46px]" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
