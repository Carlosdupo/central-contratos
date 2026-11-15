// Qual aviso de prazo uma etapa merece hoje: vence hoje ou amanhã = "vencendo"; já passou = "vencido"; o resto, nenhum.
export type TipoDePrazo = "atrasada" | "vence_hoje" | "vence_amanha" | "no_prazo" | "sem_prazo";

export function tipoDeAvisoDePrazo(situacao: TipoDePrazo): "prazo_vencendo" | "prazo_vencido" | null {
  if (situacao === "atrasada") return "prazo_vencido";
  if (situacao === "vence_hoje" || situacao === "vence_amanha") return "prazo_vencendo";
  return null;
}
