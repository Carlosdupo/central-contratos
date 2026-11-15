import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CampoCnpj, CampoReais } from "@/components/app/campos-mascara";
import { DevolverEtapa } from "@/components/app/devolver-etapa";
import { CampoTexto, Formulario, GrupoOpcoes } from "@/components/app/formulario";

const agente = createAgent({ allow: () => true });
afterEach(cleanup);
const esperar = () => act(() => new Promise((r) => setTimeout(r, 0)));

// Os mesmos campos que a tela da contratação mostra nas etapas do aditivo (fluxo 2).
function FornecedorDoAditivo({ acao }: { acao: (e: object, d: FormData) => Promise<{ ok: string }> }) {
  return (
    <Formulario acao={acao} textoBotao="Salvar fornecedor e valor">
      <CampoTexto nome="fornecedor" rotulo="Fornecedor" />
      <CampoCnpj nome="cnpj" rotulo="CNPJ do fornecedor" />
      <CampoReais nome="valor" rotulo="Valor negociado (R$)" />
    </Formulario>
  );
}

describe("Aditivo no fluxo 2", () => {
  test("fornecedor, CNPJ e valor negociado vão no formulário, com a máscara de valor", async () => {
    let enviado: FormData | null = null;
    const acao = vi.fn(async (_: object, d: FormData) => { enviado = d; return { ok: "Salvo." }; });
    render(<FornecedorDoAditivo acao={acao} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Fornecedor" }), "Fornecedor do contrato");
    await userEvent.type(screen.getByRole("textbox", { name: "CNPJ do fornecedor" }), "11222333000181");
    await userEvent.type(screen.getByRole("textbox", { name: "Valor negociado (R$)" }), "480000");
    await userEvent.click(screen.getByRole("button", { name: "Salvar fornecedor e valor" }));
    await esperar();
    const d = enviado as unknown as FormData;
    expect(d.get("fornecedor")).toBe("Fornecedor do contrato");
    expect(d.get("cnpj")).toBe("11.222.333/0001-81");
    expect(d.get("valor")).toBe("4.800,00");
  });

  test("escolha guarda-chuva ou contrato novo vai no formulário", async () => {
    let enviado: FormData | null = null;
    const acao = vi.fn(async (_: object, d: FormData) => { enviado = d; return { ok: "Salvo." }; });
    render(
      <Formulario acao={acao} textoBotao="Salvar escolha">
        <GrupoOpcoes
          nome="destino"
          rotulo="Destino do aditivo"
          opcoes={[
            { value: "guarda_chuva", label: "Cabe em contrato guarda-chuva", dica: "A assinatura não se aplica; a alçada continua." },
            { value: "contrato_novo", label: "Precisa de contrato novo", dica: "Segue para a assinatura." },
          ]}
        />
      </Formulario>,
    );
    await userEvent.click(screen.getByRole("radio", { name: /Cabe em contrato guarda-chuva/ }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar escolha" }));
    await esperar();
    expect((enviado as unknown as FormData).get("destino")).toBe("guarda_chuva");
  });

  test("teste de agente: todo controle tem nome", async () => {
    render(<FornecedorDoAditivo acao={vi.fn(async () => ({ ok: "ok" }))} />);
    await esperar();
    const componentes = agente.snapshot().filter((e) => !e.offPage && e.component !== "more");
    for (const e of componentes) expect(e.label, `${e.component} ${e.ref} sem nome`).toBeTruthy();
    const rotulos = componentes.map((e) => e.label);
    for (const r of ["Fornecedor", "CNPJ do fornecedor", "Valor negociado (R$)"]) expect(rotulos, `${r} não aparece para o agente`).toContain(r);
  });
});

describe("Régua do fluxo 2", () => {
  test("a devolução numera as etapas pela posição, não pelo número da chave (a 6 não existe)", async () => {
    render(<DevolverEtapa acao={vi.fn(async () => ({ ok: "ok" }))} etapas={[{ etapa: 4, nome: "Solicitação no Sienge", posicao: 4 }, { etapa: 7, nome: "Contrato no Sienge e minuta", posicao: 6 }]} etapaAtual="A etapa 7" />);
    await userEvent.click(screen.getByRole("button", { name: "Devolver para ajuste" }));
    await esperar();
    await userEvent.click(screen.getByRole("combobox", { name: "Devolver para a etapa" }));
    expect(await screen.findByRole("option", { name: "6. Contrato no Sienge e minuta" })).toBeTruthy();
  });
});
