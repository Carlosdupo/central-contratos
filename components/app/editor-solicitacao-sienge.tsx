"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@ui-sdk/react/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible";
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@ui-sdk/react/dialog";
import { Field, FieldDescription, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { Marcador } from "@/components/app/formulario";
import { esquemaSolicitacaoSienge, lerNumero, serieDePavimentos, totalDoItem, type ItemSienge, type ServicoEap, type SolicitacaoSienge } from "@/lib/solicitacao-sienge";
import type { SolicitacaoCompleta } from "@/modules/sienge/consultas";
import type { ResultadoSalvar } from "@/modules/sienge/acoes";

type Linha = Omit<ItemSienge, "quantidade" | "preco_mo" | "preco_mat"> & { quantidade: string; preco_mo: string; preco_mat: string };
type Props = { solicitacao: SolicitacaoCompleta; salvar: (s: SolicitacaoSienge) => Promise<ResultadoSalvar> };

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const numeroParaCampo = (n: number, casas: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: Math.max(casas, 6) });
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const novoId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const valorOuZero = (t: string) => (t.trim() === "" ? 0 : lerNumero(t));

const paraLinha = (i: ItemSienge): Linha => ({ ...i, quantidade: numeroParaCampo(i.quantidade, 0), preco_mo: numeroParaCampo(i.preco_mo, 2), preco_mat: numeroParaCampo(i.preco_mat, 2) });
const totalDaLinha = (l: Linha) => {
  const t = totalDoItem({ quantidade: lerNumero(l.quantidade), preco_mo: valorOuZero(l.preco_mo), preco_mat: valorOuZero(l.preco_mat) });
  return Number.isFinite(t) ? t : 0;
};

function Campo({ rotulo, valor, aoMudar, desabilitado, className, dica, placeholder, numerico }: {
  rotulo: string; valor: string; aoMudar: (v: string) => void; desabilitado?: boolean; className?: string; dica?: string; placeholder?: string; numerico?: boolean;
}) {
  return (
    <Field className={`flex min-w-0 flex-col gap-1 ${className ?? ""}`}>
      <FieldLabel className="text-[12px] font-semibold text-muted-foreground">{rotulo}</FieldLabel>
      <Input value={valor} onValueChange={(v) => aoMudar(String(v))} disabled={desabilitado} placeholder={placeholder} inputMode={numerico ? "decimal" : undefined} className={`campo ${numerico ? "text-right tabular-nums" : ""}`} />
      {dica && <FieldDescription className="text-xs text-muted-foreground">{dica}</FieldDescription>}
    </Field>
  );
}

function RepetirPorPavimento({ servico, aoGerar }: { servico: ServicoEap; aoGerar: (descricoes: string[], base: Pick<Linha, "quantidade" | "unidade" | "preco_mo" | "preco_mat">) => void }) {
  const [aberto, setAberto] = useState(false);
  const [base, setBase] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [tipo, setTipo] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [unidade, setUnidade] = useState("un");
  const [mo, setMo] = useState("");
  const [mat, setMat] = useState("");
  const [erro, setErro] = useState("");
  const nomes = useMemo(() => {
    const [d, a, t] = [Number(de), Number(ate), tipo.trim() === "" ? null : Number(tipo)];
    return base.trim() && Number.isInteger(d) && Number.isInteger(a) && a >= d && (t === null || Number.isInteger(t)) ? serieDePavimentos(base, d, a, t) : [];
  }, [base, de, ate, tipo]);

  function gerar() {
    if (!nomes.length) return setErro("Preencha a descrição e os pavimentos (inicial menor ou igual ao final).");
    aoGerar(nomes, { quantidade, unidade, preco_mo: mo, preco_mat: mat });
    setAberto(false);
    setErro("");
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger className="botao botao-pequeno" aria-label={`Repetir por pavimento em ${servico.referencia}`}>Repetir por pavimento</DialogTrigger>
      <DialogBackdrop />
      <DialogContent>
        <DialogTitle className="subtitulo">Repetir por pavimento</DialogTitle>
        <DialogDescription className="text-[13px] text-muted-foreground">
          {servico.referencia} {servico.descricao}. Cria um item por pavimento, como &quot;INSTALAÇÕES HIDRÁULICAS - 6 PAVTO - TIPO 01&quot;.
        </DialogDescription>
        <div className="flex flex-col gap-3">
          <Campo rotulo="Descrição base" valor={base} aoMudar={setBase} placeholder="Ex.: INSTALAÇÕES HIDRÁULICAS" />
          <div className="grid grid-cols-3 gap-2">
            <Campo rotulo="Pavimento inicial" valor={de} aoMudar={setDe} numerico placeholder="6" />
            <Campo rotulo="Pavimento final" valor={ate} aoMudar={setAte} numerico placeholder="26" />
            <Campo rotulo="Tipo inicial" valor={tipo} aoMudar={setTipo} numerico placeholder="1" dica="Vazio: sem TIPO." />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Campo rotulo="Quantidade de cada" valor={quantidade} aoMudar={setQuantidade} numerico />
            <Campo rotulo="Unidade de cada" valor={unidade} aoMudar={setUnidade} />
            <Campo rotulo="Mão de obra unitária" valor={mo} aoMudar={setMo} numerico placeholder="0,00" />
            <Campo rotulo="Material unitário" valor={mat} aoMudar={setMat} numerico placeholder="0,00" />
          </div>
          {nomes.length > 0 && (
            <p className="text-[13px] text-muted-foreground">
              {nomes.length} itens: {nomes[0]}{nomes.length > 1 ? ` … ${nomes.at(-1)}` : ""}
            </p>
          )}
          {erro && <p role="alert" className="text-[13px] text-bad">{erro}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <DialogClose className="botao">Cancelar</DialogClose>
          <Button className="botao botao-primario" onClick={gerar}>{nomes.length ? `Adicionar ${nomes.length} itens` : "Adicionar itens"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LinhaItem({ linha, numero, servico, editar, remover, duplicar, desabilitado }: {
  linha: Linha; numero: number; servico: string; editar: (campo: keyof Linha, valor: string) => void; remover: () => void; duplicar: () => void; desabilitado: boolean;
}) {
  const campo = (rotulo: string, chave: keyof Linha, extra?: { className?: string; numerico?: boolean; placeholder?: string }): ReactNode => (
    <Field className={`flex min-w-0 flex-col gap-1 ${extra?.className ?? ""}`}>
      <FieldLabel className="text-[12px] font-semibold text-muted-foreground">
        {rotulo}{" "}
        <span className="sr-only">{`do item ${numero} de ${servico}`}</span>
      </FieldLabel>
      <Input
        value={String(linha[chave] ?? "")}
        onValueChange={(v) => editar(chave, String(v))}
        disabled={desabilitado}
        placeholder={extra?.placeholder}
        inputMode={extra?.numerico ? "decimal" : undefined}
        className={`campo ${extra?.numerico ? "text-right tabular-nums" : ""}`}
      />
    </Field>
  );
  return (
    <li className="rounded-xl border border-border bg-card p-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,1fr)_7rem_6rem_4.5rem_8rem_8rem]">
        {campo("Descrição", "descricao", { className: "col-span-2 md:col-span-1" })}
        {campo("Código do serviço", "codigo_servico", { placeholder: "Ex.: 6680" })}
        {campo("Quantidade", "quantidade", { numerico: true })}
        {campo("Unidade", "unidade")}
        {campo("Mão de obra unit.", "preco_mo", { numerico: true, placeholder: "0,00" })}
        {campo("Material unit.", "preco_mat", { numerico: true, placeholder: "0,00" })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Collapsible>
          <CollapsibleTrigger className="botao botao-pequeno" aria-label={`Mais campos do item ${numero} de ${servico}`}>Mais campos</CollapsibleTrigger>
          <CollapsiblePanel>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {campo("Complemento", "complemento")}
              {campo("Código auxiliar", "codigo_auxiliar")}
              {campo("Observação interna", "observacao")}
              {campo("Conta financeira do item", "conta_financeira", { placeholder: "Vazio: a padrão" })}
            </div>
          </CollapsiblePanel>
        </Collapsible>
        <span className="ml-auto text-[13px] tabular-nums text-muted-foreground">Total {reais(totalDaLinha(linha))}</span>
        {!desabilitado && (
          <>
            <Button className="botao botao-pequeno" onClick={duplicar} aria-label={`Duplicar item ${numero} de ${servico}`}>Duplicar</Button>
            <Button className="botao botao-pequeno" onClick={remover} aria-label={`Remover item ${numero} de ${servico}`}>Remover</Button>
          </>
        )}
      </div>
    </li>
  );
}

export function EditorSolicitacaoSienge({ solicitacao, salvar }: Props) {
  const somenteLeitura = !solicitacao.podeEditar;
  const [titulo, setTitulo] = useState(solicitacao.titulo);
  const [unidadeConstrutiva, setUnidadeConstrutiva] = useState(solicitacao.unidadeConstrutiva);
  const [contaFinanceira, setContaFinanceira] = useState(solicitacao.contaFinanceira);
  const [linhas, setLinhas] = useState<Linha[]>(() => solicitacao.itens.map(paraLinha));
  const [alterado, setAlterado] = useState(false);
  const [busca, setBusca] = useState("");
  const [soComItens, setSoComItens] = useState(false);
  const [estado, setEstado] = useState<ResultadoSalvar>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!alterado) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [alterado]);

  const mudar = (f: (l: Linha[]) => Linha[]) => {
    setLinhas(f);
    setAlterado(true);
    setEstado({});
  };
  const cabecalho = (set: (v: string) => void) => (v: string) => {
    set(v);
    setAlterado(true);
    setEstado({});
  };

  const servicos = useMemo(() => solicitacao.eap.filter((e) => e.nivel >= 2), [solicitacao.eap]);
  const grupos = useMemo(() => {
    const termo = semAcento(busca.trim());
    const comItens = new Set(linhas.map((l) => l.referencia));
    const lista: { grupo: ServicoEap | null; servicos: ServicoEap[] }[] = [];
    for (const e of solicitacao.eap) {
      if (e.nivel === 1) {
        lista.push({ grupo: e, servicos: [] });
        continue;
      }
      const casa = !termo || semAcento(`${e.referencia} ${e.descricao}`).includes(termo) || semAcento(lista.at(-1)?.grupo?.descricao ?? "").includes(termo);
      if (casa && (!soComItens || comItens.has(e.referencia))) {
        if (!lista.length) lista.push({ grupo: null, servicos: [] });
        lista.at(-1)!.servicos.push(e);
      }
    }
    return lista.filter((g) => g.servicos.length);
  }, [solicitacao.eap, busca, soComItens, linhas]);

  const novaLinha = (servico: ServicoEap, extra?: Partial<Linha>): Linha => ({
    id: novoId(),
    referencia: servico.referencia,
    descricao: "",
    codigo_servico: [...linhas].reverse().find((l) => l.referencia === servico.referencia && l.codigo_servico)?.codigo_servico ?? solicitacao.codigosAnteriores[servico.referencia] ?? "",
    complemento: "",
    codigo_auxiliar: "",
    quantidade: "1",
    unidade: "un",
    preco_mo: "",
    preco_mat: "",
    observacao: "",
    conta_financeira: "",
    ...extra,
  });

  function montar(): { dados: SolicitacaoSienge } | { erro: string } {
    const itens: ItemSienge[] = [];
    for (const l of linhas) {
      const servico = l.referencia;
      const n = linhas.filter((x) => x.referencia === servico).indexOf(l) + 1;
      const onde = `Item ${n} de ${servico}`;
      const quantidade = lerNumero(l.quantidade);
      const [mo, mat] = [valorOuZero(l.preco_mo), valorOuZero(l.preco_mat)];
      if (!l.descricao.trim()) return { erro: `${onde}: escreva a descrição.` };
      if (!Number.isFinite(quantidade) || quantidade <= 0) return { erro: `${onde}: quantidade inválida.` };
      if (!Number.isFinite(mo) || mo < 0 || !Number.isFinite(mat) || mat < 0) return { erro: `${onde}: preço inválido (use 1.234,56).` };
      itens.push({ ...l, quantidade, preco_mo: Number(mo.toFixed(2)), preco_mat: Number(mat.toFixed(2)) });
    }
    const lido = esquemaSolicitacaoSienge.safeParse({ titulo, unidade_construtiva: unidadeConstrutiva, conta_financeira: contaFinanceira, itens });
    return lido.success ? { dados: lido.data } : { erro: lido.error.issues[0].message };
  }

  async function gravar(): Promise<boolean> {
    const montado = montar();
    if ("erro" in montado) {
      setEstado({ erro: montado.erro });
      return false;
    }
    setSalvando(true);
    const resultado = await salvar(montado.dados);
    setSalvando(false);
    setEstado(resultado);
    if (resultado.ok) setAlterado(false);
    return !!resultado.ok;
  }

  async function baixar() {
    if (alterado && !(await gravar())) return;
    const link = document.createElement("a");
    link.href = `/api/sienge/${solicitacao.id}`;
    link.download = "";
    link.click();
  }

  const total = linhas.reduce((t, l) => t + totalDaLinha(l), 0);
  const servicosComItens = new Set(linhas.map((l) => l.referencia)).size;
  const semCabecalho = !unidadeConstrutiva.trim() || !contaFinanceira.trim();

  return (
    <div className="flex flex-col gap-4">
      <section className="painel">
        <h2 className="subtitulo">Dados da solicitação</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Campo rotulo="Nome da solicitação" valor={titulo} aoMudar={cabecalho(setTitulo)} desabilitado={somenteLeitura} dica="Nome do arquivo CSV." />
          <Campo rotulo="Código da unidade construtiva" valor={unidadeConstrutiva} aoMudar={cabecalho(setUnidadeConstrutiva)} desabilitado={somenteLeitura} placeholder="Ex.: 5" dica="Vale para todos os itens." />
          <Campo rotulo="Conta financeira padrão" valor={contaFinanceira} aoMudar={cabecalho(setContaFinanceira)} desabilitado={somenteLeitura} placeholder="Ex.: 2.01.02.01.03" dica="O item pode ter outra em Mais campos." />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Campo rotulo="Buscar serviço da EAP" valor={busca} aoMudar={setBusca} placeholder="Código ou nome (ex.: 23.005, hidráulica)" className="min-w-[240px] flex-1" />
          <Marcador rotulo="Só serviços com itens" marcadoAgora={soComItens} aoMudar={setSoComItens} />
        </div>
        <p className="text-[13px] text-muted-foreground">{servicos.length} serviços na EAP · {servicosComItens} com itens nesta solicitação</p>
        {grupos.length === 0 && <p className="text-[14px] text-muted-foreground">Nenhum serviço encontrado.</p>}
        {grupos.map(({ grupo, servicos: lista }) => (
          <div key={grupo?.referencia ?? "sem-grupo"} className="flex flex-col gap-2">
            {grupo && <h3 className="mt-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{grupo.referencia} {grupo.descricao}</h3>}
            {lista.map((servico) => {
              const doServico = linhas.filter((l) => l.referencia === servico.referencia);
              const subtotal = doServico.reduce((t, l) => t + totalDaLinha(l), 0);
              return (
                <Collapsible key={servico.referencia} defaultOpen={doServico.length > 0} className="rounded-2xl border border-border bg-card">
                  <CollapsibleTrigger className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left hover:bg-fill-2 data-[open]:border-b data-[open]:border-border">
                    <span className="font-mono text-[13px] text-muted-foreground">{servico.referencia}</span>{" "}
                    <span className="min-w-0 flex-1 text-[14px] font-semibold">{servico.descricao}</span>
                    {doServico.length > 0 && (
                      <span className="selo selo-info">{doServico.length} {doServico.length === 1 ? "item" : "itens"} · {reais(subtotal)}</span>
                    )}
                  </CollapsibleTrigger>
                  <CollapsiblePanel>
                    <div className="flex flex-col gap-2 p-3">
                      {doServico.length === 0 && <p className="text-[13px] text-muted-foreground">Nenhum item neste serviço.</p>}
                      <ul className="flex flex-col gap-2">
                        {doServico.map((linha, i) => (
                          <LinhaItem
                            key={linha.id}
                            linha={linha}
                            numero={i + 1}
                            servico={servico.referencia}
                            desabilitado={somenteLeitura}
                            editar={(campo, valor) => mudar((ls) => ls.map((l) => (l.id === linha.id ? { ...l, [campo]: valor } : l)))}
                            remover={() => mudar((ls) => ls.filter((l) => l.id !== linha.id))}
                            duplicar={() => mudar((ls) => ls.flatMap((l) => (l.id === linha.id ? [l, { ...l, id: novoId() }] : [l])))}
                          />
                        ))}
                      </ul>
                      {!somenteLeitura && (
                        <div className="flex flex-wrap gap-2">
                          <Button className="botao botao-pequeno" onClick={() => mudar((ls) => [...ls, novaLinha(servico)])} aria-label={`Adicionar item em ${servico.referencia}`}>
                            Adicionar item
                          </Button>
                          <RepetirPorPavimento
                            servico={servico}
                            aoGerar={(nomes, base) => mudar((ls) => [...ls, ...nomes.map((descricao) => novaLinha(servico, { ...base, descricao }))])}
                          />
                        </div>
                      )}
                    </div>
                  </CollapsiblePanel>
                </Collapsible>
              );
            })}
          </div>
        ))}
      </section>

      <div className="painel sticky bottom-3 z-10 flex flex-row flex-wrap items-center gap-3 shadow-lg">
        <p className="text-[14px]">
          <strong className="tabular-nums">{linhas.length}</strong> {linhas.length === 1 ? "item" : "itens"} · <strong className="tabular-nums">{reais(total)}</strong>
        </p>
        {estado.erro && <p role="alert" className="text-[13px] text-bad">{estado.erro}</p>}
        {estado.ok && !alterado && <p role="status" className="text-[13px] text-ok">{estado.ok}</p>}
        {alterado && !estado.erro && <p className="text-[13px] text-muted-foreground">Alterações não salvas</p>}
        {semCabecalho && linhas.length > 0 && <p className="text-[13px] text-muted-foreground">Falta a unidade construtiva ou a conta financeira.</p>}
        <div className="ml-auto flex flex-wrap gap-2">
          {!somenteLeitura && (
            <Button className="botao" onClick={() => void gravar()} disabled={salvando || !alterado}>{salvando ? "Salvando…" : "Salvar"}</Button>
          )}
          <Button className="botao botao-primario" onClick={() => void baixar()} disabled={salvando || linhas.length === 0}>
            {alterado && !somenteLeitura ? "Salvar e baixar CSV" : "Baixar CSV do Sienge"}
          </Button>
        </div>
      </div>
    </div>
  );
}
