export const TIPO_CONTRATACAO: Record<string, string> = {
  unico: "Serviço único, sem medição",
  contrato: "Serviço para contrato",
  aditivo: "Aditivo de contrato",
};

export const TRILHAS: { chave: string; nome: string; nota?: string }[] = [
  { chave: "negociacao", nome: "Negociação e solicitação" },
  { chave: "contrato", nome: "Contrato", nota: "em paralelo com a documentação" },
  { chave: "documentacao", nome: "Documentação dos funcionários", nota: "em paralelo com o contrato" },
  { chave: "liberacao", nome: "Liberação", nota: "depois do contrato assinado e da integração" },
];

export const formatarReais = (v: number | null | undefined) =>
  v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
