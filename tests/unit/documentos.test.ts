import { describe, expect, it } from "vitest";
import { cnpjValido, cpfValido, formatarCnpj, mascararCpf } from "@/lib/documentos-br";
import {
  competenciaAtual,
  documentosExigidos,
  estadoDoItem,
  podeEnviarParaAnalise,
  validadeDoDocumento,
  type ItemMatriz,
} from "@/modules/terceiros/dominio/documentos";
import { dataDaIntegracao } from "@/modules/terceiros/dominio/integracao";

const matriz: ItemMatriz[] = [
  { tipo_documento: "cnd_federal", aplica_a: "empresa", condicao: "sempre" },
  { tipo_documento: "nr05", aplica_a: "empresa", condicao: "mais_de_5_na_obra" },
  { tipo_documento: "aso", aplica_a: "funcionario", condicao: "sempre" },
  { tipo_documento: "nr10", aplica_a: "funcionario", condicao: "eletricidade" },
  { tipo_documento: "aso", aplica_a: "socio_diario", condicao: "sempre" },
];
const meses = { aso: 12, nr: 24, rg_cnh: 120 };

describe("CNPJ e CPF", () => {
  it("valida dígitos verificadores", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11.222.333/0001-80")).toBe(false);
    expect(cnpjValido("11111111111111")).toBe(false);
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("529.982.247-24")).toBe(false);
    expect(cpfValido("00000000000")).toBe(false);
  });
  it("formata CNPJ e mascara CPF", () => {
    expect(formatarCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(mascararCpf("52998224725")).toBe("***.982.247-**");
  });
});

describe("matriz documental", () => {
  it("CIPA (NR-05) só com mais de 5 pessoas na obra", () => {
    expect(documentosExigidos(matriz, "empresa", { pessoasNaObra: 5 })).toEqual(["cnd_federal"]);
    expect(documentosExigidos(matriz, "empresa", { pessoasNaObra: 6 })).toEqual(["cnd_federal", "nr05"]);
  });
  it("NR-10 só para quem trabalha com eletricidade", () => {
    expect(documentosExigidos(matriz, "funcionario")).toEqual(["aso"]);
    expect(documentosExigidos(matriz, "funcionario", { eletricidade: true })).toEqual(["aso", "nr10"]);
  });
});

describe("validade", () => {
  it("ASO vale 1 ano a partir da emissão", () => {
    expect(validadeDoDocumento({ regra_validade: "meses_apos_emissao", chave_validade: "aso" }, { data_emissao: "2026-03-10", data_validade: null }, meses)).toBe("2027-03-09");
  });
  it("NR vale 2 anos; emissão em 29/02 cai no último dia do mês", () => {
    expect(validadeDoDocumento({ regra_validade: "meses_apos_emissao", chave_validade: "nr" }, { data_emissao: "2028-02-29", data_validade: null }, meses)).toBe("2030-02-27");
  });
  it("CND usa a data informada; documento sem validade não vence", () => {
    expect(validadeDoDocumento({ regra_validade: "data_informada", chave_validade: null }, { data_emissao: null, data_validade: "2027-01-31" }, meses)).toBe("2027-01-31");
    expect(validadeDoDocumento({ regra_validade: "sem_validade", chave_validade: null }, { data_emissao: null, data_validade: null }, meses)).toBeNull();
  });
  it("competência dos mensais é o mês anterior", () => {
    expect(competenciaAtual("2026-11-11")).toBe("2026-10-01");
    expect(competenciaAtual("2027-01-05")).toBe("2026-12-01");
  });
});

describe("envio para análise", () => {
  it("documento aprovado que venceu volta a ser pendência", () => {
    expect(estadoDoItem({ situacao: "aprovado", validade: "2026-11-10" }, "2026-11-11")).toBe("vencido");
    expect(estadoDoItem({ situacao: "aprovado", validade: "2026-11-11" }, "2026-11-11")).toBe("aprovado");
    expect(estadoDoItem(undefined, "2026-11-11")).toBe("falta");
  });
  it("só envia sem nada faltando e com algo novo anexado", () => {
    expect(podeEnviarParaAnalise(["anexado", "aprovado"])).toBe(true);
    expect(podeEnviarParaAnalise(["anexado", "falta"])).toBe(false);
    expect(podeEnviarParaAnalise(["aprovado", "enviado"])).toBe(false);
    expect(podeEnviarParaAnalise(["anexado", "reprovado"])).toBe(false);
    expect(podeEnviarParaAnalise([])).toBe(false);
  });
});


describe("data da integração (corte às 18h)", () => {
  const feriados = new Set(["2026-11-20"]);
  it("aprovado às 17h59 de quinta entra na sexta; às 18h00, na segunda", () => {
    expect(dataDaIntegracao({ data: "2026-11-12", hora: 17 }, 18, new Set())).toBe("2026-11-13");
    expect(dataDaIntegracao({ data: "2026-11-12", hora: 18 }, 18, new Set())).toBe("2026-11-16");
  });
  it("aprovado na sexta antes das 18h entra na segunda", () => {
    expect(dataDaIntegracao({ data: "2026-11-13", hora: 10 }, 18, new Set())).toBe("2026-11-16");
  });
  it("véspera de feriado pula o feriado", () => {
    // quinta 19/11 antes das 18h: sexta 20 é feriado, vai para segunda 23
    expect(dataDaIntegracao({ data: "2026-11-19", hora: 9 }, 18, feriados)).toBe("2026-11-23");
    expect(dataDaIntegracao({ data: "2026-11-19", hora: 19 }, 18, feriados)).toBe("2026-11-24");
  });
});
