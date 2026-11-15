export type AvisoInterno = {
  id: string;
  tipo: string;
  titulo: string;
  texto: string | null;
  contratacaoId: string | null;
  criadoEm: string;
  lido: boolean;
};

export type PreferenciasAviso = { som: boolean; email: boolean };

export type PacoteDeAvisos = { avisos: AvisoInterno[]; naoLidos: number; preferencias: PreferenciasAviso };
