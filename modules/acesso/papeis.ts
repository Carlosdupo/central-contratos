// Papéis internos (enum public.papel no banco). Empresa terceirizada não tem papel:
// é usuário do tipo "externo" ligado a uma empresa (fase F1).
export const PAPEIS = [
  "admin",
  "coordenador_obra",
  "suprimentos",
  "gerente_suprimentos",
  "contratos",
  "direcao",
  "rh",
  "sst",
] as const;

export type Papel = (typeof PAPEIS)[number];

export const ROTULO_PAPEL: Record<Papel, string> = {
  admin: "Administrador",
  coordenador_obra: "Coordenador de obra",
  suprimentos: "Suprimentos",
  gerente_suprimentos: "Gerente de suprimentos",
  contratos: "Contratos",
  direcao: "Direção",
  rh: "RH",
  sst: "Segurança do trabalho",
};

// Decisão P22 (proposta aprovada no plano): verificação em duas etapas obrigatória para estes papéis.
export const PAPEIS_COM_MFA: readonly Papel[] = ["admin", "rh", "sst"];

export const ehPapel = (valor: unknown): valor is Papel => typeof valor === "string" && (PAPEIS as readonly string[]).includes(valor);
export const exigeMfa = (papeis: readonly Papel[]): boolean => papeis.some((p) => PAPEIS_COM_MFA.includes(p));
export const temAlgumPapel = (papeis: readonly Papel[], exigidos: readonly Papel[]): boolean => exigidos.some((p) => papeis.includes(p));
