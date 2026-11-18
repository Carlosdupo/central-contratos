import { describe, expect, it } from "vitest";
import { competenciaDoParametro, csvFinanceiro, oQueFalta, prazoDaCompetencia, situacaoFinanceiro, somarMesesCompetencia, type LinhaFinanceiro } from "@/modules/financeiro/dominio";

const linha = (extra: Partial<LinhaFinanceiro> = {}): LinhaFinanceiro => ({
  empresaId: "e1", razaoSocial: "Pilar Ltda", cnpj: "11222333000181", obras: "Block", exigidos: 12, aprovados: 0, emAnalise: 0, reprovados: 0, liberadaEm: null, ...extra,
});

describe("liberação financeira", () => {
  it("prazo é o dia 30 do mês seguinte (fevereiro: último dia)", () => {
    expect(prazoDaCompetencia("2026-10-01")).toBe("2026-11-30");
    expect(prazoDaCompetencia("2027-01-01")).toBe("2027-02-28");
    expect(prazoDaCompetencia("2026-12-01")).toBe("2027-01-30");
  });
  it("liberada, pendente ou atrasada", () => {
    expect(situacaoFinanceiro(linha({ liberadaEm: "2026-11-27T10:00:00Z" }), "2026-10-01", "2026-12-05")).toBe("liberada");
    expect(situacaoFinanceiro(linha(), "2026-10-01", "2026-11-30")).toBe("pendente");
    expect(situacaoFinanceiro(linha(), "2026-10-01", "2026-12-01")).toBe("atrasada");
  });
  it("depois do prazo, o que está só em análise não é atraso da empresa", () => {
    expect(situacaoFinanceiro(linha({ aprovados: 10, emAnalise: 2 }), "2026-10-01", "2026-12-05")).toBe("pendente");
  });
  it("diz o que falta e de quem", () => {
    expect(oQueFalta(linha({ aprovados: 8, emAnalise: 2, reprovados: 1 }))).toBe("1 para a empresa enviar · 1 para a empresa corrigir · 2 em análise (RH ou Segurança)");
  });
  it("competência pela URL e navegação de meses", () => {
    expect(competenciaDoParametro("2026-09", "2026-10-01")).toBe("2026-09-01");
    expect(competenciaDoParametro("2026-13", "2026-10-01")).toBe("2026-10-01");
    expect(somarMesesCompetencia("2026-12-01", 1)).toBe("2027-01-01");
    expect(somarMesesCompetencia("2026-01-01", -1)).toBe("2025-12-01");
  });
  it("CSV para o Excel: BOM, ponto e vírgula e aspas quando precisa", () => {
    const csv = csvFinanceiro([linha({ razaoSocial: 'Pilar; "Filial"', liberadaEm: "2026-11-27T10:00:00Z", aprovados: 12 })], "2026-10-01", "2026-12-01", (c) => c);
    expect(csv.startsWith("﻿Empresa;CNPJ")).toBe(true);
    expect(csv).toContain('"Pilar; ""Filial"""');
    expect(csv).toContain("Liberada;12;12;;27/11/2026");
  });
});
