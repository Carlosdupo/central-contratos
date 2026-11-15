"use client";

import { useState } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { cnpjValido, somenteDigitos } from "@/lib/documentos-br";

// Campos com máscara e validação no navegador. A validação de verdade continua na Server Action (Zod).

const mascaraCnpj = (v: string) => {
  const d = somenteDigitos(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};
const mascaraTelefone = (v: string) => {
  const d = somenteDigitos(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

function CampoMascarado(props: {
  nome: string;
  rotulo: string;
  dica?: string;
  mascara: (v: string) => string;
  validar: (v: string) => string | null;
  inputMode?: "numeric" | "tel";
  autoComplete?: string;
  padrao?: string | null;
}) {
  const [valor, setValor] = useState(props.padrao || "");
  const [erro, setErro] = useState<string | null>(null);
  return (
    <Field invalid={!!erro} className="flex min-w-0 flex-col gap-1.5">
      <FieldLabel className="text-[13px] font-semibold">{props.rotulo}</FieldLabel>
      <Input
        name={props.nome}
        value={valor}
        inputMode={props.inputMode}
        autoComplete={props.autoComplete}
        onChange={(e) => {
          setValor(props.mascara(e.target.value));
          if (erro) setErro(null);
        }}
        onBlur={() => setErro(valor ? props.validar(valor) : null)}
        className="campo"
      />
      {props.dica && <FieldDescription className="text-xs text-muted-foreground">{props.dica}</FieldDescription>}
      <FieldError match={!!erro} className="text-[13px] font-medium text-bad">{erro}</FieldError>
    </Field>
  );
}

export const CampoCnpj = ({ nome = "cnpj", rotulo = "CNPJ" }: { nome?: string; rotulo?: string }) => (
  <CampoMascarado
    nome={nome}
    rotulo={rotulo}
    dica="Os 14 números, como 12.345.678/0001-90."
    inputMode="numeric"
    mascara={mascaraCnpj}
    validar={(v) => (somenteDigitos(v).length !== 14 ? "O CNPJ tem 14 números. Confira o que falta." : cnpjValido(v) ? null : "Este CNPJ não é válido. Confira os números.")}
  />
);

export const CampoTelefone = ({ nome = "telefone", rotulo = "Telefone (opcional)" }: { nome?: string; rotulo?: string }) => (
  <CampoMascarado
    nome={nome}
    rotulo={rotulo}
    dica="Com DDD, como (49) 99999-0000."
    inputMode="tel"
    autoComplete="tel"
    mascara={mascaraTelefone}
    validar={(v) => (somenteDigitos(v).length < 10 ? "Digite o telefone com DDD: 10 ou 11 números." : null)}
  />
);

const mascaraReais = (v: string) => {
  const d = somenteDigitos(v);
  if (!d) return "";
  const n = Number(d);
  const inteira = Math.floor(n / 100).toString();
  const centavos = (n % 100).toString().padStart(2, "0");
  const partes = inteira.split("");
  let resultado = "";
  for (let i = partes.length - 1; i >= 0; i--) {
    if ((partes.length - i - 1) % 3 === 0 && resultado) resultado = "." + resultado;
    resultado = partes[i] + resultado;
  }
  return resultado + "," + centavos;
};

export const CampoReais = ({ nome, rotulo, dica, padrao }: { nome: string; rotulo: string; dica?: string; padrao?: string | null }) => (
  <CampoMascarado
    nome={nome}
    rotulo={rotulo}
    dica={dica}
    padrao={padrao}
    inputMode="numeric"
    mascara={mascaraReais}
    validar={(v) => {
      const n = somenteDigitos(v);
      return n && Number(n) > 0 ? null : "Informe um valor maior que zero.";
    }}
  />
);
