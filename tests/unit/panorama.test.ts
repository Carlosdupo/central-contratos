import { describe, expect, test } from "vitest";
import {
  areaDoPapel, blocosDaTrilha, contagemPorArea, descricaoDaTrilha, estadoDoSegmento, filtrar, passoPrincipal, pesoNaLista, resumo, textoDoPrazo,
  type ContratacaoPanorama, type PassoPanorama,
} from "@/lib/panorama";

const passo = (etapa: number, chave: string, situacao: PassoPanorama["situacao"], extra: Partial<PassoPanorama> = {}): PassoPanorama => ({
  etapa, chave, nome: `Etapa ${chave}`, area: "Obra", responsavel: "Obra", situacao, concluidaEm: null, prazo: null, ...extra,
});

function contratacao(extra: Partial<ContratacaoPanorama> = {}): ContratacaoPanorama {
  return {
    id: "c1", codigo: "CT-2026-001", servico: "Alvenaria de vedação", obraId: "o1", obra: "Block", prefixoSienge: "CT/BL", situacao: "em_andamento", urgente: false, urgenteData: null,
    urgenteMotivo: null, aditivoDe: null, foraDoPrazo: false, abertaEm: "2026-10-01", fornecedor: "Construtora Pilar", valor: 1000, sienge: null, motivoCancelamento: null,
    empresaJaLiberada: false, equipe: null, devolucao: null,
    passos: [
      passo(1, "solicitacao", "concluida"),
      passo(2, "cotacao", "concluida"),
      passo(5, "autorizacao", "em_andamento", { area: "Suprimentos", responsavel: "Suprimentos", prazo: { tipo: "atrasada", restantes: -2, uteis: true } }),
      passo(7, "contrato", "pendente", { area: "Contratos" }),
      passo(9, "assinaturas", "pendente", { area: "Assinaturas" }),
      passo(10, "documentacao", "pulada", { area: "RH" }),
    ],
    ...extra,
  };
}

describe("Panorama: áreas e trilha", () => {
  test("a área vem do papel da etapa", () => {
    expect(areaDoPapel("coordenador_obra")).toBe("Obra");
    expect(areaDoPapel("gerente_suprimentos")).toBe("Suprimentos");
    expect(areaDoPapel("sst")).toBe("Segurança");
    expect(areaDoPapel(null)).toBe("Assinaturas");
  });

  test("estado de cada segmento: feito, atual, atual com atraso, ainda não chegou, não se aplica", () => {
    const c = contratacao();
    expect(c.passos.map((p) => estadoDoSegmento(c, p))).toEqual(["feito", "feito", "tarde", "pendente", "pendente", "na"]);
  });

  test("a trilha junta as etapas em blocos, na ordem", () => {
    const blocos = blocosDaTrilha(contratacao());
    expect(blocos.map((b) => [b.bloco, b.segmentos.length])).toEqual([[0, 2], [1, 1], [2, 1], [3, 1], [4, 1]]);
  });

  test("texto da trilha para leitor de tela", () => {
    expect(descricaoDaTrilha(contratacao())).toBe("Etapa 3 de 6: Etapa autorizacao, com Suprimentos. Atrasada 2 dias úteis.");
    expect(descricaoDaTrilha(contratacao({ situacao: "liberada" }))).toContain("Equipe liberada");
    expect(descricaoDaTrilha(contratacao({ situacao: "cancelada" }))).toBe("Contratação cancelada.");
  });

  test("com etapas em paralelo, o passo principal é o mais atrasado e o texto avisa", () => {
    const c = contratacao({
      passos: [
        passo(9, "assinaturas", "em_andamento", { area: "Assinaturas", prazo: { tipo: "no_prazo", restantes: 3, uteis: false } }),
        passo(10, "documentacao", "em_andamento", { area: "RH", prazo: { tipo: "vence_hoje", restantes: 0, uteis: true } }),
      ],
    });
    expect(passoPrincipal(c)?.chave).toBe("documentacao");
    expect(descricaoDaTrilha(c)).toContain("Mais 1 em paralelo");
  });
});

describe("Panorama: prazos, filtros e resumo", () => {
  test("texto do prazo não depende de cor", () => {
    expect(textoDoPrazo({ tipo: "atrasada", restantes: -1, uteis: false })).toBe("Atrasada 1 dia");
    expect(textoDoPrazo({ tipo: "vence_hoje", restantes: 0, uteis: false })).toBe("Vence hoje");
    expect(textoDoPrazo({ tipo: "no_prazo", restantes: 5, uteis: true })).toBe("Faltam 5 dias úteis");
    expect(textoDoPrazo(null)).toBe("Sem prazo definido");
  });

  const lista = [
    contratacao(),
    contratacao({ id: "c2", codigo: "CT-2026-002", servico: "Pintura", obraId: "o2", obra: "Vértice", urgente: true, passos: [passo(1, "solicitacao", "em_andamento", { prazo: { tipo: "no_prazo", restantes: 4, uteis: false } })] }),
    contratacao({ id: "c3", codigo: "CT-2026-003", servico: "Esquadrias", fornecedor: "Alumiglass", situacao: "liberada", passos: [passo(1, "solicitacao", "concluida")] }),
    contratacao({ id: "c4", codigo: "CT-2026-004", servico: "Limpeza", situacao: "cancelada", passos: [passo(1, "solicitacao", "pendente")] }),
  ];
  const livre = { obra: null, situacao: "todas" as const, area: null, busca: "" };

  test("filtra por obra, situação, área e busca sem acento", () => {
    expect(filtrar(lista, { ...livre, obra: "o2" }).map((c) => c.id)).toEqual(["c2"]);
    expect(filtrar(lista, { ...livre, situacao: "atraso" }).map((c) => c.id)).toEqual(["c1"]);
    expect(filtrar(lista, { ...livre, situacao: "urgente" }).map((c) => c.id)).toEqual(["c2"]);
    expect(filtrar(lista, { ...livre, situacao: "liberada" }).map((c) => c.id)).toEqual(["c3"]);
    expect(filtrar(lista, { ...livre, area: "Suprimentos" }).map((c) => c.id)).toEqual(["c1"]);
    expect(filtrar(lista, { ...livre, busca: "alumiglass" }).map((c) => c.id)).toEqual(["c3"]);
    expect(filtrar(lista, { ...livre, busca: "CT-2026-004" }).map((c) => c.id)).toEqual(["c4"]);
  });

  test("resumo e contagem por área consideram só o que está em andamento", () => {
    expect(resumo(lista)).toEqual({ emAndamento: 2, obrasEmAndamento: 2, comAtraso: 1, urgentes: 1, vencemHoje: 0, liberadas: 1 });
    const areas = contagemPorArea(lista);
    expect(areas.find((a) => a.area === "Suprimentos")).toEqual({ area: "Suprimentos", total: 1, atrasadas: 1 });
    expect(areas.find((a) => a.area === "Obra")).toEqual({ area: "Obra", total: 1, atrasadas: 0 });
  });

  test("ordem na lista: atrasadas, urgentes, vencendo, o resto, encerradas por último", () => {
    expect(lista.map(pesoNaLista)).toEqual([0, 1, 9, 9]);
  });
});
