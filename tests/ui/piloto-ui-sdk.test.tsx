import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { afterEach, describe, expect, test } from "vitest";
import { AbasAreas } from "@/components/app/abas-areas";
import { CampoFornecedor } from "@/components/app/campo-fornecedor";
import { JanelaLateral } from "@/components/app/janela-lateral";

const agente = createAgent();
afterEach(cleanup);
const esperar = () => act(() => new Promise((r) => setTimeout(r, 0)));

const abas = [
  { chave: "suprimentos", rotulo: "Suprimentos", contador: 2, conteudo: <p>Painel de Suprimentos</p> },
  { chave: "rh", rotulo: "RH", contador: 0, conteudo: <p>Painel do RH</p> },
  { chave: "sst", rotulo: "Segurança do trabalho", conteudo: <p>Painel da Segurança</p> },
];
const empresas = [
  { razao: "Beta Construções (demo)", cnpj: "98765432000198" },
  { razao: "Alfa Elétrica (demo)", cnpj: "98765431000143" },
];

describe("Abas por área (Tabs)", () => {
  test("lista de abas com nome, setas trocam a aba e o painel", async () => {
    render(<AbasAreas abas={abas} />);
    expect(screen.getByRole("tablist", { name: "Áreas" })).toBeTruthy();
    expect(screen.getByText("Painel de Suprimentos")).toBeTruthy();
    await userEvent.click(screen.getByRole("tab", { name: /Suprimentos/ }));
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "RH" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Painel do RH")).toBeTruthy();
  });

  test("uma área só mostra o conteúdo direto, sem abas", () => {
    render(<AbasAreas abas={[abas[1]]} />);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByText("Painel do RH")).toBeTruthy();
  });
});

describe("Fornecedor da cotação (Autocomplete)", () => {
  test("sugere as empresas cadastradas e escolher uma preenche o CNPJ", async () => {
    render(<CampoFornecedor empresas={empresas} />);
    await userEvent.type(screen.getByRole("combobox", { name: "Fornecedor" }), "beta");
    await userEvent.click(await screen.findByRole("option", { name: /Beta Construções/ }));
    expect(screen.getByRole<HTMLInputElement>("combobox", { name: "Fornecedor" }).value).toBe("Beta Construções (demo)");
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "CNPJ" }).value).toBe("98.765.432/0001-98");
  });

  test("aceita um fornecedor novo, que não está na lista", async () => {
    render(<CampoFornecedor empresas={empresas} />);
    await userEvent.type(screen.getByRole("combobox", { name: "Fornecedor" }), "Fornecedor Novo Ltda");
    expect(screen.getByRole<HTMLInputElement>("combobox", { name: "Fornecedor" }).value).toBe("Fornecedor Novo Ltda");
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "CNPJ" }).value).toBe("");
  });
});

describe("Janela lateral (Drawer)", () => {
  test("abre com o título como nome, Esc fecha e o foco volta ao botão", async () => {
    render(
      <JanelaLateral textoBotao="Convidar empresa" titulo="Convidar empresa" descricao="Envia o convite do portal.">
        <p>Formulário</p>
      </JanelaLateral>,
    );
    const botao = screen.getByRole("button", { name: /Convidar empresa/ });
    await userEvent.click(botao);
    await esperar();
    expect(screen.getByRole("dialog", { name: "Convidar empresa" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fechar janela" })).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    await esperar();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(botao);
  });
});

describe("Agente consegue usar o piloto", () => {
  test("todo controle tem nome, e o agente troca de aba e preenche o fornecedor", async () => {
    render(
      <>
        <AbasAreas abas={abas} />
        <CampoFornecedor empresas={empresas} />
      </>,
    );
    await esperar();
    const componentes = agente.snapshot().filter((e) => !e.offPage && e.component !== "more");
    for (const e of componentes) expect(e.label, `${e.component} ${e.ref} sem nome`).toBeTruthy();
    const rotulos = componentes.map((e) => e.label);
    for (const r of ["Áreas", "Fornecedor"]) expect(rotulos, `${r} não aparece para o agente`).toContain(r);

    const resultado = await agente.act({
      steps: [
        { ref: "Áreas", action: "setValue", args: ["RH"] },
        { ref: "Fornecedor", action: "setValue", args: ["Alfa Elétrica (demo)"] },
      ],
    });
    expect(resultado.ok, resultado.error?.message).toBe(true);
    await esperar();
    expect(screen.getByText("Painel do RH")).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "CNPJ" }).value).toBe("98.765.431/0001-43");
  });
});
