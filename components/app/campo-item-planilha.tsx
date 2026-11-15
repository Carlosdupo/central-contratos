"use client";

import { useState } from "react";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxLabel, ComboboxList } from "@ui-sdk/react/combobox";
import { cicloDoPedido, type Ciclo } from "@/lib/calendario";
import { formatarData } from "@/lib/datas";

export type ItemLivre = { id: string; tipo: "MO" | "MAT"; descricao: string; idPacote: string | null; dataSolicitar: string | null };

// Item da planilha de suprimentos na abertura (opcional). Com item: segue as datas da planilha. Sem item: o calendário diz quando a negociação começa.
export function CampoItemPlanilha({ itens, ciclos, hoje }: { itens: ItemLivre[]; ciclos: Ciclo[]; hoje: string }) {
  const [id, setId] = useState<string | null>(null);
  const item = itens.find((i) => i.id === id) ?? null;
  const ciclo = cicloDoPedido(hoje, ciclos);
  return (
    <div className="flex flex-col gap-2">
      {itens.length > 0 && (
        <Combobox name="planejamento_item" value={id} onValueChange={(v: string | null) => setId(v)}>
          <div className="flex min-w-0 flex-col gap-1.5">
            <ComboboxLabel className="text-[13px] font-semibold">Item da planilha de suprimentos (opcional)</ComboboxLabel>
            <ComboboxInput className="campo" placeholder="Digite para buscar; se o serviço não está na planilha, deixe em branco" autoComplete="off" />
          </div>
          <ComboboxContent>
            <ComboboxEmpty>Nenhum item com esse nome.</ComboboxEmpty>
            <ComboboxList>
              {itens.map((i) => (
                <ComboboxItem key={i.id} value={i.id} label={i.descricao} keywords={[i.idPacote ?? ""]}>
                  <span className="font-medium">{i.descricao}</span>
                  <span className="text-xs text-muted-foreground">{i.tipo === "MO" ? "Mão de obra" : "Materiais"}{i.idPacote ? ` · pacote ${i.idPacote}` : ""}</span>
                </ComboboxItem>
              ))}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      )}
      <p role="status" className="rounded-xl bg-primary-soft px-3.5 py-2.5 text-[13px]">
        {item
          ? item.dataSolicitar
            ? `Este item segue as datas da planilha: a obra deveria solicitar até ${formatarData(item.dataSolicitar)}${hoje > item.dataSolicitar ? ". Pedir agora conta como fora do prazo." : "."}`
            : "Este item ainda não tem data calculada na planilha (falta o início do pacote ou os prazos). Suprimentos completa na planilha."
          : ciclo
            ? `Será negociado a partir de ${formatarData(ciclo.inicio)} (pedidos até ${formatarData(ciclo.limite)} entram neste ciclo do calendário).`
            : "O calendário de suprimentos ainda não tem um ciclo para esta data. O gerente de suprimentos define o calendário."}
      </p>
    </div>
  );
}
