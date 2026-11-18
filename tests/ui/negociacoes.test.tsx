import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ItemNegociacao } from "@/modules/negociacoes/consultas";

const mover = vi.fn(async () => ({ ok: "Item movido." }));
vi.mock("@/modules/negociacoes/acoes", () => ({
  criarItemNegociacao: vi.fn(async () => ({ ok: "Item adicionado ao quadro." })),
  salvarItemNegociacao: vi.fn(async () => ({ ok: "Item salvo." })),
  excluirItemNegociacao: vi.fn(async () => ({ ok: "Item excluído." })),
  moverItemNegociacao: (...args: unknown[]) => mover(...(args as [])),
}));
const { QuadroNegociacoes } = await import("@/components/app/quadro-negociacoes");

const agente = createAgent({ allow: () => true });
afterEach(cleanup);
const esperar = () => act(() => new Promise((r) => setTimeout(r, 0)));

const item = (p: Partial<ItemNegociacao> & Pick<ItemNegociacao, "id" | "titulo" | "coluna">): ItemNegociacao => ({
  obraId: "o1", obra: "Block", tipo: "nova", atividades: null, foraDaMatriz: false, empresa: null, valorEstimado: null, valorNegociado: null,
  observacao: null, autor: "Auxiliar Obra - Ana Carolina", dias: 1, contratacao: null, podeEditar: true, ...p,
});
const ITENS = [
  item({ id: "i1", titulo: "Impermeabilização das floreiras", coluna: "a_negociar", valorEstimado: 18500 }),
  item({ id: "i2", titulo: "Acréscimo de alvenaria", coluna: "falta_contrato", tipo: "aditivo", valorNegociado: 8400, dias: 8, empresa: "Irmãos Lima" }),
  item({ id: "i3", titulo: "Pintura interna", coluna: "contratacao_aberta", contratacao: { id: "c1", codigo: "CT-2026-031" } }),
  item({ id: "i4", titulo: "Forro de gesso", coluna: "em_negociacao", obraId: "o2", obra: "Vértice", podeEditar: false, autor: "Coordenador Obra - Carlos Dupont" }),
];
const OBRAS = [{ id: "o1", nome: "Block" }, { id: "o2", nome: "Vértice" }];
const montar = () => render(<QuadroNegociacoes itens={ITENS} obrasDoFiltro={OBRAS} obrasQueEdita={[OBRAS[0]]} />);

describe("Quadro de negociações da obra", () => {
  test("cada item fica na sua coluna, com autor, valores e o lembrete de contrato parado", () => {
    montar();
    const falta = screen.getByRole("region", { name: "Negociado, falta contrato" });
    const parado = within(falta).getByRole("article", { name: "Acréscimo de alvenaria" });
    expect(parado.textContent).toContain("Sem contrato há 8 dias");
    expect(parado.textContent).toContain("Aditivo");
    expect(parado.textContent).toContain("Auxiliar Obra - Ana Carolina");
    expect(within(parado).getByRole("link", { name: "Abrir aditivo" }).getAttribute("href")).toBe("/contratacoes/nova?negociacao=i2");
    const aberta = screen.getByRole("region", { name: "Contratação aberta" });
    expect(within(aberta).getByRole("link", { name: "CT-2026-031" }).getAttribute("href")).toBe("/contratacoes/c1");
  });

  test("item de obra que a pessoa não edita não tem menu", () => {
    montar();
    const alheio = screen.getByRole("article", { name: "Forro de gesso" });
    expect(within(alheio).queryByRole("button")).toBeNull();
  });

  test("Mover para pelo menu, só com teclado", async () => {
    montar();
    const gatilho = screen.getByRole("button", { name: "Ações do item Impermeabilização das floreiras" });
    gatilho.focus();
    await userEvent.keyboard("{Enter}");
    const opcao = await screen.findByRole("menuitem", { name: "Mover para Em negociação" });
    expect(screen.queryByRole("menuitem", { name: "Mover para A negociar" })).toBeNull();
    await userEvent.click(opcao);
    await esperar();
    expect(mover).toHaveBeenCalledWith("i1", "em_negociacao");
    expect(screen.getByRole("status").textContent).toContain("Em negociação");
  });

  test("agente acha os controles pelo nome", async () => {
    montar();
    await esperar();
    const componentes = agente.snapshot().filter((e) => !e.offPage && e.component !== "more");
    for (const e of componentes) expect(e.label, `${e.component} ${e.ref} sem nome`).toBeTruthy();
    const rotulos = componentes.map((e) => e.label);
    expect(rotulos).toContain("Filtrar por obra");
    expect(rotulos).toContain("Ações do item Impermeabilização das floreiras");
  });
});
