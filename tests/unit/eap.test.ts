import { describe, expect, it } from "vitest";
import { agruparEap, lerEap } from "@/lib/eap";

const AMOSTRA = `Nível Referência Descrição
1 1 ESTUDOS, PROJETOS E CONSULTORIAS
2 1.001 PROJETO LEVANTAMENTO TOPOGRÁFICO
2 1.036 CONCESSIONÁRIAS (CASAN, CELESC) - LIGAÇÕES
DEFINITIVAS
1 7 FUNDAÇÃO
2 7.001 ESTACAS
2 7.001 ESTACAS REPETIDA
3 7.001 NIVEL ERRADO`;

describe("lerEap", () => {
  const itens = lerEap(AMOSTRA);
  it("lê nível, referência e descrição e ignora o cabeçalho", () => {
    expect(itens[0]).toEqual({ referencia: "1", descricao: "ESTUDOS, PROJETOS E CONSULTORIAS", nivel: 1 });
    expect(itens.map((i) => i.referencia)).toEqual(["1", "1.001", "1.036", "7", "7.001"]);
  });
  it("junta descrição quebrada em duas linhas", () => {
    expect(itens[2].descricao).toBe("CONCESSIONÁRIAS (CASAN, CELESC) - LIGAÇÕES DEFINITIVAS");
  });
  it("agrupa os serviços pelo grupo de nível 1", () => {
    const g = agruparEap(itens);
    expect(g.map((x) => [x.grupo.referencia, x.filhos.length])).toEqual([["1", 2], ["7", 1]]);
  });
});
