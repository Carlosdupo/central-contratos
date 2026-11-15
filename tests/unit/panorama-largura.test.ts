import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

// O panorama não pode ter largura mínima maior que a tela (nem rolagem lateral) em nenhuma largura, até 320 px (celular pequeno).
const TELA_MINIMA = 320;
const css = readFileSync("app/globals.css", "utf8");
const regrasDoPanorama = [...css.matchAll(/([^{}]*\.pan-[^{}]*)\{([^}]*)\}/g)].map((m) => ({ seletor: m[1].trim(), corpo: m[2] }));

describe("Panorama: sem largura mínima maior que a tela", () => {
  test("o CSS do panorama existe", () => {
    expect(regrasDoPanorama.length).toBeGreaterThan(10);
  });

  test("nenhuma regra .pan-* fixa largura mínima ou largura maior que a tela, nem liga rolagem lateral", () => {
    for (const { seletor, corpo } of regrasDoPanorama) {
      for (const m of corpo.matchAll(/(?<![a-z-])(min-width|width)\s*:\s*(\d+)px/g)) {
        expect(Number(m[2]), `${seletor} { ${m[1]}: ${m[2]}px }`).toBeLessThanOrEqual(TELA_MINIMA);
      }
      expect(corpo, seletor).not.toMatch(/overflow-x\s*:\s*(auto|scroll)/);
      expect(corpo, seletor).not.toMatch(/white-space\s*:\s*nowrap/);
    }
  });

  test("a linha vira uma coluna só no celular e as colunas usam minmax(0, …) (encolhem em vez de empurrar a tela)", () => {
    const linha = regrasDoPanorama.find((r) => r.seletor === ".pan-linha");
    expect(linha?.corpo).toMatch(/grid-template-columns:\s*minmax\(0/);
    expect(css).toMatch(/@media \(max-width: 859px\) \{ \.pan-linha \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  });

  test("a janela de detalhe nunca passa da largura da tela", () => {
    expect(css).toMatch(/drawer-content"\]:has\(\.pan-passo\) \{ width: min\(100vw, \d+px\)/);
  });

  test.each(["components/app/panorama.tsx", "app/(interno)/contratacoes/panorama/page.tsx"])("%s não usa largura mínima fixa maior que a tela nem rolagem lateral", (arquivo) => {
    const src = readFileSync(arquivo, "utf8");
    for (const m of src.matchAll(/\bmin-w-\[(\d+)px\]/g)) expect(Number(m[1]), `${arquivo}: ${m[0]}`).toBeLessThanOrEqual(TELA_MINIMA);
    expect(src).not.toMatch(/overflow-x-(auto|scroll)/);
    expect(src).not.toMatch(/whitespace-nowrap/);
    expect(src).not.toMatch(/<table/);
  });
});
