import { describe, expect, test } from "vitest";
import { resumoDaEquipe } from "@/lib/equipe-obra";

const m = (nome: string, situacao: string, tipo = "funcionario", obra = "Block") => ({ nome, tipo, alocacoes: [{ obra, situacao }] });

describe("Resumo da equipe na obra", () => {
  test("conta os aprovados pelo RH e lista quem falta", () => {
    const r = resumoDaEquipe([m("Ana", "liberado"), m("Bia", "integracao_agendada"), m("Caio", "em_analise"), m("Davi", "pendente")], "Block");
    expect(r).toEqual({ total: 4, aprovados: 2, faltam: ["Caio", "Davi"] });
  });
  test("ignora sócio esporádico e quem está alocado em outra obra", () => {
    const r = resumoDaEquipe([m("Ana", "liberado"), m("Eva", "pendente", "socio_esporadico"), m("Fábio", "pendente", "funcionario", "Vértice")], "Block");
    expect(r).toEqual({ total: 1, aprovados: 1, faltam: [] });
  });
});
