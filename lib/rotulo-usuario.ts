// Como a pessoa aparece no menu: quem é auxiliar em todas as obras dele aparece como "Ana - Auxiliar Block".
export function rotuloDoUsuario(nome: string, vinculos: { nivel: string; obra: string }[]): string {
  if (vinculos.length === 0 || vinculos.some((v) => v.nivel !== "auxiliar")) return nome;
  const primeiro = nome.trim().split(/\s+/)[0] ?? nome;
  return `${primeiro} - Auxiliar ${vinculos.map((v) => v.obra).join(", ")}`;
}
