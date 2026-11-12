import { describe, expect, it } from "vitest";
import { montarCsp } from "@/lib/csp";

const base = { nonce: "abc123", supabaseUrl: "https://xyz.supabase.co/rest/v1", desenvolvimento: false };

describe("montarCsp", () => {
  const csp = montarCsp(base);
  it("só aceita scripts com o nonce e sem unsafe-inline/unsafe-eval em produção", () => {
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });
  it("libera o Supabase só pela origem (sem caminho)", () => {
    expect(csp).toContain("connect-src 'self' https://xyz.supabase.co;");
    expect(csp).toContain("img-src 'self' blob: data: https://xyz.supabase.co;");
  });
  it("mantém as proteções de enquadramento, formulário e objetos", () => {
    for (const d of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "default-src 'self'"]) expect(csp).toContain(d);
  });
  it("em desenvolvimento libera eval e websocket (recarga do Next)", () => {
    const dev = montarCsp({ ...base, desenvolvimento: true });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("ws: wss:");
  });
});
