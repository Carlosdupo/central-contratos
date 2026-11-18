import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { afterEach, describe, expect, test } from "vitest";
import { QuadroFinanceiro } from "@/components/app/quadro-financeiro";
import type { LinhaFinanceiro } from "@/modules/financeiro/dominio";

afterEach(cleanup);
const esperar = () => act(() => new Promise((r) => setTimeout(r, 0)));
const linha = (id: string, nome: string, extra: Partial<LinhaFinanceiro>): LinhaFinanceiro => ({
  empresaId: id, razaoSocial: nome, cnpj: "11222333000181", obras: "Block", exigidos: 4, aprovados: 0, emAnalise: 0, reprovados: 0, liberadaEm: null, ...extra,
});
const linhas = [
  linha("a", "Alfa Ltda", { aprovados: 4, liberadaEm: "2026-11-27T13:00:00Z" }),
  linha("b", "Beta Ltda", { aprovados: 2, emAnalise: 2 }),
  linha("c", "Gama Ltda", { aprovados: 1 }),
];

describe("Quadro do financeiro", () => {
  test("abas com contagem; liberadas primeiro, com data e 100%", () => {
    render(<QuadroFinanceiro linhas={linhas} competencia="2026-10-01" hoje="2026-12-02" />);
    expect(screen.getByRole("tab", { name: /Liberadas\s*1/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: /Pendentes\s*1/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Atrasadas\s*1/ })).toBeTruthy();
    expect(screen.getByText(/Liberada em 27\/11\/2026/)).toBeTruthy();
    expect(screen.getByRole("meter", { name: "Documentação mensal de Alfa Ltda" }).getAttribute("aria-valuetext")).toBe("100% aceito, 4 de 4");
  });

  test("atrasadas mostram o que falta enviar", async () => {
    render(<QuadroFinanceiro linhas={linhas} competencia="2026-10-01" hoje="2026-12-02" />);
    await userEvent.click(screen.getByRole("tab", { name: /Atrasadas/ }));
    await esperar();
    const painel = screen.getByRole("tabpanel");
    expect(within(painel).getByText("Gama Ltda")).toBeTruthy();
    expect(within(painel).getByText("3 para a empresa enviar")).toBeTruthy();
  });

  test("agente encontra as abas pelo nome", () => {
    render(<QuadroFinanceiro linhas={linhas} competencia="2026-10-01" hoje="2026-12-02" />);
    const nomes = JSON.stringify(createAgent({ allow: () => true }).snapshot());
    expect(nomes).toContain("Pendentes");
    expect(nomes).toContain("Atrasadas");
  });
});
