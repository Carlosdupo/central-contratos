import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { decodificarCsv, lerCsv } from "@/lib/csv";
import { cicloDoPedido, ciclosDoPadrao } from "@/lib/calendario";
import { lerCronograma, lerData, lerPlanilha, lerSituacao } from "@/lib/planilha";

describe("CSV", () => {
  test("separador ponto e vírgula, aspas e BOM", () => {
    expect(lerCsv('﻿a;b;c\r\n1;"x;y";"diz ""oi"""\r\n\r\n')).toEqual([["a", "b", "c"], ["1", "x;y", 'diz "oi"']]);
  });
  test("separador vírgula", () => {
    expect(lerCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  test("o separador vem das linhas com conteúdo, mesmo que o arquivo comece com linhas vazias", () => {
    expect(lerCsv("\r\n\r\na;b,c;d\r\n1;2,5;3")).toEqual([["a", "b,c", "d"], ["1", "2,5", "3"]]);
  });
  test("UTF-8 ou Windows-1252 (CSV padrão do Excel no Brasil)", () => {
    const texto = "Mão de obra;Fundação";
    expect(decodificarCsv(new TextEncoder().encode(texto))).toBe(texto);
    expect(decodificarCsv(Buffer.from(texto, "latin1"))).toBe(texto);
  });
});

describe("Datas e situações da planilha", () => {
  test("dd/mm/aaaa e ISO; ok, _, NA e erro de fórmula viram vazio; lixo é inválido", () => {
    expect(lerData("31/10/2026")).toBe("2026-10-31");
    expect(lerData("2026-10-31")).toBe("2026-10-31");
    expect(lerData("ok")).toBeNull();
    expect(lerData("#REF!")).toBeNull();
    expect(lerData("")).toBeNull();
    expect(lerData("31/02/2026")).toBeUndefined();
    expect(lerData("amanhã")).toBeUndefined();
  });

  test("data = feito no dia; ok = feito sem data; NA e não tem = não se aplica; _ e erro de fórmula = pendente", () => {
    expect(lerSituacao("13/05/2025")).toEqual({ situacao: "feito", data: "2025-05-13" });
    expect(lerSituacao("ok")).toEqual({ situacao: "feito_sem_data", data: null });
    expect(lerSituacao("OK ")).toEqual({ situacao: "feito_sem_data", data: null });
    expect(lerSituacao("NA")).toEqual({ situacao: "nao_se_aplica", data: null });
    expect(lerSituacao("NAO TEM ")).toEqual({ situacao: "nao_se_aplica", data: null });
    expect(lerSituacao("não tem")).toEqual({ situacao: "nao_se_aplica", data: null });
    expect(lerSituacao("_")).toEqual({ situacao: "pendente", data: null });
    expect(lerSituacao("")).toEqual({ situacao: "pendente", data: null });
    expect(lerSituacao("#VALUE!")).toEqual({ situacao: "pendente", data: null });
    expect(lerSituacao("talvez")).toBeUndefined();
  });
});

describe("Leitura da planilha (trecho anonimizado no formato do Excel)", () => {
  const utf8 = readFileSync("tests/fixtures/planilha-mo-amostra.csv", "utf8");
  const ansi = Buffer.from(utf8, "latin1"); // o Excel do Brasil salva "CSV" em Windows-1252

  test("acha o cabeçalho depois dos títulos, ignora as repetições e preenche a fase dos itens", () => {
    const r = lerPlanilha(utf8);
    expect(r.erro).toBeUndefined();
    expect(r.itens.map((i) => [i.descricao, i.fase])).toEqual([
      ["Contrato de estacas", "INICIO DE OBRA + FUNDAÇAO"],
      ["Contrato de escavação", "INICIO DE OBRA + FUNDAÇAO"],
      ["Layout de canteiro (item sem ID de pacote)", "INICIO DE OBRA + FUNDAÇAO"],
      ["Item que não se aplica", "INICIO DE OBRA + FUNDAÇAO"],
      ["Contrato de fôrmas", "INICIO SUPRA + EMBASAMENTO"],
      ["Contrato de alvenaria", "TORRE E GERAL"],
    ]);
  });

  test("lê as colunas pelos nomes reais, inclusive quando o cabeçalho muda de um bloco para outro", () => {
    const [estacas, escavacao, , , formas, alvenaria] = lerPlanilha(utf8).itens;
    expect(estacas).toMatchObject({ id_pacote: "9001", local: "Fundação", pacote_vinculado: "Bloco A", responsavel: "Ana", inicio_manual: "2025-07-15", prazo_compras_dias: 60, prazo_chegada_dias: 30, observacao: "fechado com a empresa X", sienge_solicitacao: null });
    expect(escavacao).toMatchObject({ prazo_chegada_dias: 0, responsavel: null });
    expect(formas).toMatchObject({ sienge_solicitacao: "55123", data_real_obra: "2025-07-02" });
    // Neste bloco o cabeçalho veio sem o nome "ID": a coluna continua valendo na mesma posição.
    expect(alvenaria).toMatchObject({ id_pacote: "9004", observacao: "aguardando projeto" });
  });

  test("ok é feito sem data, NA e não tem não se aplicam, _ é pendente, e erro de fórmula não barra", () => {
    const [estacas, escavacao, layout, naoSeAplica, formas, alvenaria] = lerPlanilha(utf8).itens;
    expect([estacas.situacao_obra, estacas.situacao_compras]).toEqual(["feito_sem_data", "feito_sem_data"]);
    expect([escavacao.situacao_obra, escavacao.data_real_obra, escavacao.situacao_compras]).toEqual(["feito", "2025-05-13", "pendente"]);
    expect([layout.id_pacote, layout.situacao_obra, layout.situacao_compras]).toEqual([null, "feito_sem_data", "feito_sem_data"]);
    expect([naoSeAplica.situacao_obra, naoSeAplica.situacao_compras]).toEqual(["nao_se_aplica", "nao_se_aplica"]);
    expect([formas.situacao_compras, alvenaria.situacao_obra]).toEqual(["pendente", "pendente"]);
  });

  test("itens sem descrição e células à direita (totais, a partir da coluna S) são ignorados", () => {
    const r = lerPlanilha(utf8);
    expect(r.itens.some((i) => i.id_pacote === "9003")).toBe(false);
    expect(JSON.stringify(r.itens)).not.toContain("TOTAL 99");
  });

  test("o arquivo em Windows-1252 dá o mesmo resultado que o UTF-8", () => {
    expect(lerPlanilha(decodificarCsv(ansi))).toEqual(lerPlanilha(utf8));
  });

  test("linhas coladas do Excel (Ctrl+C: tabulação, aspas só onde a célula tem quebra de linha) dão o mesmo resultado", () => {
    const celula = (c: string) => (/[\t\n"]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
    const copiado = lerCsv(utf8).map((l) => l.map(celula).join("\t")).join("\r\n") + "\r\n";
    expect(lerPlanilha(copiado)).toEqual(lerPlanilha(utf8));
    const comVirgulas = "Descrição\tPrazo que compras precisa\tPrazo até chegar na obra\tCausa do atraso\r\nMaterial A, B e C\t15\t30\t\"esperando, ver com\nfornecedor\"\r\n";
    expect(lerPlanilha(comVirgulas).itens[0]).toMatchObject({ descricao: "Material A, B e C", prazo_compras_dias: 15, observacao: "esperando, ver com\nfornecedor" });
  });

  test("avisa a linha com valor inválido e a falta do cabeçalho", () => {
    expect(lerPlanilha("Descrição;Prazo que compras precisa;Prazo até chegar na obra\nX;abc;30").erro).toContain("Linha 2");
    expect(lerPlanilha("Fase;ID\nA;B").erro).toContain("cabeçalho");
  });
});

describe("Leitura do cronograma", () => {
  test("ID e Data de Início (a atual, não a da linha de base), no formato do PREVISION", () => {
    const r = lerCronograma(readFileSync("tests/fixtures/cronograma-amostra.csv", "utf8"));
    expect(r.erro).toBeUndefined();
    expect(r.pacotes).toEqual([
      { id_pacote: "9001", inicio: "2025-07-16" },
      { id_pacote: "9002", inicio: "2025-09-02" },
      { id_pacote: "9004", inicio: "2026-11-12" },
      { id_pacote: "13019812", inicio: "2025-07-31" },
    ]);
  });
  test("cronograma colado do Excel (tabulação)", () => {
    expect(lerCronograma("ID\tPacote de trabalho\tData de Início\r\n30040340\tele - ligação de luz, padrão\t01/04/2025\r\n").pacotes).toEqual([{ id_pacote: "30040340", inicio: "2025-04-01" }]);
  });
  test("data inválida aponta a linha", () => {
    expect(lerCronograma("ID;Data de Início\nP1;31/02/2026").erro).toContain("Linha 2");
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
