"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@ui-sdk/react/button";
import { Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerTitle } from "@ui-sdk/react/drawer";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { SeloUrgente } from "@/components/app/selo-urgente";
import { formatarData } from "@/lib/datas";
import {
  SITUACOES, blocosDaTrilha, contagemPorArea, descricaoDaTrilha, estadoDoSegmento, filtrar, passoPrincipal, passosAtuais, pesoNaLista, posicaoDoPasso, resumo, textoDoPrazo,
  type Area, type ContratacaoPanorama, type FiltroSituacao, type PassoPanorama,
} from "@/lib/panorama";
import { formatarReais } from "@/modules/contratacoes/rotulos";

const dia = (d: string) => formatarData(d).slice(0, 5);

function SeloDoPrazo({ c }: { c: ContratacaoPanorama }) {
  if (c.situacao === "liberada") return <span className="selo selo-ok">Liberada</span>;
  if (c.situacao === "cancelada") return <span className="selo selo-neutro">Cancelada</span>;
  const p = passoPrincipal(c);
  if (!p?.prazo || p.prazo.tipo === "sem_prazo") return null;
  const classe = p.prazo.tipo === "atrasada" ? "selo-erro" : p.prazo.tipo === "no_prazo" ? "selo-neutro" : "selo-alerta";
  return <span className={`selo ${classe}`}>{textoDoPrazo(p.prazo)}</span>;
}

function Trilha({ c }: { c: ContratacaoPanorama }) {
  return (
    <span className="pan-trilha" role="img" aria-label={descricaoDaTrilha(c)}>
      {blocosDaTrilha(c).map((b) => (
        <span key={b.bloco} className="pan-bloco" style={{ "--n": b.segmentos.length } as React.CSSProperties}>
          {b.segmentos.map((s) => <i key={s.passo.etapa} className="pan-seg" data-estado={s.estado} />)}
        </span>
      ))}
    </span>
  );
}

function Linha({ c, aoAbrir }: { c: ContratacaoPanorama; aoAbrir: (id: string) => void }) {
  const principal = passoPrincipal(c);
  const onde = c.situacao === "liberada" ? "Equipe liberada para a obra" : c.situacao === "cancelada" ? (c.motivoCancelamento ?? "Cancelada") : principal ? `Etapa ${posicaoDoPasso(c, principal)} de ${c.passos.length} · ${principal.nome}` : "";
  const comQuem = [...new Set(passosAtuais(c).map((p) => p.responsavel))].join(" e ");
  return (
    <Button type="button" className="pan-linha" data-encerrada={c.situacao !== "em_andamento" || undefined} onClick={() => aoAbrir(c.id)}>
      <span className="block min-w-0">
        <span className="block font-semibold">{c.servico}</span>
        <span className="block text-[12.5px] text-muted-foreground"><span className="font-mono">{c.codigo}</span> · aberta em {dia(c.abertaEm)}</span>
        {(c.urgente || c.aditivoDe || c.foraDoPrazo) && (
          <span className="mt-1 flex flex-wrap gap-1.5">
            {c.urgente && <SeloUrgente data={c.urgenteData} />}
            {c.aditivoDe && <span className="selo selo-info">Aditivo de {c.aditivoDe}</span>}
            {c.foraDoPrazo && <span className="selo selo-alerta">Pedido fora do prazo</span>}
          </span>
        )}
      </span>
      <span className="block min-w-0">
        <Trilha c={c} />
        <span className="mt-1 block text-[12.5px] text-muted-foreground">{onde}</span>
      </span>
      <span className="block min-w-0">
        <span className="block font-medium">{c.situacao === "em_andamento" ? `Com ${comQuem || "—"}` : "—"}</span>
        <span className="mt-1 block"><SeloDoPrazo c={c} /></span>
      </span>
      <span className="block min-w-0">
        <span className="block">{c.fornecedor ?? <span className="text-muted-foreground">Fornecedor a definir</span>}</span>
        <span className="block text-[12.5px] text-muted-foreground tabular-nums">{c.valor ? formatarReais(c.valor) : "Sem valor contratado"}{c.sienge ? ` · ${c.sienge}` : ""}</span>
      </span>
      <span className="pan-seta" aria-hidden="true">›</span>
    </Button>
  );
}

const textoDoPasso = (c: ContratacaoPanorama, p: PassoPanorama): string => {
  const e = estadoDoSegmento(c, p);
  if (e === "feito") return p.concluidaEm ? `Concluída em ${dia(p.concluidaEm)}` : "Concluída";
  if (e === "na") return "Não se aplica";
  if (e === "agora" || e === "tarde") return `Em andamento · ${textoDoPrazo(p.prazo)}`;
  return "Ainda não chegou";
};

function Detalhe({ c, aoFechar }: { c: ContratacaoPanorama; aoFechar: () => void }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-sep px-5 py-4">
        <div className="min-w-0">
          <span className="font-mono text-[12.5px] text-muted-foreground">{c.codigo} · {c.obra}</span>
          <DrawerTitle className="subtitulo">{c.servico}</DrawerTitle>
        </div>
        <DrawerClose className="grid size-10 shrink-0 place-items-center rounded-[10px] hover:bg-fill" aria-label="Fechar detalhe" onClick={aoFechar}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </DrawerClose>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
        {c.urgente && <p className="rounded-xl bg-[var(--hot-soft)] px-3.5 py-2.5 text-[13px]"><strong>Urgente: a obra precisa em {c.urgenteData ? formatarData(c.urgenteData) : "—"}.</strong> {c.urgenteMotivo}</p>}
        {c.devolucao && <p className="rounded-xl bg-[var(--warn-soft)] px-3.5 py-2.5 text-[13px]"><strong>Etapa devolvida para ajuste.</strong> {c.devolucao}</p>}
        {c.foraDoPrazo && <p className="rounded-xl bg-[var(--warn-soft)] px-3.5 py-2.5 text-[13px]"><strong>Pedido fora do prazo.</strong> A obra solicitou depois da data que a planilha previa.</p>}
        {c.empresaJaLiberada && <p className="rounded-xl bg-fill px-3.5 py-2.5 text-[13px]">Empresa já liberada na obra: documentação, integração e liberação não se aplicam.</p>}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13.5px]">
          <div><dt className="text-xs text-muted-foreground">Com quem está</dt><dd>{c.situacao === "em_andamento" ? ([...new Set(passosAtuais(c).map((p) => p.responsavel))].join(" e ") || "—") : "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Prazo da etapa</dt><dd>{c.situacao === "em_andamento" ? textoDoPrazo(passoPrincipal(c)?.prazo ?? null) : "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Fornecedor</dt><dd>{c.fornecedor ?? "A definir"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Valor contratado</dt><dd className="tabular-nums">{c.valor ? formatarReais(c.valor) : "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Contrato no Sienge</dt><dd className="font-mono">{c.sienge ?? "Ainda não lançado"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{c.aditivoDe ? "Contrato original" : "Aberta em"}</dt><dd className={c.aditivoDe ? "font-mono" : undefined}>{c.aditivoDe ?? formatarData(c.abertaEm)}</dd></div>
        </dl>
        <section aria-label="Etapas">
          <h3 className="mb-1 text-[14px] font-semibold">Etapas</h3>
          <ol className="flex flex-col">
            {c.passos.map((p, i) => (
              <li key={p.etapa} data-estado={estadoDoSegmento(c, p)} className="pan-passo">
                <span className="pan-bola" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block font-medium">{i + 1}. {p.nome}</span>
                  <span className="block text-[12.5px] text-muted-foreground">{p.responsavel}</span>
                </span>
                <span className="text-right text-[12.5px] text-muted-foreground">{textoDoPasso(c, p)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <div className="flex justify-end gap-2 border-t border-sep px-5 py-4">
        <Link href={`/contratacoes/${c.id}`} className="botao botao-primario">Abrir contratação</Link>
      </div>
    </>
  );
}

// Panorama das obras: resumo, com quem estão as contratações, filtros e uma linha compacta por contratação (sem rolagem lateral).
export function Panorama({ contratacoes }: { contratacoes: ContratacaoPanorama[] }) {
  const [obra, setObra] = useState<string | null>(null);
  const [situacao, setSituacao] = useState<FiltroSituacao>("todas");
  const [area, setArea] = useState<Area | null>(null);
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);

  const obras = useMemo(() => [...new Map(contratacoes.map((c) => [c.obraId, c.obra])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")), [contratacoes]);
  const daObra = useMemo(() => contratacoes.filter((c) => !obra || c.obraId === obra), [contratacoes, obra]);
  const r = resumo(daObra);
  const areas = contagemPorArea(daObra);
  const visiveis = useMemo(() => filtrar(contratacoes, { obra, situacao, area, busca }), [contratacoes, obra, situacao, area, busca]);
  const selecionada = contratacoes.find((c) => c.id === aberta) ?? null;

  const numero = (n: number, rotulo: string, extra: string, tom?: string) => (
    <div key={rotulo}>
      <strong className={`tabular-nums ${n === 0 ? "text-faint" : tom ?? ""}`}>{n}</strong>
      <span className="text-[13px] font-medium">{rotulo}</span>
      {extra && <small className="text-xs text-muted-foreground">{extra}</small>}
    </div>
  );

  return (
    <>
      <section aria-label="Resumo" className="pan-resumo">
        {numero(r.emAndamento, "Em andamento", `em ${r.obrasEmAndamento} ${r.obrasEmAndamento === 1 ? "obra" : "obras"}`)}
        {numero(r.comAtraso, "Com atraso", r.comAtraso ? "precisam de ação" : "", "text-bad")}
        {numero(r.urgentes, "Urgentes", "pedidos pela obra", "text-hot")}
        {numero(r.vencemHoje, "Vencem hoje", r.vencemHoje ? "prazo termina hoje" : "")}
        {numero(r.liberadas, "Liberadas", "equipe na obra", "text-ok")}
      </section>

      <section aria-labelledby="pan-areas" className="painel">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="pan-areas" className="subtitulo">Com quem estão as contratações em andamento</h2>
          <span className="text-[12.5px] text-muted-foreground">Escolha uma área para filtrar a lista</span>
        </div>
        <div className="pan-areas">
          {areas.map((a) => (
            <Button key={a.area} type="button" className="pan-area" aria-pressed={area === a.area} data-vazia={a.total === 0 || undefined} onClick={() => setArea(area === a.area ? null : a.area)}>
              <span className="text-[22px] leading-none font-bold tabular-nums">{a.total}</span>
              <span className="text-[13px] font-medium">{a.area}</span>
              <span className="text-xs text-bad">{a.atrasadas ? `${a.atrasadas} com atraso` : " "}</span>
            </Button>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-end gap-3">
        <div role="group" aria-label="Filtrar por obra" className="pan-filtro">
          {[[null, "Todas as obras"] as const, ...obras.map(([id, nome]) => [id, nome] as const)].map(([id, nome]) => (
            <Button key={id ?? "todas"} type="button" aria-pressed={obra === id} onClick={() => { setObra(id); setArea(null); }}>{nome}</Button>
          ))}
        </div>
        <div role="group" aria-label="Filtrar por situação" className="pan-filtro">
          {SITUACOES.map((s) => (
            <Button key={s.chave} type="button" aria-pressed={situacao === s.chave} onClick={() => setSituacao(s.chave)}>
              {s.rotulo} <span className="tabular-nums text-muted-foreground">{daObra.filter(s.testa).length}</span>
            </Button>
          ))}
        </div>
        <Field className="flex min-w-[220px] flex-1 flex-col">
          <FieldLabel className="sr-only">Buscar contratação</FieldLabel>
          <Input className="campo" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar serviço, fornecedor ou código" autoComplete="off" />
        </Field>
      </div>

      <ul aria-label="Legenda da trilha de etapas" className="pan-legenda">
        {([["feito", "Etapa concluída"], ["agora", "Etapa atual"], ["tarde", "Etapa atual com atraso"], ["pendente", "Ainda não chegou"], ["na", "Não se aplica"]] as const).map(([estado, texto]) => (
          <li key={estado}><i className="pan-seg" data-estado={estado} />{texto}</li>
        ))}
      </ul>

      <div className="flex flex-col gap-4" aria-live="polite">
        {visiveis.length === 0 ? (
          <p className="painel text-[14px] text-muted-foreground">Nenhuma contratação neste filtro. Escolha outra obra, situação ou área.</p>
        ) : (
          obras.filter(([id]) => visiveis.some((c) => c.obraId === id)).map(([id, nome]) => {
            const itens = visiveis.filter((c) => c.obraId === id).sort((a, b) => pesoNaLista(a) - pesoNaLista(b));
            const tarde = itens.filter((c) => passosAtuais(c).some((p) => p.prazo?.tipo === "atrasada")).length;
            return (
              <section key={id} aria-label={`Obra ${nome}`} className="pan-obra">
                <header>
                  <h2 className="subtitulo">{nome}</h2>
                  <span className="text-[13px] text-muted-foreground">
                    {itens.length} {itens.length === 1 ? "contratação" : "contratações"}
                    {tarde > 0 && <span className="text-bad"> · {tarde} com atraso</span>}
                  </span>
                  {itens[0].prefixoSienge && <span className="font-mono text-xs text-muted-foreground">Sienge {itens[0].prefixoSienge}</span>}
                </header>
                {itens.map((c) => <Linha key={c.id} c={c} aoAbrir={setAberta} />)}
              </section>
            );
          })
        )}
      </div>

      <Drawer side="right" open={!!selecionada} onOpenChange={(aberto) => { if (!aberto) setAberta(null); }}>
        <DrawerBackdrop />
        <DrawerContent>{selecionada && <Detalhe c={selecionada} aoFechar={() => setAberta(null)} />}</DrawerContent>
      </Drawer>
    </>
  );
}
