import { describe, expect, it } from "vitest";
import { gerarCsvSienge, lerNumero, nomeArquivoSienge, serieDePavimentos, type ItemSienge } from "@/lib/solicitacao-sienge";

const eap = [
  { referencia: "23", descricao: "SISTEMAS E INSTALAÇÕES HIDROSSANITÁRIAS", nivel: 1 },
  { referencia: "23.005", descricao: "MÃO DE OBRA INSTALAÇÕES HIDROSSANITÁRIAS", nivel: 2 },
  { referencia: "25", descricao: "EQUIPAMENTOS E SISTEMAS ESPECIAIS", nivel: 1 },
  { referencia: "25.001", descricao: "INFRA CLIMATIZAÇÃO | DRENOS AR CONDICIONADO", nivel: 2 },
];

const item = (id: string, referencia: string, descricao: string, codigo: string, mo: number): ItemSienge => ({
  id, referencia, descricao, codigo_servico: codigo, complemento: "", codigo_auxiliar: "",
  quantidade: 1, unidade: "un", preco_mo: mo, preco_mat: 0, observacao: "", conta_financeira: "",
});

describe("CSV de importação do Sienge", () => {
  it("gera o mesmo formato do arquivo exemplo da obra (BL0087)", () => {
    const csv = gerarCsvSienge(
      {
        unidade_construtiva: "5",
        conta_financeira: "2.01.02.01.03",
        itens: [
          item("c", "25.001", "LIGAÇÕES DE AR CONDICIONADO (DRENOS) - 7 PAVTO - TIPO 02", "26770", 3204.39),
          item("a", "23.005", "INSTALAÇÕES HIDRÁULICAS - 6 PAVTO - TIPO 01", "6680", 9648.05),
          item("b", "23.005", "INSTALAÇÕES HIDROSSANITÁRIAS - MEZANINO G1", "6680", 6553.3),
        ],
      },
      eap,
    );
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual([
      "Nível;Descrição do item;Código do serviço;Complemento;Código auxiliar do item;Quantidade;Código/Sigla da unidade de medida;Preço Unitário de Mão de Obra;Preço Unitário de Material;Observação interna;Código da unidade construtiva;Referência do item de orçamento;Código da conta financeira",
      "1;23 SISTEMAS E INSTALAÇÕES HIDROSSANITÁRIAS;;;;;;;;;;;",
      "2;23.005 MÃO DE OBRA INSTALAÇÕES HIDROSSANITÁRIAS;;;;;;;;;;;",
      "4;INSTALAÇÕES HIDRÁULICAS - 6 PAVTO - TIPO 01;6680;;;1;un ;9648.05;0.00;;5;23.005;2.01.02.01.03",
      "4;INSTALAÇÕES HIDROSSANITÁRIAS - MEZANINO G1;6680;;;1;un ;6553.30;0.00;;5;23.005;2.01.02.01.03",
      "1;25 EQUIPAMENTOS E SISTEMAS ESPECIAIS;;;;;;;;;;;",
      "2;25.001 INFRA CLIMATIZAÇÃO | DRENOS AR CONDICIONADO;;;;;;;;;;;",
      "4;LIGAÇÕES DE AR CONDICIONADO (DRENOS) - 7 PAVTO - TIPO 02;26770;;;1;un ;3204.39;0.00;;5;25.001;2.01.02.01.03",
      "",
    ]);
  });

  it("tira ';' e quebras de linha do texto e usa a conta do item quando informada", () => {
    const csv = gerarCsvSienge(
      { unidade_construtiva: "5", conta_financeira: "1.1", itens: [{ ...item("a", "23.005", "TUBO; 50mm\nPVC", "1", 2), quantidade: 2.5, conta_financeira: "9.9" }] },
      eap,
    );
    expect(csv).toContain("4;TUBO 50mm PVC;1;;;2.5;un ;2.00;0.00;;5;23.005;9.9\r\n");
  });

  it("lê números digitados no padrão brasileiro e com ponto", () => {
    expect(lerNumero("9.648,05")).toBe(9648.05);
    expect(lerNumero("9648.05")).toBe(9648.05);
    expect(lerNumero("12")).toBe(12);
    expect(lerNumero("abc")).toBeNaN();
    expect(lerNumero("")).toBeNaN();
  });

  it("monta a série por pavimento e o nome do arquivo", () => {
    expect(serieDePavimentos("PRUMADA HIDRÁULICA", 6, 8, 1)).toEqual([
      "PRUMADA HIDRÁULICA - 6 PAVTO - TIPO 01",
      "PRUMADA HIDRÁULICA - 7 PAVTO - TIPO 02",
      "PRUMADA HIDRÁULICA - 8 PAVTO - TIPO 03",
    ]);
    expect(serieDePavimentos("X", 27, 28, null)).toEqual(["X - 27 PAVTO", "X - 28 PAVTO"]);
    expect(nomeArquivoSienge("BL0087")).toBe("BL0087.csv");
    expect(nomeArquivoSienge("Solicitação hidráulica/nov")).toBe("Solicitacao_hidraulica_nov.csv");
  });
});
