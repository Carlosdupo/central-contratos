// Datas civis (YYYY-MM-DD) no fuso da empresa. A Vercel roda em UTC, então nunca use
// new Date().getDate()/getHours() direto para regra de negócio: use agoraNoFuso().
// Funções puras, sem dependência de framework (testes em tests/unit/datas.test.ts).

export const FUSO = "America/Sao_Paulo";
export type DataISO = string;
export type Feriados = ReadonlySet<DataISO>;

const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const DIA_MS = 86_400_000;

const formatador = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function agoraNoFuso(instante: Date = new Date()): { data: DataISO; hora: number; minuto: number } {
  const p = Object.fromEntries(formatador.formatToParts(instante).map((x) => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour), minuto: Number(p.minute) };
}

function paraMs(data: DataISO): number {
  if (!FORMATO_DATA.test(data)) throw new Error(`Data inválida: ${data}`);
  const [a, m, d] = data.split("-").map(Number);
  const ms = Date.UTC(a, m - 1, d);
  if (new Date(ms).toISOString().slice(0, 10) !== data) throw new Error(`Data inexistente: ${data}`);
  return ms;
}
const deMs = (ms: number): DataISO => new Date(ms).toISOString().slice(0, 10);

export const somarDias = (data: DataISO, n: number): DataISO => deMs(paraMs(data) + n * DIA_MS);
export const diaDaSemana = (data: DataISO): number => new Date(paraMs(data)).getUTCDay();
export const diasCorridosEntre = (inicio: DataISO, fim: DataISO): number => Math.round((paraMs(fim) - paraMs(inicio)) / DIA_MS);

export function ehDiaUtil(data: DataISO, feriados: Feriados): boolean {
  const d = diaDaSemana(data);
  return d !== 0 && d !== 6 && !feriados.has(data);
}

/** Dias úteis depois de `inicio` até `fim` (inclusive). O próprio dia de início não conta. */
export function diasUteisEntre(inicio: DataISO, fim: DataISO, feriados: Feriados): number {
  let n = 0;
  for (let d = inicio; d < fim; ) {
    d = somarDias(d, 1);
    if (ehDiaUtil(d, feriados)) n++;
  }
  return n;
}

export function proximoDiaUtil(data: DataISO, feriados: Feriados, quantos = 1): DataISO {
  let d = data;
  for (let falta = quantos; falta > 0; ) {
    d = somarDias(d, 1);
    if (ehDiaUtil(d, feriados)) falta--;
  }
  return d;
}

export type Prazo = { dias: number; uteis: boolean };
export type SituacaoPrazo =
  | { tipo: "sem_prazo"; usados: number }
  | { tipo: "no_prazo" | "vence_amanha" | "vence_hoje" | "atrasada"; usados: number; restantes: number };

/** Regra do protótipo: atrasada (< 0), vence hoje (0), vence amanhã (1), no prazo (> 1). */
export function situacaoPrazo(args: { inicio: DataISO; hoje: DataISO; prazo: Prazo | null; feriados: Feriados }): SituacaoPrazo {
  const { inicio, hoje, prazo, feriados } = args;
  const usados = prazo?.uteis ? diasUteisEntre(inicio, hoje, feriados) : diasCorridosEntre(inicio, hoje);
  if (!prazo) return { tipo: "sem_prazo", usados };
  const restantes = prazo.dias - usados;
  const tipo = restantes < 0 ? "atrasada" : restantes === 0 ? "vence_hoje" : restantes === 1 ? "vence_amanha" : "no_prazo";
  return { tipo, usados, restantes };
}

export const formatarData = (data: DataISO): string => `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`;
