import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/components/app/documentos", () => ({ BotaoAbrirArquivo: () => null }));
const { BlocoAnalise } = await import("@/components/app/bloco-analise");
type ItemAnalise = import("@/components/app/bloco-analise").ItemAnalise;

afterEach(cleanup);
const esperar = () => act(() => new Promise((r) => setTimeout(r, 0)));

const item = (id: string, nome: string, responsavel: "rh" | "sst", extra: Partial<ItemAnalise> = {}): ItemAnalise => ({
  id, arquivoId: null, decisao: null, motivo: null, nome, sensivel: false, responsavel, valorTexto: null, competencia: null, validade: null, ...extra,
});
const sst = [item("1", "ASO", "sst", { sensivel: true }), item("2", "Certificado NR-35", "sst", { decisao: "aprovado" })];

describe("Análise compartilhada RH e Segurança", () => {
  test("a área dona decide: botões só nos itens sem decisão", () => {
    const acao = vi.fn(async () => ({}));
    render(<BlocoAnalise bloco={{ chave: "sst", titulo: "Para a Segurança do Trabalho", area: "Segurança", itens: sst, meu: true }} aberto aprovar={() => acao} devolver={() => acao} />);
    const bloco = screen.getByRole("region", { name: "Para a Segurança do Trabalho" });
    expect(within(bloco).getAllByRole("button", { name: "Aprovar documento" })).toHaveLength(1);
    expect(within(bloco).getByRole("textbox", { name: "Motivo da devolução: ASO" })).toBeTruthy();
    expect(within(bloco).getByText("Faltam 1 para decidir")).toBeTruthy();
  });

  test("a outra área só lê e vê de quem é a vez", () => {
    const acao = vi.fn(async () => ({}));
    render(<BlocoAnalise bloco={{ chave: "sst", titulo: "Para a Segurança do Trabalho", area: "Segurança", itens: sst, meu: false }} aberto aprovar={() => acao} devolver={() => acao} />);
    expect(screen.queryByRole("button", { name: "Aprovar documento" })).toBeNull();
    expect(screen.getByText("Aguardando Segurança")).toBeTruthy();
    expect(screen.getByText(/só leitura/)).toBeTruthy();
  });

  test("aprovar chama a ação do item certo", async () => {
    const chamados: string[] = [];
    render(
      <BlocoAnalise
        bloco={{ chave: "rh", titulo: "Para o RH", area: "RH", itens: [item("rg", "RG ou CNH", "rh")], meu: true }}
        aberto
        aprovar={(id) => async () => { chamados.push(id); return {}; }}
        devolver={() => async () => ({})}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Aprovar documento" }));
    await esperar();
    expect(chamados).toEqual(["rg"]);
  });

  test("agente: aprovar e devolver pedem confirmação", () => {
    const acao = vi.fn(async () => ({}));
    render(<BlocoAnalise bloco={{ chave: "rh", titulo: "Para o RH", area: "RH", itens: [item("rg", "RG ou CNH", "rh")], meu: true }} aberto aprovar={() => acao} devolver={() => acao} />);
    const confirmam = [...document.querySelectorAll("[data-agent-confirm]")].map((e) => e.getAttribute("data-agent-confirm"));
    expect(confirmam).toContain("Aprova o documento RG ou CNH da empresa terceirizada.");
    expect(confirmam).toContain("Devolve o documento RG ou CNH para a empresa corrigir, com o motivo.");
    const agente = createAgent({ allow: () => true });
    expect(JSON.stringify(agente.snapshot())).toContain("Aprovar documento");
  });
});
