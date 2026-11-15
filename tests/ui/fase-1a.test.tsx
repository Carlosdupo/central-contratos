import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CampoReais } from "@/components/app/campos-mascara";
import { CamposCondicoesGerente, type Condicoes } from "@/components/app/campos-condicoes-gerente";
import { Formulario } from "@/components/app/formulario";
import { MaisAcoes } from "@/components/app/mais-acoes";

let aprovar = false;
const agente = createAgent({ allow: (passo) => !passo.confirm || aprovar });
afterEach(cleanup);
const esperar = () => act(() => new Promise((r) => setTimeout(r, 0)));

const vazias: Condicoes = {
  permuta: null, permuta_valor: null, permuta_formato: null,
  fat_direto: null, fat_direto_valor: null, fat_direto_percentual: null,
  sinal: null, sinal_valor: null, caucao: null,
};

describe("Campo de valor em R$", () => {
  test("digitar só números mostra 1.234,56 e o formulário envia o texto com máscara", async () => {
    let enviado: FormData | null = null;
    const acao = vi.fn(async (_: object, dados: FormData) => {
      enviado = dados;
      return { ok: "Salvo." };
    });
    render(
      <Formulario acao={acao} textoBotao="Salvar valor">
        <CampoReais nome="valor" rotulo="Valor final (R$)" />
      </Formulario>,
    );
    const campo = screen.getByRole<HTMLInputElement>("textbox", { name: "Valor final (R$)" });
    await userEvent.type(campo, "123456");
    expect(campo.value).toBe("1.234,56");
    await userEvent.type(campo, "7");
    expect(campo.value).toBe("12.345,67");
    await userEvent.clear(campo);
    await userEvent.type(campo, "abc12");
    expect(campo.value).toBe("0,12");
    await userEvent.click(screen.getByRole("button", { name: "Salvar valor" }));
    await esperar();
    expect((enviado as unknown as FormData).get("valor")).toBe("0,12");
  });

  test("valor que já vem do banco aparece formatado", () => {
    render(<CampoReais nome="valor" rotulo="Valor final (R$)" padrao={2800} />);
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Valor final (R$)" }).value).toBe("2.800,00");
  });

  test("agente acha o campo pelo nome", async () => {
    render(<form><CampoReais nome="valor" rotulo="Valor Orçamento (R$)" /></form>);
    await esperar();
    const rotulos = agente.snapshot().filter((e) => !e.offPage && e.component !== "more").map((e) => e.label);
    expect(rotulos).toContain("Valor Orçamento (R$)");
    const r = await agente.act({ steps: [{ ref: "Valor Orçamento (R$)", action: "setValue", args: ["1500"] }] });
    expect(r.ok, r.error?.message).toBe(true);
  });
});

describe("Botão único do gerente (etapa 6)", () => {
  function tela(acao: (estado: object, dados: FormData) => Promise<{ ok: string }> = vi.fn(async () => ({ ok: "Autorizada." }))) {
    render(
      <Formulario acao={acao} textoBotao="Autorizar contratação" confirmar="Autorizar Fornecedor X por R$ 1.000,00?" sensivel="Grava as condições e autoriza a contratação.">
        <CamposCondicoesGerente inicial={vazias} />
      </Formulario>,
    );
    return acao;
  }

  test("há um botão só, sem 'Salvar condições'; confirmar envia condições e autorização numa chamada", async () => {
    let enviado: FormData | null = null;
    const acao = tela(vi.fn(async (_: object, dados: FormData) => { enviado = dados; return { ok: "Autorizada." }; }));
    expect(screen.queryByRole("button", { name: /Salvar condições/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Autorizar contratação" })).toHaveLength(1);
    await userEvent.click(screen.getAllByRole("radio", { name: "Sim" })[0]);
    await esperar();
    await userEvent.click(screen.getByRole("button", { name: "Autorizar contratação" }));
    await esperar();
    expect(acao).not.toHaveBeenCalled(); // pede confirmação antes
    expect(screen.getByRole("alertdialog", { name: "Autorizar contratação?" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Sim, autorizar contratação/ }));
    await esperar();
    expect(acao).toHaveBeenCalledTimes(1);
    expect((enviado as unknown as FormData).has("permuta")).toBe(true);
  });

  test("teste de agente: todo controle tem nome e a autorização só roda com confirmação de uma pessoa", async () => {
    const acao = tela();
    await esperar();
    const componentes = agente.snapshot().filter((e) => !e.offPage && e.component !== "more");
    for (const e of componentes) expect(e.label, `${e.component} ${e.ref} sem nome`).toBeTruthy();
    // O "Sim" dentro da pergunta carrega data-agent-confirm: o agente só aperta com a permissão de uma pessoa.
    const confirmar = { steps: [{ ref: "Autorizar contratação?", action: "press", args: ["Sim, autorizar contratação"] }] };
    aprovar = false;
    expect((await agente.act(confirmar)).ok).toBe(false);
    await esperar();
    expect(acao).not.toHaveBeenCalled();
    aprovar = true;
    const r2 = await agente.act(confirmar);
    expect(r2.ok, JSON.stringify(r2.error)).toBe(true);
    await esperar();
    expect(acao).toHaveBeenCalledTimes(1);
  });
});

describe("Mais ações: cancelar contratação", () => {
  test("menu abre a janela, o motivo é obrigatório no campo e o envio chama a ação", async () => {
    let enviado: FormData | null = null;
    const cancelar = vi.fn(async (_: object, dados: FormData) => { enviado = dados; return { ok: "Contratação cancelada." }; });
    render(<MaisAcoes cancelar={cancelar} />);
    await userEvent.click(screen.getByRole("button", { name: /Mais ações/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Cancelar contratação" }));
    await esperar();
    const motivo = await screen.findByRole("textbox", { name: "Motivo do cancelamento" });
    await userEvent.type(motivo, "Obra mudou o escopo");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar contratação" }));
    await esperar();
    expect(cancelar).toHaveBeenCalledTimes(1);
    expect((enviado as unknown as FormData).get("motivo")).toBe("Obra mudou o escopo");
  });
});
