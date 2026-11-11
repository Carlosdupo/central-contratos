"use client";

import { useState } from "react";
import { formatarCnpj } from "@/lib/documentos-br";

export type EmpresaCadastrada = { razao: string; cnpj: string };

// Fornecedor da cotação: busca nas empresas já cadastradas (preenche o CNPJ) ou digita um novo.
export function CampoFornecedor({ empresas }: { empresas: EmpresaCadastrada[] }) {
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const aoDigitarNome = (valor: string) => {
    setNome(valor);
    const achada = empresas.find((e) => e.razao.toLowerCase() === valor.trim().toLowerCase());
    if (achada) setCnpj(formatarCnpj(achada.cnpj));
  };
  return (
    <>
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-muted-foreground">Fornecedor</span>
        <input name="fornecedor" list="empresas-cadastradas" value={nome} onChange={(e) => aoDigitarNome(e.target.value)} className="campo" autoComplete="off" />
        <span className="text-xs text-faint">Digite para buscar nas empresas cadastradas</span>
        <datalist id="empresas-cadastradas">
          {empresas.map((e) => <option key={e.cnpj} value={e.razao}>{formatarCnpj(e.cnpj)}</option>)}
        </datalist>
      </label>
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-muted-foreground">CNPJ</span>
        <input name="cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} className="campo" inputMode="numeric" />
      </label>
    </>
  );
}
