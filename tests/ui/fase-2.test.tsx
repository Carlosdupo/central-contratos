import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DevolverEtapa } from "@/components/app/devolver-etapa";
import { LinhaDoTempo } from "@/components/app/linha-do-tempo";

let aprovar = false;
const agente = createAgent({ allow: (passo) => !passo.confirm || aprovar });
afterEach(cleanup);
const esperar = () => act(() => new Promise((r) => setTimeout(r, 0)));
const etapas = [{ etapa: 3, nome: "Equalização" }, { etapa: 4, nome: "Solicitação no Sienge" }];

describe("Devolver para ajuste", () => {
  test("abre a janela, pede a etapa e o motivo e envia os dois", async () => {
    let enviado: FormData | null = null;
    const acao = vi.fn(async (_: object, d: FormData) => { enviado = d; return { ok: "Etapa devolvida para ajuste." }; });
    render(<DevolverEtapa acao={acao} etapas={etapas} etapaAtual="A etapa 5" />);
    await userEvent.click(screen.getByRole("button", { name: "Devolver para ajuste" }));
    await esperar();
    await userEvent.click(screen.getByRole("combobox", { name: "Devolver para a etapa" }));
    await userEvent.click(await screen.findByRole("option", { name: "4. Solicitação no Sienge" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Motivo da devolução" }), "Faltou o anexo do Sienge");
    await userEvent.click(screen.getByRole("button", { name: "Devolver etapa" }));
    await esperar();
    expect(acao).toHaveBeenCalledTimes(1);
    const d = enviado as unknown as FormData;
    expect(d.get("para")).toBe("4");
    expect(d.get("motivo")).toBe("Faltou o anexo do Sienge");
  });

  test("teste de agente: controles com nome, e devolver só roda com confirmação de uma pessoa", async () => {
    const acao = vi.fn(async () => ({ ok: "Etapa devolvida para ajuste." }));
    render(<DevolverEtapa acao={acao} etapas={etapas} etapaAtual="A etapa 5" />);
    await esperar();
    const abrir = { steps: [{ ref: "Devolver para ajuste", action: "press", args: [] }] };
    expect((await agente.act(abrir)).ok).toBe(true);
    await esperar();
    const componentes = agente.snapshot().filter((e) => !e.offPage && e.component !== "more");
    for (const e of componentes) expect(e.label, `${e.component} ${e.ref} sem nome`).toBeTruthy();
    const rotulos = componentes.map((e) => e.label);
    for (const r of ["Devolver para a etapa", "Motivo da devolução", "Devolver etapa"]) expect(rotulos, `${r} não aparece para o agente`).toContain(r);
    const enviar = { steps: [{ ref: "Devolver etapa", action: "press", args: [] }] };
    aprovar = false;
    expect((await agente.act(enviar)).ok).toBe(false);
    expect(acao).not.toHaveBeenCalled();
  });
});

describe("Linha do tempo", () => {
  test("lista os eventos na ordem recebida, com a devolução e o motivo", () => {
    render(
      <LinhaDoTempo
        eventos={[
          { id: "a", quando: "2026-11-10T12:00:00Z", texto: "Contratação CT-2026-001 aberta." },
          { id: "b", quando: "2026-11-12T15:30:00Z", texto: "Etapa 5 devolvida para a etapa 4 por Carlos: Faltou o anexo", destaque: true },
        ]}
      />,
    );
    const itens = screen.getAllByRole("listitem");
    expect(itens).toHaveLength(2);
    expect(itens[0].textContent).toContain("aberta");
    expect(itens[1].textContent).toContain("Faltou o anexo");
    expect(screen.getByRole("list", { name: "Linha do tempo da contratação" })).toBeTruthy();
  });
});
