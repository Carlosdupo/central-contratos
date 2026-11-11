import { describe, expect, it } from "vitest";
import { lerParametroDoFormulario } from "@/modules/admin/parametros";
import { camposAlterados, formatarValor } from "@/modules/admin/auditoria";

const form = (campos: Record<string, string>) => {
  const f = new FormData();
  Object.entries(campos).forEach(([k, v]) => f.set(k, v));
  return f;
};

describe("parâmetros", () => {
  it("aceita o limite de R$ 4.000 e rejeita valor negativo ou vazio", () => {
    expect(lerParametroDoFormulario("limite_escolha_obra_reais", form({ valor: "4000" }))).toEqual({ valor: 4000 });
    expect(lerParametroDoFormulario("limite_escolha_obra_reais", form({ valor: "-1" }))).toHaveProperty("erro");
    expect(lerParametroDoFormulario("limite_escolha_obra_reais", form({ valor: "" }))).toHaveProperty("erro");
  });
  it("horário de corte só de 0 a 23, inteiro", () => {
    expect(lerParametroDoFormulario("horario_corte_integracao", form({ valor: "18" }))).toEqual({ valor: 18 });
    expect(lerParametroDoFormulario("horario_corte_integracao", form({ valor: "24" }))).toHaveProperty("erro");
    expect(lerParametroDoFormulario("horario_corte_integracao", form({ valor: "17.5" }))).toHaveProperty("erro");
  });
  it("prazo do RH com dias e marcação de dias úteis", () => {
    expect(lerParametroDoFormulario("prazo_analise_rh", form({ dias: "2", uteis: "on" }))).toEqual({ valor: { dias: 2, uteis: true } });
    expect(lerParametroDoFormulario("prazo_analise_rh", form({ dias: "2" }))).toEqual({ valor: { dias: 2, uteis: false } });
  });
  it("prazos das etapas: etapa sem dias fica sem prazo", () => {
    const r = lerParametroDoFormulario("prazos_etapas", form({ dias_7: "7", dias_10: "2", uteis_10: "on", dias_3: "" }));
    expect(r).toEqual({ valor: { "7": { dias: 7, uteis: false }, "10": { dias: 2, uteis: true } } });
  });
  it("fuso horário não é editável", () => {
    expect(lerParametroDoFormulario("fuso_horario", form({ valor: "UTC" }))).toHaveProperty("erro");
  });
});

describe("auditoria", () => {
  it("lista só os campos que mudaram, sem colunas técnicas", () => {
    const antes = { id: "1", nome: "Obra A", ativa: true, updated_at: "x" };
    const depois = { id: "1", nome: "Obra A", ativa: false, updated_at: "y" };
    expect(camposAlterados(antes, depois)).toEqual([{ campo: "ativa", de: true, para: false }]);
  });
  it("inclusão mostra todos os campos preenchidos", () => {
    expect(camposAlterados(null, { id: "1", nome: "Obra A" })).toEqual([
      { campo: "id", de: null, para: "1" },
      { campo: "nome", de: null, para: "Obra A" },
    ]);
  });
  it("formata valores para leitura", () => {
    expect(formatarValor(true)).toBe("sim");
    expect(formatarValor(null)).toBe("—");
    expect(formatarValor({ dias: 2 })).toBe('{"dias":2}');
  });
});
