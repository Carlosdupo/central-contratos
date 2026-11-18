import { describe, expect, test } from "vitest";
import { diasNaColuna, ehColunaMovivel, estaParado } from "@/lib/negociacoes";

describe("Quadro de negociações: regras", () => {
  test("dias na coluna contam dias corridos inteiros", () => {
    const agora = new Date("2026-11-17T12:00:00-03:00");
    expect(diasNaColuna("2026-11-17T08:00:00-03:00", agora)).toBe(0);
    expect(diasNaColuna("2026-11-09T12:00:00-03:00", agora)).toBe(8);
  });
  test("só Negociado, falta contrato há mais de 5 dias fica parado", () => {
    expect(estaParado("falta_contrato", 6)).toBe(true);
    expect(estaParado("falta_contrato", 5)).toBe(false);
    expect(estaParado("em_negociacao", 30)).toBe(false);
  });
  test("Contratação aberta não é coluna de mover à mão", () => {
    expect(ehColunaMovivel("falta_contrato")).toBe(true);
    expect(ehColunaMovivel("contratacao_aberta")).toBe(false);
  });
});
