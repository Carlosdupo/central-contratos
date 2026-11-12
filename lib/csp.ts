// Política de segurança de conteúdo (CSP) com nonce por requisição. Montada no proxy.ts.
// - script-src: só scripts com o nonce da requisição (e os que eles carregam: 'strict-dynamic').
// - style-src: CSS próprio e <style> com nonce; style-src-attr libera só o atributo style="" (barra de progresso etc.).
// - connect-src/img-src: o Supabase (upload por URL assinada, fotos e arquivos pelo Storage).
export function montarCsp({ nonce, supabaseUrl, desenvolvimento }: { nonce: string; supabaseUrl: string; desenvolvimento: boolean }): string {
  const supabase = new URL(supabaseUrl).origin;
  const diretivas = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${desenvolvimento ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' blob: data: ${supabase}`,
    "font-src 'self'",
    `connect-src 'self' ${supabase}${desenvolvimento ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  return diretivas.join("; ");
}
