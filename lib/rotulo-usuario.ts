// Como a pessoa aparece no menu: quem é auxiliar em todas as obras dele aparece como "Ana - Auxiliar Block".
export function rotuloDoUsuario(nome: string, vinculos: { nivel: string; obra: string }[]): string {
  if (vinculos.length === 0 || vinculos.some((v) => v.nivel !== "auxiliar")) return nome;
  const primeiro = nome.trim().split(/\s+/)[0] ?? nome;
  return `${primeiro} - Auxiliar ${vinculos.map((v) => v.obra).join(", ")}`;
}

// Perfis por extenso. O auxiliar tem o papel coordenador_obra no banco, mas aparece como "Auxiliar Obra":
// só auxiliar -> "Auxiliar Obra"; coordena uma obra e é auxiliar em outra -> os dois.
export function rotuloDosPerfis(perfis: string[], niveis: string[], rotulos: Record<string, string>): string {
  return perfis
    .flatMap((p) => {
      if (p !== "coordenador_obra" || !niveis.includes("auxiliar")) return [rotulos[p] ?? p];
      return niveis.some((n) => n !== "auxiliar") ? [rotulos[p] ?? p, "Auxiliar Obra"] : ["Auxiliar Obra"];
    })
    .join(", ");
}

// Quem fez algo na contratação, com o papel na obra: "Auxiliar Obra - Ana Carolina", "Coordenador Obra - Carlos Dupont".
// Sem vínculo com a obra (Suprimentos, RH...): só o nome.
export function nomeComPapelNaObra(nome: string, nivel: string | null | undefined): string {
  if (nivel === "auxiliar") return `Auxiliar Obra - ${nome}`;
  if (nivel === "coordenador") return `Coordenador Obra - ${nome}`;
  return nome;
}
