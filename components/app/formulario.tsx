"use client";

import { useActionState, useRef, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ui-sdk/react/alert-dialog";
import { Button } from "@ui-sdk/react/button";
import { Checkbox, CheckboxIndicator } from "@ui-sdk/react/checkbox";
import { Field, FieldDescription, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { Radio, RadioGroup, RadioIndicator } from "@ui-sdk/react/radio";
import { Select, SelectContent, SelectGroup, SelectGroupLabel, SelectItem, SelectTrigger, SelectValue } from "@ui-sdk/react/select";
import type { EstadoFormulario } from "@/lib/formulario";

// Peças de formulário do Nexus sobre o UI SDK: o comportamento (teclado, foco, ARIA, agentes) vem do UI SDK,
// o visual vem dos tokens do Nexus (app/globals.css, pelos data-slot).

type Variante = "primario" | "perigo" | "neutro" | "ok" | "discreto";
const CLASSE_BOTAO: Record<Variante, string> = {
  primario: "botao botao-primario",
  perigo: "botao botao-perigo",
  ok: "botao botao-ok",
  discreto: "botao border-transparent bg-transparent text-muted-foreground hover:text-foreground",
  neutro: "botao",
};

// Estado de uma ação: erro/ok e, nas ações que devolvem um dado para mostrar uma vez (a senha provisória), esse dado.
type EstadoDaAcao = EstadoFormulario & { senha?: string; email?: string };

type Props = {
  // Sintaxe de método de propósito: aceita ações que declaram só parte do estado (EstadoFormulario ou EstadoSenha).
  acao(estado: EstadoDaAcao, dados: FormData): Promise<EstadoDaAcao>;
  /** Conteúdo extra a partir do resultado da ação (ex.: a senha provisória, que aparece uma vez). */
  resultado?: (estado: EstadoDaAcao) => ReactNode;
  textoBotao: string;
  children?: ReactNode;
  variante?: Variante;
  /** Pergunta de confirmação antes de enviar (ações difíceis de desfazer). Abre um AlertDialog. */
  confirmar?: string;
  className?: string;
  /** Botão desligado (ex.: itens da etapa ainda não marcados). */
  desabilitado?: boolean;
  /** Ação sensível: um agente de IA só executa com a confirmação de uma pessoa (data-agent-confirm). */
  sensivel?: string;
};

// Formulário com Server Action: mostra o resultado (erro ou confirmação) ao lado do botão.
export function Formulario({ acao, textoBotao, children, variante = "primario", confirmar, className, desabilitado, sensivel, resultado }: Props) {
  const [estado, enviar, enviando] = useActionState<EstadoDaAcao, FormData>(acao, {});
  const formulario = useRef<HTMLFormElement>(null);
  const classe = CLASSE_BOTAO[variante];

  return (
    <form ref={formulario} action={enviar} className={className ?? "flex flex-col gap-4"} noValidate>
      {children}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {estado.erro && <p role="alert" className="mr-auto text-[13px] text-bad">{estado.erro}</p>}
        {estado.ok && <p role="status" className="mr-auto text-[13px] text-ok">{estado.ok}</p>}
        {confirmar ? (
          <AlertDialog>
            <AlertDialogTrigger className={classe} disabled={enviando || desabilitado}>
              {enviando ? "Salvando…" : textoBotao}
            </AlertDialogTrigger>
            <AlertDialogBackdrop />
            <AlertDialogContent>
              <AlertDialogTitle className="subtitulo">{textoBotao}?</AlertDialogTitle>
              <AlertDialogDescription className="text-[14px] text-muted-foreground">{confirmar}</AlertDialogDescription>
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <AlertDialogClose className="botao">Voltar</AlertDialogClose>
                <AlertDialogClose value="confirm" className={classe} data-agent-confirm={confirmar} action={() => formulario.current?.requestSubmit()}>
                  Sim, {textoBotao.charAt(0).toLowerCase() + textoBotao.slice(1)}
                </AlertDialogClose>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button type="submit" className={classe} disabled={enviando || desabilitado} data-agent-confirm={sensivel}>
            {enviando ? "Salvando…" : textoBotao}
          </Button>
        )}
      </div>
      {resultado?.(estado)}
    </form>
  );
}

export function CampoTexto(props: {
  nome: string;
  rotulo: string;
  padrao?: string | number | null;
  tipo?: string;
  dica?: string;
  className?: string;
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  return (
    <Field className={`flex min-w-0 flex-col gap-1.5 ${props.className ?? ""}`}>
      <FieldLabel className="text-[13px] font-semibold">{props.rotulo}</FieldLabel>
      <Input
        name={props.nome}
        type={props.tipo ?? "text"}
        defaultValue={props.padrao == null ? "" : String(props.padrao)}
        min={props.min}
        max={props.max}
        placeholder={props.placeholder}
        className="campo"
      />
      {props.dica && <FieldDescription className="text-xs text-muted-foreground">{props.dica}</FieldDescription>}
    </Field>
  );
}

const IconeCheck = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

/** Caixa de marcar (Checkbox do UI SDK). Controlada com `marcadoAgora`/`aoMudar`, ou solta com `marcado`. */
export function Marcador(props: {
  nome?: string;
  valor?: string;
  rotulo: ReactNode;
  marcado?: boolean;
  marcadoAgora?: boolean;
  aoMudar?: (marcado: boolean) => void;
  desabilitado?: boolean;
  className?: string;
}) {
  return (
    <label className={props.className ?? `flex items-center gap-3 px-3.5 py-2.5 ${props.desabilitado ? "" : "cursor-pointer hover:bg-fill-2"}`}>
      <Checkbox
        name={props.nome}
        value={props.valor ?? "on"}
        defaultChecked={props.marcadoAgora === undefined ? props.marcado : undefined}
        checked={props.marcadoAgora}
        onCheckedChange={props.aoMudar ? (v) => props.aoMudar?.(v === true) : undefined}
        disabled={props.desabilitado}
      >
        <CheckboxIndicator>
          <IconeCheck />
        </CheckboxIndicator>
      </Checkbox>
      <span className="text-[14px]">{props.rotulo}</span>
    </label>
  );
}

export type Opcao = { value: string; label: string };
export type GrupoDeOpcoes = { label: string; itens: Opcao[] };

const Seta = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ml-auto shrink-0 opacity-70">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/** Lista de seleção (Select do UI SDK), com grupos opcionais. Envia com o formulário pelo `nome`. */
export function CampoSelecao(props: {
  nome: string;
  rotulo: string;
  opcoes?: Opcao[];
  grupos?: GrupoDeOpcoes[];
  padrao?: string | null;
  valor?: string | null;
  aoMudar?: (valor: string | null) => void;
  placeholder?: string;
  className?: string;
  dica?: string;
}) {
  const itens = props.opcoes ?? props.grupos?.flatMap((g) => g.itens) ?? [];
  return (
    <Field className={`flex min-w-0 flex-col gap-1.5 ${props.className ?? ""}`}>
      <FieldLabel className="text-[13px] font-semibold">{props.rotulo}</FieldLabel>
      <Select
        name={props.nome}
        items={itens}
        placeholder={props.placeholder ?? "Escolha"}
        defaultValue={props.valor === undefined ? (props.padrao ?? null) : undefined}
        value={props.valor}
        onValueChange={props.aoMudar ? (v) => props.aoMudar?.((v as string | null) ?? null) : undefined}
      >
        <SelectTrigger className="campo flex items-center gap-2 text-left">
          <SelectValue className="min-w-0 truncate" />
          <Seta />
        </SelectTrigger>
        <SelectContent>
          {props.opcoes?.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          {props.grupos?.map((g) => (
            <SelectGroup key={g.label}>
              <SelectGroupLabel>{g.label}</SelectGroupLabel>
              {g.itens.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {props.dica && <FieldDescription className="text-xs text-muted-foreground">{props.dica}</FieldDescription>}
    </Field>
  );
}

/** Grupo de opções, uma escolhida (RadioGroup do UI SDK). `estilo="pilula"` mostra como botões arredondados. */
export function GrupoOpcoes(props: {
  nome: string;
  rotulo: string;
  opcoes: (Opcao & { dica?: string; desabilitada?: boolean })[];
  padrao?: string | null;
  valor?: string | null;
  aoMudar?: (valor: string | null) => void;
  estilo?: "lista" | "pilula";
  rotuloVisivel?: boolean;
}) {
  const pilula = props.estilo === "pilula";
  return (
    <RadioGroup
      name={props.nome}
      aria-label={props.rotulo}
      defaultValue={props.valor === undefined ? (props.padrao ?? null) : undefined}
      value={props.valor}
      onValueChange={props.aoMudar ? (v) => props.aoMudar?.((v as string | null) ?? null) : undefined}
      className={pilula ? "flex flex-wrap gap-1.5" : "flex flex-col gap-1.5"}
    >
      {props.rotuloVisivel !== false && !pilula && <span className="mb-0.5 text-[13px] font-semibold">{props.rotulo}</span>}
      <div className={pilula ? "contents" : "lista-agrupada"}>
        {props.opcoes.map((o) => (
          <label
            key={o.value}
            data-pilula={pilula || undefined}
            className={pilula ? "opcao-pilula" : `flex items-start gap-3 px-3.5 py-2.5 ${o.desabilitada ? "opacity-50" : "cursor-pointer hover:bg-fill-2"}`}
          >
            <Radio value={o.value} disabled={o.desabilitada} className={pilula ? "sr-only" : undefined}>
              <RadioIndicator />
            </Radio>
            <span className="text-[14px]">
              {o.label}
              {o.dica && <span className="block text-[12.5px] text-muted-foreground">{o.dica}</span>}
            </span>
          </label>
        ))}
      </div>
    </RadioGroup>
  );
}

/** Campo de uma linha sem rótulo visível ao lado de um botão (motivo, novo valor): o nome vai em aria-label. */
export function CampoEmLinha(props: { nome: string; rotulo: string; placeholder?: string; padrao?: string | number | null; tipo?: string; min?: number; className?: string }) {
  return (
    <Input
      name={props.nome}
      aria-label={props.rotulo}
      placeholder={props.placeholder}
      type={props.tipo ?? "text"}
      min={props.min}
      defaultValue={props.padrao == null ? "" : String(props.padrao)}
      className={`campo py-1.5 ${props.className ?? ""}`}
    />
  );
}
