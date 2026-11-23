import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ConviteEmpresa } from "@/components/app/convite-empresa";

const agente = createAgent({ allow: () => true });
const esperar = () => act(() => new Promise((r) => setTimeout(r, 0)));
afterEach(cleanup);

const obras = [{ value: "o1", label: "Obra Block" }];

describe("Convite de empresa já cadastrada", () => {
  test("CNPJ que já existe mostra os documentos aprovados e o que falta", async () => {
    const convidar = vi.fn(async () => ({
      erro: "Esta empresa já está cadastrada. Veja abaixo o que ela já tem aprovado.",
      empresaExistente: {
        id: "e1",
        razao: "Construtora Alfa Ltda",
        situacao: "aprovada",
        obras: ["Obra Torre"],
        aprovados: [{ codigo: "pgr", nome: "PGR válido e assinado", validade: "2027-03-31" }],
        pendentes: [{ codigo: "cnd_federal", nome: "CND federal" }],
      },
    }));
    render(<ConviteEmpresa obras={obras} convidar={convidar} />);
    await userEvent.type(screen.getByRole("textbox", { name: "CNPJ" }), "11222333000181");
    await userEvent.click(screen.getByRole("button", { name: "Enviar convite à empresa" }));
    await esperar();

    const painel = await screen.findByRole("region", { name: "Empresa já cadastrada" });
    expect(painel.textContent).toContain("Construtora Alfa Ltda");
    expect(painel.textContent).toContain("Obra Torre");
    expect(painel.textContent).toContain("PGR válido e assinado");
    expect(painel.textContent).toContain("vale até 31/03/2027");
    expect(painel.textContent).toContain("CND federal");
    expect(screen.getByRole("link", { name: "Abrir a empresa para liberar outra obra →" }).getAttribute("href")).toBe("/terceiros/empresas/e1");
    expect(screen.getByRole("alert").textContent).toContain("já está cadastrada");
  });

  test("agente acha os campos e o botão pelo nome", () => {
    render(<ConviteEmpresa obras={obras} convidar={vi.fn(async () => ({}))} />);
    const nomes = JSON.stringify(agente.snapshot());
    for (const nome of ["CNPJ", "Razão social", "E-mail do responsável", "Enviar convite à empresa"]) expect(nomes).toContain(nome);
  });
});
