"use client";

import { useState } from "react";
import { Button } from "@ui-sdk/react/button";

// Senha provisória mostrada UMA vez para quem gerou. Ela só existe no estado desta tela: não vai para URL, armazenamento
// do navegador, banco nem log. Ao sair da página (ou gerar outra), some.
export function PainelSenha({ senha, email }: { senha: string; email?: string }) {
  const [copia, setCopia] = useState<"" | "ok" | "falhou">("");
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(senha);
      setCopia("ok");
    } catch {
      setCopia("falhou");
    }
  };
  return (
    <section aria-label="Senha provisória" className="flex flex-col gap-2 rounded-xl border border-sep bg-warn-soft px-3.5 py-3 text-[13.5px]">
      <p className="font-semibold">Senha provisória{email ? ` de ${email}` : ""}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code data-agent-secret className="rounded-lg bg-card px-3 py-2 font-mono text-[16px] font-semibold tracking-wide select-all" aria-label="Senha provisória gerada">{senha}</code>
        <Button type="button" className="botao" onClick={() => void copiar()}>Copiar senha</Button>
        <span role="status" className="text-[12.5px]">{copia === "ok" ? "Senha copiada." : copia === "falhou" ? "Não foi possível copiar. Selecione a senha e copie à mão." : ""}</span>
      </div>
      <p className="text-[12.5px]">
        <strong>Passe esta senha pessoalmente ou pelo WhatsApp; ela não aparece de novo.</strong> No primeiro acesso a pessoa é obrigada a criar uma senha nova.
      </p>
    </section>
  );
}
