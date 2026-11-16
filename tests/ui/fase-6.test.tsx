import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { afterEach, describe, expect, test } from "vitest";
import { Panorama } from "@/components/app/panorama";
import type { ContratacaoPanorama, PassoPanorama } from "@/lib/panorama";

const agente = createAgent({ allow: () => true });
afterEach(cleanup);
const esperar = () => act(() => new Promise((r) => setTimeout(r, 0)));

const passo = (etapa: number, chave: string, situacao: PassoPanorama["situacao"], extra: Partial<PassoPanorama> = {}): PassoPanorama => ({
  etapa, chave, nome: `Etapa ${chave}`, area: "Obra", responsavel: "Obra", situacao, concluidaEm: null, prazo: null, ...extra,
});
const base = (extra: Partial<ContratacaoPanorama>): ContratacaoPanorama => ({
  id: "c1", codigo: "CT-2026-001", codigoInterno: "CT-2026-001", servico: "Alvenaria de vedação", obraId: "o1", obra: "Block", prefixoSienge: "CT/BL", situacao: "em_andamento", urgente: false, urgenteData: null, urgenteMotivo: null,
  aditivoDe: null, foraDoPrazo: false, abertaEm: "2026-10-01", fornecedor: "Construtora Pilar", valor: 486000, sienge: null, motivoCancelamento: null, empresaJaLiberada: false, escopo: null, equipe: null, devolucao: null,
  passos: [], ...extra,
});

const lista: ContratacaoPanorama[] = [
  base({
    passos: [passo(1, "solicitacao", "concluida", { concluidaEm: "2026-10-02" }), passo(5, "autorizacao", "em_andamento", { area: "Suprimentos", responsavel: "Suprimentos", prazo: { tipo: "atrasada", restantes: -3, uteis: true } }), passo(7, "contrato", "pendente", { area: "Contratos", responsavel: "Contratos" })],
  }),
  base({ id: "c2", codigo: "CT-2026-002", servico: "Pintura interna", obraId: "o2", obra: "Vértice", prefixoSienge: "CT/VT", urgente: true, urgenteData: "2026-11-27", urgenteMotivo: "Licença vence no fim do mês.", fornecedor: null, valor: null,
    passos: [passo(1, "solicitacao", "em_andamento", { prazo: { tipo: "no_prazo", restantes: 4, uteis: false } }), passo(2, "cotacao", "pendente")] }),
  base({ id: "c3", codigo: "CT-2026-003", servico: "Esquadrias de alumínio", obraId: "o1", situacao: "liberada", passos: [passo(1, "solicitacao", "concluida"), passo(12, "liberacao", "concluida")] }),
];

describe("Panorama das obras", () => {
  test("resumo e áreas contam só o que está em andamento", () => {
    render(<Panorama contratacoes={lista} />);
    const resumo = screen.getByRole("region", { name: "Resumo" });
    expect(within(resumo).getByText("Em andamento").previousSibling?.textContent).toBe("2");
    expect(within(resumo).getByText("Com atraso").previousSibling?.textContent).toBe("1");
    expect(within(resumo).getByText("Liberadas").previousSibling?.textContent).toBe("1");
    expect(screen.getByRole("button", { name: /^1s*Suprimentos/ }).textContent).toContain("1 com atraso");
  });

  test("a trilha tem texto para leitor de tela (etapa X de N, com quem, atraso)", () => {
    render(<Panorama contratacoes={lista} />);
    expect(screen.getByRole("img", { name: "Etapa 2 de 3: Etapa autorizacao, com Suprimentos. Atrasada 3 dias úteis." })).toBeTruthy();
    expect(screen.getByText("Atrasada 3 dias úteis")).toBeTruthy();
  });

  test("filtros por obra, situação e área, e busca sem acento", async () => {
    render(<Panorama contratacoes={lista} />);
    expect(screen.getAllByRole("region", { name: /^Obra / })).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Vértice" }));
    expect(screen.queryByText("Alvenaria de vedação")).toBeNull();
    expect(screen.getByText("Pintura interna")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Todas as obras" }));
    await userEvent.click(screen.getByRole("button", { name: /^Com atraso/ }));
    expect(screen.getByText("Alvenaria de vedação")).toBeTruthy();
    expect(screen.queryByText("Pintura interna")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^Todas \d/ }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar contratação" }), "esquadrias");
    expect(screen.getByText("Esquadrias de alumínio")).toBeTruthy();
    expect(screen.queryByText("Alvenaria de vedação")).toBeNull();
  });

  test("filtro sem resultado explica o que fazer", async () => {
    render(<Panorama contratacoes={lista} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar contratação" }), "zzzz");
    expect(screen.getByText(/Nenhuma contratação neste filtro/)).toBeTruthy();
  });

  test("clicar numa linha abre o detalhe com as etapas e o aviso de urgência", async () => {
    render(<Panorama contratacoes={lista} />);
    await userEvent.click(screen.getByRole("button", { name: /Pintura interna/ }));
    await esperar();
    const detalhe = await screen.findByRole("region", { name: "Etapas" });
    expect(within(detalhe).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText(/Urgente: a obra precisa em 27\/11\/2026/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Abrir contratação" }).getAttribute("href")).toBe("/contratacoes/c2");
    await userEvent.click(screen.getByRole("button", { name: "Fechar detalhe" }));
    await esperar();
    expect(screen.queryByRole("region", { name: "Etapas" })).toBeNull();
  });

  test("teste de agente: todo controle da tela tem nome", async () => {
    render(<Panorama contratacoes={lista} />);
    await esperar();
    const componentes = agente.snapshot().filter((e) => !e.offPage && e.component !== "more");
    for (const e of componentes) expect(e.label, `${e.component} ${e.ref} sem nome`).toBeTruthy();
    const rotulos = componentes.map((x) => x.label);
    for (const r of ["Todas as obras", "Buscar contratação"]) expect(rotulos, `${r} não aparece para o agente`).toContain(r);
  });
});

describe("Panorama: selos da linha e teclado", () => {
  const comDocumentacao = base({
    id: "c9", codigo: "CT-2026-009", servico: "Esquadrias de alumínio", urgente: true, urgenteData: "2026-11-24", aditivoDe: "CT/BL0061",
    equipe: { aprovados: 7, total: 10 },
    passos: [passo(1, "solicitacao", "concluida"), passo(10, "documentacao", "em_andamento", { area: "RH", responsavel: "RH", prazo: { tipo: "vence_hoje", restantes: 0, uteis: true } })],
  });

  test("a linha mostra a data de necessidade da urgência, o contrato original do aditivo e 'x de y aprovados'", () => {
    render(<Panorama contratacoes={[comDocumentacao]} />);
    expect(screen.getByText("Urgente · precisa em 24/11")).toBeTruthy();
    expect(screen.getByText("Aditivo de CT/BL0061")).toBeTruthy();
    expect(screen.getByText("7 de 10 aprovados")).toBeTruthy();
  });

  test("o 'x de y aprovados' só aparece enquanto a documentação está em andamento", () => {
    render(<Panorama contratacoes={[{ ...comDocumentacao, passos: [passo(1, "solicitacao", "concluida"), passo(7, "contrato", "em_andamento", { area: "Contratos" })] }]} />);
    expect(screen.queryByText("7 de 10 aprovados")).toBeNull();
  });

  test("pelo teclado: Enter na linha abre o detalhe e Esc fecha", async () => {
    render(<Panorama contratacoes={[comDocumentacao]} />);
    const linha = screen.getByRole("button", { name: /Esquadrias de alumínio/ });
    linha.focus();
    await userEvent.keyboard("{Enter}");
    await esperar();
    expect(await screen.findByRole("region", { name: "Etapas" })).toBeTruthy();
    expect(screen.getByText("Equipe aprovada pelo RH")).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    await esperar();
    expect(screen.queryByRole("region", { name: "Etapas" })).toBeNull();
  });
});
