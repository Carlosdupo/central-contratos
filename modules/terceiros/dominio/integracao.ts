// Regra (procedimento rev. 02): integração só nos dias da semana configurados (segunda, quarta e sexta).
// Aprovado até o horário de corte (18h) vale a partir do próximo dia útil; depois do corte, do dia útil seguinte.
// Feriados não contam.
import { ehDiaUtil, proximoDiaUtil, type DataISO, type Feriados } from "@/lib/datas";

export const DIAS_INTEGRACAO_PADRAO = [1, 3, 5];
const NOMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const diaDaSemana = (data: DataISO) => new Date(`${data}T12:00:00Z`).getUTCDay();

export function proximoDiaDeIntegracao(desde: DataISO, feriados: Feriados, dias: number[] = DIAS_INTEGRACAO_PADRAO): DataISO {
  const validos = dias.filter((d) => d >= 1 && d <= 5);
  if (validos.length === 0) return ehDiaUtil(desde, feriados) ? desde : proximoDiaUtil(desde, feriados);
  let d = desde;
  while (!(ehDiaUtil(d, feriados) && validos.includes(diaDaSemana(d)))) d = proximoDiaUtil(d, feriados);
  return d;
}

export function dataDaIntegracao(agora: { data: DataISO; hora: number }, horaCorte: number, feriados: Feriados, dias: number[] = DIAS_INTEGRACAO_PADRAO): DataISO {
  return proximoDiaDeIntegracao(proximoDiaUtil(agora.data, feriados, agora.hora < horaCorte ? 1 : 2), feriados, dias);
}

export function descreverDiasDeIntegracao(dias: number[]): string {
  const nomes = dias.filter((d) => d >= 1 && d <= 5).sort().map((d) => NOMES[d]);
  if (nomes.length <= 1) return nomes[0] ?? "dias úteis";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`;
}
