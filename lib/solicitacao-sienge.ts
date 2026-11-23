import { z } from "zod";

// Solicitação para importação no Sienge: itens por serviço da EAP -> CSV no formato do exemplo da obra
// (UTF-8 com BOM, ";" como separador, CRLF, ponto decimal, títulos da EAP com nível 1/2 e itens com nível 4).

export const CABECALHO_SIENGE = [
  "Nível",
  "Descrição do item",
  "Código do serviço",
  "Complemento",
  "Código auxiliar do item",
  "Quantidade",
  "Código/Sigla da unidade de medida",
  "Preço Unitário de Mão de Obra",
  "Preço Unitário de Material",
  "Observação interna",
  "Código da unidade construtiva",
  "Referência do item de orçamento",
  "Código da conta financeira",
] as const;

const texto = (max: number) => z.string().trim().max(max);

export const esquemaItemSienge = z.object({
  id: z.string().min(1).max(40),
  referencia: z.string().regex(/^\d+(\.\d+)*$/, "Serviço da EAP inválido."),
  descricao: z.string().trim().min(1, "Todo item precisa de descrição.").max(200, "Descrição do item grande demais (até 200)."),
  codigo_servico: texto(20),
  complemento: texto(60),
  codigo_auxiliar: texto(30),
  quantidade: z.number({ message: "Quantidade inválida." }).positive("A quantidade precisa ser maior que zero.").max(1e9),
  unidade: z.string().trim().min(1, "Informe a unidade de medida.").max(10),
  preco_mo: z.number({ message: "Preço de mão de obra inválido." }).min(0).max(1e10),
  preco_mat: z.number({ message: "Preço de material inválido." }).min(0).max(1e10),
  observacao: texto(300),
  conta_financeira: texto(40),
});
export type ItemSienge = z.infer<typeof esquemaItemSienge>;

export const esquemaSolicitacaoSienge = z.object({
  titulo: z.string().trim().min(1, "Dê um nome à solicitação.").max(80, "Nome grande demais (até 80)."),
  unidade_construtiva: texto(20),
  conta_financeira: texto(40),
  itens: z.array(esquemaItemSienge).max(2000, "Até 2.000 itens por solicitação."),
});
export type SolicitacaoSienge = z.infer<typeof esquemaSolicitacaoSienge>;

export type ServicoEap = { referencia: string; descricao: string; nivel: number };

/** Número digitado no padrão brasileiro ("9.648,05", "9648,05") ou com ponto ("9648.05"). Vazio ou inválido -> NaN. */
export function lerNumero(t: string): number {
  const s = t.trim().replace(/\s/g, "");
  if (!s) return NaN;
  const normal = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return /^-?\d+(\.\d+)?$/.test(normal) ? Number(normal) : NaN;
}

export const totalDoItem = (i: Pick<ItemSienge, "quantidade" | "preco_mo" | "preco_mat">) => i.quantidade * (i.preco_mo + i.preco_mat);

// O Sienge lê o arquivo sem aspas: ";" e quebras de linha no texto viram espaço.
const limpar = (t: string) => t.replace(/[;\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
const decimal = (n: number) => n.toFixed(2);
const quantidade = (n: number) => String(Number(n.toFixed(6)));

/** Ancestrais da referência na EAP ("23.005.002" -> ["23", "23.005"]). */
const ancestrais = (ref: string) => ref.split(".").map((_, i, p) => p.slice(0, i + 1).join("."));

export function gerarCsvSienge(
  solicitacao: Pick<SolicitacaoSienge, "unidade_construtiva" | "conta_financeira" | "itens">,
  eap: ServicoEap[],
): string {
  const desc = new Map(eap.map((e) => [e.referencia, e.descricao]));
  const ordem = new Map(eap.map((e, i) => [e.referencia, i]));
  const refs = [...new Set(solicitacao.itens.map((i) => i.referencia))].sort(
    (a, b) => (ordem.get(a) ?? Number.MAX_SAFE_INTEGER) - (ordem.get(b) ?? Number.MAX_SAFE_INTEGER) || a.localeCompare(b, "pt-BR", { numeric: true }),
  );
  const linhas: string[] = [CABECALHO_SIENGE.join(";")];
  const vazias = ";".repeat(CABECALHO_SIENGE.length - 2);
  const titulos = new Set<string>();
  for (const ref of refs) {
    for (const a of ancestrais(ref)) {
      if (titulos.has(a)) continue;
      titulos.add(a);
      const nivel = a.split(".").length;
      linhas.push(`${nivel};${limpar(`${a} ${desc.get(a) ?? ""}`)}${vazias}`);
    }
    const nivelItem = Math.max(4, ref.split(".").length + 1);
    for (const i of solicitacao.itens.filter((x) => x.referencia === ref)) {
      linhas.push(
        [
          nivelItem,
          limpar(i.descricao),
          limpar(i.codigo_servico),
          limpar(i.complemento),
          limpar(i.codigo_auxiliar),
          quantidade(i.quantidade),
          limpar(i.unidade).padEnd(3, " "),
          decimal(i.preco_mo),
          decimal(i.preco_mat),
          limpar(i.observacao),
          limpar(solicitacao.unidade_construtiva),
          ref,
          limpar(i.conta_financeira || solicitacao.conta_financeira),
        ].join(";"),
      );
    }
  }
  return `﻿${linhas.join("\r\n")}\r\n`;
}

/** Nome do arquivo a partir do nome da solicitação ("BL0087" -> "BL0087.csv"). */
export const nomeArquivoSienge = (titulo: string) => `${titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "solicitacao"}.csv`;

/** Série por pavimento: "BASE - 6 PAVTO - TIPO 01" ... (tipo opcional, com dois dígitos). */
export function serieDePavimentos(base: string, de: number, ate: number, tipoInicial: number | null): string[] {
  const nomes: string[] = [];
  for (let p = de, t = tipoInicial; p <= ate && nomes.length < 200; p++, t = t == null ? null : t + 1) {
    nomes.push(`${base.trim()} - ${p} PAVTO${t == null ? "" : ` - TIPO ${String(t).padStart(2, "0")}`}`);
  }
  return nomes;
}
