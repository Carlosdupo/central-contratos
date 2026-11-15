import { describe, expect, test } from "vitest";
import { lerValor, mascaraReais, numeroOuNulo, valorParaCampo } from "@/lib/valor-reais";

describe("Valor em R$", () => {
  test("a máscara mostra 1.234,56 enquanto a pessoa digita só números", () => {
    expect(mascaraReais("1")).toBe("0,01");
    expect(mascaraReais("12")).toBe("0,12");
    expect(mascaraReais("123")).toBe("1,23");
    expect(mascaraReais("123456")).toBe("1.234,56");
    expect(mascaraReais("123456789")).toBe("1.234.567,89");
    expect(mascaraReais("1.234,56" + "7")).toBe("12.345,67");
    expect(mascaraReais("abc")).toBe("");
    expect(mascaraReais("")).toBe("");
  });

  test("o servidor converte 1.234,56 para 1234.56", () => {
    expect(lerValor("1.234,56")).toBe(1234.56);
    expect(lerValor("0,01")).toBe(0.01);
    expect(lerValor("1.234.567,89")).toBe(1234567.89);
    expect(lerValor("  4.000,00 ")).toBe(4000);
    expect(lerValor("")).toBeNaN();
    expect(lerValor(null)).toBeNaN();
    expect(lerValor("abc")).toBeNaN();
  });

  test("numeroOuNulo devolve número com 2 casas ou null", () => {
    expect(numeroOuNulo("1.234,56")).toBe(1234.56);
    expect(numeroOuNulo("")).toBeNull();
    expect(numeroOuNulo(null)).toBeNull();
    expect(numeroOuNulo("x")).toBeNull();
  });

  test("o que a máscara mostra volta igual no servidor", () => {
    for (const digitos of ["1", "99", "100", "123456", "100000000"]) {
      expect(lerValor(mascaraReais(digitos))).toBe(Number(digitos) / 100);
    }
  });

  test("valor do banco volta para o campo", () => {
    expect(valorParaCampo(1234.5)).toBe("1.234,50");
    expect(valorParaCampo("2800.00")).toBe("2.800,00");
    expect(valorParaCampo(null)).toBe("");
  });
});
