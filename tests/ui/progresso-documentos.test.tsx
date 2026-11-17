import { cleanup, render, screen } from "@testing-library/react";
import { createAgent } from "@ui-sdk/react/agent";
import { afterEach, describe, expect, test } from "vitest";
import { ProgressoDocumentos } from "@/components/app/progresso-documentos";
import { progressoDocumentos } from "@/modules/terceiros/dominio/documentos";

afterEach(cleanup);

describe("Marcador de documentação aceita", () => {
  test("mostra percentual, contagem e faixa em texto", () => {
    render(<ProgressoDocumentos progresso={progressoDocumentos(["aprovado", "aprovado", "aprovado", "enviado"])} />);
    const medidor = screen.getByRole("meter", { name: "Documentação aceita" });
    expect(medidor.getAttribute("aria-valuetext")).toBe("75% aceito, 3 de 4");
    expect(medidor.getAttribute("data-faixa")).toBe("andamento");
    expect(screen.getByText("Em andamento")).toBeTruthy();
  });

  test("reprovado aparece como pendência, tudo aprovado como completo", () => {
    const { rerender } = render(<ProgressoDocumentos progresso={progressoDocumentos(["aprovado", "reprovado"])} />);
    expect(screen.getByText("Tem pendência")).toBeTruthy();
    rerender(<ProgressoDocumentos progresso={progressoDocumentos(["aprovado", "aprovado"])} />);
    expect(screen.getByText("Completo")).toBeTruthy();
  });

  test("sem documentos exigidos não mostra nada", () => {
    const { container } = render(<ProgressoDocumentos progresso={progressoDocumentos([])} />);
    expect(container.innerHTML).toBe("");
  });

  test("agente lê o marcador pelo nome", () => {
    render(<ProgressoDocumentos progresso={progressoDocumentos(["aprovado", "falta"])} rotulo="Documentos da empresa" />);
    const agente = createAgent({ allow: () => true });
    const tela = agente.snapshot();
    expect(JSON.stringify(tela)).toContain("Documentos da empresa");
  });
});
