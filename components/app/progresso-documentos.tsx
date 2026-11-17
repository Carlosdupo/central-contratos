"use client";

import { Meter, MeterIndicator, MeterLabel, MeterTrack, MeterValue } from "@ui-sdk/react/meter";
import type { Progresso } from "@/modules/terceiros/dominio/documentos";

const textoFaixa = { completo: "Completo", andamento: "Em andamento", pendencia: "Tem pendência" } as const;

export function ProgressoDocumentos({ progresso, rotulo = "Documentação aceita" }: { progresso: Progresso; rotulo?: string }) {
  const { aprovados, exigidos, percentual, faixa } = progresso;
  if (exigidos === 0) return null;
  return (
    <Meter
      value={aprovados}
      max={exigidos}
      format={(v: number) => `${percentual}% aceito, ${v} de ${exigidos}`}
      data-faixa={faixa}
      className="progresso-docs"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <MeterLabel className="text-[13px] font-semibold">{rotulo}</MeterLabel>
        <span className="flex items-baseline gap-2 text-[13px]">
          <MeterValue className="tabular-nums" />
          <span className="progresso-docs-faixa font-semibold">{textoFaixa[faixa]}</span>
        </span>
      </div>
      <MeterTrack>
        <MeterIndicator />
      </MeterTrack>
    </Meter>
  );
}
