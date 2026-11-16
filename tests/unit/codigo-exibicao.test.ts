import { describe, expect, it } from "vitest";
import { codigoExibicao } from "@/lib/sienge";

describe("codigoExibicao", () => {
  it("mostra o contrato do Sienge quando já foi lançado", () => {
    expect(codigoExibicao({ codigo: "CT-2026-001", sienge_contrato: "CT/BL0083", sienge_solicitacao: "123" })).toBe("CT/BL0083");
  });
  it("antes do contrato, mostra a solicitação (SS)", () => {
    expect(codigoExibicao({ codigo: "CT-2026-001", sienge_contrato: null, sienge_solicitacao: "123" })).toBe("SS 123");
  });
  it("sem nada do Sienge, mostra o código interno", () => {
    expect(codigoExibicao({ codigo: "CT-2026-001", sienge_contrato: " ", sienge_solicitacao: null })).toBe("CT-2026-001");
  });
});
