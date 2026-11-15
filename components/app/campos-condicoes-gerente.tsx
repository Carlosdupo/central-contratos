"use client";

import { useState } from "react";
import { CampoReais } from "@/components/app/campos-mascara";
import { CampoTexto, GrupoOpcoes } from "@/components/app/formulario";

export type Condicoes = {
  permuta: boolean | null; permuta_valor: number | null; permuta_formato: string | null;
  fat_direto: boolean | null; fat_direto_valor: number | null; fat_direto_percentual: number | null;
  sinal: boolean | null; sinal_valor: number | null;
  caucao: string | null;
};

const texto = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));

const SIM_NAO = [{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }];
const paraTexto = (v: boolean | null) => (v === null ? null : v ? "sim" : "nao");

function SimNao({ nome, rotulo, valor, aoMudar }: { nome: string; rotulo: string; valor: boolean | null; aoMudar: (v: boolean) => void }) {
  return <GrupoOpcoes nome={nome} rotulo={rotulo} estilo="pilula" opcoes={SIM_NAO} valor={paraTexto(valor)} aoMudar={(v) => v && aoMudar(v === "sim")} />;
}

function Linha({ titulo, children, detalhe }: { titulo: string; children: React.ReactNode; detalhe?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-3.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[14px] font-medium">{titulo}</span>
        {children}
      </div>
      {detalhe}
    </div>
  );
}

const Campo = ({ nome, rotulo, padrao }: { nome: string; rotulo: string; padrao: string }) => (
  <CampoTexto nome={nome} rotulo={rotulo} padrao={padrao} className="min-w-[140px] flex-1" />
);

// Condições do gerente de suprimentos (etapa 6): permuta, faturamento direto, sinal e caução.
export function CamposCondicoesGerente({ inicial }: { inicial: Condicoes }) {
  const [permuta, setPermuta] = useState(inicial.permuta);
  const [fat, setFat] = useState(inicial.fat_direto);
  const [sinal, setSinal] = useState(inicial.sinal);
  const [caucao, setCaucao] = useState(inicial.caucao);
  return (
    <div className="lista-agrupada">
      <Linha titulo="Permuta" detalhe={permuta && (
        <div className="flex flex-wrap gap-2">
          <CampoReais nome="permuta_valor" rotulo="Valor da permuta (R$)" padrao={inicial.permuta_valor} className="min-w-[140px] flex-1" />
          <Campo nome="permuta_formato" rotulo="Formato da permuta" padrao={inicial.permuta_formato ?? ""} />
        </div>
      )}>
        <SimNao nome="permuta" rotulo="Permuta" valor={permuta} aoMudar={setPermuta} />
      </Linha>
      <Linha titulo="Faturamento direto" detalhe={fat && (
        <div className="flex flex-wrap gap-2">
          <CampoReais nome="fat_direto_valor" rotulo="Valor do faturamento direto (R$)" padrao={inicial.fat_direto_valor} className="min-w-[140px] flex-1" />
          <Campo nome="fat_direto_percentual" rotulo="Percentual do faturamento direto (%)" padrao={texto(inicial.fat_direto_percentual)} />
        </div>
      )}>
        <SimNao nome="fat_direto" rotulo="Faturamento direto" valor={fat} aoMudar={setFat} />
      </Linha>
      <Linha titulo="Sinal" detalhe={sinal && (
        <div className="flex flex-wrap gap-2"><CampoReais nome="sinal_valor" rotulo="Valor do sinal (R$)" padrao={inicial.sinal_valor} className="min-w-[140px] flex-1" /></div>
      )}>
        <SimNao nome="sinal" rotulo="Sinal" valor={sinal} aoMudar={setSinal} />
      </Linha>
      <Linha titulo="Caução">
        <GrupoOpcoes nome="caucao" rotulo="Caução" estilo="pilula" valor={caucao} aoMudar={setCaucao} opcoes={[{ value: "3", label: "3%" }, { value: "5", label: "5%" }, { value: "na", label: "N.A." }]} />
      </Linha>
    </div>
  );
}
