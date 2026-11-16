import "server-only";
import { randomInt } from "node:crypto";

// Senha provisória: gerada no servidor com o sorteador criptográfico do Node (crypto.randomInt), não com o sorteador comum do JavaScript.
// 16 caracteres, com pelo menos uma maiúscula, uma minúscula e um número (a regra de senha do projeto pede 10 ou mais).
// Sem caracteres que se confundem ao ditar ou ler (0/O, 1/l/I) e sem símbolos, para passar por WhatsApp sem erro.
export const TAMANHO_SENHA_PROVISORIA = 16;

const MAIUSCULAS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const MINUSCULAS = "abcdefghijkmnopqrstuvwxyz";
const NUMEROS = "23456789";
const TODOS = MAIUSCULAS + MINUSCULAS + NUMEROS;

const sortear = (alfabeto: string) => alfabeto[randomInt(alfabeto.length)];

export function gerarSenhaProvisoria(tamanho = TAMANHO_SENHA_PROVISORIA): string {
  if (tamanho < 12) throw new Error("A senha provisória tem pelo menos 12 caracteres.");
  const caracteres = [sortear(MAIUSCULAS), sortear(MINUSCULAS), sortear(NUMEROS)];
  while (caracteres.length < tamanho) caracteres.push(sortear(TODOS));
  // Embaralha (Fisher-Yates com o mesmo sorteador) para as três classes obrigatórias não ficarem sempre no começo.
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join("");
}
