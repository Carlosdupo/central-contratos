"use client";

import { useState } from "react";
import { Autocomplete, AutocompleteContent, AutocompleteEmpty, AutocompleteInput, AutocompleteItem, AutocompleteLabel, AutocompleteList } from "@ui-sdk/react/autocomplete";
import { formatarCnpj } from "@/lib/documentos-br";

export type EmpresaCadastrada = { razao: string; cnpj: string };

// Fornecedor da cotação: texto livre com sugestões das empresas cadastradas (Autocomplete do UI SDK).
// Escolher uma empresa cadastrada preenche o CNPJ; um fornecedor novo é digitado com o CNPJ à mão.
export function CampoFornecedor({ empresas }: { empresas: EmpresaCadastrada[] }) {
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const aoMudarNome = (valor: string) => {
    setNome(valor);
    const achada = empresas.find((e) => e.razao.toLowerCase() === valor.trim().toLowerCase());
    if (achada) setCnpj(formatarCnpj(achada.cnpj));
  };
  return (
    <>
      <Autocomplete value={nome} onValueChange={aoMudarNome} name="fornecedor" filter="contains">
        <div className="flex min-w-0 flex-col gap-1.5">
          <AutocompleteLabel className="text-[13px] font-semibold">Fornecedor</AutocompleteLabel>
          <AutocompleteInput className="campo" autoComplete="off" />
          <span className="text-xs text-muted-foreground">Digite para buscar nas empresas cadastradas, ou escreva um fornecedor novo.</span>
        </div>
        <AutocompleteContent>
          <AutocompleteEmpty>Nenhuma empresa cadastrada com esse nome. Pode seguir com o fornecedor novo.</AutocompleteEmpty>
          <AutocompleteList>
            {empresas.map((e) => (
              <AutocompleteItem key={e.cnpj} value={e.razao} label={e.razao}>
                <span className="font-medium">{e.razao}</span>
                <span className="font-mono text-xs text-muted-foreground">{formatarCnpj(e.cnpj)}</span>
              </AutocompleteItem>
            ))}
          </AutocompleteList>
        </AutocompleteContent>
      </Autocomplete>
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[13px] font-semibold">CNPJ</span>
        <input name="cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} className="campo" inputMode="numeric" />
      </label>
    </>
  );
}
