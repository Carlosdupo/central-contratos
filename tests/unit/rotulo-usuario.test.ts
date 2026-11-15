import { describe, expect, test } from "vitest";
import { rotuloDoUsuario } from "@/lib/rotulo-usuario";

describe("Nome no menu", () => {
  test("auxiliar aparece como primeiro nome + Auxiliar + obra", () => {
    expect(rotuloDoUsuario("Ana Carolina Souza", [{ nivel: "auxiliar", obra: "Block" }])).toBe("Ana - Auxiliar Block");
  });
  test("quem coordena alguma obra, ou não tem obra, aparece com o nome inteiro", () => {
    expect(rotuloDoUsuario("Ana Carolina Souza", [{ nivel: "auxiliar", obra: "Block" }, { nivel: "coordenador", obra: "Vértice" }])).toBe("Ana Carolina Souza");
    expect(rotuloDoUsuario("Ana Carolina Souza", [])).toBe("Ana Carolina Souza");
  });
});
