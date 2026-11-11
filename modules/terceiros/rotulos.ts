// Rótulos e cores de situação usados nas telas de terceiros.
export const SITUACAO_EMPRESA: Record<string, [string, string]> = {
  convidada: ["selo-neutro", "Convite enviado"],
  cadastro_incompleto: ["selo-alerta", "Cadastro incompleto"],
  em_analise: ["selo-info", "Em análise"],
  pendente: ["selo-erro", "Pendente"],
  aprovada: ["selo-ok", "Aprovada"],
  bloqueada: ["selo-erro", "Bloqueada"],
};

export const SITUACAO_ALOCACAO: Record<string, [string, string]> = {
  rascunho: ["selo-neutro", "Cadastro incompleto"],
  em_analise: ["selo-info", "Em análise do RH"],
  pendente: ["selo-erro", "Documentos pendentes"],
  aguardando_empresa: ["selo-alerta", "Aprovado, aguardando a empresa"],
  integracao_agendada: ["selo-info", "Integração agendada"],
  liberado: ["selo-ok", "Liberado para a obra"],
  bloqueado: ["selo-erro", "Bloqueado"],
};

export const TIPO_VINCULO: Record<string, string> = {
  funcionario: "Funcionário",
  socio_diario: "Sócio, acesso diário",
  socio_esporadico: "Sócio, acesso esporádico",
};
