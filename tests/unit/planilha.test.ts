import { describe, expect, test } from "vitest";
import { lerCsv } from "@/lib/csv";
import { cicloDoPedido, ciclosDoPadrao } from "@/lib/calendario";
import { lerCronograma, lerData, lerPlanilha } from "@/lib/planilha";

describe("CSV", () => {
  test("separador ponto e vírgula, aspas e BOM", () => {
    expect(lerCsv('﻿a;b;c\r\n1;"x;y";"diz ""oi"""\r\n\r\n')).toEqual([["a", "b", "c"], ["1", "x;y", 'diz "oi"']]);
  });
  test("separador vírgula", () => {
    expect(lerCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("Datas da planilha", () => {
  test("dd/mm/aaaa e ISO; ok, _ e NA viram vazio; lixo é inválido", () => {
    expect(lerData("31/10/2026")).toBe("2026-10-31");
    expect(lerData("2026-10-31")).toBe("2026-10-31");
    expect(lerData("ok")).toBeNull();
    expect(lerData("_")).toBeNull();
    expect(lerData("NA")).toBeNull();
    expect(lerData("")).toBeNull();
    expect(lerData("31/02/2026")).toBeUndefined();
    expect(lerData("amanhã")).toBeUndefined();
  });
});

describe("Leitura da planilha de MO", () => {
  const csv = [
    "Fase;ID do pacote;Descrição;Responsável;Prazo que compras precisa (dias);Prazo até chegar na obra (dias);Data real da obra;Causa do atraso/observação",
    "Fundação;P1;Estacas;Ana;30;30;15/10/2026;",
    ";;Item sem ID;;60;30;ok;aguardando projeto",
  ].join("\n");
  test("mapeia as colunas pelo nome, sem diferenciar acento", () => {
    const r = lerPlanilha(csv);
    expect(r.erro).toBeUndefined();
    expect(r.itens).toHaveLength(2);
    expect(r.itens[0]).toMatchObject({ fase: "Fundação", id_pacote: "P1", descricao: "Estacas", prazo_compras_dias: 30, prazo_chegada_dias: 30, data_real_obra: "2026-10-15" });
    expect(r.itens[1]).toMatchObject({ id_pacote: null, descricao: "Item sem ID", data_real_obra: null, observacao: "aguardando projeto" });
  });
  test("avisa a linha com valor inválido e a falta da coluna de descrição", () => {
    expect(lerPlanilha("Descrição;Prazo compras\nX;abc").erro).toContain("Linha 2");
    expect(lerPlanilha("Fase;ID\nA;B").erro).toContain("descrição");
  });
});

describe("Leitura do cronograma", () => {
  test("ID do pacote e início", () => {
    expect(lerCronograma("ID;Início\nP1;01/06/2026\nP2;2026-12-20\n;31/12/2026").pacotes).toEqual([
      { id_pacote: "P1", inicio: "2026-06-01" },
      { id_pacote: "P2", inicio: "2026-12-20" },
    ]);
    expect(lerCronograma("ID;Início\nP1;31/02/2026").erro).toContain("Linha 2");
  });
});

describe("Calendário", () => {
  const ciclos = [
    { limite: "2026-01-10", inicio: "2026-01-11" },
    { limite: "2026-01-25", inicio: "2026-01-26" },
    { limite: "2026-02-10", inicio: "2026-02-11" },
  ];
  test("o pedido entra no primeiro ciclo cujo limite não passou (inclusive no dia do corte)", () => {
    expect(cicloDoPedido("2026-01-05", ciclos)?.inicio).toBe("2026-01-11");
    expect(cicloDoPedido("2026-01-10", ciclos)?.inicio).toBe("2026-01-11");
    expect(cicloDoPedido("2026-01-11", ciclos)?.inicio).toBe("2026-01-26");
  });
  test("virada de mês; sem ciclo depois do último", () => {
    expect(cicloDoPedido("2026-01-26", ciclos)?.inicio).toBe("2026-02-11");
    expect(cicloDoPedido("2026-02-11", ciclos)).toBeNull();
  });
  test("padrão do ano: dois ciclos por mês, com fevereiro e fim de mês", () => {
    const c = ciclosDoPadrao(2026, 10, 31);
    expect(c).toHaveLength(24);
    expect(c.find((x) => x.mes === 2 && x.ciclo === 2)).toMatchObject({ limite: "2026-02-28", inicio: "2026-03-01" });
    expect(c.find((x) => x.mes === 12 && x.ciclo === 2)).toMatchObject({ limite: "2026-12-31", inicio: "2027-01-01" });
  });
});
