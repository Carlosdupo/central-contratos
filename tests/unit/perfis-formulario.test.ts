import { describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { lerPerfisDoFormulario } from "@/modules/admin/perfis-formulario";

const OBRA = "00000000-0000-0000-0000-0000000000aa";
const form = (pares: [string, string][]) => {
  const d = new FormData();
  for (const [k, v] of pares) d.append(k, v);
  return d;
};

describe("Perfis do cadastro de usuário", () => {
  test("Auxiliar Obra vira o papel coordenador_obra com as obras no nível auxiliar", () => {
    expect(lerPerfisDoFormulario(form([["papeis", "auxiliar_obra"], ["obras_auxiliar", OBRA]]))).toEqual({ papeis: ["coordenador_obra"], obrasAuxiliar: [OBRA] });
  });
  test("Auxiliar Obra sem obra é recusado", () => {
    expect(lerPerfisDoFormulario(form([["papeis", "auxiliar_obra"]]))).toEqual({ erro: "Escolha a obra em que a pessoa será Auxiliar Obra." });
  });
  test("sem Auxiliar Obra, obras marcadas são ignoradas e o papel não repete", () => {
    expect(lerPerfisDoFormulario(form([["papeis", "rh"], ["obras_auxiliar", OBRA]]))).toEqual({ papeis: ["rh"], obrasAuxiliar: [] });
    expect(lerPerfisDoFormulario(form([["papeis", "coordenador_obra"], ["papeis", "auxiliar_obra"], ["obras_auxiliar", OBRA]]))).toEqual({ papeis: ["coordenador_obra"], obrasAuxiliar: [OBRA] });
  });
  test("nenhum perfil é recusado; valor desconhecido é ignorado", () => {
    expect(lerPerfisDoFormulario(form([["papeis", "dono"]]))).toEqual({ erro: "Escolha pelo menos um perfil." });
  });
});
