import { z } from "zod";

// Formato e limites de cada parâmetro de negócio (tabela public.parametros).
// O admin edita por formulário; nada de JSON digitado à mão.

const prazo = z.object({ dias: z.number().int().min(1).max(365), uteis: z.boolean() });
export const ETAPAS_COM_PRAZO = Array.from({ length: 12 }, (_, i) => String(i + 1));

export const ESQUEMAS = {
  fuso_horario: z.literal("America/Sao_Paulo"),
  limite_escolha_obra_reais: z.number().min(0).max(10_000_000),
  prazo_analise_rh: prazo,
  horario_corte_integracao: z.number().int().min(0).max(23),
  antecedencia_visita_dias: z.number().int().min(0).max(30),
  validade_documentos_meses: z.object({
    aso: z.number().int().min(1).max(120),
    nr: z.number().int().min(1).max(120),
    rg_cnh: z.number().int().min(1).max(240),
  }),
  // partialRecord: no Zod 4, record com enum exige todas as chaves; aqui etapas sem prazo ficam de fora.
  prazos_etapas: z.partialRecord(z.enum(ETAPAS_COM_PRAZO as [string, ...string[]]), prazo),
} as const;

export type ChaveParametro = keyof typeof ESQUEMAS;
export const ehChaveParametro = (c: string): c is ChaveParametro => c in ESQUEMAS;
export const PARAMETROS_SOMENTE_LEITURA: readonly ChaveParametro[] = ["fuso_horario"];

export const ROTULO_PARAMETRO: Record<ChaveParametro, string> = {
  fuso_horario: "Fuso horário",
  limite_escolha_obra_reais: "Limite para a obra escolher fornecedor",
  prazo_analise_rh: "Prazo do RH para analisar documentos",
  horario_corte_integracao: "Horário de corte da integração",
  antecedencia_visita_dias: "Antecedência do pedido de visita",
  validade_documentos_meses: "Validade dos documentos",
  prazos_etapas: "Prazos das etapas da contratação",
};

const inteiro = (v: FormDataEntryValue | null) => {
  const t = typeof v === "string" ? v.trim().replace(",", ".") : "";
  return t === "" ? NaN : Number(t);
};
const marcado = (v: FormDataEntryValue | null) => v === "on" || v === "true";

/** Monta o valor do parâmetro a partir do formulário e valida. Devolve o valor ou a mensagem de erro. */
export function lerParametroDoFormulario(chave: ChaveParametro, dados: FormData): { valor: unknown } | { erro: string } {
  let bruto: unknown;
  switch (chave) {
    case "fuso_horario":
      return { erro: "O fuso horário não pode ser alterado." };
    case "limite_escolha_obra_reais":
    case "horario_corte_integracao":
    case "antecedencia_visita_dias":
      bruto = inteiro(dados.get("valor"));
      break;
    case "prazo_analise_rh":
      bruto = { dias: inteiro(dados.get("dias")), uteis: marcado(dados.get("uteis")) };
      break;
    case "validade_documentos_meses":
      bruto = { aso: inteiro(dados.get("aso")), nr: inteiro(dados.get("nr")), rg_cnh: inteiro(dados.get("rg_cnh")) };
      break;
    case "prazos_etapas": {
      // Etapa sem número de dias = sem prazo definido.
      const prazos: Record<string, { dias: number; uteis: boolean }> = {};
      for (const etapa of ETAPAS_COM_PRAZO) {
        const dias = inteiro(dados.get(`dias_${etapa}`));
        if (!Number.isNaN(dias)) prazos[etapa] = { dias, uteis: marcado(dados.get(`uteis_${etapa}`)) };
      }
      bruto = prazos;
      break;
    }
  }
  const lido = ESQUEMAS[chave].safeParse(bruto);
  return lido.success ? { valor: lido.data } : { erro: "Valor fora do permitido. Confira os números informados." };
}
