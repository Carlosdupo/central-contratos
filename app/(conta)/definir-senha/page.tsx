import type { Metadata } from "next";
import { definirSenha } from "@/modules/acesso/acoes";
import { Campo, FormularioAcesso } from "@/components/app/formulario-acesso";

export const metadata: Metadata = { title: "Criar senha" };

// Chega aqui pelo link do convite ou da recuperação de senha (sessão criada em /auth/confirmar).
export default function PaginaDefinirSenha() {
  return (
    <>
      <div>
        <h1 className="titulo">Criar senha</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Pelo menos 10 caracteres, com letra maiúscula, letra minúscula e número.
        </p>
      </div>
      <FormularioAcesso acao={definirSenha} textoBotao="Salvar senha">
        <Campo id="senha" rotulo="Nova senha" tipo="password" autoComplete="new-password" />
        <Campo id="confirmacao" rotulo="Confirmar senha" tipo="password" autoComplete="new-password" />
      </FormularioAcesso>
    </>
  );
}
