// Escopo da contratação por pacote da matriz: a obra contrata um grupo, um subgrupo ou uma atividade, e pode tirar o que não entra.
// O banco calcula a forma legal pela mesma regra (app.forma_legal_mais_rigorosa) e confere tudo de novo.

/** Da mais rigorosa para a menos rigorosa. */
export const FORMAS_LEGAIS = ["Contrato + Edital", "Contrato", "Contrato genérico", "Proposta comercial assinada", "Pedido", "Medição excel"] as const;

const peso = (forma: string) => {
  const i = FORMAS_LEGAIS.findIndex((f) => f.toLowerCase() === forma.trim().toLowerCase());
  return i < 0 ? FORMAS_LEGAIS.length : i;
};

/** A forma legal da contratação é a mais rigorosa entre as das atividades. Forma desconhecida conta como a menos rigorosa. */
export function formaLegalMaisRigorosa(formas: string[]): string | null {
  if (formas.length === 0) return null;
  return [...formas].sort((a, b) => peso(a) - peso(b))[0];
}

/** As formas diferentes entre as atividades, da mais para a menos rigorosa. */
export function formasDiferentes(formas: string[]): string[] {
  return [...new Set(formas)].sort((a, b) => peso(a) - peso(b));
}

export type AtividadeDoEscopo = { id: string; atividade: string; grupo: string; subgrupo: string | null };

const plural = (n: number) => `${n} ${n === 1 ? "atividade" : "atividades"}`;

/**
 * Rótulo do escopo (vira o "pacote" da contratação):
 * uma atividade só: o nome dela; todas do mesmo subgrupo: "21.1 Elétrica (13 de 14 atividades)"; do mesmo grupo: "21 Inst. Elétrica (n de m atividades)".
 * Quando todas as atividades do pacote entram, fica só a contagem ("21.1 Elétrica (14 atividades)").
 */
export function rotuloDoEscopo(marcadas: AtividadeDoEscopo[], todas: AtividadeDoEscopo[]): string {
  if (marcadas.length === 1) return marcadas[0].atividade;
  const contagem = (total: number) => (marcadas.length === total ? `(${plural(total)})` : `(${marcadas.length} de ${plural(total)})`);
  const subgrupos = new Set(marcadas.map((a) => a.subgrupo));
  const [primeiro] = marcadas;
  if (subgrupos.size === 1 && primeiro.subgrupo) {
    const total = todas.filter((a) => a.subgrupo === primeiro.subgrupo).length;
    return `${primeiro.subgrupo} ${contagem(total)}`;
  }
  const grupos = new Set(marcadas.map((a) => a.grupo));
  if (grupos.size === 1) {
    const total = todas.filter((a) => a.grupo === primeiro.grupo).length;
    return `${primeiro.grupo} ${contagem(total)}`;
  }
  return `${plural(marcadas.length)} da matriz`;
}
