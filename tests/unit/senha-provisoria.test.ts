import { readFileSync } from "node:fs";
import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { gerarSenhaProvisoria } = await import("@/lib/senha-provisoria");

describe("Gerador de senha provisória", () => {
  const amostra = Array.from({ length: 2000 }, () => gerarSenhaProvisoria());

  test("tem 16 caracteres e segue a regra de senha do projeto (10+, maiúscula, minúscula e número)", () => {
    for (const s of amostra) {
      expect(s).toHaveLength(16);
      expect(s).toMatch(/[a-z]/);
      expect(s).toMatch(/[A-Z]/);
      expect(s).toMatch(/\d/);
      expect(s.length).toBeGreaterThanOrEqual(10);
    }
  });

  test("usa só letras e números fáceis de ditar (sem 0, O, 1, l, I e sem símbolos)", () => {
    for (const s of amostra) expect(s).toMatch(/^[A-HJ-NP-Za-km-z2-9]+$/);
  });

  test("é aleatória: 2.000 senhas, todas diferentes", () => {
    expect(new Set(amostra).size).toBe(amostra.length);
  });

  test("os caracteres se espalham pelo alfabeto e as classes obrigatórias não ficam sempre no começo", () => {
    const usados = new Set(amostra.join(""));
    expect(usados.size).toBeGreaterThanOrEqual(55);
    const primeirosSaoMaiusculas = amostra.filter((s) => /^[A-Z]/.test(s)).length;
    expect(primeirosSaoMaiusculas / amostra.length).toBeLessThan(0.6);
    expect(primeirosSaoMaiusculas / amostra.length).toBeGreaterThan(0.1);
  });

  test("rejeita tamanho curto demais", () => {
    expect(() => gerarSenhaProvisoria(8)).toThrow();
  });

  test("usa o sorteador criptográfico do Node, não Math.random", () => {
    const src = readFileSync("lib/senha-provisoria.ts", "utf8");
    expect(src).toContain('from "node:crypto"');
    expect(src).toContain("randomInt");
    expect(src).not.toContain("Math.random");
  });
});
