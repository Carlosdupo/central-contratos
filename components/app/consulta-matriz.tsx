"use client";

import { useState } from "react";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { DetalheAtividade } from "@/components/app/detalhe-atividade";
import type { AtividadeMatriz } from "@/modules/matriz/consultas";

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Consulta da matriz de contratação: busca por atividade, grupo ou forma legal.
export function ConsultaMatriz({ atividades }: { atividades: AtividadeMatriz[] }) {
  const [busca, setBusca] = useState("");
  const termo = semAcento(busca.trim());
  const achadas = termo
    ? atividades.filter((a) => semAcento([a.atividade, a.grupo, a.subgrupo ?? "", a.formaLegal].join(" ")).includes(termo))
    : atividades;
  return (
    <div className="flex flex-col gap-4">
      <Field className="flex max-w-[460px] flex-col gap-1.5">
        <FieldLabel className="text-[13px] font-semibold">Buscar atividade</FieldLabel>
        <Input className="campo" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ex.: alvenaria, pintura, elevador" autoComplete="off" />
      </Field>
      <p role="status" className="text-[13px] text-muted-foreground">
        {achadas.length === atividades.length ? `${atividades.length} atividades` : `${achadas.length} de ${atividades.length} atividades`}
      </p>
      <ul className="grid gap-3 lg:grid-cols-2">
        {achadas.slice(0, 60).map((a) => (
          <li key={a.id}>
            <DetalheAtividade atividade={a} />
          </li>
        ))}
      </ul>
      {achadas.length > 60 && <p className="text-[13px] text-muted-foreground">Mostrando as 60 primeiras. Digite mais letras para afinar a busca.</p>}
      {achadas.length === 0 && <p className="rounded-xl bg-fill px-3.5 py-2.5 text-[13px] text-muted-foreground">Nenhuma atividade com esse nome.</p>}
    </div>
  );
}
