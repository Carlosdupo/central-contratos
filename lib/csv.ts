// Leitura de CSV exportado do Excel: separador ";", "," ou tab, aspas, BOM e quebra de linha do Windows.

/** Bytes do arquivo -> texto. O Excel do Brasil grava "CSV" em Windows-1252; "CSV UTF-8" vem em UTF-8. */
export function decodificarCsv(bytes: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

// O separador é o que mais aparece nas primeiras linhas com conteúdo (o arquivo pode começar com linhas vazias).
function separador(t: string): string {
  const amostra = t.split(/\r?\n/).filter((l) => l.trim() !== "").slice(0, 25).join("\n");
  const conta = (c: string) => amostra.split(c).length - 1;
  const [pv, vg, tab] = [conta(";"), conta(","), conta("\t")];
  if (pv > 0 && pv >= vg && pv >= tab) return ";";
  if (tab > vg) return "\t";
  return ",";
}

export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, "");
  const sep = separador(t);
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo);
      campo = "";
      if (linha.some((x) => x.trim() !== "")) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((x) => x.trim() !== "")) linhas.push(linha);
  return linhas.map((l) => l.map((x) => x.trim()));
}
