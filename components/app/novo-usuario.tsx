"use client";

import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import { CampoTexto, Formulario, Marcador } from "@/components/app/formulario";
import { PainelSenha } from "@/components/app/painel-senha";
import { PAPEIS, ROTULO_PAPEL } from "@/modules/acesso/papeis";
import type { EstadoFormulario } from "@/lib/formulario";

type Acao = (estado: EstadoFormulario & { senha?: string; email?: string }, dados: FormData) => Promise<EstadoFormulario & { senha?: string; email?: string }>;

const Perfis = () => (
  <fieldset className="flex flex-col gap-1.5">
    <legend className="mb-1.5 text-[13px] font-semibold">Perfis</legend>
    <div className="lista-agrupada">
      {PAPEIS.map((p) => <Marcador key={p} nome="papeis" valor={p} rotulo={ROTULO_PAPEL[p]} />)}
    </div>
  </fieldset>
);

// Cadastro de usuário novo: convite por e-mail (como antes) ou senha provisória, sem e-mail (quando o convite não chega).
export function NovoUsuario({ convidar, gerarSenha }: { convidar: Acao; gerarSenha: Acao }) {
  return (
    <Tabs defaultValue="convite" className="flex flex-col gap-4">
      <TabsList aria-label="Como dar o acesso">
        <TabsTab value="convite">Enviar convite por e-mail</TabsTab>
        <TabsTab value="senha">Gerar senha provisória</TabsTab>
      </TabsList>
      <TabsPanel value="convite" className="outline-offset-4">
        <Formulario acao={convidar} textoBotao="Enviar convite à pessoa">
          <CampoTexto nome="nome" rotulo="Nome completo" />
          <CampoTexto nome="email" rotulo="E-mail" tipo="email" />
          <Perfis />
        </Formulario>
      </TabsPanel>
      <TabsPanel value="senha" className="outline-offset-4">
        <p className="mb-3 text-[13px] text-muted-foreground">
          Cria o acesso já pronto, sem e-mail. A senha aparece uma única vez, para você passar pessoalmente ou pelo WhatsApp. No primeiro acesso a pessoa cria uma senha nova.
        </p>
        <Formulario
          acao={gerarSenha}
          textoBotao="Criar acesso com senha provisória"
          sensivel="Cria o acesso do usuário e mostra uma senha provisória uma única vez."
          resultado={(e) => (e.senha ? <PainelSenha senha={e.senha} email={e.email} /> : null)}
        >
          <CampoTexto nome="nome" rotulo="Nome completo da pessoa" />
          <CampoTexto nome="email" rotulo="E-mail de acesso" tipo="email" />
          <Perfis />
        </Formulario>
      </TabsPanel>
    </Tabs>
  );
}
