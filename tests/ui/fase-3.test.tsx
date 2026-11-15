import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CentralDeAvisos } from "@/components/app/central-de-avisos";
import { CamposNovaContratacao } from "@/components/app/campos-nova-contratacao";
import { Formulario } from "@/components/app/formulario";
import { SeloUrgente } from "@/components/app/selo-urgente";
import type { PacoteDeAvisos } from "@/modules/notificacoes/avisos-tipos";

const agente = createAgent({ allow: () => true });
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const esperar = () => act(() => new Promise((r) => setTimeout(r, 0)));

const aviso = (id: string, titulo: string, lido = false) => ({ id, tipo: "etapa", titulo, texto: null, contratacaoId: "c1", criadoEm: "2026-11-15T12:00:00Z", lido });
const pacote = (avisos: PacoteDeAvisos["avisos"], som = true): PacoteDeAvisos => ({ avisos, naoLidos: avisos.filter((a) => !a.lido).length, preferencias: { som, email: true } });

function sino(inicial: PacoteDeAvisos, extra: Partial<Parameters<typeof CentralDeAvisos>[0]> = {}) {
  const props = {
    inicial,
    carregar: vi.fn(async () => inicial),
    marcarLidos: vi.fn(async () => ({ ok: "ok" })),
    salvarPreferencias: vi.fn(async () => ({ ok: "ok" })),
    ...extra,
  };
  render(<CentralDeAvisos {...props} />);
  return props;
}

describe("Sino de avisos", () => {
  test("o botão diz quantos avisos não foram lidos e a lista mostra o texto escrito", async () => {
    sino(pacote([aviso("a1", "CT-2026-001: chegou a etapa 5 para a sua área"), aviso("a2", "CT-2026-002: autorizada", true)]));
    const botao = screen.getByRole("button", { name: "Avisos, 1 não lido" });
    await userEvent.click(botao);
    await esperar();
    expect(await screen.findByText("CT-2026-001: chegou a etapa 5 para a sua área")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  test("marcar todos como lidos chama a ação e zera o contador", async () => {
    const props = sino(pacote([aviso("a1", "CT-2026-001: etapa devolvida")]));
    await userEvent.click(screen.getByRole("button", { name: "Avisos, 1 não lido" }));
    await userEvent.click(await screen.findByRole("button", { name: "Marcar todos como lidos" }));
    await esperar();
    expect(props.marcarLidos).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Avisos, nenhum não lido" })).toBeTruthy();
  });

  test("preferências de som e e-mail são salvas ao mudar", async () => {
    const props = sino(pacote([]));
    await userEvent.click(screen.getByRole("button", { name: "Avisos, nenhum não lido" }));
    await userEvent.click(await screen.findByRole("switch", { name: "Tocar som quando chegar aviso" }));
    await esperar();
    expect(props.salvarPreferencias).toHaveBeenCalledWith(false, true);
    await userEvent.click(screen.getByRole("switch", { name: "Receber os avisos também por e-mail" }));
    await esperar();
    expect(props.salvarPreferencias).toHaveBeenLastCalledWith(false, false);
  });

  test("aviso novo é anunciado por escrito para o leitor de tela (nunca só pelo som)", async () => {
    const novo = pacote([aviso("a1", "CT-2026-001: urgente"), aviso("a2", "CT-2026-003: chegou a etapa 1 para a sua área")]);
    const carregar = vi.fn(async () => novo);
    sino(pacote([aviso("a1", "CT-2026-001: urgente")], false), { carregar, intervalo: 20 });
    await act(() => new Promise((r) => setTimeout(r, 80)));
    expect(carregar).toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("Novo aviso: CT-2026-003: chegou a etapa 1 para a sua área");
  });

  test("teste de agente: todo controle do sino tem nome", async () => {
    sino(pacote([aviso("a1", "CT-2026-001: etapa devolvida")]));
    await userEvent.click(screen.getByRole("button", { name: "Avisos, 1 não lido" }));
    await esperar();
    const componentes = agente.snapshot().filter((e) => !e.offPage && e.component !== "more");
    for (const e of componentes) expect(e.label, `${e.component} ${e.ref} sem nome`).toBeTruthy();
  });
});

describe("Urgência na abertura", () => {
  const matriz = [{ id: "m1", grupo: "5 Alvenaria", subgrupo: null, atividade: "Alvenaria", formaLegal: "Contrato", unidadeNegociacao: null, tipo: null, lotes: null, unidadeMedicao: null, observacoes: null }];

  test("motivo e data de necessidade só aparecem ao marcar urgente, e vão no formulário", async () => {
    let enviado: FormData | null = null;
    const acao = vi.fn(async (_: object, d: FormData) => { enviado = d; return { ok: "Aberta." }; });
    render(
      <Formulario acao={acao} textoBotao="Abrir contratação">
        <CamposNovaContratacao obras={[{ id: "o1", nome: "Obra Block", prefixoSienge: null }]} limite={4000} matriz={matriz} />
      </Formulario>,
    );
    expect(screen.queryByRole("textbox", { name: "Motivo da urgência" })).toBeNull();
    await userEvent.click(screen.getByRole("checkbox", { name: /Marcar como urgente/ }));
    await userEvent.type(screen.getByRole("textbox", { name: "Motivo da urgência" }), "Concretagem na semana");
    await userEvent.type(screen.getByLabelText("Data de necessidade"), "2026-11-30");
    await userEvent.click(screen.getByRole("button", { name: "Abrir contratação" }));
    await esperar();
    const d = enviado as unknown as FormData;
    expect(d.get("urgente")).toBe("on");
    expect(d.get("urgente_motivo")).toBe("Concretagem na semana");
    expect(d.get("urgente_data")).toBe("2026-11-30");
  });

  test("selo Urgente mostra a data de necessidade", () => {
    render(<SeloUrgente data="2026-11-30" />);
    expect(screen.getByText("Urgente").getAttribute("title")).toBe("Necessária até 30/11/2026");
  });
});
