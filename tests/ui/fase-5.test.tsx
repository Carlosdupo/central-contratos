import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CampoItemPlanilha } from "@/components/app/campo-item-planilha";
import { FormularioCalendario } from "@/components/app/formulario-calendario";
import { TabelaPlanejamento } from "@/components/app/tabela-planejamento";
import type { ItemPlanejamento } from "@/modules/suprimentos/consultas";

const agente = createAgent({ allow: () => true });
afterEach(cleanup);
const esperar = () => act(() => new Promise((r) => setTimeout(r, 0)));

describe("Abertura: item da planilha e calendário", () => {
  const ciclos = [{ limite: "2026-11-10", inicio: "2026-11-11" }, { limite: "2026-11-25", inicio: "2026-11-26" }];
  const itens = [{ id: "i1", tipo: "MO" as const, descricao: "Alvenaria de vedação", idPacote: "P1", dataSolicitar: "2026-11-01" }];

  test("sem item: 'será negociado a partir de dd/mm' pelo ciclo do calendário", () => {
    render(<CampoItemPlanilha itens={itens} ciclos={ciclos} hoje="2026-11-15" />);
    expect(screen.getByRole("status").textContent).toContain("Será negociado a partir de 26/11/2026");
  });

  test("sem calendário definido, avisa que o gerente precisa definir", () => {
    render(<CampoItemPlanilha itens={[]} ciclos={[]} hoje="2026-11-15" />);
    expect(screen.getByRole("status").textContent).toContain("ainda não tem um ciclo");
  });

  test("com item da planilha: segue as datas dela e avisa quando já passou da data", async () => {
    render(<CampoItemPlanilha itens={itens} ciclos={ciclos} hoje="2026-11-15" />);
    await userEvent.type(screen.getByRole("combobox", { name: /Item da planilha de suprimentos/ }), "alven");
    await userEvent.click(await screen.findByRole("option", { name: /Alvenaria de vedação/ }));
    await esperar();
    const texto = screen.getByRole("status").textContent ?? "";
    expect(texto).toContain("segue as datas da planilha");
    expect(texto).toContain("01/11/2026");
    expect(texto).toContain("fora do prazo");
  });

  test("teste de agente: o campo tem nome", async () => {
    render(<form><CampoItemPlanilha itens={itens} ciclos={ciclos} hoje="2026-11-15" /></form>);
    await esperar();
    const rotulos = agente.snapshot().filter((e) => !e.offPage && e.component !== "more").map((e) => e.label);
    expect(rotulos).toContain("Item da planilha de suprimentos (opcional)");
  });
});

describe("Calendário de suprimentos", () => {
  const acao = vi.fn(async () => ({ ok: "Salvo." }));

  test("o gerente preenche janeiro e copia o padrão para os outros meses", async () => {
    const campos: [string, string][] = [
      ["Janeiro, ciclo 1: a obra pode solicitar até", "2026-01-10"],
      ["Janeiro, ciclo 2: a obra pode solicitar até", "2026-01-25"],
    ];
    render(<FormularioCalendario ano={2026} salvos={[]} acao={acao} podeEditar />);
    const copiar = screen.getByRole("button", { name: /Copiar o padrão de janeiro/ });
    expect((copiar as HTMLButtonElement).disabled).toBe(true);
    for (const [nome, valor] of campos) await userEvent.type(screen.getByLabelText(nome), valor);
    expect((copiar as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(copiar);
    expect((screen.getByLabelText("Março, ciclo 1: a obra pode solicitar até") as HTMLInputElement).value).toBe("2026-03-10");
    expect((screen.getByLabelText("Março, ciclo 1: Suprimentos negocia a partir de") as HTMLInputElement).value).toBe("2026-03-11");
    expect((screen.getByLabelText("Dezembro, ciclo 2: a obra pode solicitar até") as HTMLInputElement).value).toBe("2026-12-25");
  });

  test("quem não é gerente só lê o calendário", () => {
    render(<FormularioCalendario ano={2026} salvos={[{ mes: 1, ciclo: 1, limite: "2026-01-10", inicio: "2026-01-11" }]} acao={acao} podeEditar={false} />);
    expect(screen.getByText(/Ciclo 1: pedir até 10\/01\/2026; negocia a partir de 11\/01\/2026/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Salvar o calendário/ })).toBeNull();
  });

  test("teste de agente: todo campo do calendário tem nome", async () => {
    render(<FormularioCalendario ano={2026} salvos={[]} acao={acao} podeEditar />);
    await esperar();
    const componentes = agente.snapshot().filter((e) => !e.offPage && e.component !== "more");
    for (const e of componentes) expect(e.label, `${e.component} ${e.ref} sem nome`).toBeTruthy();
  });
});

describe("Planilha de suprimentos", () => {
  const item = (extra: Partial<ItemPlanejamento>): ItemPlanejamento => ({
    id: "x", obraId: "o", tipo: "MO", fase: "Fundação", idPacote: "P1", pacoteVinculado: null, responsavel: "Ana", descricao: "Estacas", prazoCompras: 30, prazoChegada: 30,
    inicioManual: null, inicioPacote: "2026-06-01", dataEstudo: "2026-03-03", dataSolicitar: "2026-04-02", dataComprasFechar: "2026-05-02", dataDeveriaFechar: null,
    siengeSolicitacao: null, dataRealObra: null, dataRealCompras: null, observacao: null, contratacaoId: null, ...extra,
  });
  const editar = vi.fn(async () => ({ ok: "Item salvo." }));

  test("busca sem acento e mostra as datas calculadas na linha", async () => {
    render(<TabelaPlanejamento itens={[item({ id: "a" }), item({ id: "b", descricao: "Pintura interna", idPacote: null, inicioPacote: null, dataSolicitar: null, dataComprasFechar: null, dataEstudo: null })]} podeEditar editar={editar} />);
    expect(screen.getByRole("status").textContent).toBe("2 itens");
    expect(screen.getByText("Sem data: digite o início do pacote na edição.")).toBeTruthy();
    await userEvent.type(screen.getByRole("textbox", { name: "Buscar item" }), "estaca");
    expect(screen.getByRole("status").textContent).toBe("1 de 2 itens");
    expect(screen.getByText("Estacas")).toBeTruthy();
    expect(screen.getByText("02/04")).toBeTruthy();
  });

  test("a edição abre na própria linha; item sem ID pede a data de início e quem não edita não vê o botão", async () => {
    render(<TabelaPlanejamento itens={[item({ id: "b", descricao: "Pintura interna", idPacote: null })]} podeEditar editar={editar} />);
    await userEvent.click(screen.getByRole("button", { name: "Editar Pintura interna" }));
    await esperar();
    expect(await screen.findByLabelText("Início do pacote")).toBeTruthy();
    cleanup();
    render(<TabelaPlanejamento itens={[item({})]} podeEditar={false} editar={editar} />);
    expect(screen.queryByRole("button", { name: /Editar/ })).toBeNull();
  });
});
