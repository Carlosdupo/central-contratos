import { describe, expect, it } from "vitest";
import { cnpjValido, cpfValido, formatarCnpj, mascararCpf } from "@/lib/documentos-br";
import {
  competenciaAtual,
  documentosExigidos,
  estadoDoItem,
  podeEnviarParaAnalise,
  progressoDocumentos,
  nomeArquivoFoto,
  exigeNoMes,
  podeEnviarAlgumaEtapa,
  validadeDoDocumento,
  type EstadoItem,
  type ItemMatriz,
} from "@/modules/terceiros/dominio/documentos";
import { dataDaIntegracao, descreverDiasDeIntegracao } from "@/modules/terceiros/dominio/integracao";

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


describe("data da integração (corte às 18h, só segunda, quarta e sexta)", () => {
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
    // depois das 18h: terça 24 não tem integração, vai para quarta 25
    expect(dataDaIntegracao({ data: "2026-11-19", hora: 19 }, 18, feriados)).toBe("2026-11-25");
  });
  it("aprovado na segunda vai para quarta; na quarta, para sexta", () => {
    expect(dataDaIntegracao({ data: "2026-11-16", hora: 10 }, 18, new Set())).toBe("2026-11-18");
    expect(dataDaIntegracao({ data: "2026-11-18", hora: 10 }, 18, new Set())).toBe("2026-11-20");
  });
  it("feriado na quarta empurra para sexta", () => {
    expect(dataDaIntegracao({ data: "2026-11-16", hora: 10 }, 18, new Set(["2026-11-18"]))).toBe("2026-11-20");
  });
  it("outros dias configurados e lista vazia (qualquer dia útil)", () => {
    expect(dataDaIntegracao({ data: "2026-11-16", hora: 10 }, 18, new Set(), [4])).toBe("2026-11-19");
    expect(dataDaIntegracao({ data: "2026-11-16", hora: 10 }, 18, new Set(), [])).toBe("2026-11-17");
  });
  it("texto dos dias", () => {
    expect(descreverDiasDeIntegracao([5, 1, 3])).toBe("segunda, quarta e sexta");
  });
});

describe("percentual de documentos aceitos", () => {
  it("conta só os aprovados sobre os exigidos", () => {
    expect(progressoDocumentos(["aprovado", "aprovado", "enviado", "falta"])).toEqual({ aprovados: 2, exigidos: 4, percentual: 50, faixa: "andamento" });
  });
  it("arredonda para baixo: 99% não vira 100%", () => {
    const estados = [...Array(199).fill("aprovado"), "enviado"] as EstadoItem[];
    expect(progressoDocumentos(estados).percentual).toBe(99);
  });
  it("completo só com tudo aprovado", () => {
    expect(progressoDocumentos(["aprovado", "aprovado"]).faixa).toBe("completo");
  });
  it("reprovado ou vencido marca pendência", () => {
    expect(progressoDocumentos(["aprovado", "reprovado"]).faixa).toBe("pendencia");
    expect(progressoDocumentos(["aprovado", "vencido"]).faixa).toBe("pendencia");
  });
  it("sem nada exigido fica em 0% e não completo", () => {
    expect(progressoDocumentos([])).toEqual({ aprovados: 0, exigidos: 0, percentual: 0, faixa: "andamento" });
  });
});

describe("documentação mensal", () => {
  const tipo = (etapa: "entrada" | "mensal", so_optante_simples = false) => ({ etapa, so_optante_simples });
  it("mensal só para funcionário liberado; entrada sempre", () => {
    expect(exigeNoMes(tipo("mensal"), { liberado: false })).toBe(false);
    expect(exigeNoMes(tipo("mensal"), { liberado: true })).toBe(true);
    expect(exigeNoMes(tipo("entrada"), { liberado: false })).toBe(true);
  });
  it("Simples só para optante", () => {
    expect(exigeNoMes(tipo("mensal", true), { optanteSimples: false })).toBe(false);
    expect(exigeNoMes(tipo("mensal", true), { optanteSimples: true })).toBe(true);
  });
  it("entrada e mensal são enviadas cada uma quando completa", () => {
    const i = (etapa: "entrada" | "mensal", estado: EstadoItem) => ({ estado, tipo: { etapa } });
    expect(podeEnviarAlgumaEtapa([i("entrada", "aprovado"), i("mensal", "anexado"), i("mensal", "anexado")])).toBe(true);
    expect(podeEnviarAlgumaEtapa([i("entrada", "falta"), i("mensal", "anexado")])).toBe(true);
    expect(podeEnviarAlgumaEtapa([i("entrada", "aprovado"), i("mensal", "anexado"), i("mensal", "falta")])).toBe(false);
  });
});

describe("nome do arquivo da foto (catraca)", () => {
  it("usa o nome da pessoa e a extensão da foto", () => {
    expect(nomeArquivoFoto("João da Silva", "empresas/x/foto/a.jpg")).toBe("João da Silva.jpg");
    expect(nomeArquivoFoto("Ana", "empresas/x/foto/a.PNG")).toBe("Ana.png");
  });
  it("tira caracteres que o Windows não aceita", () => {
    expect(nomeArquivoFoto('Zé / "Bigode" \ Lima?', "a.jpg")).toBe("Zé Bigode Lima.jpg");
    expect(nomeArquivoFoto("  ", "a.jpg")).toBe("foto.jpg");
  });
});
