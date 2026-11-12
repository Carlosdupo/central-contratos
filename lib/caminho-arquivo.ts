const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const CODIGO = "[a-z][a-z0-9_]*";

// Caminho que o servidor gera em prepararEnvioArquivo: pasta fixa + UUID + extensão.
// Sem "..", sem barras extras: nada além disso é aceito.
const PADRAO = new RegExp(`^empresas/${UUID}/(?:empresa/${CODIGO}|vinculos/${UUID}/${CODIGO})/${UUID}\\.(?:pdf|jpg|png)$`);

export const caminhoDeArquivoValido = (caminho: string): boolean => PADRAO.test(caminho);
