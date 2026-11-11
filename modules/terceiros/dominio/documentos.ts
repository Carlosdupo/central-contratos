// Regras de documentos de terceiros (puras, sem framework). Testes em tests/unit/documentos.test.ts.
import { somarDias, type DataISO } from "@/lib/datas";

export type RegraValidade = "meses_apos_emissao" | "data_informada" | "sem_validade" | "mensal";
export type SituacaoDocumento = "anexado" | "enviado" | "aprovado" | "reprovado" | "vencido";
export type AplicaA = "empresa" | "funcionario" | "socio_diario";
export type Condicao = "sempre" | "eletricidade" | "mais_de_5_na_obra";

export type TipoDocumento = {
  codigo: string;
  nome: string;
  regra_validade: RegraValidade;
  chave_validade: "aso" | "nr" | "rg_cnh" | null;
  sensivel: boolean;
  aceita_texto: boolean;
  observacao: string | null;
  ordem: number;
};
export type ItemMatriz = { tipo_documento: string; aplica_a: AplicaA; condicao: Condicao };
export type ValidadeMeses = { aso: number; nr: number; rg_cnh: number };

export type Contexto = { pessoasNaObra?: number; eletricidade?: boolean };

/** Códigos dos documentos exigidos para empresa, funcionário ou sócio diário, conforme a matriz. */
export function documentosExigidos(matriz: ItemMatriz[], aplicaA: AplicaA, ctx: Contexto = {}): string[] {
  return matriz
    .filter((m) => m.aplica_a === aplicaA)
    .filter((m) =>
      m.condicao === "sempre" ? true : m.condicao === "eletricidade" ? !!ctx.eletricidade : (ctx.pessoasNaObra ?? 0) > 5,
    )
    .map((m) => m.tipo_documento);
}

function somarMeses(data: DataISO, meses: number): DataISO {
  const [a, m, d] = data.split("-").map(Number);
  const total = a * 12 + (m - 1) + meses;
  const ano = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  // Dia 31 + meses num mês curto: vai para o último dia do mês.
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${String(mes).padStart(2, "0")}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}

/** Data até quando o documento vale (inclusive), ou null se não vence. */
export function validadeDoDocumento(
  tipo: Pick<TipoDocumento, "regra_validade" | "chave_validade">,
  doc: { data_emissao: DataISO | null; data_validade: DataISO | null },
  meses: ValidadeMeses,
): DataISO | null {
  switch (tipo.regra_validade) {
    case "meses_apos_emissao":
      if (!doc.data_emissao || !tipo.chave_validade) return null;
      return somarDias(somarMeses(doc.data_emissao, meses[tipo.chave_validade]), -1);
    case "data_informada":
      return doc.data_validade;
    default:
      return null;
  }
}

/** Competência exigida dos documentos mensais: o mês anterior ao de hoje (P11 pendente). */
export function competenciaAtual(hoje: DataISO): DataISO {
  const [a, m] = hoje.split("-").map(Number);
  const anterior = m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
  return `${anterior}-01`;
}
export const formatarCompetencia = (c: DataISO): string => `${c.slice(5, 7)}/${c.slice(0, 4)}`;

export type EstadoItem = "falta" | "vencido" | SituacaoDocumento;

/** Situação de cada documento exigido, para a tela "o que falta". */
export function estadoDoItem(
  doc: { situacao: SituacaoDocumento; validade: DataISO | null } | undefined,
  hoje: DataISO,
): EstadoItem {
  if (!doc) return "falta";
  if (doc.situacao === "aprovado" && doc.validade && doc.validade < hoje) return "vencido";
  return doc.situacao;
}

/** Pode enviar para análise: nada faltando, reprovado ou vencido, e pelo menos um anexado novo. */
export function podeEnviarParaAnalise(estados: EstadoItem[]): boolean {
  return estados.length > 0 && estados.every((e) => e === "anexado" || e === "enviado" || e === "aprovado") && estados.includes("anexado");
}

/** Validade mínima: arquivo de documento que vence precisa estar válido hoje. */
export function dentroDaValidade(validade: DataISO | null, hoje: DataISO): boolean {
  return validade === null || validade >= hoje;
}
