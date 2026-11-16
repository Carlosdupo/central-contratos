"use client";

import { Formulario } from "@/components/app/formulario";
import { PainelSenha } from "@/components/app/painel-senha";
import type { EstadoFormulario } from "@/lib/formulario";

type Acao = (estado: EstadoFormulario & { senha?: string; email?: string }, dados: FormData) => Promise<EstadoFormulario & { senha?: string; email?: string }>;

// "Gerar nova senha provisória" para quem esqueceu a senha e não recebe e-mail. Pede confirmação; a senha aparece uma vez.
export function GerarSenhaUsuario({ acao, nome }: { acao: Acao; nome: string }) {
  return (
    <Formulario
      acao={acao}
      textoBotao="Gerar nova senha provisória"
      variante="neutro"
      confirmar={`Gerar uma nova senha provisória para ${nome}? A senha atual deixa de valer e a pessoa terá de criar uma senha nova no próximo acesso.`}
      resultado={(e) => (e.senha ? <PainelSenha senha={e.senha} email={e.email} /> : null)}
    />
  );
}
