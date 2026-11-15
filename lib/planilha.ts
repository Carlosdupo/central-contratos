import { lerCsv } from "@/lib/csv";

// Converte o CSV das planilhas de suprimentos (e do cronograma) no que o banco recebe. Só lê e confere: o banco confere de novo.

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** "31/10/2026" ou "2026-10-31" -> "2026-10-31"; "ok", "_", "NA", "não tem", vazio -> null; outra coisa -> undefined (inválido). */
export function lerData(v: string | undefined): string | null | undefined {
  const t = (v ?? "").trim();
  if (!t || /^(_|-|ok|na|n\/a|nao tem|não tem)$/i.test(t)) return null;
  let d: string;
  let m: string;
  let a: string;
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (br) [, d, m, a] = br;
  else if (iso) [, a, m, d] = iso;
  else return undefined;
  const data = new Date(Date.UTC(Number(a), Number(m) - 1, Number(d)));
  if (data.getUTCFullYear() !== Number(a) || data.getUTCMonth() !== Number(m) - 1 || data.getUTCDate() !== Number(d)) return undefined;
  return `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

const lerDias = (v: string | undefined): number | null | undefined => {
  const t = (v ?? "").trim();
  if (!t || /^(_|-|na|n\/a)$/i.test(t)) return null;
  return /^\d{1,4}$/.test(t) ? Number(t) : undefined;
};

const COLUNAS: Record<string, string[]> = {
  fase: ["fase"],
  id_pacote: ["id do pacote", "id pacote", "id"],
  pacote_vinculado: ["pacote vinculado"],
  local: ["tipo local", "local", "tipo"],
  responsavel: ["responsavel"],
  descricao: ["descricao", "item", "descricao do item"],
  prazo_compras_dias: ["prazo que compras precisa dias", "prazo compras dias", "prazo de compras dias", "prazo compras"],
  prazo_chegada_dias: ["prazo ate chegar na obra dias", "prazo ate chegar na obra", "prazo chegada dias", "prazo chegada"],
  inicio_manual: ["inicio atual", "inicio", "data de inicio", "inicio do pacote"],
  sienge_solicitacao: ["n solicitacao no sienge", "no solicitacao no sienge", "solicitacao no sienge", "solicitacao sienge"],
  data_real_obra: ["data real da obra", "data real obra"],
  data_real_compras: ["data real de compras", "data real compras"],
  observacao: ["causa do atraso observacao", "observacao", "causa do atraso"],
};

function indices(cabecalho: string[]): Record<string, number> {
  const norm = cabecalho.map(semAcento);
  const achado: Record<string, number> = {};
  for (const [campo, nomes] of Object.entries(COLUNAS)) {
    const i = norm.findIndex((n) => nomes.includes(n));
    if (i >= 0) achado[campo] = i;
  }
  return achado;
}

export type ItemPlanilha = Record<string, string | number | null>;

export function lerPlanilha(texto: string): { itens: ItemPlanilha[]; erro?: string } {
  const linhas = lerCsv(texto);
  if (linhas.length < 2) return { itens: [], erro: "A planilha está vazia." };
  const col = indices(linhas[0]);
  if (col.descricao === undefined) return { itens: [], erro: "Não achei a coluna de descrição do item na primeira linha." };
  const itens: ItemPlanilha[] = [];
  for (let n = 1; n < linhas.length; n++) {
    const l = linhas[n];
    const at = (campo: string) => (col[campo] === undefined ? undefined : l[col[campo]]);
    if (!(at("descricao") ?? "").trim()) continue;
    const dias = (campo: string) => lerDias(at(campo));
    const datas = (campo: string) => lerData(at(campo));
    const conferidos: [string, unknown][] = [
      ["prazo_compras_dias", dias("prazo_compras_dias")],
      ["prazo_chegada_dias", dias("prazo_chegada_dias")],
      ["inicio_manual", datas("inicio_manual")],
      ["data_real_obra", datas("data_real_obra")],
      ["data_real_compras", datas("data_real_compras")],
    ];
    for (const [campo, valor] of conferidos) {
      if (valor === undefined) return { itens: [], erro: `Linha ${n + 1}: valor inválido na coluna "${campo.replace(/_/g, " ")}".` };
    }
    const texto = (campo: string) => (at(campo) ?? "").trim() || null;
    itens.push({
      fase: texto("fase"),
      id_pacote: texto("id_pacote"),
      pacote_vinculado: texto("pacote_vinculado"),
      local: texto("local"),
      responsavel: texto("responsavel"),
      descricao: (at("descricao") ?? "").trim(),
      prazo_compras_dias: dias("prazo_compras_dias") as number | null,
      prazo_chegada_dias: dias("prazo_chegada_dias") as number | null,
      inicio_manual: datas("inicio_manual") as string | null,
      sienge_solicitacao: texto("sienge_solicitacao"),
      data_real_obra: datas("data_real_obra") as string | null,
      data_real_compras: datas("data_real_compras") as string | null,
      observacao: texto("observacao"),
    });
  }
  return itens.length ? { itens } : { itens, erro: "Nenhum item com descrição foi encontrado." };
}

export function lerCronograma(texto: string): { pacotes: { id_pacote: string; inicio: string }[]; erro?: string } {
  const linhas = lerCsv(texto);
  if (linhas.length < 2) return { pacotes: [], erro: "O cronograma está vazio." };
  const col = indices(linhas[0]);
  if (col.id_pacote === undefined || col.inicio_manual === undefined) return { pacotes: [], erro: "Não achei as colunas ID do pacote e Início na primeira linha." };
  const pacotes: { id_pacote: string; inicio: string }[] = [];
  for (let n = 1; n < linhas.length; n++) {
    const id = (linhas[n][col.id_pacote] ?? "").trim();
    if (!id) continue;
    const inicio = lerData(linhas[n][col.inicio_manual]);
    if (inicio === undefined) return { pacotes: [], erro: `Linha ${n + 1}: data de início inválida.` };
    if (inicio) pacotes.push({ id_pacote: id, inicio });
  }
  return pacotes.length ? { pacotes } : { pacotes, erro: "Nenhum pacote com data de início foi encontrado." };
}
