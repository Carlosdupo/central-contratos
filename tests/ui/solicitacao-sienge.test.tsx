import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EditorSolicitacaoSienge } from "@/components/app/editor-solicitacao-sienge";
import type { SolicitacaoCompleta } from "@/modules/sienge/consultas";

const agente = createAgent({ allow: () => true });
afterEach(cleanup);
const esperar = () => act(() => new Promise((r) => setTimeout(r, 0)));

const base: SolicitacaoCompleta = {
  id: "00000000-0000-0000-0000-000000000001",
  obraId: "o1",
  obra: "Obra Teste",
  titulo: "BL0087",
  unidadeConstrutiva: "5",
  contaFinanceira: "2.01.02.01.03",
  itens: [],
  eap: [
    { referencia: "23", descricao: "SISTEMAS E INSTALAÇÕES HIDROSSANITÁRIAS", nivel: 1 },
    { referencia: "23.005", descricao: "MÃO DE OBRA INSTALAÇÕES HIDROSSANITÁRIAS", nivel: 2 },
    { referencia: "25", descricao: "EQUIPAMENTOS E SISTEMAS ESPECIAIS", nivel: 1 },
    { referencia: "25.001", descricao: "INFRA CLIMATIZAÇÃO", nivel: 2 },
  ],
  podeEditar: true,
  codigosAnteriores: { "23.005": "6680" },
};

describe("Solicitação Sienge: editor por serviço da EAP", () => {
  test("abre o serviço, escreve o item e salva com o código do serviço já preenchido", async () => {
    const salvar = vi.fn(async () => ({ ok: "Solicitação salva." }));
    render(<EditorSolicitacaoSienge solicitacao={base} salvar={salvar} />);
    await userEvent.click(screen.getByRole("button", { name: /23\.005 MÃO DE OBRA/ }));
    await userEvent.click(screen.getByRole("button", { name: "Adicionar item em 23.005" }));
    expect((screen.getByRole("textbox", { name: "Código do serviço do item 1 de 23.005" }) as HTMLInputElement).value).toBe("6680");
    await userEvent.type(screen.getByRole("textbox", { name: "Descrição do item 1 de 23.005" }), "INSTALAÇÕES HIDRÁULICAS - 6 PAVTO");
    await userEvent.type(screen.getByRole("textbox", { name: "Mão de obra unit. do item 1 de 23.005" }), "9.648,05");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(salvar).toHaveBeenCalledWith({
      titulo: "BL0087",
      unidade_construtiva: "5",
      conta_financeira: "2.01.02.01.03",
      itens: [expect.objectContaining({ referencia: "23.005", descricao: "INSTALAÇÕES HIDRÁULICAS - 6 PAVTO", codigo_servico: "6680", quantidade: 1, unidade: "un", preco_mo: 9648.05, preco_mat: 0 })],
    });
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Solicitação salva.");
  });

  test("item sem descrição não salva e diz qual é", async () => {
    const salvar = vi.fn(async () => ({ ok: "ok" }));
    render(<EditorSolicitacaoSienge solicitacao={base} salvar={salvar} />);
    await userEvent.click(screen.getByRole("button", { name: /25\.001 INFRA/ }));
    await userEvent.click(screen.getByRole("button", { name: "Adicionar item em 25.001" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(salvar).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Item 1 de 25.001: escreva a descrição.");
  });

  test("repetir por pavimento cria um item por andar", async () => {
    render(<EditorSolicitacaoSienge solicitacao={base} salvar={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /23\.005 MÃO DE OBRA/ }));
    await userEvent.click(screen.getByRole("button", { name: "Repetir por pavimento em 23.005" }));
    const janela = await screen.findByRole("dialog");
    await userEvent.type(within(janela).getByRole("textbox", { name: "Descrição base" }), "PRUMADA HIDRÁULICA");
    await userEvent.type(within(janela).getByRole("textbox", { name: "Pavimento inicial" }), "6");
    await userEvent.type(within(janela).getByRole("textbox", { name: "Pavimento final" }), "8");
    await userEvent.type(within(janela).getByRole("textbox", { name: "Tipo inicial" }), "1");
    await userEvent.click(within(janela).getByRole("button", { name: "Adicionar 3 itens" }));
    await esperar();
    expect((screen.getByRole("textbox", { name: "Descrição do item 3 de 23.005" }) as HTMLInputElement).value).toBe("PRUMADA HIDRÁULICA - 8 PAVTO - TIPO 03");
  });

  test("quem não é da obra só vê e baixa", () => {
    const item = { id: "a", referencia: "23.005", descricao: "X", codigo_servico: "6680", complemento: "", codigo_auxiliar: "", quantidade: 1, unidade: "un", preco_mo: 10, preco_mat: 0, observacao: "", conta_financeira: "" };
    render(<EditorSolicitacaoSienge solicitacao={{ ...base, podeEditar: false, itens: [item] }} salvar={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Adicionar item em 23.005" })).toBeNull();
    expect(screen.getByRole("button", { name: "Baixar CSV do Sienge" })).toBeTruthy();
  });

  test("teste de agente: os controles têm nome", async () => {
    render(<EditorSolicitacaoSienge solicitacao={base} salvar={vi.fn()} />);
    await esperar();
    const rotulos = agente.snapshot().filter((e) => !e.offPage && e.component !== "more").map((e) => e.label);
    expect(rotulos).toEqual(expect.arrayContaining(["Nome da solicitação", "Código da unidade construtiva", "Conta financeira padrão", "Buscar serviço da EAP", "Só serviços com itens"]));
    expect(rotulos.every((r) => !!r)).toBe(true);
  });
});
