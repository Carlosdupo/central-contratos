"use client";

import { useState } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { cnpjValido, somenteDigitos } from "@/lib/documentos-br";
import { mascaraReais, valorParaCampo } from "@/lib/valor-reais";

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
  placeholder?: string;
  className?: string;
  /** Rótulo só para leitor de tela (campo ao lado de um botão). */
  rotuloOculto?: boolean;
  desabilitado?: boolean;
  aoMudar?: (valor: string) => void;
}) {
  const [valor, setValor] = useState(props.padrao || "");
  const [erro, setErro] = useState<string | null>(null);
  return (
    <Field invalid={!!erro} disabled={props.desabilitado} className={`flex min-w-0 flex-col gap-1.5 ${props.className ?? ""}`}>
      <FieldLabel className={props.rotuloOculto ? "sr-only" : "text-[13px] font-semibold"}>{props.rotulo}</FieldLabel>
      <Input
        name={props.nome}
        value={props.desabilitado ? "" : valor}
        placeholder={props.placeholder}
        disabled={props.desabilitado}
        inputMode={props.inputMode}
        autoComplete={props.autoComplete}
        onChange={(e) => {
          const novo = props.mascara(e.target.value);
          setValor(novo);
          props.aoMudar?.(novo);
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

/** Campo de valor em R$ com pontos e vírgula automáticos: a pessoa digita só números e o campo mostra 1.234,56. */
export const CampoReais = ({
  nome, rotulo, dica, padrao, placeholder, className, rotuloOculto, desabilitado, aoMudar,
}: {
  nome: string;
  rotulo: string;
  dica?: string;
  /** Valor inicial: número do banco ou texto já formatado. */
  padrao?: number | string | null;
  placeholder?: string;
  className?: string;
  rotuloOculto?: boolean;
  desabilitado?: boolean;
  aoMudar?: (valor: string) => void;
}) => (
  <CampoMascarado
    nome={nome}
    rotulo={rotulo}
    dica={dica}
    padrao={typeof padrao === "string" && padrao.includes(",") ? padrao : valorParaCampo(padrao)}
    placeholder={placeholder}
    className={className}
    rotuloOculto={rotuloOculto}
    desabilitado={desabilitado}
    aoMudar={aoMudar}
    inputMode="numeric"
    mascara={mascaraReais}
    validar={(v) => (Number(somenteDigitos(v)) > 0 ? null : "Informe um valor maior que zero.")}
  />
);
