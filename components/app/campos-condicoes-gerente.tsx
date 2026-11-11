"use client";

import { useState } from "react";

export type Condicoes = {
  permuta: boolean | null; permuta_valor: number | null; permuta_formato: string | null;
  fat_direto: boolean | null; fat_direto_valor: number | null; fat_direto_percentual: number | null;
  sinal: boolean | null; sinal_valor: number | null;
  caucao: string | null;
};

const texto = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));

function SimNao({ nome, valor, aoMudar }: { nome: string; valor: boolean | null; aoMudar: (v: boolean) => void }) {
  return (
    <span className="flex gap-1.5">
      {[["sim", true], ["nao", false]].map(([v, b]) => (
        <label key={v as string} className={`cursor-pointer rounded-full px-3 py-1 text-[13px] font-medium ${valor === b ? "bg-primary text-primary-foreground" : "bg-fill-2"}`}>
          <input type="radio" name={nome} value={v as string} checked={valor === b} onChange={() => aoMudar(b as boolean)} className="sr-only" />
          {b ? "Sim" : "Não"}
        </label>
      ))}
    </span>
  );
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
  <label className="flex min-w-[140px] flex-1 flex-col gap-1">
    <span className="text-xs font-medium text-muted-foreground">{rotulo}</span>
    <input name={nome} defaultValue={padrao} className="campo py-1.5" />
  </label>
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
          <Campo nome="permuta_valor" rotulo="Valor (R$)" padrao={texto(inicial.permuta_valor)} />
          <Campo nome="permuta_formato" rotulo="Formato" padrao={inicial.permuta_formato ?? ""} />
        </div>
      )}>
        <SimNao nome="permuta" valor={permuta} aoMudar={setPermuta} />
      </Linha>
      <Linha titulo="Faturamento direto" detalhe={fat && (
        <div className="flex flex-wrap gap-2">
          <Campo nome="fat_direto_valor" rotulo="Valor (R$)" padrao={texto(inicial.fat_direto_valor)} />
          <Campo nome="fat_direto_percentual" rotulo="Percentual (%)" padrao={texto(inicial.fat_direto_percentual)} />
        </div>
      )}>
        <SimNao nome="fat_direto" valor={fat} aoMudar={setFat} />
      </Linha>
      <Linha titulo="Sinal" detalhe={sinal && (
        <div className="flex flex-wrap gap-2"><Campo nome="sinal_valor" rotulo="Valor (R$)" padrao={texto(inicial.sinal_valor)} /></div>
      )}>
        <SimNao nome="sinal" valor={sinal} aoMudar={setSinal} />
      </Linha>
      <Linha titulo="Caução">
        <span className="flex gap-1.5">
          {[["3", "3%"], ["5", "5%"], ["na", "N.A."]].map(([v, r]) => (
            <label key={v} className={`cursor-pointer rounded-full px-3 py-1 text-[13px] font-medium ${caucao === v ? "bg-primary text-primary-foreground" : "bg-fill-2"}`}>
              <input type="radio" name="caucao" value={v} checked={caucao === v} onChange={() => setCaucao(v)} className="sr-only" />
              {r}
            </label>
          ))}
        </span>
      </Linha>
    </div>
  );
}
