// Valor em R$ digitado na tela (1.234,56) <-> número. Uma só implementação para a máscara e para as ações do servidor.

const somenteDigitos = (t: string) => t.replace(/\D/g, "");

/** Máscara enquanto digita: só números entram; "123456" vira "1.234,56". */
export function mascaraReais(texto: string): string {
  const digitos = somenteDigitos(texto).replace(/^0+(?=\d)/, "");
  if (!digitos) return "";
  const centavos = digitos.padStart(3, "0");
  const inteira = centavos.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${inteira},${centavos.slice(-2)}`;
}

/** "1.234,56" -> 1234.56. Vazio ou inválido -> NaN. */
export function lerValor(v: FormDataEntryValue | null): number {
  const t = String(v ?? "").trim().replace(/\./g, "").replace(",", ".");
  return t === "" ? NaN : Number(t);
}

/** Como lerValor, com 2 casas; vazio ou inválido -> null. */
export function numeroOuNulo(v: FormDataEntryValue | null): number | null {
  const n = lerValor(v);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : null;
}

/** Número do banco -> texto da máscara (1234.5 -> "1.234,50"). */
export const valorParaCampo = (v: number | string | null | undefined): string =>
  v == null || v === "" ? "" : mascaraReais(String(Math.round(Number(v) * 100)));
