// Etapas do fluxo de contratação (aba "CONTRATAÇÃO REV FINAL", versão 1 aprovada).
// Por enquanto só nomes e áreas; dependências e regras entram na fase F6.
export const ETAPAS_CONTRATACAO = [
  { numero: 1, nome: "Escopo do serviço", area: "Obra" },
  { numero: 2, nome: "Cotação com 3 fornecedores", area: "Obra" },
  { numero: 3, nome: "Equalização e 1ª negociação", area: "Obra" },
  { numero: 4, nome: "Solicitação de serviço no Sienge", area: "Obra" },
  { numero: 5, nome: "Validação e negociação", area: "Suprimentos" },
  { numero: 6, nome: "Autorização do gerente de suprimentos", area: "Suprimentos" },
  { numero: 7, nome: "Contrato no Sienge e minuta", area: "Contratos" },
  { numero: 8, nome: "Aprovação de alçada", area: "Obra" },
  { numero: 9, nome: "Assinaturas do contrato", area: "5 assinantes" },
  { numero: 10, nome: "Documentação dos funcionários", area: "RH" },
  { numero: 11, nome: "Integração de segurança", area: "Segurança do trabalho" },
  { numero: 12, nome: "Liberação para a obra", area: "RH" },
] as const;
