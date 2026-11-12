"use client";

import { useActionState, useRef, useState, type FormEvent } from "react";
import type { EstadoFormulario } from "@/lib/formulario";

type Props = { acao: (estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>; proximo: string };

// Login: só a interface mudou. A Server Action `entrar` e a verificação em duas etapas continuam iguais.
// Erros de preenchimento aparecem em texto, ligados ao campo (aria-describedby), anunciados (role="alert"),
// e o foco vai para o campo com problema.
export function FormularioEntrar({ acao, proximo }: Props) {
  const [estado, enviar, enviando] = useActionState(acao, {});
  const [erro, setErro] = useState<{ campo: "email" | "senha"; texto: string } | null>(null);
  const [mostrar, setMostrar] = useState(false);
  const email = useRef<HTMLInputElement>(null);
  const senha = useRef<HTMLInputElement>(null);

  const conferir = (e: FormEvent<HTMLFormElement>) => {
    const valorEmail = email.current?.value.trim() ?? "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valorEmail)) {
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
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-[13px] font-semibold">E-mail</label>
        <input
          ref={email}
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="nome@empresa.com.br"
          aria-invalid={erro?.campo === "email" ? true : undefined}
          aria-describedby={erro?.campo === "email" ? "erro-email" : undefined}
          className="campo min-h-[46px]"
        />
        {erro?.campo === "email" && <p id="erro-email" role="alert" className="rounded-[10px] bg-bad-soft px-3 py-2 text-[13px] font-medium text-bad">{erro.texto}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="senha" className="text-[13px] font-semibold">Senha</label>
        <span className="relative">
          <input
            ref={senha}
            id="senha"
            name="senha"
            type={mostrar ? "text" : "password"}
            autoComplete="current-password"
            aria-invalid={erro?.campo === "senha" ? true : undefined}
            aria-describedby={erro?.campo === "senha" ? "erro-senha" : undefined}
            className="campo min-h-[46px] pr-12"
          />
          <button
            type="button"
            onClick={() => setMostrar((v) => !v)}
            aria-pressed={mostrar}
            aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
            className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-fill hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
              {mostrar && <path d="M4 4l16 16" />}
            </svg>
          </button>
        </span>
        {erro?.campo === "senha" && <p id="erro-senha" role="alert" className="rounded-[10px] bg-bad-soft px-3 py-2 text-[13px] font-medium text-bad">{erro.texto}</p>}
      </div>
      {estado.erro && !erro && <p role="alert" className="rounded-[10px] bg-bad-soft px-3 py-2 text-[13px] font-medium text-bad">{estado.erro}</p>}
      <button type="submit" className="botao botao-primario min-h-[46px]" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
