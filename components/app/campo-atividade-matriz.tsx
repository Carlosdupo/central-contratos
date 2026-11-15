"use client";

import { useState } from "react";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxLabel, ComboboxList } from "@ui-sdk/react/combobox";
import { DetalheAtividade } from "@/components/app/detalhe-atividade";
import type { AtividadeMatriz } from "@/modules/matriz/consultas";

// Escolha da atividade da matriz na abertura: busca por nome; ao escolher, mostra os dados da atividade logo abaixo.
export function CampoAtividadeMatriz({ atividades }: { atividades: AtividadeMatriz[] }) {
  const [id, setId] = useState<string | null>(null);
  const escolhida = atividades.find((a) => a.id === id) ?? null;
  return (
    <div className="flex flex-col gap-3">
      <Combobox name="matriz" value={id} onValueChange={(v: string | null) => setId(v)}>
        <div className="flex min-w-0 flex-col gap-1.5">
          <ComboboxLabel className="text-[13px] font-semibold">Atividade da matriz</ComboboxLabel>
          <ComboboxInput className="campo" placeholder="Digite para buscar a atividade" autoComplete="off" />
          <span className="text-xs text-muted-foreground">A forma legal e os dados da atividade aparecem ao escolher.</span>
        </div>
        <ComboboxContent>
          <ComboboxEmpty>Nenhuma atividade com esse nome.</ComboboxEmpty>
          <ComboboxList>
            {atividades.map((a) => (
              <ComboboxItem key={a.id} value={a.id} label={a.atividade} keywords={[a.grupo, a.subgrupo ?? ""]}>
                <span className="font-medium">{a.atividade}</span>
                <span className="text-xs text-muted-foreground">{a.subgrupo ?? a.grupo}</span>
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {escolhida && <DetalheAtividade atividade={escolhida} />}
    </div>
  );
}
