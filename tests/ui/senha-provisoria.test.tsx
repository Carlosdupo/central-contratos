import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GerarSenhaUsuario } from "@/components/app/gerar-senha-usuario";
import { NovoUsuario } from "@/components/app/novo-usuario";

let aprovar = false;
const agente = createAgent({ allow: (passo) => !passo.confirm || aprovar });
const esperar = () => act(() => new Promise((r) => setTimeout(r, 0)));
const SENHA = "Zk7mQp3Xv9RtWb4N";
const escreverNaArea = vi.fn(async () => undefined);

beforeEach(() => {
  escreverNaArea.mockClear();
  Object.defineProperty(navigator, "clipboard", { value: { writeText: escreverNaArea }, configurable: true });
});
afterEach(cleanup);

const convidar = vi.fn(async () => ({ ok: "Convite enviado." }));

describe("Novo usuário com senha provisória", () => {
  test("a senha aparece uma vez, com aviso e botão de copiar, e some ao sair da tela", async () => {
    let enviado: FormData | null = null;
    const gerar = vi.fn(async (_: object, d: FormData) => {
      enviado = d;
      return { ok: "Acesso criado.", senha: SENHA, email: "ana@santamaria.com.br" };
    });
    const { unmount } = render(<NovoUsuario convidar={convidar} gerarSenha={gerar} />);
    await userEvent.click(screen.getByRole("tab", { name: "Gerar senha provisória" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Nome completo da pessoa" }), "Ana Souza");
    await userEvent.type(screen.getByRole("textbox", { name: "E-mail de acesso" }), "ana@santamaria.com.br");
    await userEvent.click(screen.getAllByRole("checkbox", { name: "Coordenador de obra" })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Criar acesso com senha provisória" }));
    await esperar();

    const painel = await screen.findByRole("region", { name: "Senha provisória" });
    expect(painel.textContent).toContain(SENHA);
    expect(painel.textContent).toContain("Passe esta senha pessoalmente ou pelo WhatsApp; ela não aparece de novo.");
    expect(painel.querySelector("[data-agent-secret]")?.textContent).toBe(SENHA);
    expect((enviado as unknown as FormData).get("email")).toBe("ana@santamaria.com.br");
    expect((enviado as unknown as FormData).getAll("papeis")).toEqual(["coordenador_obra"]);

    await userEvent.click(screen.getByRole("button", { name: "Copiar senha" }));
    expect(escreverNaArea).toHaveBeenCalledWith(SENHA);
    expect(await screen.findByText("Senha copiada.")).toBeTruthy();

    // A senha só existe no estado da tela: não vai para o armazenamento do navegador nem para o endereço.
    expect(JSON.stringify({ ...localStorage })).not.toContain(SENHA);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(SENHA);
    expect(window.location.href).not.toContain(SENHA);

    unmount();
    render(<NovoUsuario convidar={convidar} gerarSenha={gerar} />);
    await userEvent.click(screen.getByRole("tab", { name: "Gerar senha provisória" }));
    expect(screen.queryByText(SENHA)).toBeNull();
    expect(document.body.textContent).not.toContain(SENHA);
  });

  test("erro não mostra senha nenhuma", async () => {
    const gerar = vi.fn(async () => ({ erro: "Este e-mail já tem cadastro." }));
    render(<NovoUsuario convidar={convidar} gerarSenha={gerar} />);
    await userEvent.click(screen.getByRole("tab", { name: "Gerar senha provisória" }));
    await userEvent.click(screen.getByRole("button", { name: "Criar acesso com senha provisória" }));
    await esperar();
    expect(await screen.findByText("Este e-mail já tem cadastro.")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Senha provisória" })).toBeNull();
  });

  test("o convite por e-mail continua sendo a primeira opção", () => {
    render(<NovoUsuario convidar={convidar} gerarSenha={vi.fn(async () => ({}))} />);
    expect(screen.getByRole("tab", { name: "Enviar convite por e-mail", selected: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enviar convite à pessoa" })).toBeTruthy();
  });

  test("teste de agente: todo controle tem nome e a criação do acesso só roda com a confirmação de uma pessoa", async () => {
    const gerar = vi.fn(async () => ({ ok: "Acesso criado.", senha: SENHA, email: "ana@x.com" }));
    render(<NovoUsuario convidar={convidar} gerarSenha={gerar} />);
    await userEvent.click(screen.getByRole("tab", { name: "Gerar senha provisória" }));
    await esperar();
    const componentes = agente.snapshot().filter((e) => !e.offPage && e.component !== "more");
    for (const e of componentes) expect(e.label, `${e.component} ${e.ref} sem nome`).toBeTruthy();
    const passo = { steps: [{ ref: "Criar acesso com senha provisória", action: "press", args: [] }] };
    aprovar = false;
    expect((await agente.act(passo)).ok).toBe(false);
    expect(gerar).not.toHaveBeenCalled();
  });
});

describe("Gerar nova senha provisória (usuário existente)", () => {
  test("pede confirmação antes e mostra a senha uma vez", async () => {
    const acao = vi.fn(async () => ({ ok: "Nova senha provisória gerada.", senha: SENHA, email: "bia@x.com" }));
    render(<GerarSenhaUsuario acao={acao} nome="Bia Lima" />);
    await userEvent.click(screen.getByRole("button", { name: "Gerar nova senha provisória" }));
    await esperar();
    expect(screen.getByRole("alertdialog", { name: "Gerar nova senha provisória?" }).textContent).toContain("Bia Lima");
    expect(acao).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Sim, gerar nova senha provisória/ }));
    await esperar();
    expect(acao).toHaveBeenCalledTimes(1);
    expect((await screen.findByRole("region", { name: "Senha provisória" })).textContent).toContain(SENHA);
  });

  test("teste de agente: o 'Sim' da confirmação só roda com a confirmação de uma pessoa", async () => {
    const acao = vi.fn(async () => ({ ok: "ok", senha: SENHA, email: "bia@x.com" }));
    render(<GerarSenhaUsuario acao={acao} nome="Bia Lima" />);
    await esperar();
    const confirmar = { steps: [{ ref: "Gerar nova senha provisória?", action: "press", args: ["Sim, gerar nova senha provisória"] }] };
    aprovar = false;
    expect((await agente.act(confirmar)).ok).toBe(false);
    await esperar();
    expect(acao).not.toHaveBeenCalled();
    aprovar = true;
    expect((await agente.act(confirmar)).ok).toBe(true);
    await esperar();
    expect(acao).toHaveBeenCalledTimes(1);
  });
});
