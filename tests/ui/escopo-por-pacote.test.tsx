import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CampoAtividadeMatriz } from "@/components/app/campo-atividade-matriz";
import { EscopoContratacao } from "@/components/app/escopo-contratacao";
import { Formulario } from "@/components/app/formulario";
import type { AtividadeMatriz } from "@/modules/matriz/consultas";

const agente = createAgent({ allow: () => true });
afterEach(cleanup);
const esperar = () => act(() => new Promise((r) => setTimeout(r, 0)));

const ativ = (id: string, atividade: string, grupo: string, subgrupo: string | null, formaLegal: string): AtividadeMatriz => ({
  id, atividade, grupo, subgrupo, formaLegal, unidadeNegociacao: "unid", tipo: "mao_de_obra", lotes: null, unidadeMedicao: null, observacoes: null,
});
const MATRIZ: AtividadeMatriz[] = [
  ativ("e1", "Quadro geral de baixa tensão", "21 Inst. Elétrica", "21.1 Elétrica", "Contrato + Edital"),
  ativ("e2", "Eletrodutos e fiação", "21 Inst. Elétrica", "21.1 Elétrica", "Contrato"),
  ativ("e3", "Iluminação de emergência", "21 Inst. Elétrica", "21.1 Elétrica", "Pedido"),
  ativ("p1", "SPDA", "21 Inst. Elétrica", "21.2 Proteção", "Proposta comercial assinada"),
  ativ("a1", "Alvenaria de vedação", "9 Alvenaria", "9.1 Vedação", "Contrato + Edital"),
];
const NOME = "Escopo da matriz (atividade, subgrupo ou grupo)";

function abertura() {
  let enviado: FormData | null = null;
  const acao = vi.fn(async (_: object, d: FormData) => {
    enviado = d;
    return { ok: "Aberta." };
  });
  render(
    <Formulario acao={acao} textoBotao="Abrir contratação">
      <CampoAtividadeMatriz atividades={MATRIZ} />
    </Formulario>,
  );
  return { acao, enviado: () => enviado as unknown as FormData };
}

async function escolher(busca: string, opcao: RegExp) {
  await userEvent.type(screen.getByRole("combobox", { name: NOME }), busca);
  await userEvent.click(await screen.findByRole("option", { name: opcao }));
  await esperar();
}

describe("Escopo por pacote na abertura", () => {
  test("a busca lista os três níveis: grupo inteiro, subgrupo e atividade", async () => {
    abertura();
    await userEvent.type(screen.getByRole("combobox", { name: NOME }), "elétrica");
    expect(await screen.findByRole("option", { name: /21 Inst\. Elétrica · 4 atividades/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /21\.1 Elétrica · 3 atividades/ })).toBeTruthy();
    expect(screen.getAllByText("Grupo inteiro").length).toBeGreaterThan(0);
    expect(screen.getByText("Grupos inteiros")).toBeTruthy();
    expect(screen.getByText("Subgrupos")).toBeTruthy();
  });

  test("escolher o subgrupo marca todas as atividades e mostra a forma legal mais rigorosa e as diferentes", async () => {
    abertura();
    await escolher("elétrica", /21\.1 Elétrica · 3 atividades/);
    const pacote = screen.getByRole("region", { name: "Atividades do escopo" });
    expect(within(pacote).getAllByRole("checkbox")).toHaveLength(3);
    for (const c of within(pacote).getAllByRole("checkbox")) expect((c as HTMLInputElement).getAttribute("aria-checked") ?? (c as HTMLInputElement).checked.toString()).toMatch(/true/);
    expect(pacote.textContent).toContain("21.1 Elétrica (3 atividades)");
    expect(pacote.textContent).toContain("Forma legal: Contrato + Edital (a mais rigorosa entre as atividades marcadas)");
    expect(pacote.textContent).toContain("As atividades marcadas têm formas diferentes: Contrato + Edital (1), Contrato (1), Pedido (1).");
  });

  test("desmarcar muda a contagem, o rótulo e a forma legal", async () => {
    abertura();
    await escolher("elétrica", /21\.1 Elétrica · 3 atividades/);
    await userEvent.click(screen.getByRole("checkbox", { name: /Quadro geral de baixa tensão/ }));
    const pacote = screen.getByRole("region", { name: "Atividades do escopo" });
    expect(pacote.textContent).toContain("21.1 Elétrica (2 de 3 atividades)");
    expect(pacote.textContent).toContain("2 de 3 atividades marcadas");
    expect(pacote.textContent).toContain("Forma legal: Contrato (a mais rigorosa entre as atividades marcadas)");
    await userEvent.click(screen.getByRole("button", { name: "Marcar todas" }));
    expect(screen.getByRole("region", { name: "Atividades do escopo" }).textContent).toContain("Forma legal: Contrato + Edital");
  });

  test("pelo menos uma atividade fica marcada", async () => {
    abertura();
    await escolher("elétrica", /21\.1 Elétrica · 3 atividades/);
    await userEvent.click(screen.getByRole("checkbox", { name: /Quadro geral de baixa tensão/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Eletrodutos e fiação/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Iluminação de emergência/ }));
    expect(screen.getByText("Deixe pelo menos uma atividade marcada.")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Atividades do escopo" }).textContent).toContain("1 de 3 atividades marcadas");
  });

  test("o formulário leva o item escolhido e uma 'atividades' por atividade marcada", async () => {
    const { enviado } = abertura();
    await escolher("elétrica", /21\.1 Elétrica · 3 atividades/);
    await userEvent.click(screen.getByRole("checkbox", { name: /Iluminação de emergência/ }));
    await userEvent.click(screen.getByRole("button", { name: "Abrir contratação" }));
    await esperar();
    expect(enviado().get("matriz")).toBe("s:21.1 Elétrica");
    expect(enviado().getAll("atividades")).toEqual(["e1", "e2"]);
  });

  test("escolher uma atividade fica como antes: só ela, sem lista de marcadores", async () => {
    const { enviado } = abertura();
    await escolher("alvenaria", /Alvenaria de vedação/);
    expect(screen.queryByRole("region", { name: "Atividades do escopo" })).toBeNull();
    expect(screen.getByRole("region", { name: "Dados da atividade da matriz" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Abrir contratação" }));
    await esperar();
    expect(enviado().get("matriz")).toBe("a:a1");
    expect(enviado().getAll("atividades")).toEqual([]);
  });

  test("escolher o grupo inteiro traz as atividades de todos os subgrupos", async () => {
    abertura();
    await escolher("inst", /21 Inst\. Elétrica · 4 atividades/);
    const pacote = screen.getByRole("region", { name: "Atividades do escopo" });
    expect(within(pacote).getAllByRole("checkbox")).toHaveLength(4);
    expect(pacote.textContent).toContain("21 Inst. Elétrica (4 atividades)");
  });

  test("teste de agente: todo controle tem nome", async () => {
    abertura();
    await escolher("elétrica", /21\.1 Elétrica · 3 atividades/);
    const componentes = agente.snapshot().filter((e) => !e.offPage && e.component !== "more");
    for (const e of componentes) expect(e.label, `${e.component} ${e.ref} sem nome`).toBeTruthy();
    const rotulos = componentes.map((e) => e.label);
    expect(rotulos).toContain(NOME);
    expect(rotulos.some((r) => r?.startsWith("Quadro geral de baixa tensão"))).toBe(true);
  });
});

describe("Escopo na tela da contratação e no panorama", () => {
  const atividades = [
    { id: "e1", atividade: "Quadro geral de baixa tensão", formaLegal: "Contrato + Edital" },
    { id: "e2", atividade: "Eletrodutos e fiação", formaLegal: "Contrato" },
    { id: "e3", atividade: "Iluminação de emergência", formaLegal: "Pedido" },
  ];

  test("mostra o escopo, a forma legal mais rigorosa e a lista que abre e fecha", async () => {
    render(<EscopoContratacao rotulo="21.1 Elétrica (3 de 14 atividades)" atividades={atividades} />);
    const secao = screen.getByRole("region", { name: "Escopo da contratação" });
    expect(secao.textContent).toContain("Escopo: 21.1 Elétrica (3 de 14 atividades)");
    expect(secao.textContent).toContain("Forma legal: Contrato + Edital");
    expect(screen.queryByText("Iluminação de emergência")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "3 atividades incluídas" }));
    expect(await screen.findByText("Iluminação de emergência")).toBeTruthy();
  });

  test("contratação de uma atividade só não mostra o quadro de escopo", () => {
    const { container } = render(<EscopoContratacao rotulo="Alvenaria" atividades={atividades.slice(0, 1)} />);
    expect(container.textContent).toBe("");
  });
});

describe("Atividade que não consta na matriz", () => {
  test("marcar troca a busca pela descrição e envia o texto", async () => {
    const { acao, enviado } = abertura();
    await userEvent.click(screen.getByRole("checkbox", { name: "Não consta na matriz" }));
    expect(screen.queryByRole("combobox", { name: NOME })).toBeNull();
    await userEvent.type(screen.getByRole("textbox", { name: "Atividade que não consta na matriz" }), "Limpeza de fachada");
    await userEvent.click(screen.getByRole("button", { name: "Abrir contratação" }));
    await esperar();
    expect(acao).toHaveBeenCalled();
    expect(enviado().get("nao_consta_matriz")).toBe("on");
    expect(enviado().get("fora_matriz")).toBe("Limpeza de fachada");
    expect(enviado().getAll("atividades")).toEqual([]);
  });
  test("desmarcar volta a busca na matriz", async () => {
    abertura();
    const marcador = screen.getByRole("checkbox", { name: "Não consta na matriz" });
    await userEvent.click(marcador);
    await userEvent.click(marcador);
    expect(screen.getByRole("combobox", { name: NOME })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Atividade que não consta na matriz" })).toBeNull();
  });
});
