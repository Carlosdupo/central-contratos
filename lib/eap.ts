// Leitura da EAP exportada do Sienge (PDF com as colunas Nível | Referência | Descrição).
// Cada item vem numa linha: "2 1.001 PROJETO LEVANTAMENTO TOPOGRÁFICO". Linhas que não começam
// com nível + referência são continuação da descrição anterior (descrição longa quebrada).

export type ItemEap = { referencia: string; descricao: string; nivel: number };

const LINHA = /^(\d)\s+(\d+(?:\.\d+)*)\s+(.+)$/;
const CABECALHO = /^n[ií]vel\s+refer[eê]ncia\s+descri[cç][aã]o$/i;

export function lerEap(texto: string): ItemEap[] {
  const itens: ItemEap[] = [];
  const vistos = new Set<string>();
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\s+/g, " ").trim();
    if (!linha || CABECALHO.test(linha) || /^p[aá]gina\s+\d+/i.test(linha)) continue;
    const m = LINHA.exec(linha);
    if (m) {
      const [, nivel, referencia, descricao] = m;
      // O nível do arquivo tem de bater com a profundidade da referência (1 = "7", 2 = "7.001").
      if (Number(nivel) !== referencia.split(".").length || vistos.has(referencia)) continue;
      vistos.add(referencia);
      itens.push({ referencia, descricao: descricao.slice(0, 200), nivel: Number(nivel) });
    } else if (itens.length) {
      const ultimo = itens[itens.length - 1];
      ultimo.descricao = `${ultimo.descricao} ${linha}`.slice(0, 200);
    }
  }
  return itens;
}

/** Itens agrupados pelo nível 1 (para o seletor da nova contratação). */
export function agruparEap<T extends { referencia: string; nivel: number }>(itens: T[]): { grupo: T; filhos: T[] }[] {
  const grupos: { grupo: T; filhos: T[] }[] = [];
  for (const item of itens) {
    if (item.nivel === 1) grupos.push({ grupo: item, filhos: [] });
    else grupos.at(-1)?.filhos.push(item);
  }
  return grupos;
}
