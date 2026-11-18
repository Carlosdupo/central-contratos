"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@ui-sdk/react/dialog";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@ui-sdk/react/menu";
import { CampoSelecao, CampoTexto, Formulario, GrupoOpcoes, Marcador } from "@/components/app/formulario";
import { CampoReais } from "@/components/app/campos-mascara";
import { JanelaLateral } from "@/components/app/janela-lateral";
import { COLUNAS_MOVIVEIS, COLUNAS_NEGOCIACAO, DIAS_LEMBRETE_CONTRATO, estaParado } from "@/lib/negociacoes";
import { criarItemNegociacao, excluirItemNegociacao, moverItemNegociacao, salvarItemNegociacao } from "@/modules/negociacoes/acoes";
import type { ItemNegociacao } from "@/modules/negociacoes/consultas";

type Obra = { id: string; nome: string };

const reais = (v: number | null) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }));
const haDias = (d: number) => (d === 0 ? "hoje" : `há ${d} ${d === 1 ? "dia" : "dias"}`);

export function QuadroNegociacoes({ itens, obrasDoFiltro, obrasQueEdita }: { itens: ItemNegociacao[]; obrasDoFiltro: Obra[]; obrasQueEdita: Obra[] }) {
  const [obra, setObra] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [editando, setEditando] = useState<ItemNegociacao | null>(null);
  const [excluindo, setExcluindo] = useState<ItemNegociacao | null>(null);
  const [, iniciar] = useTransition();

  const visiveis = itens.filter((i) => !obra || i.obraId === obra);
  const faltaContrato = visiveis.filter((i) => i.coluna === "falta_contrato");
  const parados = faltaContrato.filter((i) => estaParado(i.coluna, i.dias)).length;

  const agir = (item: ItemNegociacao, valor: string) => {
    if (valor === "editar") return setEditando(item);
    if (valor === "excluir") return setExcluindo(item);
    const coluna = valor.replace(/^mover:/, "");
    iniciar(async () => {
      const r = await moverItemNegociacao(item.id, coluna);
      setAviso(r.erro ?? `"${item.titulo}" foi para ${COLUNAS_NEGOCIACAO.find((c) => c.id === coluna)?.nome}.`);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <CampoSelecao
          nome="filtro_obra"
          rotulo="Filtrar por obra"
          placeholder="Todas as obras"
          valor={obra}
          aoMudar={setObra}
          opcoes={[{ value: "", label: "Todas as obras" }, ...obrasDoFiltro.map((o) => ({ value: o.id, label: o.nome }))]}
          className="min-w-[220px]"
        />
        {obrasQueEdita.length > 0 && (
          <JanelaLateral textoBotao="Novo item" titulo="Novo item para negociar" descricao="Anote o que a obra precisa negociar. Quando virar contratação, abra pelo próprio cartão.">
            <Formulario acao={criarItemNegociacao} textoBotao="Adicionar ao quadro">
              <CampoSelecao nome="obra" rotulo="Obra do item" placeholder="Escolha a obra" padrao={obrasQueEdita.length === 1 ? obrasQueEdita[0].id : null} opcoes={obrasQueEdita.map((o) => ({ value: o.id, label: o.nome }))} />
              <CamposItem />
            </Formulario>
          </JanelaLateral>
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-[13px] text-muted-foreground" aria-label="Resumo do quadro">
        <span className="rounded-full border border-sep bg-card px-3 py-1"><strong className="text-foreground tabular-nums">{visiveis.filter((i) => i.coluna !== "contratacao_aberta").length}</strong> itens em aberto</span>
        <span className="rounded-full border border-sep bg-card px-3 py-1">
          <strong className="text-foreground tabular-nums">{faltaContrato.length}</strong> negociados sem contrato
          {parados > 0 && <> · <strong className="text-hot tabular-nums">{parados}</strong> há mais de {DIAS_LEMBRETE_CONTRATO} dias</>}
        </span>
        <span className="rounded-full border border-sep bg-card px-3 py-1">Negociado sem contrato: <strong className="text-foreground tabular-nums">{reais(faltaContrato.reduce((s, i) => s + (i.valorNegociado ?? 0), 0))}</strong></span>
      </div>
      <p role="status" className="min-h-5 text-[13px]">{aviso}</p>

      <div className="grid grid-cols-[repeat(4,minmax(260px,1fr))] items-start gap-3.5 overflow-x-auto pb-1.5">
        {COLUNAS_NEGOCIACAO.map((c) => {
          const lista = visiveis.filter((i) => i.coluna === c.id);
          return (
            <section key={c.id} aria-label={c.nome} data-coluna={c.id} className="flex min-w-0 flex-col gap-2.5 rounded-[14px] bg-fill p-3">
              <h2 className={`flex items-center justify-between gap-2 text-[14px] font-semibold ${c.id === "falta_contrato" ? "text-hot" : ""}`}>
                {c.nome}
                <span className="rounded-full bg-card px-2.5 py-0.5 text-[12px] text-muted-foreground tabular-nums">{lista.length}</span>
              </h2>
              <p className="-mt-1 text-[12px] text-muted-foreground">{c.dica}</p>
              {lista.length === 0 ? (
                <p className="rounded-[10px] border border-dashed border-sep-strong p-3.5 text-center text-[12.5px] text-muted-foreground">Nada aqui.</p>
              ) : (
                lista.map((i) => <Cartao key={i.id} item={i} agir={agir} />)
              )}
            </section>
          );
        })}
      </div>

      <Dialog open={!!editando} onOpenChange={(aberto) => { if (!aberto) setEditando(null); }}>
        <DialogBackdrop />
        <DialogContent className="janela-confirmacao max-h-[90vh] overflow-y-auto">
          <DialogTitle className="subtitulo">Editar item</DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">{editando?.obra}</DialogDescription>
          {editando && (
            <Formulario key={editando.id} acao={salvarItemNegociacao.bind(null, editando.id)} textoBotao="Salvar item">
              <CamposItem item={editando} />
            </Formulario>
          )}
          <div className="flex justify-end">
            <DialogClose className="botao">Fechar</DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!excluindo} onOpenChange={(aberto) => { if (!aberto) setExcluindo(null); }}>
        <DialogBackdrop />
        <DialogContent className="janela-confirmacao">
          <DialogTitle className="subtitulo">Excluir item?</DialogTitle>
          <DialogDescription className="text-[14px] text-muted-foreground">&ldquo;{excluindo?.titulo}&rdquo; sai do quadro. Não dá para desfazer.</DialogDescription>
          {excluindo && (
            <Formulario key={excluindo.id} acao={async () => { const r = await excluirItemNegociacao(excluindo.id); if (!r.erro) { setExcluindo(null); setAviso(r.ok ?? ""); } return r; }} textoBotao="Excluir item" variante="perigo" sensivel="Exclui o item do quadro de negociações. Não dá para desfazer." />
          )}
          <div className="flex justify-end">
            <DialogClose className="botao">Voltar</DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Cartao({ item: i, agir }: { item: ItemNegociacao; agir: (item: ItemNegociacao, valor: string) => void }) {
  const parado = estaParado(i.coluna, i.dias);
  const aberta = i.coluna === "contratacao_aberta";
  return (
    <article aria-label={i.titulo} data-parado={parado || undefined} className="flex flex-col gap-2 rounded-xl border border-sep bg-card p-3 data-[parado]:border-hot">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`selo ${i.tipo === "aditivo" ? "selo-info" : "selo-ok"}`}>{i.tipo === "aditivo" ? "Aditivo" : "Nova contratação"}</span>
        <span className="rounded-full bg-fill px-2 py-0.5 text-[11.5px] font-semibold text-muted-foreground">{i.obra}</span>
        {i.foraDaMatriz && <span className="selo selo-alerta">Não consta na matriz</span>}
        {parado && <span className="selo selo-urgente">Sem contrato há {i.dias} dias</span>}
      </div>
      <h3 className="text-[14.5px] leading-snug font-semibold">{i.titulo}</h3>
      <p className={`text-[13px] ${i.empresa ? "" : "text-muted-foreground italic"}`}>{i.empresa ?? "Empresa a definir"}</p>
      {i.atividades && <p className="text-[12.5px] text-muted-foreground">{i.atividades}</p>}
      <dl className="grid grid-cols-2 gap-x-2.5 gap-y-1 text-[12px] text-muted-foreground">
        <div><dt>Estimado</dt><dd className="text-[13.5px] font-semibold text-foreground tabular-nums">{reais(i.valorEstimado)}</dd></div>
        <div><dt>Negociado</dt><dd className="text-[13.5px] font-semibold text-foreground tabular-nums">{reais(i.valorNegociado)}</dd></div>
      </dl>
      {i.observacao && <p className="rounded-lg bg-fill px-2 py-1.5 text-[12.5px]">{i.observacao}</p>}
      {i.podeEditar && i.coluna === "falta_contrato" && (
        <Link href={`/contratacoes/nova?negociacao=${i.id}`} className="botao botao-primario botao-pequeno min-h-8">
          {i.tipo === "aditivo" ? "Abrir aditivo" : "Abrir contratação"}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sep pt-2 text-[11.5px] text-muted-foreground">
        <span>{i.autor} · {haDias(i.dias)}</span>
        {aberta && i.contratacao ? (
          <Link href={`/contratacoes/${i.contratacao.id}`} className="font-mono text-[12.5px] font-bold text-primary">{i.contratacao.codigo}</Link>
        ) : i.podeEditar ? (
          <Menu onAction={(valor) => agir(i, String(valor))}>
            <MenuTrigger className="botao botao-pequeno min-h-8" aria-label={`Ações do item ${i.titulo}`}>
              Mover ou editar <span aria-hidden="true">⋯</span>
            </MenuTrigger>
            <MenuContent className="menu-acoes">
              {COLUNAS_MOVIVEIS.filter((c) => c.id !== i.coluna).map((c) => (
                <MenuItem key={c.id} value={`mover:${c.id}`}>Mover para {c.nome}</MenuItem>
              ))}
              <MenuSeparator />
              <MenuItem value="editar">Editar item</MenuItem>
              <MenuItem value="excluir" className="item-menu-perigo">Excluir item</MenuItem>
            </MenuContent>
          </Menu>
        ) : null}
      </div>
    </article>
  );
}

function CamposItem({ item }: { item?: ItemNegociacao }) {
  return (
    <>
      <CampoTexto nome="titulo" rotulo="O que negociar" padrao={item?.titulo} placeholder="Ex.: Pintura externa torre B" />
      <GrupoOpcoes
        nome="coluna"
        rotulo="Situação"
        padrao={item && item.coluna !== "contratacao_aberta" ? item.coluna : "a_negociar"}
        opcoes={COLUNAS_MOVIVEIS.map((c) => ({ value: c.id, label: c.nome }))}
        estilo="pilula"
      />
      <GrupoOpcoes
        nome="tipo"
        rotulo="Vai virar"
        padrao={item?.tipo ?? "nova"}
        opcoes={[{ value: "nova", label: "Nova contratação" }, { value: "aditivo", label: "Aditivo" }]}
        estilo="pilula"
      />
      <CampoTexto nome="atividades" rotulo="Atividades" padrao={item?.atividades} dica="Ex.: 21.1 Elétrica, ou a atividade que não consta na matriz." />
      <Marcador nome="fora_da_matriz" rotulo="Não consta na matriz" marcado={item?.foraDaMatriz} className="flex cursor-pointer items-center gap-2 text-[13px]" />
      <CampoTexto nome="empresa" rotulo="Empresa (se já tiver)" padrao={item?.empresa} />
      <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
        <CampoReais nome="valor_estimado" rotulo="Valor estimado (R$)" padrao={item?.valorEstimado} />
        <CampoReais nome="valor_negociado" rotulo="Valor negociado (R$)" padrao={item?.valorNegociado} />
      </div>
      <CampoTexto nome="observacao" rotulo="Observação" padrao={item?.observacao} placeholder="Ex.: Empresa pediu 30 dias para começar" />
    </>
  );
}
