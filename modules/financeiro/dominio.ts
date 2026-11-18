// Liberação para o financeiro (regras puras). Competência = mês dos documentos; envio de 25 a 30 do mês seguinte.
import type { DataISO } from "@/lib/datas";

export type LinhaFinanceiro = {
  empresaId: string;
  razaoSocial: string;
  cnpj: string;
  obras: string | null;
  exigidos: number;
  aprovados: number;
  emAnalise: number;
  reprovados: number;
  liberadaEm: string | null;
};

export type SituacaoFinanceiro = "liberada" | "pendente" | "atrasada";

// Dia 30 do mês seguinte à competência (em fevereiro, o último dia).
export function prazoDaCompetencia(competencia: DataISO): DataISO {
  const [a, m] = competencia.split("-").map(Number);
  const ano = m === 12 ? a + 1 : a;
  const mes = m === 12 ? 1 : m + 1;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${String(mes).padStart(2, "0")}-${String(Math.min(30, ultimo)).padStart(2, "0")}`;
}

export const faltamEnviar = (l: LinhaFinanceiro) => Math.max(0, l.exigidos - l.aprovados - l.emAnalise - l.reprovados);

// Atrasada: passou do dia 30 e a empresa ainda não mandou tudo. O que está só em análise ou reprovado fica pendente.
export function situacaoFinanceiro(l: LinhaFinanceiro, competencia: DataISO, hoje: DataISO): SituacaoFinanceiro {
  if (l.liberadaEm) return "liberada";
  return hoje > prazoDaCompetencia(competencia) && faltamEnviar(l) > 0 ? "atrasada" : "pendente";
}

export function oQueFalta(l: LinhaFinanceiro): string {
  const partes = [
    faltamEnviar(l) && `${faltamEnviar(l)} para a empresa enviar`,
    l.reprovados && `${l.reprovados} para a empresa corrigir`,
    l.emAnalise && `${l.emAnalise} em análise (RH ou Segurança)`,
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : "Nada pendente";
}

export function competenciaDoParametro(valor: string | undefined, padrao: DataISO): DataISO {
  return valor && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor) ? `${valor}-01` : padrao;
}

export function somarMesesCompetencia(competencia: DataISO, meses: number): DataISO {
  const [a, m] = competencia.split("-").map(Number);
  const total = a * 12 + (m - 1) + meses;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

const csvCampo = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

// CSV para o Excel do Brasil: ";" como separador e BOM para abrir com acentos.
export function csvFinanceiro(linhas: LinhaFinanceiro[], competencia: DataISO, hoje: DataISO, formatarCnpj: (c: string) => string): string {
  const rotulo = { liberada: "Liberada", pendente: "Pendente", atrasada: "Atrasada" };
  const cab = ["Empresa", "CNPJ", "Obras", "Situação", "Aceitos", "Exigidos", "O que falta", "Liberada em"];
  const corpo = linhas.map((l) =>
    [
      l.razaoSocial,
      formatarCnpj(l.cnpj),
      l.obras ?? "",
      rotulo[situacaoFinanceiro(l, competencia, hoje)],
      String(l.aprovados),
      String(l.exigidos),
      l.liberadaEm ? "" : oQueFalta(l),
      l.liberadaEm ? l.liberadaEm.slice(0, 10).split("-").reverse().join("/") : "",
    ]
      .map(csvCampo)
      .join(";"),
  );
  return "﻿" + [cab.join(";"), ...corpo].join("\r\n");
}
