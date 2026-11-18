"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import { CampoTexto, Formulario, Marcador } from "@/components/app/formulario";
import { PainelSenha } from "@/components/app/painel-senha";
import { PAPEIS, ROTULO_PAPEL } from "@/modules/acesso/papeis";
import type { EstadoFormulario } from "@/lib/formulario";

type Acao = (estado: EstadoFormulario & { senha?: string; email?: string }, dados: FormData) => Promise<EstadoFormulario & { senha?: string; email?: string }>;

export type ObraOpcao = { id: string; nome: string };

// "Auxiliar Obra" logo depois de "Coordenador de obra". Marcado, pede as obras (abre e age até a etapa 3 só nelas).
function Perfis({ obras }: { obras: ObraOpcao[] }) {
  const [auxiliar, setAuxiliar] = useState(false);
  return (
    <>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[13px] font-semibold">Perfis</legend>
        <div className="lista-agrupada">
          {PAPEIS.flatMap((p) => [
            <Marcador key={p} nome="papeis" valor={p} rotulo={ROTULO_PAPEL[p]} />,
            ...(p === "coordenador_obra" ? [<Marcador key="auxiliar_obra" nome="papeis" valor="auxiliar_obra" rotulo="Auxiliar Obra" marcadoAgora={auxiliar} aoMudar={setAuxiliar} />] : []),
          ])}
        </div>
      </fieldset>
      {auxiliar && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[13px] font-semibold">Obras do Auxiliar Obra</legend>
          <p className="text-xs text-muted-foreground">Abre a solicitação e age até a etapa 3 nestas obras; da etapa 4 em diante é do coordenador.</p>
          {obras.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Nenhuma obra ativa cadastrada.</p>
          ) : (
            <div className="lista-agrupada max-h-[220px] overflow-y-auto">
              {obras.map((o) => <Marcador key={o.id} nome="obras_auxiliar" valor={o.id} rotulo={`Auxiliar em ${o.nome}`} />)}
            </div>
          )}
        </fieldset>
      )}
    </>
  );
}

// Cadastro de usuário novo: convite por e-mail (como antes) ou senha provisória, sem e-mail (quando o convite não chega).
export function NovoUsuario({ convidar, gerarSenha, obras = [] }: { convidar: Acao; gerarSenha: Acao; obras?: ObraOpcao[] }) {
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
          <Perfis obras={obras} />
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
          <Perfis obras={obras} />
        </Formulario>
      </TabsPanel>
    </Tabs>
  );
}
