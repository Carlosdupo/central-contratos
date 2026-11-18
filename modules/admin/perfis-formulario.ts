import "server-only";
import { PAPEIS, type Papel } from "@/modules/acesso/papeis";

// Perfis do cadastro de usuário. "Auxiliar Obra" não é um papel no banco: é o papel coordenador_obra com a pessoa ligada às
// obras no nível auxiliar (abre e age até a etapa 3). Por isso, no cadastro, exige escolher as obras.
export const AUXILIAR_OBRA = "auxiliar_obra";

export function lerPerfisDoFormulario(dados: FormData): { erro: string } | { papeis: Papel[]; obrasAuxiliar: string[] } {
  const marcados = dados.getAll("papeis").filter((p): p is string => typeof p === "string");
  const auxiliar = marcados.includes(AUXILIAR_OBRA);
  const papeis = marcados.filter((p): p is Papel => (PAPEIS as readonly string[]).includes(p));
  if (auxiliar && !papeis.includes("coordenador_obra")) papeis.push("coordenador_obra");
  if (papeis.length === 0) return { erro: "Escolha pelo menos um perfil." };
  const obrasAuxiliar = auxiliar ? [...new Set(dados.getAll("obras_auxiliar").filter((o): o is string => typeof o === "string" && /^[0-9a-f-]{36}$/i.test(o)))] : [];
  if (auxiliar && obrasAuxiliar.length === 0) return { erro: "Escolha a obra em que a pessoa será Auxiliar Obra." };
  return { papeis, obrasAuxiliar };
}
