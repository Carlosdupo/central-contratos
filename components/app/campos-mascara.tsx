"use client";

import { useId, useState } from "react";
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
}) {
  const id = useId();
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const descritores = [props.dica ? `${id}-dica` : null, erro ? `${id}-erro` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold">{props.rotulo}</label>
      <input
        id={id}
        name={props.nome}
        value={valor}
        inputMode={props.inputMode}
        autoComplete={props.autoComplete}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descritores}
        onChange={(e) => {
          setValor(props.mascara(e.target.value));
          if (erro) setErro(null);
        }}
        onBlur={() => setErro(valor ? props.validar(valor) : null)}
        className="campo"
      />
      {props.dica && <span id={`${id}-dica`} className="text-xs text-muted-foreground">{props.dica}</span>}
      {erro && <span id={`${id}-erro`} role="alert" className="text-[13px] font-medium text-bad">{erro}</span>}
    </div>
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
