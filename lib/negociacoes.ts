export const COLUNAS_NEGOCIACAO = [
  { id: "a_negociar", nome: "A negociar", dica: "O que a obra vai precisar contratar." },
  { id: "em_negociacao", nome: "Em negociação", dica: "Já conversando com empresas." },
  { id: "falta_contrato", nome: "Negociado, falta contrato", dica: "Lembrete: abrir a contratação ou o aditivo." },
  { id: "contratacao_aberta", nome: "Contratação aberta", dica: "Segue no fluxo de contratação." },
] as const;

export type ColunaNegociacao = (typeof COLUNAS_NEGOCIACAO)[number]["id"];
export const COLUNAS_MOVIVEIS = COLUNAS_NEGOCIACAO.filter((c) => c.id !== "contratacao_aberta");
export const DIAS_LEMBRETE_CONTRATO = 5;

export const ehColunaMovivel = (v: unknown): v is Exclude<ColunaNegociacao, "contratacao_aberta"> =>
  COLUNAS_MOVIVEIS.some((c) => c.id === v);

// Dias corridos desde que o cartão entrou na coluna atual.
export function diasNaColuna(movidoEm: string, agora = new Date()): number {
  return Math.max(0, Math.floor((agora.getTime() - new Date(movidoEm).getTime()) / 86_400_000));
}

export const estaParado = (coluna: string, dias: number) => coluna === "falta_contrato" && dias > DIAS_LEMBRETE_CONTRATO;
