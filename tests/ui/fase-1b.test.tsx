import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CamposNovaContratacao } from "@/components/app/campos-nova-contratacao";
import { ConsultaMatriz } from "@/components/app/consulta-matriz";
import { Formulario } from "@/components/app/formulario";
import type { AtividadeMatriz } from "@/modules/matriz/consultas";

const agente = createAgent({ allow: () => true });
afterEach(cleanup);
const esperar = () => act(() => new Promise((r) => setTimeout(r, 0)));

const matriz: AtividadeMatriz[] = [
  { id: "m1", grupo: "5 Alvenaria", subgrupo: "5.1 Vedação", atividade: "Alvenaria de vedação", formaLegal: "Contrato + Edital", unidadeNegociacao: "m²", tipo: "mao_de_obra", lotes: "Pavimentos", unidadeMedicao: "0; 50% ou 100% do pavimento", observacoes: "Negociar as diárias antes de iniciar" },
  { id: "m2", grupo: "9 Pintura", subgrupo: null, atividade: "Pintura interna", formaLegal: "Pedido", unidadeNegociacao: "m²", tipo: "material_e_mao_de_obra", lotes: null, unidadeMedicao: null, observacoes: null },
];
const obras = [{ id: "o1", nome: "Obra Block", prefixoSienge: "CT/BL" }];

function abertura(acao = vi.fn(async () => ({ ok: "Aberta." }))) {
  render(
    <Formulario acao={acao} textoBotao="Abrir contratação">
      <CamposNovaContratacao obras={obras} limite={4000} matriz={matriz} />
    </Formulario>,
  );
  return acao;
}

describe("Abertura pela matriz", () => {
  test("escolher a atividade mostra forma legal, unidade, lotes e observações; a escolha vai no formulário", async () => {
    let enviado: FormData | null = null;
    abertura(vi.fn(async (_: object, d: FormData) => { enviado = d; return { ok: "Aberta." }; }) as never);
    expect(screen.queryByText("Forma legal")).toBeNull();
    await userEvent.type(screen.getByRole("combobox", { name: "Escopo da matriz (atividade, subgrupo ou grupo)" }), "alven");
    await userEvent.click(await screen.findByRole("option", { name: /Alvenaria de vedação/ }));
    await esperar();
    const quadro = screen.getByRole("region", { name: "Dados da atividade da matriz" });
    expect(quadro.textContent).toContain("Contrato + Edital");
    expect(quadro.textContent).toContain("Só mão de obra");
    expect(quadro.textContent).toContain("Pavimentos");
    expect(quadro.textContent).toContain("Negociar as diárias antes de iniciar");
    await userEvent.click(screen.getByRole("button", { name: "Abrir contratação" }));
    await esperar();
    expect((enviado as unknown as FormData).get("matriz")).toBe("a:m1");
  });

  test("não há mais escolha de serviço da EAP nem de tipo de contrato", () => {
    abertura();
    expect(screen.queryByText("Serviço da EAP")).toBeNull();
    expect(screen.queryByText(/Serviço único/)).toBeNull();
    expect(screen.queryByText(/Serviço para contrato/)).toBeNull();
  });

  test("o contrato original só aparece quando é aditivo, com a dica do prefixo da obra", async () => {
    abertura();
    await userEvent.click(screen.getByRole("combobox", { name: "Obra da contratação" }));
    await userEvent.click(await screen.findByRole("option", { name: "Obra Block" }));
    expect(screen.queryByRole("textbox", { name: "Nº do contrato original no Sienge" })).toBeNull();
    await userEvent.click(screen.getByRole("checkbox", { name: /É aditivo de contrato/ }));
    expect(screen.getByRole("textbox", { name: "Nº do contrato original no Sienge" })).toBeTruthy();
    expect(screen.getByText(/CT\/BL0083/)).toBeTruthy();
    await userEvent.click(screen.getByRole("checkbox", { name: /É aditivo de contrato/ }));
    expect(screen.queryByRole("textbox", { name: "Nº do contrato original no Sienge" })).toBeNull();
  });

  test("teste de agente: todo controle da abertura tem nome", async () => {
    abertura();
    await esperar();
    const componentes = agente.snapshot().filter((e) => !e.offPage && e.component !== "more");
    for (const e of componentes) expect(e.label, `${e.component} ${e.ref} sem nome`).toBeTruthy();
    const rotulos = componentes.map((e) => e.label);
    for (const r of ["Escopo da matriz (atividade, subgrupo ou grupo)", "Obra da contratação", "Valor Orçamento (R$)", "Quem negocia"]) expect(rotulos, `${r} não aparece para o agente`).toContain(r);
  });
});

describe("Consulta da matriz", () => {
  test("busca por nome, sem diferenciar acento", async () => {
    render(<ConsultaMatriz atividades={matriz} />);
    expect(screen.getByRole("status").textContent).toBe("2 atividades");
    await userEvent.type(screen.getByRole("textbox", { name: "Buscar atividade" }), "vedacao");
    expect(screen.getByRole("status").textContent).toBe("1 de 2 atividades");
    expect(screen.getByText("Alvenaria de vedação")).toBeTruthy();
    expect(screen.queryByText("Pintura interna")).toBeNull();
  });
});
