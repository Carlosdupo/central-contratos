import { describe, expect, it } from "vitest";
import { quemAnalisa, resumoPendencias, textoPendencias, type EstadoItem } from "@/modules/terceiros/dominio/documentos";

const item = (nome: string, estado: EstadoItem, responsavel: "rh" | "sst" = "rh") => ({ estado, tipo: { nome, responsavel } });

describe("pendências para cobrar a empresa", () => {
  it("separa o que falta enviar, o que voltou e com quem está", () => {
    const r = resumoPendencias([
      item("RG", "aprovado"),
      item("ASO", "enviado", "sst"),
      item("Ordem de serviço", "enviado", "sst"),
      item("eSocial", "falta"),
      item("NR-35", "reprovado", "sst"),
    ]);
    expect(r).toMatchObject({ aprovados: 1, exigidos: 5, faltaEnviar: ["eSocial"], corrigir: ["NR-35"], comRh: [], comSst: ["ASO", "Ordem de serviço"] });
    expect(textoPendencias(r)).toBe("1 de 5 aprovados. A empresa não enviou: eSocial. A empresa precisa corrigir: NR-35. Com a Segurança: ASO, Ordem de serviço.");
    expect(quemAnalisa(r)).toBe("SEGURANÇA");
  });
  it("RH aprovou e só falta a Segurança (caso da PLUMBER)", () => {
    const r = resumoPendencias([item("RG", "aprovado"), item("Ordem de serviço", "enviado", "sst")]);
    expect(textoPendencias(r)).toBe("1 de 2 aprovados. Com a Segurança: Ordem de serviço.");
  });
  it("encurta listas longas", () => {
    const r = resumoPendencias(["A", "B", "C", "D", "E"].map((n) => item(n, "falta")));
    expect(textoPendencias(r)).toContain("A, B, C e mais 2");
    expect(quemAnalisa(r)).toBeNull();
  });
});
