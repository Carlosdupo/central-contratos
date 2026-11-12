// Aceita só caminhos internos do próprio site. Rejeita "//host", "/\host" e caracteres de controle
// (o parser de URL ignora tabulação e quebra de linha, então "/\t/evil.com" viraria "//evil.com").
export function destinoSeguro(valor: unknown, padrao = "/"): string {
  if (typeof valor !== "string" || valor.length === 0 || valor.length > 500) return padrao;
  if (!valor.startsWith("/") || valor.startsWith("//") || /[\u0000-\u001f\u007f\\]/.test(valor)) return padrao;
  try {
    const url = new URL(valor, "http://interno.invalid");
    if (url.origin !== "http://interno.invalid") return padrao;
    return url.pathname + url.search + url.hash;
  } catch {
    return padrao;
  }
}
