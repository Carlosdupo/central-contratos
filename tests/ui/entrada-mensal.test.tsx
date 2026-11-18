import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { TipoDocumento } from "@/modules/terceiros/dominio/documentos";

vi.mock("@/components/app/documentos", () => ({ BotaoAbrirArquivo: () => null, EnviarArquivo: () => null, SeloEstado: ({ estado }: { estado: string }) => <span>{estado}</span> }));
vi.mock("@/modules/terceiros/acoes", () => ({ salvarTextoEmpresa: async () => ({}) }));
const { ListaDocumentosEmpresa } = await import("@/components/app/lista-documentos-empresa");
type Item = Parameters<typeof ListaDocumentosEmpresa>[0]["itens"][number];

afterEach(cleanup);

const tipo = (codigo: string, etapa: "entrada" | "mensal"): TipoDocumento => ({
  codigo, nome: codigo, regra_validade: etapa === "mensal" ? "mensal" : "sem_validade", chave_validade: null, sensivel: false, aceita_texto: false, observacao: null, ordem: 1, etapa, responsavel: "rh", so_optante_simples: false,
});
const item = (codigo: string, etapa: "entrada" | "mensal", estado: Item["estado"]): Item => ({
  tipo: tipo(codigo, etapa), estado, documentoId: null, arquivoId: null, validade: null, competencia: etapa === "mensal" ? "2026-10-01" : null, valorTexto: null, motivo: null,
});

describe("Documentos da empresa: entrada e mensal", () => {
  test("cada etapa tem a sua barra, com a competência no mensal", () => {
    render(<ListaDocumentosEmpresa editavel={false} podeAbrir={false} itens={[item("cnd_federal", "entrada", "aprovado"), item("cartao_cnpj", "entrada", "falta"), item("fgts_guia", "mensal", "aprovado")]} />);
    expect(screen.getByRole("meter", { name: "Documentação de entrada" }).getAttribute("aria-valuetext")).toBe("50% aceito, 1 de 2");
    expect(screen.getByRole("meter", { name: "Documentação mensal: competência 10/2026" }).getAttribute("aria-valuetext")).toBe("100% aceito, 1 de 1");
  });

  test("sem mensal, só a entrada aparece", () => {
    render(<ListaDocumentosEmpresa editavel={false} podeAbrir={false} itens={[item("cnd_federal", "entrada", "enviado")]} />);
    expect(screen.getAllByRole("meter")).toHaveLength(1);
  });
});
