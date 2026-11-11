// Regra aprovada: quem o RH aprova até o horário de corte (18h) entra na integração do próximo dia útil;
// depois do corte, na do dia útil seguinte. Fins de semana e feriados não contam.
import { proximoDiaUtil, type DataISO, type Feriados } from "@/lib/datas";

export function dataDaIntegracao(agora: { data: DataISO; hora: number }, horaCorte: number, feriados: Feriados): DataISO {
  return proximoDiaUtil(agora.data, feriados, agora.hora < horaCorte ? 1 : 2);
}
