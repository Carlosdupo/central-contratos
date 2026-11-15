import { lerCsv } from "@/lib/csv";

// Converte o CSV das planilhas de suprimentos (e do cronograma) no que o banco recebe. Só lê e confere: o banco confere de novo.
// A planilha real tem linhas de título no topo, o cabeçalho se repete a cada fase (e pode mudar de uma fase para outra),
// linhas de fase (texto numa célula só), colunas calculadas com erro de fórmula e indicadores à direita (a partir da coluna S).

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Colunas lidas: só as 18 primeiras (A a R). O que vem depois (totais e indicadores) é ignorado. */
const COLUNAS_LIDAS = 18;
const ERRO_DE_FORMULA = /^#(REF!|VALUE!|N\/A|DIV\/0!|NAME\?|NUM!|NULL!)$/i;

const vazio = (v: string | undefined) => {
  const t = (v ?? "").trim();
  return t === "" || ERRO_DE_FORMULA.test(t);
};

function dataValida(t: string): string | undefined {
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

/** "31/10/2026" ou "2026-10-31" -> "2026-10-31"; "ok", "_", "NA", "não tem", erro de fórmula, vazio -> null; outra coisa -> undefined (inválido). */
export function lerData(v: string | undefined): string | null | undefined {
  const t = (v ?? "").trim();
  if (vazio(t) || /^(_|-|ok|na|n\/a|nao tem|não tem)$/i.test(t)) return null;
  return dataValida(t);
}

export type SituacaoDoLado = "pendente" | "feito" | "feito_sem_data" | "nao_se_aplica";

/**
 * Data real da obra ou de compras. Uma data = feito naquele dia; "ok" = feito, sem a data; "NA", "não tem" = não se aplica;
 * "_", vazio e erro de fórmula = pendente. Outra coisa -> undefined (inválido).
 */
export function lerSituacao(v: string | undefined): { situacao: SituacaoDoLado; data: string | null } | undefined {
  const t = (v ?? "").trim();
  if (vazio(t) || /^(_|-)$/.test(t)) return { situacao: "pendente", data: null };
  if (/^ok$/i.test(t)) return { situacao: "feito_sem_data", data: null };
  if (["na", "n a", "nao tem"].includes(semAcento(t))) return { situacao: "nao_se_aplica", data: null };
  const data = dataValida(t);
  return data ? { situacao: "feito", data } : undefined;
}

const lerDias = (v: string | undefined): number | null | undefined => {
  const t = (v ?? "").trim();
  if (vazio(t) || /^(_|-|na|n\/a)$/i.test(t)) return null;
  return /^\d{1,4}$/.test(t) ? Number(t) : undefined;
};

const COLUNAS: Record<string, string[]> = {
  fase: ["fase"],
  id_pacote: ["id do pacote", "id pacote", "id"],
  pacote_vinculado: ["pacote vinculado"],
  local: ["tipo local", "local", "tipo"],
  responsavel: ["responsavel"],
  descricao: ["descricao", "item", "descricao do item", "principais mao de obra do projeto", "principais insumos do projeto"],
  prazo_compras_dias: ["prazo que compras precisa dias", "prazo que compras precisa", "prazo que o compras precisa", "prazo compras dias", "prazo de compras dias", "prazo compras"],
  prazo_chegada_dias: ["prazo ate chegar na obra dias", "prazo ate chegar na obra", "prazo chegada dias", "prazo chegada"],
  inicio_manual: ["inicio pacote atual", "inicio atual", "inicio", "data de inicio", "inicio do pacote"],
  sienge_solicitacao: ["numero da solicitacao sienge material", "n solicitacao no sienge", "no solicitacao no sienge", "solicitacao no sienge", "solicitacao sienge"],
  data_real_obra: ["data real obra", "data real da obra", "data real que a obra solicitou"],
  data_real_compras: ["data real compras", "data real de compras", "data real que compras fechou"],
  observacao: ["causa do atraso observacao", "observacao", "causa do atraso"],
};

function indices(cabecalho: string[]): Record<string, number> {
  const norm = cabecalho.slice(0, COLUNAS_LIDAS).map(semAcento);
  const achado: Record<string, number> = {};
  for (const [campo, nomes] of Object.entries(COLUNAS)) {
    const i = norm.findIndex((n) => nomes.includes(n));
    if (i >= 0) achado[campo] = i;
  }
  return achado;
}

/** Linha de cabeçalho: tem a coluna de descrição e mais pelo menos duas colunas conhecidas. */
const ehCabecalho = (cabecalho: string[]) => {
  const col = indices(cabecalho);
  return col.descricao !== undefined && Object.keys(col).length >= 3;
};

export type ItemPlanilha = Record<string, string | number | null>;

export function lerPlanilha(texto: string): { itens: ItemPlanilha[]; erro?: string } {
  const linhas = lerCsv(texto);
  let col: Record<string, number> | null = null;
  let fase: string | null = null;
  const itens: ItemPlanilha[] = [];
  for (let n = 0; n < linhas.length; n++) {
    const l = linhas[n];
    if (ehCabecalho(l)) {
      // O cabeçalho se repete a cada fase e pode mudar de um bloco para outro. Uma coluna que perdeu o nome
      // (célula do cabeçalho em branco, como o ID em alguns blocos) continua valendo na mesma posição.
      const novo = indices(l);
      for (const [campo, i] of Object.entries(col ?? {})) if (novo[campo] === undefined && (l[i] ?? "").trim() === "") novo[campo] = i;
      col = novo;
      continue;
    }
    const preenchidas = l.slice(0, COLUNAS_LIDAS).filter((x) => x.trim() !== "");
    const at = (campo: string) => (col === null || col[campo] === undefined ? undefined : l[col[campo]]);
    // Antes do primeiro cabeçalho há títulos e a data de referência; a linha da primeira fase também vem antes dele.
    const descricao = (at("descricao") ?? "").trim();
    if (!descricao) {
      // Linha de fase: texto numa célula só, com letras (descarta números soltos, como a data de referência).
      if (preenchidas.length === 1 && /[A-Za-zÀ-ÿ]/.test(preenchidas[0])) fase = preenchidas[0].replace(/\s+/g, " ").trim();
      continue;
    }
    const aqui = `Linha ${n + 1}`;
    const dias = (campo: string) => lerDias(at(campo));
    const inicio = lerData(at("inicio_manual"));
    const obra = lerSituacao(at("data_real_obra"));
    const compras = lerSituacao(at("data_real_compras"));
    const invalido = (campo: string) => `${aqui}: valor inválido na coluna "${campo}".`;
    if (dias("prazo_compras_dias") === undefined) return { itens: [], erro: invalido("prazo de compras") };
    if (dias("prazo_chegada_dias") === undefined) return { itens: [], erro: invalido("prazo até chegar na obra") };
    if (inicio === undefined) return { itens: [], erro: invalido("início") };
    if (!obra) return { itens: [], erro: invalido("data real da obra") };
    if (!compras) return { itens: [], erro: invalido("data real de compras") };
    const txt = (campo: string) => {
      const v = (at(campo) ?? "").trim();
      return v === "" || ERRO_DE_FORMULA.test(v) ? null : v;
    };
    itens.push({
      fase: txt("fase") ?? fase,
      id_pacote: txt("id_pacote"),
      pacote_vinculado: txt("pacote_vinculado"),
      local: txt("local"),
      responsavel: txt("responsavel"),
      descricao,
      prazo_compras_dias: dias("prazo_compras_dias") as number | null,
      prazo_chegada_dias: dias("prazo_chegada_dias") as number | null,
      inicio_manual: inicio,
      sienge_solicitacao: txt("sienge_solicitacao"),
      data_real_obra: obra.data,
      data_real_compras: compras.data,
      situacao_obra: obra.situacao,
      situacao_compras: compras.situacao,
      observacao: txt("observacao"),
    });
  }
  if (!col) return { itens: [], erro: "Não achei a linha de cabeçalho com a coluna de descrição do item (ex.: Principais Mão de obra do Projeto)." };
  return itens.length ? { itens } : { itens, erro: "Nenhum item com descrição foi encontrado." };
}

export function lerCronograma(texto: string): { pacotes: { id_pacote: string; inicio: string }[]; erro?: string } {
  const linhas = lerCsv(texto);
  const cab = linhas.findIndex((l) => {
    const c = indices(l);
    return c.id_pacote !== undefined && c.inicio_manual !== undefined;
  });
  if (cab < 0) return { pacotes: [], erro: "Não achei as colunas ID e Data de Início na primeira linha." };
  const col = indices(linhas[cab]);
  const pacotes: { id_pacote: string; inicio: string }[] = [];
  for (let n = cab + 1; n < linhas.length; n++) {
    const id = (linhas[n][col.id_pacote] ?? "").trim();
    if (!id || vazio(id)) continue;
    const inicio = lerData(linhas[n][col.inicio_manual]);
    if (inicio === undefined) return { pacotes: [], erro: `Linha ${n + 1}: data de início inválida.` };
    if (inicio) pacotes.push({ id_pacote: id, inicio });
  }
  return pacotes.length ? { pacotes } : { pacotes, erro: "Nenhum pacote com data de início foi encontrado." };
}
