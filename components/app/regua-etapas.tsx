// Régua das 12 etapas da contratação: concluída (verde), atual (azul), por vir (cinza).
// A régua é decorativa; o texto ao lado ("Etapa 10 de 12 · Documentação RH") é o que o leitor de tela lê.

export type SituacaoEtapa = "pendente" | "em_andamento" | "concluida" | "pulada";

export function ReguaEtapas({ situacoes, texto }: { situacoes: SituacaoEtapa[]; texto: string }) {
  return (
    <div className="mt-2 flex flex-col gap-1">
      <div className="flex gap-[3px]" aria-hidden="true">
        {situacoes.map((s, i) => (
          <i
            key={i}
            className={`h-[5px] max-w-[22px] flex-1 rounded-[3px] ${
              s === "concluida" || s === "pulada" ? "bg-ok" : s === "em_andamento" ? "bg-primary" : "bg-sep-strong opacity-55"
            }`}
          />
        ))}
      </div>
      <span className="text-[12px] text-muted-foreground tabular-nums">{texto}</span>
    </div>
  );
}
