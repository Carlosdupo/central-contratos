// Código de contrato no Sienge: se a obra tem prefixo (ex.: CT/BL), o código é o prefixo + 4 números (CT/BL0083).
// O banco confere de novo (app.conferir_codigo_sienge).

export function codigoSiengeValido(codigo: string, prefixo: string | null | undefined): boolean {
  const p = prefixo?.trim();
  if (!p) return true;
  const c = codigo.trim();
  return c.startsWith(p) && /^\d{4}$/.test(c.slice(p.length));
}

export function dicaCodigoSienge(prefixo: string | null | undefined): string {
  const p = prefixo?.trim();
  return p ? `Prefixo ${p} seguido de 4 números, como ${p}0083.` : "Esta obra não tem prefixo cadastrado: escreva o código como está no Sienge.";
}

/**
 * Número que aparece na tela para identificar a contratação: o contrato do Sienge quando já foi
 * lançado (etapa 7); antes disso, a solicitação (SS, etapa 4); antes disso, o código interno (CT-2026-001).
 */
export function codigoExibicao(c: { codigo: string; sienge_contrato?: string | null; sienge_solicitacao?: string | null }): string {
  const contrato = c.sienge_contrato?.trim();
  if (contrato) return contrato;
  const solicitacao = c.sienge_solicitacao?.trim();
  return solicitacao ? `SS ${solicitacao}` : c.codigo;
}
