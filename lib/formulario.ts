// Resultado padrão das Server Actions de formulário.
export type EstadoFormulario = { erro?: string; ok?: string };

/** Traduz erros do Postgres/PostgREST para mensagens de tela. */
export function mensagemDeErro(erro: { code?: string; message?: string } | null | undefined, padrao: string): string {
  if (!erro) return padrao;
  if (erro.code === "P0001" && erro.message) return erro.message; // regras do banco (ex.: último admin)
  if (erro.code === "23505") return "Já existe um registro com esses dados.";
  if (erro.code === "42501") return "Você não tem permissão para esta alteração.";
  return padrao;
}
