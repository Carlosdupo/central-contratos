import { describe, expect, test } from "vitest";
import { FORMAS_LEGAIS, formaLegalMaisRigorosa, formasDiferentes, rotuloDoEscopo, type AtividadeDoEscopo } from "@/lib/escopo";

describe("Forma legal do escopo: a mais rigorosa entre as atividades", () => {
  test("a ordem é Contrato + Edital > Contrato > Contrato genérico > Proposta comercial assinada > Pedido > Medição excel", () => {
    expect([...FORMAS_LEGAIS]).toEqual(["Contrato + Edital", "Contrato", "Contrato genérico", "Proposta comercial assinada", "Pedido", "Medição excel"]);
    for (let i = 0; i < FORMAS_LEGAIS.length - 1; i++) {
      expect(formaLegalMaisRigorosa([FORMAS_LEGAIS[i + 1], FORMAS_LEGAIS[i]])).toBe(FORMAS_LEGAIS[i]);
    }
  });

  test("uma atividade só fica com a própria forma; lista vazia não tem forma", () => {
    expect(formaLegalMaisRigorosa(["Pedido"])).toBe("Pedido");
    expect(formaLegalMaisRigorosa([])).toBeNull();
  });

  test("mistura: vale a mais rigorosa, e as formas diferentes saem da mais para a menos rigorosa", () => {
    const formas = ["Pedido", "Contrato", "Pedido", "Proposta comercial assinada", "Medição excel"];
    expect(formaLegalMaisRigorosa(formas)).toBe("Contrato");
    expect(formasDiferentes(formas)).toEqual(["Contrato", "Proposta comercial assinada", "Pedido", "Medição excel"]);
  });

  test("forma desconhecida conta como a menos rigorosa (e maiúsculas não importam)", () => {
    expect(formaLegalMaisRigorosa(["Outra coisa", "Medição excel"])).toBe("Medição excel");
    expect(formaLegalMaisRigorosa(["pedido", "CONTRATO"])).toBe("CONTRATO");
  });
});

describe("Rótulo do escopo", () => {
  const eletrica = Array.from({ length: 14 }, (_, i) => ({ id: `e${i}`, atividade: `Elétrica ${i}`, grupo: "21 Inst. Elétrica", subgrupo: "21.1 Elétrica" }));
  const spda = [{ id: "s1", atividade: "SPDA", grupo: "21 Inst. Elétrica", subgrupo: "21.2 SPDA" }];
  const todas: AtividadeDoEscopo[] = [...eletrica, ...spda, { id: "a1", atividade: "Alvenaria", grupo: "9 Alvenaria", subgrupo: "9.1 Vedação" }];

  test("uma atividade: o nome dela", () => {
    expect(rotuloDoEscopo([eletrica[0]], todas)).toBe("Elétrica 0");
  });
  test("parte de um subgrupo: '21.1 Elétrica (13 de 14 atividades)'", () => {
    expect(rotuloDoEscopo(eletrica.slice(1), todas)).toBe("21.1 Elétrica (13 de 14 atividades)");
  });
  test("o subgrupo inteiro: só a contagem", () => {
    expect(rotuloDoEscopo(eletrica, todas)).toBe("21.1 Elétrica (14 atividades)");
  });
  test("subgrupos diferentes do mesmo grupo: o grupo", () => {
    expect(rotuloDoEscopo([...eletrica.slice(0, 5), ...spda], todas)).toBe("21 Inst. Elétrica (6 de 15 atividades)");
    expect(rotuloDoEscopo([...eletrica, ...spda], todas)).toBe("21 Inst. Elétrica (15 atividades)");
  });
  test("grupos diferentes: só a contagem", () => {
    expect(rotuloDoEscopo([eletrica[0], todas[todas.length - 1]], todas)).toBe("2 atividades da matriz");
  });
});
