import { describe, expect, it } from "vitest";
import { destinoSeguro } from "@/lib/destino-seguro";
import { caminhoDeArquivoValido } from "@/lib/caminho-arquivo";

describe("destinoSeguro", () => {
  it("aceita caminhos internos", () => {
    expect(destinoSeguro("/painel")).toBe("/painel");
    expect(destinoSeguro("/contratacoes?x=1#a")).toBe("/contratacoes?x=1#a");
  });
  it.each(["//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "https://evil.com", "evil.com", "", "/\u0000"])(
    "rejeita %j",
    (v) => expect(destinoSeguro(v, "/x")).toBe("/x"),
  );
  it("rejeita o que não é texto", () => expect(destinoSeguro(null, "/x")).toBe("/x"));
});

describe("caminhoDeArquivoValido", () => {
  const e = "11111111-1111-4111-8111-111111111111";
  const v = "22222222-2222-4222-8222-222222222222";
  const f = "33333333-3333-4333-8333-333333333333";
  it("aceita os caminhos gerados pelo servidor", () => {
    expect(caminhoDeArquivoValido(`empresas/${e}/empresa/cnd_federal/${f}.pdf`)).toBe(true);
    expect(caminhoDeArquivoValido(`empresas/${e}/vinculos/${v}/aso/${f}.png`)).toBe(true);
  });
  it("rejeita travessia e formatos fora do padrão", () => {
    expect(caminhoDeArquivoValido(`empresas/${e}/empresa/cnd_federal/../../../${v}/empresa/x/${f}.pdf`)).toBe(false);
    expect(caminhoDeArquivoValido(`empresas/${e}/empresa/cnd_federal/arquivo.pdf`)).toBe(false);
    expect(caminhoDeArquivoValido(`empresas/${e}/empresa/cnd_federal/${f}.exe`)).toBe(false);
    expect(caminhoDeArquivoValido(`empresas/${e}/empresa/cnd_federal/a/${f}.pdf`)).toBe(false);
  });
});
