"use client";

import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import { formatarCnpj } from "@/lib/documentos-br";
import { oQueFalta, situacaoFinanceiro, type LinhaFinanceiro, type SituacaoFinanceiro } from "@/modules/financeiro/dominio";
import { progressoDocumentos, type EstadoItem } from "@/modules/terceiros/dominio/documentos";
import { ProgressoDocumentos } from "./progresso-documentos";

const ABAS: { chave: SituacaoFinanceiro; rotulo: string; vazio: string }[] = [
  { chave: "liberada", rotulo: "Liberadas", vazio: "Nenhuma empresa liberada nesta competência ainda." },
  { chave: "pendente", rotulo: "Pendentes", vazio: "Nenhuma empresa pendente." },
  { chave: "atrasada", rotulo: "Atrasadas", vazio: "Nenhuma empresa atrasada." },
];

const estados = (l: LinhaFinanceiro): EstadoItem[] => [
  ...Array<EstadoItem>(l.aprovados).fill("aprovado"),
  ...Array<EstadoItem>(l.reprovados).fill("reprovado"),
  ...Array<EstadoItem>(Math.max(0, l.exigidos - l.aprovados - l.reprovados)).fill("enviado"),
];
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

// Quadro do financeiro: empresas liberadas para receber na competência, pendentes e atrasadas. Tabs do UI SDK.
export function QuadroFinanceiro({ linhas, competencia, hoje }: { linhas: LinhaFinanceiro[]; competencia: string; hoje: string }) {
  const porSituacao = (s: SituacaoFinanceiro) => linhas.filter((l) => situacaoFinanceiro(l, competencia, hoje) === s);
  return (
    <Tabs defaultValue="liberada" className="flex flex-col gap-3">
      <TabsList aria-label="Situação das empresas">
        {ABAS.map((a) => (
          <TabsTab key={a.chave} value={a.chave}>
            {a.rotulo}
            <span className="tabular-nums opacity-80">{porSituacao(a.chave).length}</span>
          </TabsTab>
        ))}
      </TabsList>
      {ABAS.map((a) => {
        const lista = porSituacao(a.chave);
        return (
          <TabsPanel key={a.chave} value={a.chave} className="outline-offset-4">
            {lista.length === 0 ? (
              <p className="painel text-[14px] text-muted-foreground">{a.vazio}</p>
            ) : (
              <div className="lista-agrupada">
                {lista.map((l) => (
                  <div key={l.empresaId} className="grid gap-3 px-3.5 py-3 sm:grid-cols-[minmax(0,1fr)_260px] sm:items-center">
                    <div className="min-w-0">
                      <div className="font-medium">{l.razaoSocial}</div>
                      <div className="text-[12.5px] text-muted-foreground">CNPJ {formatarCnpj(l.cnpj)}{l.obras ? ` · ${l.obras}` : ""}</div>
                      <div className="mt-1 text-[12.5px]">
                        {l.liberadaEm ? <span className="text-ok">Liberada em {dataHora(l.liberadaEm)}</span> : <span className={a.chave === "atrasada" ? "text-bad" : "text-muted-foreground"}>{oQueFalta(l)}</span>}
                      </div>
                    </div>
                    <ProgressoDocumentos progresso={progressoDocumentos(estados(l))} rotulo={`Documentação mensal de ${l.razaoSocial}`} />
                  </div>
                ))}
              </div>
            )}
          </TabsPanel>
        );
      })}
    </Tabs>
  );
}
