import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

// Conferência dos pares de cores do Nexus nos dois temas (app/globals.css): texto 4,5:1; bordas, foco e estados 3:1.

const css = readFileSync("app/globals.css", "utf8");

function tokens(bloco: string): Record<string, string> {
  return Object.fromEntries([...bloco.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\b/g)].map((m) => [m[1], m[2]]));
}
// Claro: o bloco :root da linha base; escuro: o bloco :root[data-theme="dark"] (o da preferência do sistema é igual).
const claroInicio = css.indexOf(":root {");
const claro = tokens(css.slice(claroInicio, css.indexOf("}", claroInicio)));
const escuroInicio = css.indexOf(':root[data-theme="dark"] {');
const escuro = tokens(css.slice(escuroInicio, css.indexOf("}", escuroInicio)));

const canal = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luz = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
};
const contraste = (a: string, b: string) => {
  const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [primeiro plano, fundo, mínimo, para quê]
const TEXTO = 4.5;
const GRAFICO = 3;
const PARES: [string, string, number, string][] = [
  ["texto", "superficie", TEXTO, "texto na superfície"],
  ["texto", "fundo", TEXTO, "texto no fundo da página"],
  ["cinza", "superficie", TEXTO, "texto secundário na superfície"],
  ["cinza", "preenchimento", TEXTO, "texto secundário sobre preenchimento"],
  ["azul", "superficie", TEXTO, "link e botão em texto azul"],
  ["azul-tinta", "azul", TEXTO, "texto do botão primário"],
  ["azul", "azul-suave", TEXTO, "texto azul sobre fundo suave (menu, filtro marcado)"],
  ["ok", "ok-soft", TEXTO, "selo verde"],
  ["warn", "warn-soft", TEXTO, "selo amarelo e avisos"],
  ["hot", "hot-soft", TEXTO, "selo de urgência"],
  ["bad", "bad-soft", TEXTO, "selo vermelho"],
  ["info", "info-soft", TEXTO, "selo azul"],
  ["bad", "superficie", TEXTO, "texto de erro e de atraso"],
  ["hot", "superficie", TEXTO, "texto de urgência"],
  ["ok", "superficie", TEXTO, "texto de concluído"],
  ["separador-forte", "superficie", GRAFICO, "borda dos campos e contorno da trilha"],
  ["azul", "superficie", GRAFICO, "foco e segmento da etapa atual"],
  ["ok-fill", "superficie", GRAFICO, "segmento de etapa concluída"],
  ["bad", "superficie", GRAFICO, "segmento de etapa atrasada"],
];

for (const [tema, t] of [["claro", claro], ["escuro", escuro]] as const) {
  describe(`Contraste no tema ${tema}`, () => {
    test("os tokens foram lidos", () => {
      for (const nome of ["texto", "superficie", "azul", "bad", "separador-forte"]) expect(t[nome], `token ${nome}`).toMatch(/^#/);
    });
    for (const [a, b, minimo, uso] of PARES) {
      test(`${uso} (${a} sobre ${b}) ≥ ${minimo}:1`, () => {
        expect(contraste(t[a], t[b])).toBeGreaterThanOrEqual(minimo);
      });
    }
  });
}
