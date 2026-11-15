import type { AtividadeMatriz } from "@/modules/matriz/consultas";

const ROTULO_TIPO: Record<string, string> = {
  mao_de_obra: "Só mão de obra",
  material: "Só material",
  material_e_mao_de_obra: "Material + mão de obra",
};

// Dados da atividade da matriz: forma legal, tipo, unidade da negociação, lotes, unidade de medição e observações.
export function DetalheAtividade({ atividade }: { atividade: AtividadeMatriz }) {
  const linhas: [string, string | null][] = [
    ["Forma legal", atividade.formaLegal],
    ["Tipo", atividade.tipo ? (ROTULO_TIPO[atividade.tipo] ?? atividade.tipo) : null],
    ["Unidade da negociação", atividade.unidadeNegociacao],
    ["Lotes", atividade.lotes],
    ["Unidade de medição", atividade.unidadeMedicao],
    ["Observações", atividade.observacoes],
  ];
  return (
    <section aria-label="Dados da atividade da matriz" className="flex flex-col gap-2 rounded-xl bg-fill px-3.5 py-3 text-[13px]">
      <div className="font-semibold">{atividade.atividade}</div>
      <div className="text-xs text-muted-foreground">{[atividade.grupo, atividade.subgrupo].filter(Boolean).join(" › ")}</div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="contents">
            <dt className="text-muted-foreground">{rotulo}</dt>
            <dd>{valor ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
