"use client";

import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible";
import { formaLegalMaisRigorosa, formasDiferentes } from "@/lib/escopo";

export type AtividadeDoPacote = { id: string; atividade: string; formaLegal: string };

// Escopo de uma contratação por pacote: o rótulo ("21.1 Elétrica (13 de 14 atividades)"), a forma legal (a mais rigorosa entre
// as atividades) e a lista das atividades incluídas, que abre e fecha. Contratação de uma atividade só não mostra nada.
export function EscopoContratacao({ rotulo, atividades }: { rotulo: string | null; atividades: AtividadeDoPacote[] }) {
  if (atividades.length < 2) return null;
  const formas = atividades.map((a) => a.formaLegal);
  const diferentes = formasDiferentes(formas);
  return (
    <section aria-label="Escopo da contratação" className="flex flex-col gap-1.5 rounded-xl bg-fill px-3.5 py-3 text-[13px]">
      <p className="font-semibold">Escopo: {rotulo ?? `${atividades.length} atividades da matriz`}</p>
      <p>
        Forma legal: <strong>{formaLegalMaisRigorosa(formas)}</strong> <span className="text-muted-foreground">(a mais rigorosa entre as atividades incluídas)</span>
      </p>
      {diferentes.length > 1 && <p className="text-muted-foreground">Formas das atividades: {diferentes.map((f) => `${f} (${formas.filter((x) => x === f).length})`).join(", ")}.</p>}
      <Collapsible>
        <CollapsibleTrigger className="botao">{atividades.length} atividades incluídas</CollapsibleTrigger>
        <CollapsiblePanel>
          <ul className="mt-2 flex flex-col gap-0.5">
            {atividades.map((a) => (
              <li key={a.id}>
                {a.atividade} <span className="text-xs text-muted-foreground">· {a.formaLegal}</span>
              </li>
            ))}
          </ul>
        </CollapsiblePanel>
      </Collapsible>
    </section>
  );
}
