// Quantos da equipe da empresa já passaram pela análise do RH nesta obra (documentação aprovada), e quem falta.
// Fluxo 2: a tela mostra "7 de 10 aprovados"; o RH decide e fecha a etapa.
export type MembroParaResumo = { nome: string; tipo: string; alocacoes: { obra: string; situacao: string }[] };

const APROVADAS = new Set(["integracao_agendada", "liberado"]);

export function resumoDaEquipe(equipe: MembroParaResumo[], obra: string): { total: number; aprovados: number; faltam: string[] } {
  // Sócio esporádico entra por pedido de visita, não pela análise: não conta.
  const alocados = equipe.filter((m) => m.tipo !== "socio_esporadico" && m.alocacoes.some((a) => a.obra === obra));
  const aprovados = alocados.filter((m) => m.alocacoes.some((a) => a.obra === obra && APROVADAS.has(a.situacao)));
  return { total: alocados.length, aprovados: aprovados.length, faltam: alocados.filter((m) => !aprovados.includes(m)).map((m) => m.nome) };
}

export type VinculoParaResumo = { tipo: string; ativo: boolean; alocacoes: { obra_id: string; situacao: string }[] };

/** Mesmo resumo, a partir dos vínculos da empresa e do id da obra (o panorama traz isso na mesma consulta). */
export function resumoDaEquipePorObra(vinculos: VinculoParaResumo[], obraId: string): { total: number; aprovados: number } {
  const alocados = vinculos.filter((v) => v.ativo && v.tipo !== "socio_esporadico" && v.alocacoes.some((a) => a.obra_id === obraId));
  return { total: alocados.length, aprovados: alocados.filter((v) => v.alocacoes.some((a) => a.obra_id === obraId && APROVADAS.has(a.situacao))).length };
}
