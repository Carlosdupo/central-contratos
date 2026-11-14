import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CampoSelecao, CampoTexto, Formulario, GrupoOpcoes, Marcador } from "@/components/app/formulario";

let aprovar = false;
const agente = createAgent({ allow: (passo) => !passo.confirm || aprovar });
afterEach(cleanup);
const esperar = () => act(() => new Promise((r) => setTimeout(r, 0)));

const obras = [
  { value: "o1", label: "Obra Block" },
  { value: "o2", label: "Obra Demonstração" },
];

describe("Peças de formulário sobre o UI SDK", () => {
  test("campo de texto e seleção enviam com o formulário pelo nome", async () => {
    let enviado: FormData | null = null;
    const acao = vi.fn(async (_: object, dados: FormData) => {
      enviado = dados;
      return { ok: "Salvo." };
    });
    render(
      <Formulario acao={acao} textoBotao="Salvar obra">
        <CampoTexto nome="nome" rotulo="Nome da obra" />
        <CampoSelecao nome="obra" rotulo="Obra" placeholder="Escolha a obra" opcoes={obras} padrao="o2" />
        <Marcador nome="ativa" rotulo="Obra ativa" marcado />
        <GrupoOpcoes nome="tipo" rotulo="Tipo de contrato" padrao="contrato" opcoes={[{ value: "unico", label: "Serviço único" }, { value: "contrato", label: "Serviço para contrato" }]} />
      </Formulario>,
    );
    await userEvent.type(screen.getByRole("textbox", { name: "Nome da obra" }), "Torre Sul");
    await userEvent.click(screen.getByRole("button", { name: "Salvar obra" }));
    await esperar();
    expect(acao).toHaveBeenCalled();
    const d = enviado as unknown as FormData;
    expect(d.get("nome")).toBe("Torre Sul");
    expect(d.get("obra")).toBe("o2");
    expect(d.get("ativa")).toBe("on");
    expect(d.get("tipo")).toBe("contrato");
    expect(await screen.findByText("Salvo.")).toBeTruthy();
  });

  test("seleção abre pelo teclado e escolhe pelo nome", async () => {
    render(<CampoSelecao nome="obra" rotulo="Obra" placeholder="Escolha a obra" opcoes={obras} />);
    const gatilho = screen.getByRole("combobox", { name: "Obra" });
    gatilho.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(await screen.findByRole("option", { name: "Obra Block" }));
    expect(gatilho.textContent).toContain("Obra Block");
  });

  test("ação com confirmação abre a janela de pergunta e só envia no 'Sim'", async () => {
    const acao = vi.fn(async () => ({ ok: "Cancelada." }));
    render(<Formulario acao={acao} textoBotao="Cancelar contratação" variante="perigo" confirmar="Não dá para desfazer." />);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar contratação" }));
    await esperar();
    expect(screen.getByRole("alertdialog", { name: "Cancelar contratação?" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    await esperar();
    expect(acao).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar contratação" }));
    await esperar();
    await userEvent.click(screen.getByRole("button", { name: /Sim, cancelar contratação/ }));
    await esperar();
    expect(acao).toHaveBeenCalledTimes(1);
  });
});

describe("Agente consegue usar os formulários", () => {
  test("todo controle tem nome e o agente preenche e escolhe", async () => {
    render(
      <form>
        <CampoTexto nome="nome" rotulo="Nome do responsável" />
        <CampoSelecao nome="obra" rotulo="Obra" placeholder="Escolha a obra" opcoes={obras} />
        <Marcador nome="ativa" rotulo="Ativa" />
        <GrupoOpcoes nome="tipo" rotulo="Tipo de contrato" opcoes={[{ value: "unico", label: "Serviço único" }, { value: "contrato", label: "Serviço para contrato" }]} />
      </form>,
    );
    await esperar();
    const componentes = agente.snapshot().filter((e) => !e.offPage && e.component !== "more");
    for (const e of componentes) expect(e.label, `${e.component} ${e.ref} sem nome`).toBeTruthy();
    const rotulos = componentes.map((e) => e.label);
    for (const r of ["Nome do responsável", "Obra", "Ativa", "Tipo de contrato"]) expect(rotulos, `${r} não aparece para o agente`).toContain(r);

    const resultado = await agente.act({
      steps: [
        { ref: "Nome do responsável", action: "setValue", args: ["Torre Norte"] },
        { ref: "Obra", action: "setValue", args: ["Obra Demonstração"] },
        { ref: "Tipo de contrato", action: "setValue", args: ["Serviço único"] },
      ],
    });
    expect(resultado.ok, resultado.error?.message).toBe(true);
    await esperar();
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Nome do responsável" }).value).toBe("Torre Norte");
    expect(screen.getByRole("combobox", { name: "Obra" }).textContent).toContain("Obra Demonstração");
  });

  test("ação sensível só roda com a confirmação de uma pessoa", async () => {
    const acao = vi.fn(async () => ({ ok: "Aprovado." }));
    render(<Formulario acao={acao} textoBotao="Aprovar documento" sensivel="Aprova este documento da empresa terceirizada." />);
    await esperar();
    const aprovarDoc = { steps: [{ ref: "Aprovar documento", action: "press", args: [] }] };
    aprovar = false;
    expect((await agente.act(aprovarDoc)).ok).toBe(false);
    aprovar = true;
    expect((await agente.act(aprovarDoc)).ok).toBe(true);
    await esperar();
    expect(acao).toHaveBeenCalledTimes(1);
  });
});
