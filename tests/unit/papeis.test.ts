import { describe, expect, it } from "vitest";
import { ehPapel, exigeMfa, temAlgumPapel } from "@/modules/acesso/papeis";

describe("papéis", () => {
  it("reconhece só papéis válidos", () => {
    expect(ehPapel("rh")).toBe(true);
    expect(ehPapel("empresa")).toBe(false);
    expect(ehPapel(undefined)).toBe(false);
  });
  it("verificação em duas etapas obrigatória só para o admin (opcional para RH e Segurança desde 18/11)", () => {
    expect(exigeMfa(["admin"])).toBe(true);
    expect(exigeMfa(["coordenador_obra", "sst"])).toBe(false);
    expect(exigeMfa(["rh"])).toBe(false);
    expect(exigeMfa(["coordenador_obra", "suprimentos"])).toBe(false);
    expect(exigeMfa([])).toBe(false);
  });
  it("checa se o usuário tem algum dos papéis exigidos", () => {
    expect(temAlgumPapel(["suprimentos"], ["suprimentos", "gerente_suprimentos"])).toBe(true);
    expect(temAlgumPapel(["direcao"], ["rh"])).toBe(false);
  });
});
