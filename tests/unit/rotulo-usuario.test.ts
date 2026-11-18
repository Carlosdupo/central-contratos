import { describe, expect, test } from "vitest";
import { nomeComPapelNaObra, rotuloDoUsuario, rotuloDosPerfis } from "@/lib/rotulo-usuario";

describe("Nome no menu", () => {
  test("auxiliar aparece como primeiro nome + Auxiliar + obra", () => {
    expect(rotuloDoUsuario("Ana Carolina Souza", [{ nivel: "auxiliar", obra: "Block" }])).toBe("Ana - Auxiliar Block");
  });
  test("quem coordena alguma obra, ou não tem obra, aparece com o nome inteiro", () => {
    expect(rotuloDoUsuario("Ana Carolina Souza", [{ nivel: "auxiliar", obra: "Block" }, { nivel: "coordenador", obra: "Vértice" }])).toBe("Ana Carolina Souza");
    expect(rotuloDoUsuario("Ana Carolina Souza", [])).toBe("Ana Carolina Souza");
  });
});

describe("Perfis por extenso", () => {
  const rotulos = { coordenador_obra: "Coordenador de obra", rh: "RH" };
  test("só auxiliar aparece como Auxiliar Obra", () => {
    expect(rotuloDosPerfis(["coordenador_obra"], ["auxiliar"], rotulos)).toBe("Auxiliar Obra");
  });
  test("coordenador e auxiliar em obras diferentes aparece com os dois", () => {
    expect(rotuloDosPerfis(["coordenador_obra"], ["coordenador", "auxiliar"], rotulos)).toBe("Coordenador de obra, Auxiliar Obra");
  });
  test("coordenador sem auxiliar e outros perfis ficam iguais", () => {
    expect(rotuloDosPerfis(["coordenador_obra", "rh"], ["coordenador"], rotulos)).toBe("Coordenador de obra, RH");
    expect(rotuloDosPerfis(["rh"], [], rotulos)).toBe("RH");
  });
});

describe("Nome com o papel na obra", () => {
  test("auxiliar e coordenador aparecem com o papel antes do nome", () => {
    expect(nomeComPapelNaObra("Ana Carolina", "auxiliar")).toBe("Auxiliar Obra - Ana Carolina");
    expect(nomeComPapelNaObra("Carlos Dupont", "coordenador")).toBe("Coordenador Obra - Carlos Dupont");
  });
  test("sem vínculo com a obra fica só o nome", () => {
    expect(nomeComPapelNaObra("Bruno", null)).toBe("Bruno");
  });
});
